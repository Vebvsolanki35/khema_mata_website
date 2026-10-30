/**
 * Minimal in-process stand-in for the Supabase endpoints this project uses
 * (PostgREST `site_content` table, Storage object + the two RPCs).
 *
 * It exists so `scripts/bench-parivaar.mjs` can exercise the REAL server code
 * (validation, RPC call, replica mirror, store write) end to end, with
 * injectable network latency, without touching production data.
 *
 * Supported:
 *   GET    /rest/v1/site_content?select=&key=eq.X&key=like.pre*&order=&limit=
 *   POST   /rest/v1/site_content?on_conflict=key      (upsert, JSON array/object)
 *   DELETE /rest/v1/site_content?key=eq.X
 *   POST   /rest/v1/rpc/<fn>
 *   GET    /storage/v1/object/gallery/<path>
 *   POST   /storage/v1/object/gallery/<path>
 */

import http from "node:http";

export function createMockSupabase({ latencyMs = 0 } = {}) {
  const kv = new Map();
  const storage = new Map();
  const counters = new Map();
  const registrations = [];
  const metrics = { requests: 0, bytesIn: 0, bytesOut: 0, byPath: new Map() };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const parseFilters = (params) => {
    const filters = [];
    for (const [key, raw] of params.entries()) {
      if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(key)) continue;
      const [op, ...rest] = raw.split(".");
      const value = rest.join(".");
      filters.push({ key, op, value });
    }
    return filters;
  };

  const matches = (row, filters) =>
    filters.every(({ key, op, value }) => {
      const cell = row[key];
      if (op === "eq") return String(cell) === String(value);
      if (op === "neq") return String(cell) !== String(value);
      if (op === "like") {
        const parts = String(value)
          .split("*")
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
        return new RegExp(`^${parts.join(".*")}$`).test(String(cell ?? ""));
      }
      if (op === "in") {
        return String(value)
          .replace(/^\(|\)$/g, "")
          .split(",")
          .map((part) => part.replace(/^"|"$/g, ""))
          .includes(String(cell));
      }
      return true;
    });

  const send = (res, status, body, headers = {}) => {
    const payload = body === null || body === undefined ? "" : JSON.stringify(body);
    metrics.bytesOut += Buffer.byteLength(payload);
    res.writeHead(status, {
      "content-type": "application/json",
      ...headers,
    });
    res.end(payload);
  };

  function handleStorage(req, res, url) {
    const objectPath = decodeURIComponent(url.pathname.replace("/storage/v1/object/gallery/", ""));
    if (req.method === "GET") {
      const body = storage.get(objectPath);
      if (body === undefined) {
        return send(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
      }
      metrics.bytesOut += Buffer.byteLength(body);
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(body);
    }
    if (req.method === "POST" || req.method === "PUT") {
      storage.set(objectPath, req.__body || "");
      return send(res, 200, { Key: `gallery/${objectPath}` });
    }
    return send(res, 405, { message: "unsupported" });
  }

  function handleRpc(res, name, params) {
    if (name === "submit_parivaar_registration") {
      const village = String(params.p_village_code || "");
      const phone = String(params.p_phone_number || "");
      const name2 = String(params.p_full_name || "").trim().toLowerCase();
      const existing = registrations.find(
        (row) =>
          row.phone_number === phone &&
          row.full_name.trim().toLowerCase() === name2 &&
          row.district_code === String(params.p_district_code || "")
      );
      if (existing) {
        return send(res, 200, {
          ok: true,
          duplicate: true,
          ...existing,
        });
      }
      const seq = (counters.get(village) || 0) + 1;
      counters.set(village, seq);
      const row = {
        id: `00000000-0000-4000-8000-${String(registrations.length + 1).padStart(12, "0")}`,
        family_id: params.p_family_id || `${village}-${String(seq).padStart(3, "0")}`,
        full_name: params.p_full_name,
        father_name: params.p_father_name || null,
        member_count: Number(params.p_member_count) || 1,
        state_code: String(params.p_state_code || ""),
        district_code: String(params.p_district_code || ""),
        subdistrict_code: String(params.p_subdistrict_code || ""),
        village_code: village || null,
        thikana: params.p_thikana || null,
        thikana_same_as_village: Boolean(params.p_thikana_same_as_village),
        current_address: params.p_current_address || null,
        phone_number: phone,
        public_visibility: "default",
        status: "approved",
        created_at: new Date().toISOString(),
      };
      registrations.push(row);
      return send(res, 200, { ok: true, ...row });
    }

    if (name === "get_parivaar_summary_stats") {
      return send(res, 200, {
        total_registrations: registrations.length,
        total_members: registrations.reduce((sum, r) => sum + (Number(r.member_count) || 0), 0),
        states_represented: new Set(registrations.map((r) => r.state_code)).size,
        districts_covered: new Set(registrations.map((r) => r.district_code)).size,
        villages_represented: new Set(registrations.map((r) => r.village_code)).size,
      });
    }

    if (name === "get_public_parivaar_families") {
      const page = Number(params.p_page || 1);
      const pageSize = Number(params.p_page_size || 20);
      const rows = registrations
        .filter((row) => row.public_visibility !== "private")
        .slice((page - 1) * pageSize, page * pageSize)
        .map((row) => ({
          family_id: row.family_id,
          family_head_name: row.full_name,
          father_name: row.father_name,
          member_count: row.member_count,
          state_code: row.state_code,
          district_code: row.district_code,
          subdistrict_code: row.subdistrict_code,
          village_code: row.village_code,
          created_at: row.created_at,
          is_private: false,
        }));
      return send(res, 200, { families: rows, total: registrations.length });
    }

    return send(res, 404, {
      code: "PGRST202",
      message: `Could not find the function public.${name}`,
    });
  }

  const server = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    req.__body = body;
    metrics.requests += 1;
    metrics.bytesIn += Buffer.byteLength(body);
    const url = new URL(req.url, "http://127.0.0.1");
    const bucket = url.pathname.startsWith("/storage/") ? "storage" : url.pathname;
    metrics.byPath.set(bucket, (metrics.byPath.get(bucket) || 0) + 1);
    if (latencyMs > 0) await sleep(latencyMs);

    try {
      if (url.pathname.startsWith("/storage/v1/object/gallery/")) {
        return handleStorage(req, res, url);
      }

      if (url.pathname.startsWith("/rest/v1/rpc/")) {
        const name = url.pathname.replace("/rest/v1/rpc/", "");
        return handleRpc(res, name, body ? JSON.parse(body) : {});
      }

      if (url.pathname === "/rest/v1/site_content") {
        const filters = parseFilters(url.searchParams);
        const select = (url.searchParams.get("select") || "*")
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);

        if (req.method === "GET") {
          const wantsObject = String(req.headers.accept || "").includes("pgrst.object");
          let rows = [...kv.values()].filter((row) => matches(row, filters));
          const order = url.searchParams.get("order");
          if (order) {
            const [column, dir] = order.split(".");
            rows.sort((a, b) =>
              String(a[column] ?? "").localeCompare(String(b[column] ?? "")) *
              (dir === "desc" ? -1 : 1)
            );
          }
          const offset = Number(url.searchParams.get("offset") || 0);
          if (offset > 0) rows = rows.slice(offset);
          const limit = Number(url.searchParams.get("limit") || 0);
          const range = String(req.headers.range || "");
          let start = 0;
          let end = Number.MAX_SAFE_INTEGER;
          if (range) {
            const [from, to] = range.replace("bytes=", "").split("-").map(Number);
            start = from || 0;
            end = Number.isFinite(to) ? to : end;
          }
          rows = rows.slice(start, end === Number.MAX_SAFE_INTEGER ? undefined : end + 1);
          if (limit > 0) rows = rows.slice(0, limit);
          const projected = rows.map((row) => {
            if (select.length === 1 && select[0] === "*") return row;
            const out = {};
            for (const column of select) out[column] = row[column];
            return out;
          });
          if (wantsObject) {
            if (projected.length === 0) return send(res, 200, null);
            if (projected.length > 1) {
              return send(res, 406, { code: "PGRST116", message: "multiple rows" });
            }
            return send(res, 200, projected[0]);
          }
          return send(res, 200, projected);
        }

        if (req.method === "POST") {
          const parsed = JSON.parse(body || "[]");
          const rows = Array.isArray(parsed) ? parsed : [parsed];
          for (const row of rows) kv.set(String(row.key), row);
          const prefer = String(req.headers.prefer || "");
          if (prefer.includes("return=representation")) return send(res, 201, rows);
          return send(res, 201, null);
        }

        if (req.method === "DELETE") {
          for (const row of [...kv.values()]) {
            if (matches(row, filters)) kv.delete(row.key);
          }
          return send(res, 204, null);
        }
      }

      return send(res, 404, { message: `unsupported ${req.method} ${url.pathname}` });
    } catch (err) {
      return send(res, 500, { message: err?.message || "mock failure" });
    }
  });

  /** Seeds the two durable shapes this project has used, so the same dataset can
   *  be replayed by the pre-optimisation code (one encrypted document) and by the
   *  current code (one row per registration). */
  function seedRegistrations(records, { legacyDocument = true } = {}) {
    for (const record of records) {
      registrations.push(record);
      counters.set(
        String(record.village_code || ""),
        Math.max(counters.get(String(record.village_code || "")) || 0, Number(String(record.family_id || "").split("-")[1]) || 0)
      );
      kv.set(`parivaar_reg_v1:${record.id}`, {
        key: `parivaar_reg_v1:${record.id}`,
        value: JSON.stringify({ v: 2, ...record }),
      });
    }
    if (legacyDocument) {
      kv.set("parivaar_pg_store_v1", {
        key: "parivaar_pg_store_v1",
        value: JSON.stringify({
          version: 1,
          updated_at: new Date().toISOString(),
          deleted_ids: [],
          registrations: records,
          counters: [...counters].map(([village_code, last_seq]) => ({ village_code, last_seq })),
          audit_logs: [],
          missing_reports: [],
        }),
      });
    }
  }

  return {
    seedRegistrations,
    metrics,
    kv,
    storage,
    registrations,
    listen: () =>
      new Promise((resolve) => {
        server.listen(0, "127.0.0.1", () => {
          const { port } = server.address();
          resolve(`http://127.0.0.1:${port}`);
        });
      }),
    close: () => new Promise((resolve) => server.close(resolve)),
    resetMetrics: () => {
      metrics.requests = 0;
      metrics.bytesIn = 0;
      metrics.bytesOut = 0;
      metrics.byPath.clear();
    },
  };
}
