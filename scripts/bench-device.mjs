/**
 * "Second device" for scripts/bench-parivaar.mjs.
 *
 * Runs a completely separate process with its own SQLite replica, polls the
 * API like a browser tab would (while visible), and prints how long it took to
 * see a family registered by another instance.
 */

const [, , baseUrl, familyId, sqlitePath] = process.argv;

process.env.PARIVAAR_SQLITE_PATH = sqlitePath;
process.env.PARIVAAR_REGISTRATION_KEY = "bench-secret-key";

const POLL_INTERVAL_MS = 500;
const MAX_WAIT_MS = 25000;
const started = performance.now();

const { handleParivaarApiRequest } = await import("../server/parivaarApiHandler.mjs");

function call(url) {
  return new Promise((resolve) => {
    const req = { method: "GET", url, headers: {}, on() {} };
    const res = {
      statusCode: 0,
      headers: {},
      setHeader() {},
      end(payload) {
        resolve({ status: this.statusCode, body: String(payload ?? "") });
      },
    };
    handleParivaarApiRequest(req, res).catch(() => resolve({ status: 0, body: "" }));
  });
}

const query = `/api/parivaar?action=public-families&state_code=8&district_code=94&subdistrict_code=6033&village_code=94497&q=${encodeURIComponent(familyId)}`;

let visibleAfter = null;
while (performance.now() - started < MAX_WAIT_MS) {
  const out = await call(query);
  if (out.status === 200) {
    try {
      const parsed = JSON.parse(out.body);
      const families = parsed.families || parsed.rows || [];
      const hit = families.some((f) => String(f.family_id) === String(familyId));
      if (hit) {
        visibleAfter = Math.round(performance.now() - started);
        break;
      }
    } catch {
      /* ignore malformed poll */
    }
  }
  await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
}

console.log(`VISIBLE_AFTER_MS=${visibleAfter ?? "none"}`);
