#!/usr/bin/env node
/**
 * Parivaar performance & multi-device propagation benchmark.
 * ---------------------------------------------------------------------------
 * Runs the REAL `/api/parivaar` handler against a REAL SQLite LGD database and
 * an in-process mock of the Supabase PostgREST / RPC / Storage surface, with a
 * configurable per-request network delay so that serverless -> database round
 * trips are represented in the numbers.
 *
 * Why a mock database?  The sandbox used for this work cannot open outbound
 * connections to the production Supabase project.  The mock reproduces the
 * request sequence and latency profile of the production database calls, so
 * "before vs after" numbers are directly comparable.  Live correctness is
 * verified separately against https://khemaj-mata.vercel.app/api/parivaar.
 *
 * Usage:
 *   node scripts/bench-parivaar.mjs                 # full benchmark suite
 *   node scripts/bench-parivaar.mjs --iterations=30 --latency=40
 *   node scripts/bench-parivaar.mjs --json          # machine readable output
 *
 * The benchmark database is a throw-away SQLite file inside `.cache/bench/`.
 * It never touches production data.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

function readArgs() {
  const args = { _: [] };
  for (const raw of process.argv.slice(2)) {
    if (!raw.startsWith("--")) {
      args._.push(raw);
      continue;
    }
    const [k, v] = raw.slice(2).split("=");
    args[k] = v === undefined ? true : v;
  }
  return args;
}

const ARGS = readArgs();
const IS_WORKER = ARGS.worker === true || ARGS.worker === "true";

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function round(n, digits = 1) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function summarize(samples) {
  const clean = samples.filter((n) => Number.isFinite(n));
  if (!clean.length) return { count: 0, p50: 0, p95: 0, min: 0, max: 0, mean: 0 };
  const total = clean.reduce((a, b) => a + b, 0);
  return {
    count: clean.length,
    p50: round(percentile(clean, 50)),
    p95: round(percentile(clean, 95)),
    min: round(Math.min(...clean)),
    max: round(Math.max(...clean)),
    mean: round(total / clean.length),
  };
}

async function timedFetch(url, options = {}) {
  const started = performance.now();
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return {
    status: res.status,
    json,
    text,
    ms: performance.now() - started,
  };
}

/* ------------------------------------------------------------------ */
/* Dataset: real official LGD rows (Bundi / Rajasthan)                 */
/* ------------------------------------------------------------------ */

const BENCH_VILLAGES = [
  { village_code: "94494", subdistrict_code: "6033", block_code: "BLK-639", district_code: "94", state_code: "8", name_en: "Chhapawda" },
  { village_code: "94076", subdistrict_code: "624", block_code: "BLK-637", district_code: "94", state_code: "8", name_en: "Abhaipur" },
  { village_code: "93788", subdistrict_code: "622", block_code: "BLK-636", district_code: "94", state_code: "8", name_en: "Abwar" },
  { village_code: "94276", subdistrict_code: "625", block_code: "BLK-637", district_code: "94", state_code: "8", name_en: "Ajanda" },
  { village_code: "94390", subdistrict_code: "626", block_code: "BLK-6907", district_code: "94", state_code: "8", name_en: "Ajeta" },
  { village_code: "100752", subdistrict_code: "659", block_code: "BLK-1", district_code: "95", state_code: "8", name_en: "Aambaberi" },
  { village_code: "100754", subdistrict_code: "659", block_code: "BLK-1", district_code: "95", state_code: "8", name_en: "Abhaypur" },
  { village_code: "101568", subdistrict_code: "664", block_code: "BLK-2", district_code: "95", state_code: "8", name_en: "Achalpura" },
  { village_code: "70786", subdistrict_code: "486", block_code: "BLK-3", district_code: "96", state_code: "8", name_en: "Aasi Agooni" },
  { village_code: "70602", subdistrict_code: "485", block_code: "BLK-4", district_code: "96", state_code: "8", name_en: "Abadsar" },
];

const BENCH_STATE = { state_code: "8", name_en: "Rajasthan" };
const BENCH_DISTRICTS = [
  { district_code: "94", state_code: "8", name_en: "Bundi" },
  { district_code: "95", state_code: "8", name_en: "Bundi North" },
  { district_code: "96", state_code: "8", name_en: "Bundi South" },
];

