import {
  getParivaarDb,
  queryStates,
  queryDistricts,
  querySubdistricts,
  queryVillages,
  queryDirectory,
  queryPublicFamilies,
  querySummaryStats,
  queryMapAggregates,
  queryParivaarConsistentSnapshot,
  verifyParivaarDataConsistency,
  insertMissingLocationReport,
  queryAdminParivaarData,
  buildAdminExportData,
  updateAdminRecord,
} from "./parivaarDatabase.mjs";
import {
  ensurePostgresHydrated,
  getHydrationState,
  persistMissingLocationReport,
  syncDatabaseStateToPostgres,
} from "./parivaarPostgresSync.mjs";
import { createParivaarRegistration } from "./parivaarRegistration.mjs";
import { buildCsvBuffer, buildXlsxWorkbookBuffer } from "./xlsxBuilder.mjs";

function sendJson(res, statusCode, payload, options = {}) {
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    options.cacheControl ||
      "no-store, no-cache, must-revalidate, max-age=0"
  );
  if (options.revision) res.setHeader("X-Parivaar-Revision", options.revision);
  if (options.serverTiming) res.setHeader("Server-Timing", options.serverTiming);
  res.end(body);
}

/**
 * Official LGD location data is immutable reference data: it never changes when
 * a family registers.  It is therefore cached in-process (and at the CDN edge)
 * instead of being re-queried on every page visit.
 */
const staticLocationCache = new Map();
const STATIC_LOCATION_TTL_MS = 10 * 60 * 1000;
const STATIC_LOCATION_CACHE_CONTROL =
  "public, max-age=300, s-maxage=86400, stale-while-revalidate=86400";

function readStaticLocationCache(key) {
  const hit = staticLocationCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > STATIC_LOCATION_TTL_MS) {
    staticLocationCache.delete(key);
    return null;
  }
  return hit.payload;
}

function writeStaticLocationCache(key, payload) {
  if (staticLocationCache.size > 400) staticLocationCache.clear();
  staticLocationCache.set(key, { at: Date.now(), payload });
}

/**
 * Resolves whether the local replica is current.  Never throws: a database
 * problem is reported to the client as `degraded` with a warning message
 * instead of being silently rendered as "0 registrations".
 */
async function resolveReplica(db) {
  try {
    const hydration = await ensurePostgresHydrated(db);
    const degraded =
      hydration?.source !== "local" &&
      (Boolean(hydration?.error) || hydration?.stale === true);
    return {
      hydration,
      degraded,
      warning: degraded
        ? "Live registration data could not be refreshed from the database. Showing the most recent verified data."
        : null,
      revision: hydration?.revision || null,
    };
  } catch (err) {
    return {
      hydration: { hydrated: false, error: err?.message || "hydration failed" },
      degraded: true,
      warning:
        "Live registration data could not be refreshed from the database. Showing the most recent verified data.",
      revision: null,
    };
  }
}

