/**
 * Parivaar performance benchmark.
 *
 * Runs the REAL API handler (validation -> RPC -> replica -> store) against an
 * in-process mock of the Supabase endpoints used by this project, with
 * injectable network latency, so every number below is produced by the code in
 * `server/`, not by a simulation of it.
 *
 * Usage:
 *   node scripts/bench-parivaar.mjs --registrations=200 --latency=40 --iterations=10
 *   node scripts/bench-parivaar.mjs --no-device-b      (skip the second-device test)
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createMockSupabase } from "./mock-postgrest.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : fallback;
};
const REGISTRATIONS = Number(argValue("registrations", 200));
const LATENCY = Number(argValue("latency", 40));
const ITERATIONS = Number(argValue("iterations", 10));
const WITH_DEVICE_B = !args.includes("--no-device-b");
const PARALLEL = Number(argValue("parallel", 5));

const workDir = mkdtempSync(path.join(tmpdir(), "parivaar-bench-"));
const dbPath = path.join(workDir, "parivaar.sqlite");

const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
};
const round = (n) => Math.round(n * 10) / 10;

function makeFixture(index, village = "94494", district = "94", subdistrict = "6033") {
  const seq = String(index + 1).padStart(3, "0");
  return {
    id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    family_id: `${village}-${seq}`,
    full_name: `Bench Family ${seq}`,
    father_name: `Bench Father ${seq}`,
    member_count: (index % 5) + 1,
    state_code: "8",
    district_code: district,
    subdistrict_code: subdistrict,
    village_code: village,
    thikana: "Chhapawda",
    thikana_same_as_village: true,
    current_address: "Rajasthan, India",
    phone_number: `9${String(index % 1000000000).padStart(9, "0")}`,
    public_visibility: "default",
    status: "approved",
    admin_note: null,
    created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, index % 60)).toISOString(),
    updated_at: new Date(Date.UTC(2026, 0, 1, 0, 0, index % 60)).toISOString(),
  };
}

function seedMock(mock, count) {
  const fixtures = Array.from({ length: count }, (_, i) => makeFixture(i));
  mock.seedRegistrations(fixtures);
  mock.kv.set("parivaar_rev_v1", {
    key: "parivaar_rev_v1",
    value: JSON.stringify({
      rev: `seed-${Date.now().toString(36)}`,
      updated_at: new Date().toISOString(),
      counts: { registrations: fixtures.length },
    }),
  });
  mock.kv.set("parivaar_store_v2", {
    key: "parivaar_store_v2",
    value: JSON.stringify({ migrated_at: new Date().toISOString(), count: fixtures.length }),
  });
  return fixtures;
}

function toRegisterPayload(fixture, idempotencyKey) {
  const payload = { ...fixture, idempotency_key: idempotencyKey };
  delete payload.id;
  delete payload.family_id;
  delete payload.thikana; // thikana_same_as_village → server uses the LGD village
  delete payload.status;
  delete payload.created_at;
  delete payload.updated_at;
  delete payload.admin_note;
  delete payload.public_visibility;
  return payload;
}

function callHandler(handler, method, url, body) {
  return new Promise((resolve) => {
    const started = performance.now();
    const req = { method, url, headers: {}, on() {}, body };
    const res = {
      statusCode: 0,
      headers: {},
      setHeader(key, value) {
        this.headers[key.toLowerCase()] = value;
      },
      end(payload) {
        resolve({
          status: this.statusCode,
          headers: this.headers,
          body: String(payload ?? ""),
          ms: performance.now() - started,
        });
      },
    };
    handler(req, res).catch((err) =>
      resolve({ status: 0, headers: {}, body: JSON.stringify({ error: err?.message }), ms: performance.now() - started })
    );
  });
}

async function measure(handler, label, url, { iterations = ITERATIONS, method = "GET", body } = {}) {
  const samples = [];
  let status = 0;
  let bytes = 0;
  for (let i = 0; i < iterations; i += 1) {
    const out = await callHandler(handler, method, url, body);
    status = out.status;
    bytes = out.body.length;
    samples.push(out.ms);
  }
  return {
    label,
    p50: round(percentile(samples, 50)),
    p95: round(percentile(samples, 95)),
    max: round(Math.max(...samples)),
    status,
    bytes,
  };
}

async function main() {
  const mock = createMockSupabase({ latencyMs: LATENCY });
  const fixtures = seedMock(mock, REGISTRATIONS);
  const baseUrl = await mock.listen();

  process.env.VITE_SUPABASE_URL = baseUrl;
  process.env.SUPABASE_URL = "";
  process.env.VITE_SUPABASE_ANON_KEY = "bench-anon-key";
  process.env.PARIVAAR_SQLITE_PATH = dbPath;
  process.env.PARIVAAR_REGISTRATION_KEY = "bench-secret-key";

  const { handleParivaarApiRequest } = await import("../server/parivaarApiHandler.mjs");
  const handler = handleParivaarApiRequest;

  console.log(
    `\nparivaar bench · ${REGISTRATIONS} registrations · simulated DB latency ${LATENCY} ms/request · ${ITERATIONS} iterations`
  );

  // --- cold start ---------------------------------------------------------
  mock.resetMetrics();
  const coldStart = performance.now();
  await callHandler(handler, "GET", "/api/parivaar?action=states");
  const coldLgd = performance.now() - coldStart;
  const firstReadStart = performance.now();
  const firstSummary = await callHandler(handler, "GET", "/api/parivaar?action=summary");
  const firstRead = performance.now() - firstReadStart;
  const coldRequests = mock.metrics.requests;
  console.log(
    `cold start: LGD ready ${round(coldLgd)} ms · first summary ${round(firstRead)} ms · ${coldRequests} DB requests`
  );
  if (firstSummary.status !== 200) console.log("  first summary payload:", firstSummary.body.slice(0, 200));

  // --- steady-state read endpoints ---------------------------------------
  const endpoints = [
    ["summary", "/api/parivaar?action=summary"],
    ["revision", "/api/parivaar?action=revision"],
    ["directory(villages)", "/api/parivaar?action=directory&level=villages&state_code=8&district_code=94&subdistrict_code=6033&village_code=94494"],
    ["map-aggregates", "/api/parivaar?action=map-aggregates"],
    ["public-families(village)", "/api/parivaar?action=public-families&state_code=8&district_code=94&subdistrict_code=6033&village_code=94494"],
    ["villages(LGD page)", "/api/parivaar?action=villages&district_code=94&subdistrict_code=6033&limit=50"],
  ];

  const readResults = [];
  for (const [label, url] of endpoints) {
    mock.resetMetrics();
    const result = await measure(handler, label, url);
    result.dbRequestsPerCall = round(mock.metrics.requests / ITERATIONS);
    readResults.push(result);
  }

  console.log("\nread endpoints (ms)");
  for (const r of readResults) {
    console.log(
      `  ${r.label.padEnd(24)} p50 ${String(r.p50).padStart(8)}  p95 ${String(r.p95).padStart(8)}  max ${String(r.max).padStart(8)}  db-req/call ${String(r.dbRequestsPerCall).padStart(4)}  http ${r.status}`
    );
  }

  // --- idle browser poll (every 7 s in production) -------------------------
  await new Promise((resolve) => setTimeout(resolve, 1700));
  mock.resetMetrics();
  const pollStart = performance.now();
  const pollOut = await callHandler(handler, "GET", "/api/parivaar?action=summary");
  const pollMs = round(performance.now() - pollStart);
  console.log(
    `\nidle poll (after the 1.5 s revision cache expires): ${pollMs} ms · ${mock.metrics.requests} DB request(s) · http ${pollOut.status}`
  );

  // --- registration -------------------------------------------------------
  const registrationSamples = [];
  const perRegistrationDbRequests = [];
  const registrationStatuses = new Set();
  for (let i = 0; i < Math.min(5, ITERATIONS); i += 1) {
    const payload = toRegisterPayload(
      makeFixture(REGISTRATIONS + i, "94495", "94", "6033"),
      `bench-${i}-${Date.now()}`
    );
    mock.resetMetrics();
    const out = await callHandler(
      handler,
      "POST",
      "/api/parivaar?action=register",
      JSON.stringify(payload)
    );
    registrationSamples.push(out.ms);
    perRegistrationDbRequests.push(mock.metrics.requests);
    registrationStatuses.add(out.status);
  }
  const regP50 = round(percentile(registrationSamples, 50));
  const regP95 = round(percentile(registrationSamples, 95));
  const avgDbRequests = round(
    perRegistrationDbRequests.reduce((a, b) => a + b, 0) / perRegistrationDbRequests.length
  );

  // concurrent registrations
  const concurrentPayloads = Array.from({ length: PARALLEL }, (_, i) =>
    toRegisterPayload(
      makeFixture(REGISTRATIONS + 100 + i, "94496", "94", "6033"),
      `bench-concurrent-${i}-${Date.now()}`
    )
  );
  const concurrentStart = performance.now();
  const concurrentOut = await Promise.all(
    concurrentPayloads.map((payload) =>
      callHandler(handler, "POST", "/api/parivaar?action=register", JSON.stringify(payload))
    )
  );
  const concurrentWall = round(performance.now() - concurrentStart);
  const concurrentOk = concurrentOut.filter((r) => r.status === 200 || r.status === 201).length;
  for (const out of concurrentOut) registrationStatuses.add(out.status);

  console.log("\nregistration (ms)");
  console.log(`  sequential p50 ${regP50} · p95 ${regP95} · ${avgDbRequests} DB requests per registration`);
  console.log(`  ${PARALLEL} concurrent wall ${concurrentWall} ms · ${concurrentOk}/${PARALLEL} succeeded · http ${[...registrationStatuses].join("/")}`);

  // --- duplicate / idempotent replay --------------------------------------
  const idemKey = `bench-idem-${Date.now()}`;
  const idemPayload = toRegisterPayload(
    makeFixture(REGISTRATIONS + 7, "94497", "94", "6033"),
    idemKey
  );
  const first = await callHandler(handler, "POST", "/api/parivaar?action=register", JSON.stringify(idemPayload));
  const replay = await callHandler(handler, "POST", "/api/parivaar?action=register", JSON.stringify(idemPayload));
  const parse = (r) => {
    try {
      return JSON.parse(r.body);
    } catch {
      return {};
    }
  };
  const firstBody = parse(first);
  const replayBody = parse(replay);
  console.log(
    `\nidempotency: first ${first.status} (${firstBody.family_id || firstBody.code || "?"}) · replay ${replay.status} (${
      replayBody.family_id || replayBody.code || "?"
    }) · same family: ${String(firstBody.family_id) === String(replayBody.family_id)}`
  );

  // --- second device visibility ------------------------------------------
  if (WITH_DEVICE_B) {
    const target = firstBody.family_id;
    if (target) {
      const deviceDir = mkdtempSync(path.join(tmpdir(), "parivaar-device-b-"));
      const started = performance.now();
      const visibleAfter = await new Promise((resolve) => {
        const child = spawn(
          process.execPath,
          [path.join(ROOT, "scripts/bench-device.mjs"), baseUrl, String(target), path.join(deviceDir, "b.sqlite")],
          { env: { ...process.env, SUPABASE_URL: "" }, stdio: ["ignore", "pipe", "pipe"] }
        );
        let stdout = "";
        child.stdout.on("data", (chunk) => {
          stdout += chunk;
        });
        child.stderr.on("data", () => {});
        child.on("close", () => {
          const match = stdout.match(/VISIBLE_AFTER_MS=(\d+)/);
          resolve(match ? Number(match[1]) : null);
        });
        setTimeout(() => child.kill("SIGKILL"), 30000);
      });
      rmSync(deviceDir, { recursive: true, force: true });
      console.log(
        `\nsecond device: family ${target} visible after ${visibleAfter ?? "never"} ms (total ${round(performance.now() - started)} ms incl. cold start)`
      );
    }
  }

  // --- failure behaviour --------------------------------------------------
  mock.close();
  await new Promise((resolve) => setTimeout(resolve, 50));
  const outageSummary = await callHandler(handler, "GET", "/api/parivaar?action=summary");
  const outageRegister = await callHandler(
    handler,
    "POST",
    "/api/parivaar?action=register",
    JSON.stringify(
      toRegisterPayload(
        makeFixture(REGISTRATIONS + 55, "94498", "94", "6033"),
        `bench-outage-${Date.now()}`
      )
    )
  );
  const outageSummaryBody = parse(outageSummary);
  const outageRegisterBody = parse(outageRegister);
  console.log(
    `\ndatabase outage: summary ${outageSummary.status} claims ${outageSummaryBody?.stats?.total_registrations ?? "?"} registrations · ` +
      `register ${outageRegister.status} (${outageRegisterBody.code || "ok"}) · reported success while the database was down: ${
        outageRegister.status === 200 || outageRegister.status === 201
      }`
  );

  rmSync(workDir, { recursive: true, force: true });
}

main().catch((err) => {
  console.error("bench failed:", err);
  process.exit(1);
});