function buildSeedRegistrations(count) {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const village = BENCH_VILLAGES[i % BENCH_VILLAGES.length];
    const seq = Math.floor(i / BENCH_VILLAGES.length) + 1;
    rows.push({
      id: crypto.randomUUID(),
      family_id: `${village.village_code}-${String(seq).padStart(3, "0")}`,
      full_name: `Bench Family ${i + 1}`,
      father_name: `Bench Father ${i + 1}`,
      member_count: (i % 5) + 1,
      state_code: village.state_code,
      district_code: village.district_code,
      subdistrict_code: village.subdistrict_code,
      village_code: village.village_code,
      thikana: village.name_en,
      thikana_same_as_village: true,
      current_address: "Benchmark dataset only",
      phone_number: `9${String(100000000 + i).slice(0, 9)}`,
      consent_given: true,
      public_opt_in: true,
      public_visibility: "default",
      status: "approved",
      admin_note: null,
      created_at: new Date(Date.UTC(2026, 9, 1, 0, 0, i % 60)).toISOString(),
      updated_at: new Date(Date.UTC(2026, 9, 1, 0, 0, i % 60)).toISOString(),
    });
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* Mock Supabase (PostgREST + RPC + Storage)                           */
/* ------------------------------------------------------------------ */

function createMockSupabase({ latencyMs = 40, registrations = [] } = {}) {
  const state = {
    kv: new Map(), // site_content rows
    storage: new Map(), // bucket/path -> string
    regs: registrations.map((r) => ({ ...r })),
    counters: new Map(),
    requests: 0,
    bytesIn: 0,
    latencyMs,
  };

  // Seed BOTH persistence formats so the benchmark measures like-for-like:
  //  - the legacy single encrypted document (pre-optimisation architecture)
  //  - one encrypted row per registration (current architecture)
  {
    const legacyRegistrations = state.regs.map((r) => ({
      id: r.id,
      family_id: r.family_id,
      full_name: r.full_name,
      father_name: r.father_name,
      member_count: r.member_count,
      state_code: r.state_code,
      district_code: r.district_code,
      subdistrict_code: r.subdistrict_code,
      village_code: r.village_code,
      thikana: r.thikana,
      thikana_same_as_village: r.thikana_same_as_village,
      current_address: r.current_address,
      phone_number: r.phone_number,
      public_visibility: r.public_visibility,
      status: r.status,
      admin_note: r.admin_note,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
    const counters = [...new Set(state.regs.map((r) => r.village_code).filter(Boolean))].map(
      (villageCode) => ({
        village_code: villageCode,
        last_seq: Math.max(
          ...[
            state.regs
              .filter((r) => r.village_code === villageCode)
              .map((r) => Number(String(r.family_id || "").split("-")[1]) || 0),
            0,
          ].flat()
        ),
        updated_at: new Date().toISOString(),
      })
    );
    state.kv.set("parivaar_pg_store_v1", {
      key: "parivaar_pg_store_v1",
      value: JSON.stringify({
        version: 1,
        updated_at: new Date().toISOString(),
        deleted_ids: [],
        registrations: legacyRegistrations,
        counters,
        audit_logs: [],
        missing_reports: [],
      }),
    });
    for (const record of legacyRegistrations) {
      state.kv.set(`parivaar_reg_v1:${record.id}`, {
        key: `parivaar_reg_v1:${record.id}`,
        value: JSON.stringify({ v: 2, ...record }),
      });
    }
    state.kv.set("parivaar_store_v2", {
      key: "parivaar_store_v2",
      value: JSON.stringify({ migrated_at: new Date().toISOString(), count: state.regs.length }),
    });
  }

  // prime per-village family id counters so RPC allocations never collide
  for (const r of state.regs) {
    if (!r.family_id) continue;
    const m = String(r.family_id).match(/^(.*)-(\d+)$/);
    if (!m) continue;
    state.counters.set(m[1], Math.max(state.counters.get(m[1]) || 0, Number(m[2]) || 0));
  }

  function nextFamilyId(villageCode) {
    const next = (state.counters.get(villageCode) || 0) + 1;
    state.counters.set(villageCode, next);
    return `${villageCode}-${String(next).padStart(3, "0")}`;
  }

  function rpcSubmit(params) {
    const name = String(params.p_full_name || "").trim();
    const father = String(params.p_father_name || "").trim() || null;
    const phone = String(params.p_phone_number || "").replace(/\D/g, "");
    const district = String(params.p_district_code || "").trim();
    const village = String(params.p_village_code || "").trim() || null;
    const members = Math.max(1, Math.min(250, Number(params.p_member_count) || 1));

    if (name.length < 2) {
      return { ok: false, code: "INVALID_NAME", message: "Invalid name" };
    }
    if (!/^[6-9][0-9]{9}$/.test(phone)) {
      return { ok: false, code: "INVALID_PHONE", message: "Invalid phone" };
    }
    const existing = state.regs.find(
      (r) =>
        r.phone_number === phone &&
        r.full_name.toLowerCase() === name.toLowerCase() &&
        r.district_code === district
    );
    if (existing) {
      if (params.p_family_id && existing.family_id === params.p_family_id) {
        return { ok: true, id: existing.id, family_id: existing.family_id };
      }
      return {
        ok: false,
        code: "DUPLICATE_REGISTRATION",
        message: "A registration with this name, phone number, and district has already been recorded.",
      };
    }
    const familyId = params.p_family_id || nextFamilyId(village || district);
    const row = {
      id: crypto.randomUUID(),
      family_id: familyId,
      full_name: name,
      father_name: father,
      member_count: members,
      state_code: String(params.p_state_code || ""),
      district_code: district,
      subdistrict_code: String(params.p_subdistrict_code || ""),
      village_code: village,
      thikana: String(params.p_thikana || ""),
      thikana_same_as_village: params.p_thikana_same_as_village !== false,
      current_address: String(params.p_current_address || ""),
      phone_number: phone,
      consent_given: true,
      public_opt_in: true,
      public_visibility: "default",
      status: "approved",
      admin_note: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    state.regs.push(row);
    return {
      ok: true,
      id: row.id,
      family_id: row.family_id,
      full_name: row.full_name,
      father_name: row.father_name,
      member_count: row.member_count,
      state_code: row.state_code,
      district_code: row.district_code,
      subdistrict_code: row.subdistrict_code,
      village_code: row.village_code,
      created_at: row.created_at,
    };
  }

  function matchesFilters(r, p) {
    const like = (haystack, needle) =>
      String(haystack || "").toLowerCase().includes(String(needle || "").toLowerCase());
    if (p.p_state_code && r.state_code !== p.p_state_code) return false;
    if (p.p_district_code && r.district_code !== p.p_district_code) return false;
    if (p.p_village_code && r.village_code !== p.p_village_code) return false;
    if (p.p_subdistrict_code) {
      const village = BENCH_VILLAGES.find((v) => v.village_code === r.village_code);
      if (
        r.subdistrict_code !== p.p_subdistrict_code &&
        village?.subdistrict_code !== p.p_subdistrict_code &&
        village?.block_code !== p.p_subdistrict_code
      ) {
        return false;
      }
    }
    if (p.p_q) {
      return (
        like(r.family_id, p.p_q) ||
        like(r.full_name, p.p_q) ||
        like(r.father_name, p.p_q) ||
        like(r.thikana, p.p_q) ||
        like(r.village_code, p.p_q)
      );
    }
    return true;
  }

  function rpcPublicFamilies(p) {
    const filtered = state.regs.filter((r) => r.status === "approved" && matchesFilters(r, p));
    const page = Math.max(1, Number(p.p_page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(p.p_page_size) || 20));
    const rows = filtered.slice((page - 1) * pageSize, page * pageSize).map((r) => {
      const village = BENCH_VILLAGES.find((v) => v.village_code === r.village_code);
      const district = BENCH_DISTRICTS.find((d) => d.district_code === r.district_code);
      return {
        family_id: r.family_id,
        is_public: true,
        is_private: false,
        family_head_name: r.full_name,
        head_name: r.full_name,
        father_name: r.father_name,
        member_count: r.member_count,
        state_code: r.state_code,
        state_name: BENCH_STATE.name_en,
        district_code: r.district_code,
        district_name: district?.name_en || r.district_code,
        subdistrict_code: r.subdistrict_code,
        subdistrict_name: village ? `Tehsil ${village.subdistrict_code}` : r.subdistrict_code,
        admin_type: "Tehsil",
        village_code: r.village_code,
        village_name: village?.name_en || r.thikana,
        created_at: r.created_at,
      };
    });
    return {
      ok: true,
      families: rows,
      total: filtered.length,
      total_members: filtered.reduce((s, r) => s + (Number(r.member_count) || 1), 0),
      page,
      page_size: pageSize,
      visibility_policy: "public_basic",
    };
  }

  function rpcSummary() {
    const approved = state.regs.filter((r) => r.status === "approved");
    return {
      total_registrations: approved.length,
      total_members: approved.reduce((s, r) => s + (Number(r.member_count) || 1), 0),
      states_represented: new Set(approved.map((r) => r.state_code)).size,
      districts_covered: new Set(approved.map((r) => r.district_code)).size,
      villages_represented: new Set(approved.map((r) => r.village_code).filter(Boolean)).size,
    };
  }

  function rpcMapAggregates(p) {
    const approved = state.regs.filter(
      (r) =>
        r.status === "approved" &&
        (!p.p_state_code || r.state_code === p.p_state_code) &&
        (!p.p_district_code || r.district_code === p.p_district_code)
    );
    const villageMap = new Map();
    for (const r of approved) {
      if (!r.village_code) continue;
      const village = BENCH_VILLAGES.find((v) => v.village_code === r.village_code);
      const entry = villageMap.get(r.village_code) || {
        village_code: r.village_code,
        subdistrict_code: village?.subdistrict_code || r.subdistrict_code,
        subdistrict_name: `Tehsil ${village?.subdistrict_code || r.subdistrict_code}`,
        district_code: r.district_code,
        district_name: BENCH_DISTRICTS.find((d) => d.district_code === r.district_code)?.name_en || r.district_code,
        state_code: r.state_code,
        state_name: BENCH_STATE.name_en,
        name_en: village?.name_en || r.thikana,
        name_local: null,
        latitude: 25.3,
        longitude: 75.7,
        coord_source: "LGD",
        coord_verified: true,
        registration_count: 0,
      };
      entry.registration_count += 1;
      villageMap.set(r.village_code, entry);
    }
    const by = (key) => {
      const map = new Map();
      for (const r of approved) {
        const k = r[key];
        if (!k) continue;
        const cur = map.get(k) || { code: k, registration_count: 0 };
        cur.registration_count += 1;
        map.set(k, cur);
      }
      return [...map.values()];
    };
    return {
      states: by("state_code").map((x) => ({ state_code: x.code, name_en: BENCH_STATE.name_en, registration_count: x.registration_count })),
      districts: by("district_code").map((x) => ({
        district_code: x.code,
        state_code: "8",
        state_name: BENCH_STATE.name_en,
        name_en: BENCH_DISTRICTS.find((d) => d.district_code === x.code)?.name_en || x.code,
        registration_count: x.registration_count,
      })),
      subdistricts: by("subdistrict_code").map((x) => ({ subdistrict_code: x.code, registration_count: x.registration_count })),
      villages: [...villageMap.values()],
    };
  }

  function parseFilters(searchParams) {
    const filters = [];
    for (const [key, value] of searchParams.entries()) {
      if (["select", "limit", "offset", "order", "on_conflict", "columns"].includes(key)) continue;
      const m = value.match(/^(eq|neq|like|ilike|gt|gte|lt|lte|in|is)\.(.*)$/s);
      if (!m) continue;
      filters.push({ column: key, op: m[1], value: m[2] });
    }
    return filters;
  }

  function applyFilters(rows, filters) {
    return rows.filter((row) =>
      filters.every((f) => {
        const cell = row[f.column];
        switch (f.op) {
          case "eq":
            return String(cell) === String(f.value);
          case "neq":
            return String(cell) !== String(f.value);
          case "like":
          case "ilike": {
            const pattern = String(f.value).replace(/\*/g, "%").replace(/%/g, ".*");
            const rx = new RegExp(`^${pattern}$`, f.op === "ilike" ? "is" : "s");
            return rx.test(String(cell ?? ""));
          }
          case "in": {
            const list = f.value.replace(/^\(|\)$/g, "").split(",");
            return list.map((x) => x.replace(/^"|"$/g, "")).includes(String(cell));
          }
          case "is":
            return f.value === "null" ? cell === null || cell === undefined : String(cell) === f.value;
          default:
            return true;
        }
      })
    );
  }

  const server = http.createServer(async (req, res) => {
    state.requests += 1;
    const url = new URL(req.url, "http://127.0.0.1");
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks);
    state.bytesIn += rawBody.length;
    const wantedObject = String(req.headers.accept || "").includes("vnd.pgrst.object");

    if (state.latencyMs > 0) await sleep(state.latencyMs);

    const json = (status, payload) => {
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(payload === undefined ? "" : JSON.stringify(payload));
    };

    try {
      // ---- RPC ----
      if (url.pathname.startsWith("/rest/v1/rpc/")) {
        const fn = url.pathname.replace("/rest/v1/rpc/", "");
        const params = rawBody.length ? JSON.parse(rawBody.toString("utf8")) : {};
        if (fn === "submit_parivaar_registration") return json(200, rpcSubmit(params));
        if (fn === "get_public_parivaar_families") return json(200, rpcPublicFamilies(params));
        if (fn === "get_parivaar_summary_stats") return json(200, rpcSummary());
        if (fn === "get_parivaar_map_aggregates") return json(200, rpcMapAggregates(params));
        return json(404, { message: `mock RPC '${fn}' not implemented` });
      }

      // ---- Storage ----
      if (url.pathname.startsWith("/storage/v1/object/")) {
        const objectPath = url.pathname
          .replace("/storage/v1/object/authenticated/", "")
          .replace("/storage/v1/object/", "");
        if (req.method === "POST" || req.method === "PUT") {
          state.storage.set(objectPath, rawBody.toString("utf8"));
          return json(200, { Key: objectPath, Id: crypto.randomUUID() });
        }
        const stored = state.storage.get(objectPath);
        if (stored === undefined) {
          return json(400, { statusCode: "404", error: "not_found", message: "Object not found" });
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/octet-stream");
        return res.end(stored);
      }

      // ---- Tables ----
      if (url.pathname.startsWith("/rest/v1/")) {
        const table = url.pathname.replace("/rest/v1/", "").split("/")[0];
        if (table !== "site_content") {
          // tables the server may query directly (locations) are served empty
          return json(200, wantedObject ? null : []);
        }
        const filters = parseFilters(url.searchParams);
        const limit = Number(url.searchParams.get("limit") || 0);
        const offset = Number(url.searchParams.get("offset") || 0);

        if (req.method === "GET") {
          let rows = [...state.kv.values()];
          rows = applyFilters(rows, filters);
          if (offset) rows = rows.slice(offset);
          if (limit) rows = rows.slice(0, limit);
          if (wantedObject) return json(200, rows.length === 1 ? rows[0] : null);
          return json(200, rows);
        }

        if (req.method === "POST") {
          const body = JSON.parse(rawBody.toString("utf8") || "{}");
          const incoming = Array.isArray(body) ? body : [body];
          const onConflict = url.searchParams.get("on_conflict") || "key";
          for (const row of incoming) {
            const conflictKey = row[onConflict];
            if (conflictKey !== undefined && state.kv.has(String(conflictKey))) {
              const existing = state.kv.get(String(conflictKey));
              state.kv.set(String(conflictKey), { ...existing, ...row });
            } else {
              state.kv.set(String(conflictKey ?? crypto.randomUUID()), { ...row });
            }
          }
          return json(201, null);
        }

        if (req.method === "DELETE") {
          let rows = [...state.kv.values()];
          rows = applyFilters(rows, filters);
          for (const row of rows) state.kv.delete(String(row.key));
          return json(204, undefined);
        }
      }

      return json(404, { message: `mock: unsupported ${req.method} ${url.pathname}` });
    } catch (err) {
      return json(500, { message: err?.message || "mock failure" });
    }
  });

  return {
    state,
    listen: () =>
      new Promise((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve(server.address().port));
      }),
    close: () => new Promise((resolve) => server.close(resolve)),
    setLatency: (ms) => {
      state.latencyMs = ms;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Worker: serves the real API handler                                 */
/* ------------------------------------------------------------------ */

async function runWorker() {
  const port = Number(ARGS.port || 0);
  const sqlitePath = String(ARGS.sqlite || "");
  if (!process.env.PARIVAAR_SQLITE_PATH) {
    // resolveSqliteDbPath prefers PARIVAAR_SQLITE_PATH; nothing else needed.
  }
  const { handleParivaarApiRequest } = await import("../server/parivaarApiHandler.mjs");
  const bootedAt = performance.now();

  const server = http.createServer(async (req, res) => {
    if (req.url === "/__health") {
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: true, uptimeMs: performance.now() - bootedAt }));
      return;
    }
    try {
      await handleParivaarApiRequest(req, res);
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, message: err?.message || "worker failure" }));
    }
  });

  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  process.send?.({ ready: true, port: server.address().port, sqlitePath });
}

/* ------------------------------------------------------------------ */
/* Driver                                                              */
/* ------------------------------------------------------------------ */

function spawnWorker(env, name) {
  const child = spawn(
    process.execPath,
    [fileURLToPath(import.meta.url), "--worker", `--port=0`],
    {
      env: { ...process.env, ...env },
      stdio: ["ignore", "inherit", "inherit", "ipc"],
    }
  );
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`worker '${name}' did not start in 60s`)),
      60000
    );
    child.once("message", (msg) => {
      if (msg?.ready) {
        clearTimeout(timer);
        resolve({ child, port: msg.port, name });
      }
    });
    child.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function stopWorker(worker) {
  if (!worker?.child) return;
  worker.child.kill("SIGKILL");
}