function readRequestBody(req) {
  if (req.body && typeof req.body === "object") {
    return Promise.resolve(req.body);
  }
  if (typeof req.body === "string" && req.body.length > 0) {
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch {
      return Promise.reject(new Error("Invalid JSON body"));
    }
  }
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

export async function handleParivaarApiRequest(req, res) {
  try {
    const urlObj = new URL(req.url || "/api/parivaar", "http://localhost");
    const method = (req.method || "GET").toUpperCase();
    const action = (urlObj.searchParams.get("action") || "").trim();
    const db = getParivaarDb();

    if (method === "GET") {
      if (action === "states") {
        let states = readStaticLocationCache("states");
        if (!states) {
          states = queryStates(db);
          writeStaticLocationCache("states", states);
        }
        return sendJson(res, 200, { ok: true, states }, {
          cacheControl: STATIC_LOCATION_CACHE_CONTROL,
        });
      }

      if (action === "districts") {
        const stateCode = urlObj.searchParams.get("state_code");
        const cacheKey = `districts:${stateCode || "all"}`;
        let districts = readStaticLocationCache(cacheKey);
        if (!districts) {
          districts = queryDistricts(stateCode, db);
          writeStaticLocationCache(cacheKey, districts);
        }
        return sendJson(res, 200, { ok: true, districts }, {
          cacheControl: STATIC_LOCATION_CACHE_CONTROL,
        });
      }

      if (action === "subdistricts") {
        const stateCode = urlObj.searchParams.get("state_code");
        const districtCode = urlObj.searchParams.get("district_code");
        const cacheKey = `subdistricts:${stateCode || "all"}:${districtCode || "all"}`;
        let subdistricts = readStaticLocationCache(cacheKey);
        if (!subdistricts) {
          subdistricts = querySubdistricts(stateCode, districtCode, db);
          writeStaticLocationCache(cacheKey, subdistricts);
        }
        return sendJson(res, 200, { ok: true, subdistricts }, {
          cacheControl: STATIC_LOCATION_CACHE_CONTROL,
        });
      }

      if (action === "villages") {
        const stateCode = urlObj.searchParams.get("state_code");
        const districtCode = urlObj.searchParams.get("district_code");
        const subdistrictCode = urlObj.searchParams.get("subdistrict_code");
        const q = urlObj.searchParams.get("q");
        const limit = urlObj.searchParams.get("limit") || "1000";
        const cacheKey = `villages:${stateCode || ""}:${districtCode || ""}:${
          subdistrictCode || ""
        }:${(q || "").toLowerCase()}:${limit}`;
        let villages = readStaticLocationCache(cacheKey);
        if (!villages) {
          villages = queryVillages(
            { stateCode, districtCode, subdistrictCode, q, limit },
            db
          );
          writeStaticLocationCache(cacheKey, villages);
        }
        return sendJson(res, 200, { ok: true, villages }, {
          cacheControl: STATIC_LOCATION_CACHE_CONTROL,
        });
      }

      if (action === "directory") {
        const replica = await resolveReplica(db);
        const level = urlObj.searchParams.get("level") || "villages";
        const stateCode = urlObj.searchParams.get("state_code");
        const districtCode = urlObj.searchParams.get("district_code");
        const subdistrictCode = urlObj.searchParams.get("subdistrict_code");
        const villageCode = urlObj.searchParams.get("village_code");
        const onlyWithRegistrations =
          urlObj.searchParams.get("only_with_registrations") === "1" ||
          urlObj.searchParams.get("only_with_registrations") === "true";
        const q = urlObj.searchParams.get("q");
        const page = Number(urlObj.searchParams.get("page") || "1");
        const pageSize = Number(urlObj.searchParams.get("page_size") || "24");
        const result = queryDirectory(
          {
            level,
            stateCode,
            districtCode,
            subdistrictCode,
            villageCode,
            onlyWithRegistrations,
            q,
            page,
            pageSize,
          },
          db
        );
        return sendJson(
          res,
          200,
          {
            ok: true,
            ...result,
            revision: replica.revision,
            degraded: replica.degraded,
            data_warning: replica.warning,
          },
          { revision: replica.revision }
        );
      }

      if (action === "public-families") {
        const replica = await resolveReplica(db);
        const stateCode = urlObj.searchParams.get("state_code");
        const districtCode = urlObj.searchParams.get("district_code");
        const subdistrictCode = urlObj.searchParams.get("subdistrict_code");
        const villageCode = urlObj.searchParams.get("village_code");
        const q = urlObj.searchParams.get("q");
        const page = Number(urlObj.searchParams.get("page") || "1");
        const pageSize = Number(urlObj.searchParams.get("page_size") || "20");
        const result = queryPublicFamilies(
          { stateCode, districtCode, subdistrictCode, villageCode, q, page, pageSize },
          db
        );
        return sendJson(
          res,
          200,
          {
            ok: true,
            ...result,
            revision: replica.revision,
            degraded: replica.degraded,
            data_warning: replica.warning,
          },
          { revision: replica.revision }
        );
      }

      if (action === "summary") {
        const replica = await resolveReplica(db);
        const stats = querySummaryStats(db);
        return sendJson(
          res,
          200,
          {
            ok: true,
            stats,
            summary: stats,
            revision: replica.revision,
            degraded: replica.degraded,
            data_warning: replica.warning,
            hydration: getHydrationState(),
          },
          { revision: replica.revision }
        );
      }

      // Ultra-light change-detection endpoint used by open directory pages to
      // refresh only when something actually changed (no full payload).
      if (action === "revision") {
        const replica = await resolveReplica(db);
        const stats = querySummaryStats(db);
        const clientRevision = urlObj.searchParams.get("revision") || "";
        const unchanged = Boolean(
          clientRevision && replica.revision && clientRevision === replica.revision
        );
        return sendJson(
          res,
          200,
          {
            ok: true,
            revision: replica.revision,
            unchanged,
            total_registrations: Number(stats.total_registrations) || 0,
            total_members: Number(stats.total_members) || 0,
            degraded: replica.degraded,
            data_warning: replica.warning,
          },
          { revision: replica.revision }
        );
      }

      if (action === "map-aggregates") {
        const replica = await resolveReplica(db);
        const clientRevision = urlObj.searchParams.get("revision") || "";

        // Nothing changed since the caller's last load: skip every query and
        // answer with a tiny payload.  This is what keeps 5-10 s polling cheap.
        if (
          clientRevision &&
          replica.revision &&
          clientRevision === replica.revision
        ) {
          const lightStats = querySummaryStats(db);
          return sendJson(
            res,
            200,
            {
              ok: true,
              unchanged: true,
              revision: replica.revision,
              summary: lightStats,
              stats: lightStats,
              total_registrations: Number(lightStats.total_registrations) || 0,
              total_members: Number(lightStats.total_members) || 0,
            },
            { revision: replica.revision }
          );
        }

        const stateCode = urlObj.searchParams.get("state_code");
        const districtCode = urlObj.searchParams.get("district_code");
        // One pass over the replica produces overview + map + family data that
        // are guaranteed to agree with each other.
        const snapshot = queryParivaarConsistentSnapshot(
          { stateCode, districtCode, page: 1, pageSize: 100 },
          db
        );
        return sendJson(
          res,
          200,
          {
            ok: true,
            aggregates: snapshot.aggregates,
            summary: snapshot.summary,
            public_families: snapshot.public_families,
            revision: replica.revision,
            degraded: replica.degraded,
            data_warning: replica.warning,
          },
          { revision: replica.revision }
        );
      }

      if (action === "consistency") {
        const replica = await resolveReplica(db);
        const consistency = verifyParivaarDataConsistency(db);
        return sendJson(res, 200, {
          ok: true,
          ...consistency,
          revision: replica.revision,
          hydration: getHydrationState(),
        });
      }

      if (action === "admin-data") {
        await resolveReplica(db);
        const filters = {
          q: urlObj.searchParams.get("q") || "",
          stateCode: urlObj.searchParams.get("state_code") || "",
          districtCode: urlObj.searchParams.get("district_code") || "",
          subdistrictCode: urlObj.searchParams.get("subdistrict_code") || "",
          villageCode: urlObj.searchParams.get("village_code") || "",
          status: urlObj.searchParams.get("status") || "all",
          publicVisibility: urlObj.searchParams.get("public_visibility") || "all",
          dateFrom: urlObj.searchParams.get("date_from") || "",
          dateTo: urlObj.searchParams.get("date_to") || "",
          page: Number(urlObj.searchParams.get("page") || "1"),
          pageSize: Number(urlObj.searchParams.get("page_size") || "100"),
        };
        const adminData = queryAdminParivaarData(filters, db);
        return sendJson(res, 200, { ok: true, ...adminData });
      }

      if (action === "admin-export") {
        await resolveReplica(db);
        const format = (urlObj.searchParams.get("format") || "xlsx")
          .trim()
          .toLowerCase();
        const includePrivate =
          urlObj.searchParams.get("include_private") !== "0";
        const filters = {
          q: urlObj.searchParams.get("q") || "",
          stateCode: urlObj.searchParams.get("state_code") || "",
          districtCode: urlObj.searchParams.get("district_code") || "",
          subdistrictCode: urlObj.searchParams.get("subdistrict_code") || "",
          villageCode: urlObj.searchParams.get("village_code") || "",
          status: urlObj.searchParams.get("status") || "all",
          publicVisibility: urlObj.searchParams.get("public_visibility") || "all",
          dateFrom: urlObj.searchParams.get("date_from") || "",
          dateTo: urlObj.searchParams.get("date_to") || "",
        };

        const exportData = buildAdminExportData(filters, db);

        const mainColumns = [
          { key: "family_id", header: "Family ID", type: "text", width: 18 },
          {
            key: "full_name",
            header: "Family Head's Name (परिवार के मुखिया का नाम)",
            type: "text",
            width: 28,
          },
          {
            key: "father_name",
            header: "Father's Name (पिता का नाम)",
            type: "text",
            width: 28,
          },
          {
            key: "member_count",
            header: "Number of Family Members (सदस्य संख्या)",
            type: "number",
            width: 22,
          },
          {
            key: "state_name",
            header: "State / UT (राज्य / केंद्रशासित प्रदेश)",
            type: "text",
            width: 22,
          },
          {
            key: "district_name",
            header: "District (जिला)",
            type: "text",
            width: 20,
          },
          {
            key: "subdistrict_name",
            header: "Tehsil / Block (तहसील / ब्लॉक)",
            type: "text",
            width: 22,
          },
          {
            key: "village_name",
            header: "Ancestral Village (पैतृक गाँव)",
            type: "text",
            width: 24,
          },
          {
            key: "village_code",
            header: "Official Village LGD Code",
            type: "text",
            width: 20,
          },
          ...(includePrivate
            ? [
                {
                  key: "current_address",
                  header: "Current Address (वर्तमान पता)",
                  type: "text",
                  width: 34,
                },
                {
                  key: "phone_number",
                  header: "Mobile Number (मोबाइल नंबर)",
                  type: "text",
                  width: 18,
                },
              ]
            : []),
          {
            key: "created_at",
            header: "Registration Date (पंजीकरण तिथि)",
            type: "text",
            width: 24,
          },
          {
            key: "status",
            header: "Status (स्थिति)",
            type: "text",
            width: 14,
          },
          {
            key: "public_visibility",
            header: "Public Visibility",
            type: "text",
            width: 16,
          },
        ];

        const stamp = new Date().toISOString().slice(0, 10);

        if (format === "csv") {
          const csvBuf = buildCsvBuffer(mainColumns, exportData.registrations);
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/csv; charset=utf-8");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="solanki-parivaar-registrations-${stamp}.csv"`
          );
          res.setHeader("Cache-Control", "no-store");
          return res.end(csvBuf);
        }

        const sheets = [
          {
            name: "All Registrations",
            columns: mainColumns,
            rows: exportData.registrations,
          },
          {
            name: "State Summary",
            columns: [
              { key: "state_code", header: "LGD State Code", type: "text", width: 16 },
              { key: "state_name", header: "State / UT (राज्य)", type: "text", width: 26 },
              { key: "family_count", header: "Registered Families (पंजीकृत परिवार)", type: "number", width: 24 },
              { key: "member_count", header: "Reported Family Members (कुल सदस्य)", type: "number", width: 24 },
              { key: "districts_count", header: "Districts Represented", type: "number", width: 20 },
              { key: "villages_count", header: "Villages Represented", type: "number", width: 20 },
            ],
            rows: exportData.stateSummary,
          },
          {
            name: "District Summary",
            columns: [
              { key: "district_code", header: "LGD District Code", type: "text", width: 18 },
              { key: "district_name", header: "District (जिला)", type: "text", width: 24 },
              { key: "state_name", header: "State / UT (राज्य)", type: "text", width: 24 },
              { key: "family_count", header: "Registered Families (पंजीकृत परिवार)", type: "number", width: 24 },
              { key: "member_count", header: "Reported Family Members (कुल सदस्य)", type: "number", width: 24 },
              { key: "villages_count", header: "Villages Represented", type: "number", width: 20 },
            ],
            rows: exportData.districtSummary,
          },
          {
            name: "Village Summary",
            columns: [
              { key: "village_code", header: "Official Village LGD Code", type: "text", width: 22 },
              { key: "village_name", header: "Village (गाँव)", type: "text", width: 26 },
              { key: "subdistrict_name", header: "Tehsil / Block (तहसील / ब्लॉक)", type: "text", width: 24 },
              { key: "district_name", header: "District (जिला)", type: "text", width: 22 },
              { key: "state_name", header: "State / UT (राज्य)", type: "text", width: 22 },
              { key: "family_count", header: "Registered Families (पंजीकृत परिवार)", type: "number", width: 24 },
              { key: "member_count", header: "Reported Family Members (कुल सदस्य)", type: "number", width: 24 },
            ],
            rows: exportData.villageSummary,
          },
          {
            name: "Thikana Summary",
            columns: [
              { key: "thikana_name", header: "Village / Thikana Association (गाँव / ठिकाना)", type: "text", width: 28 },
              { key: "village_code", header: "Official Village LGD Code", type: "text", width: 22 },
              { key: "district_name", header: "District (जिला)", type: "text", width: 22 },
              { key: "state_name", header: "State / UT (राज्य)", type: "text", width: 22 },
              { key: "family_count", header: "Registered Families (पंजीकृत परिवार)", type: "number", width: 24 },
              { key: "member_count", header: "Reported Family Members (कुल सदस्य)", type: "number", width: 24 },
            ],
            rows: exportData.thikanaSummary,
          },
        ];

        const xlsxBuf = buildXlsxWorkbookBuffer(sheets);
        res.statusCode = 200;
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="solanki-parivaar-directory-${stamp}.xlsx"`
        );
        res.setHeader("Cache-Control", "no-store");
        return res.end(xlsxBuf);
      }

      return sendJson(res, 400, {
        ok: false,
        code: "UNKNOWN_ACTION",
        message: `Unsupported GET action: '${action}'`,
      });
    }

    if (method === "POST") {
      const body = await readRequestBody(req);
      const postAction = action || String(body?.action || "").trim();

      if (postAction === "register") {
        // No forced full re-hydration here: the previous implementation pulled
        // the entire dataset from the database before every single write.
        await resolveReplica(db);
        const result = await createParivaarRegistration(body, db);

        // Keep the immediate confirmation cheap and consistent: overview
        // counters come from the same replica the directory reads.
        if (result.ok) {
          const stats = querySummaryStats(db);
          result.summary = stats;
          result.stats = stats;
        }

        const statusCode = result.ok
          ? 201
          : result.code === "DUPLICATE_REGISTRATION"
            ? 409
            : "PERSISTENCE_FAILED" === result.code
              ? 503
              : 400;
        return sendJson(res, statusCode, result, {
          revision: result.revision || null,
        });
      }

      if (postAction === "missing-location") {
        await resolveReplica(db);
        const result = insertMissingLocationReport(body, db);
        if (result.ok) {
          const reportRow = db
            .prepare(
              `SELECT id, reporter_name, reporter_phone, state_code, district_code,
                      subdistrict_code, missing_level, proposed_name, parent_context,
                      pincode, notes, status, created_at
               FROM missing_location_reports WHERE id = ?`
            )
            .get(result.id);
          if (reportRow) await persistMissingLocationReport(reportRow);
        }
        const statusCode = result.ok ? 201 : 400;
        return sendJson(res, statusCode, result);
      }

      if (postAction === "admin-update") {
        await resolveReplica(db);
        const result = updateAdminRecord(body, db);
        if (result.ok) {
          const deletedId =
            body?.entity === "registration" && body?.operation === "delete"
              ? body?.id
              : null;
          await syncDatabaseStateToPostgres(db, {
            deletedId,
            registrationId: deletedId ? null : body?.id || null,
          });
        }
        return sendJson(res, result.ok ? 200 : 400, result);
      }

      return sendJson(res, 400, {
        ok: false,
        code: "UNKNOWN_ACTION",
        message: `Unsupported POST action: '${postAction}'`,
      });
    }

    return sendJson(res, 405, { ok: false, message: "Method not allowed" });
  } catch (err) {
    return sendJson(res, 500, {
      ok: false,
      code: "DATABASE_ERROR",
      message: err?.message || "Database query failed.",
    });
  }
}