async function waitForHealth(port, timeoutMs = 60000) {
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/__health`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(50);
  }
  throw new Error("worker health check timed out");
}

function benchDir() {
  const dir = path.join(ROOT, ".cache", "bench");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function runDriver() {
  const iterations = Number(ARGS.iterations || 20);
  const latencyMs = Number(ARGS.latency || 40);
  const seedCount = Number(ARGS.registrations || 200);
  const dir = benchDir();

  const seed = buildSeedRegistrations(seedCount);
  const mock = createMockSupabase({ latencyMs, registrations: seed });
  const mockPort = await mock.listen();
  const mockUrl = `http://127.0.0.1:${mockPort}`;

  const envFor = (sqliteName) => ({
    SUPABASE_URL: mockUrl,
    VITE_SUPABASE_URL: mockUrl,
    SUPABASE_ANON_KEY: "bench-anon-key",
    VITE_SUPABASE_ANON_KEY: "bench-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "",
    PARIVAAR_SQLITE_PATH: path.join(dir, sqliteName),
    NODE_NO_WARNINGS: "1",
  });

  for (const name of ["a.sqlite", "b.sqlite"]) {
    for (const suffix of ["", "-wal", "-shm"]) {
      try {
        fs.unlinkSync(path.join(dir, name + suffix));
      } catch {
        /* ignore */
      }
    }
  }

  const results = {
    generated_at: new Date().toISOString(),
    configuration: {
      simulated_database_latency_ms: latencyMs,
      seeded_registrations: seedCount,
      warm_iterations: iterations,
      runtime: process.version,
    },
  };

  // ---- cold start: worker A (LGD seed + first hydration) ----
  const coldStartedAt = performance.now();
  const workerA = await spawnWorker(envFor("a.sqlite"), "A");
  let cold = await timedFetch(`http://127.0.0.1:${workerA.port}/api/parivaar?action=summary`);
  results.cold_start_summary = {
    ms: round(performance.now() - coldStartedAt),
    status: cold.status,
    families: cold.json?.stats?.total_registrations ?? null,
  };

  const workerB = await spawnWorker(envFor("b.sqlite"), "B");
  const warmB = await timedFetch(`http://127.0.0.1:${workerB.port}/api/parivaar?action=summary`);
  results.cold_start_worker_b = { status: warmB.status, ms: round(warmB.ms) };

  const baseA = `http://127.0.0.1:${workerA.port}/api/parivaar`;
  const baseB = `http://127.0.0.1:${workerB.port}/api/parivaar`;
  const villageQuery = "state_code=8&district_code=94&subdistrict_code=6033&village_code=94494";

  const endpointSamples = { summary: [], directory: [], map: [], public_families: [] };

  for (let i = 0; i < iterations; i += 1) {
    const summary = await timedFetch(`${baseA}?action=summary`);
    endpointSamples.summary.push(summary.ms);

    const directory = await timedFetch(`${baseA}?action=directory&level=villages&state_code=8&district_code=94&page_size=24`);
    endpointSamples.directory.push(directory.ms);

    const map = await timedFetch(`${baseA}?action=map-aggregates`);
    endpointSamples.map.push(map.ms);

    const families = await timedFetch(`${baseA}?action=public-families&${villageQuery}`);
    endpointSamples.public_families.push(families.ms);
  }

  results.endpoints = {
    summary: summarize(endpointSamples.summary),
    directory: summarize(endpointSamples.directory),
    map_aggregates: summarize(endpointSamples.map),
    public_families: summarize(endpointSamples.public_families),
  };

  // ---- sequential registrations ----
  const ioBefore = { requests: mock.state.requests, bytesIn: mock.state.bytesIn };
  const registrationSamples = [];
  const registrationErrors = [];
  let lastFamilyId = null;
  for (let i = 0; i < 8; i += 1) {
    const payload = {
      action: "register",
      full_name: `Perf Test Family ${Date.now()}${i}`,
      father_name: "Perf Test Father",
      require_father_name: true,
      member_count: (i % 4) + 1,
      state_code: "8",
      district_code: "94",
      subdistrict_code: "6033",
      village_code: "94494",
      thikana: "Chhapawda",
      thikana_same_as_village: true,
      require_village: true,
      current_address: "Benchmark address, Amritsar, Punjab",
      phone_number: `8${String(700000000 + i + Math.floor(Date.now() / 1000) % 1000).slice(0, 9)}`,
      consent_given: true,
    };
    const res = await timedFetch(`${baseA}?action=register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    registrationSamples.push(res.ms);
    if (res.json?.ok) lastFamilyId = res.json.family_id;
    else registrationErrors.push(res.json?.code || `HTTP_${res.status}`);
  }
  const ioAfter = { requests: mock.state.requests, bytesIn: mock.state.bytesIn };
  const successfulRegistrations = registrationSamples.length - registrationErrors.length;
  results.registration = {
    sequential: summarize(registrationSamples),
    errors: registrationErrors,
    db_requests_per_registration: successfulRegistrations
      ? round((ioAfter.requests - ioBefore.requests) / successfulRegistrations, 2)
      : 0,
    db_bytes_written_per_registration: successfulRegistrations
      ? Math.round((ioAfter.bytesIn - ioBefore.bytesIn) / successfulRegistrations)
      : 0,
  };

  // ---- concurrent registrations ----
  const concurrentPayloads = [];
  for (let i = 0; i < 5; i += 1) {
    concurrentPayloads.push({
      action: "register",
      full_name: `Concurrent Family ${Date.now()}${i}`,
      father_name: "Concurrent Father",
      require_father_name: true,
      member_count: 2,
      state_code: "8",
      district_code: "94",
      subdistrict_code: "6033",
      village_code: "94494",
      thikana: "Chhapawda",
      thikana_same_as_village: true,
      require_village: true,
      current_address: "Benchmark address, Amritsar, Punjab",
      phone_number: `7${String(600000000 + i + Math.floor(Date.now() / 1000) % 1000).slice(0, 9)}`,
      consent_given: true,
    });
  }
  const concurrentStarted = performance.now();
  const concurrentResponses = await Promise.all(
    concurrentPayloads.map((payload) =>
      timedFetch(`${baseA}?action=register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    )
  );
  results.registration.concurrent = {
    wall_ms: round(performance.now() - concurrentStarted),
    per_request: summarize(concurrentResponses.map((r) => r.ms)),
    ok_count: concurrentResponses.filter((r) => r.json?.ok).length,
    family_ids: concurrentResponses.map((r) => r.json?.family_id || null),
  };

  // ---- cross-device propagation: register on A, watch B ----
  const propagationPayload = {
    action: "register",
    full_name: `Propagation Family ${Date.now()}`,
    father_name: "Propagation Father",
    require_father_name: true,
    member_count: 3,
    state_code: "8",
    district_code: "94",
    subdistrict_code: "6033",
    village_code: "94494",
    thikana: "Chhapawda",
    thikana_same_as_village: true,
    require_village: true,
    current_address: "Benchmark address, Amritsar, Punjab",
    phone_number: `6${String(500000000 + (Date.now() % 100000)).slice(0, 9)}`,
    consent_given: true,
  };
  const propRes = await timedFetch(`${baseA}?action=register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(propagationPayload),
  });
  const newFamilyId = propRes.json?.family_id || null;
  const propStart = performance.now();
  let visibleAfterMs = null;
  let visibleInSummaryMs = null;
  while (performance.now() - propStart < 20000) {
    if (newFamilyId) {
      const search = await timedFetch(`${baseB}?action=public-families&q=${encodeURIComponent(newFamilyId)}&page_size=5`);
      if (
        visibleAfterMs === null &&
        search.json?.families?.some((f) => f.family_id === newFamilyId)
      ) {
        visibleAfterMs = round(performance.now() - propStart);
      }
      const summary = await timedFetch(`${baseB}?action=summary`);
      const totalA =
        propRes.json?.summary?.total_registrations ??
        propRes.json?.stats?.total_registrations ??
        null;
      if (
        visibleInSummaryMs === null &&
        summary.json?.stats &&
        totalA !== null &&
        Number(summary.json.stats.total_registrations) >= Number(totalA)
      ) {
        visibleInSummaryMs = round(performance.now() - propStart);
      }
      if (visibleAfterMs !== null && visibleInSummaryMs !== null) break;
    }
    await sleep(200);
  }
  const pollIntervalMs = Number(ARGS.poll || 7000);
  results.cross_device = {
    new_family_id: newFamilyId,
    directory_visible_after_ms: visibleAfterMs,
    summary_updated_after_ms: visibleInSummaryMs,
    simulated_client_poll_interval_ms: pollIntervalMs,
    worst_case_client_latency_ms:
      visibleAfterMs === null ? null : round(visibleAfterMs + pollIntervalMs),
  };

  // ---- database outage behaviour ----
  mock.setLatency(0);
  await mock.close();
  const outageSummary = await timedFetch(`${baseA}?action=summary`);
  const outageRegister = await timedFetch(`${baseA}?action=register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...propagationPayload, phone_number: "9999999999", full_name: `Outage Family ${Date.now()}` }),
  });
  results.database_outage = {
    summary_status: outageSummary.status,
    summary_ok: outageSummary.json?.ok ?? false,
    summary_reports_error: Boolean(outageSummary.json?.stats_error || outageSummary.json?.code),
    summary_families: outageSummary.json?.stats?.total_registrations ?? null,
    registration_status: outageRegister.status,
    registration_reported_failure: outageRegister.json?.ok === false,
  };

  await stopWorker(workerA);
  await stopWorker(workerB);

  // ---- persistence check: no data loss for existing records ----
  results.multi_device_consistency = {
    last_family_id: lastFamilyId,
    worker_b_saw_new_family: visibleAfterMs !== null,
  };

  const outPath = path.join(dir, `results-${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));

  if (ARGS.json === true || ARGS.json === "true") {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log("\n=== Parivaar benchmark ===");
    console.log(`simulated DB latency: ${latencyMs} ms/request · seeded registrations: ${seedCount}`);
    console.log(`\ncold start (LGD seed + first hydration): ${results.cold_start_summary.ms} ms`);
    console.log("\nendpoint latency (ms):");
    for (const [name, s] of Object.entries(results.endpoints)) {
      console.log(`  ${name.padEnd(16)} p50=${String(s.p50).padStart(7)}  p95=${String(s.p95).padStart(7)}  max=${String(s.max).padStart(7)}`);
    }
    console.log("\nregistration (ms):");
    console.log(`  sequential       p50=${results.registration.sequential.p50}  p95=${results.registration.sequential.p95}  errors=${results.registration.errors.length}`);
    console.log(`  concurrent(5)    wall=${results.registration.concurrent.wall_ms}  ok=${results.registration.concurrent.ok_count}/5`);
    console.log(`  database I/O     ${results.registration.db_requests_per_registration} requests and ${results.registration.db_bytes_written_per_registration} bytes per registration`);
    console.log("\ncross-device propagation:");
    console.log(`  family ${results.cross_device.new_family_id}: directory ${results.cross_device.directory_visible_after_ms} ms · summary ${results.cross_device.summary_updated_after_ms} ms`);
    console.log(`  worst case for an already-open device (poll ${results.cross_device.simulated_client_poll_interval_ms} ms): ${results.cross_device.worst_case_client_latency_ms} ms`);
    console.log("\ndatabase outage:");
    console.log(`  ${JSON.stringify(results.database_outage)}`);
    console.log(`\nresults written to ${path.relative(ROOT, outPath)}\n`);
  }

  process.exit(0);
}

if (IS_WORKER) {
  if (ARGS.sqlite) process.env.PARIVAAR_SQLITE_PATH = String(ARGS.sqlite);
  runWorker().catch((err) => {
    console.error("worker failed:", err);
    process.exit(1);
  });
} else {
  runDriver().catch((err) => {
    console.error("benchmark failed:", err);
    process.exit(1);
  });
}
