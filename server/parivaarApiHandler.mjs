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
  insertParivaarRegistration,
  insertMissingLocationReport,
  queryAdminParivaarData,
  buildAdminExportData,
  updateAdminRecord,
} from "./parivaarDatabase.mjs";
import {
  ensurePostgresHydrated,
  persistRegistrationToPostgres,
  syncDatabaseStateToPostgres,
} from "./parivaarPostgresSync.mjs";
import { buildCsvBuffer, buildXlsxWorkbookBuffer } from "./xlsxBuilder.mjs";

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
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
        const states = queryStates(db);
        return sendJson(res, 200, { ok: true, states });
      }

      if (action === "districts") {
        const stateCode = urlObj.searchParams.get("state_code");
        const districts = queryDistricts(stateCode, db);
        return sendJson(res, 200, { ok: true, districts });
      }

      if (action === "subdistricts") {
        const stateCode = urlObj.searchParams.get("state_code");
        const districtCode = urlObj.searchParams.get("district_code");
        const subdistricts = querySubdistricts(stateCode, districtCode, db);
        return sendJson(res, 200, { ok: true, subdistricts });
      }

      if (action === "villages") {
        const stateCode = urlObj.searchParams.get("state_code");
        const districtCode = urlObj.searchParams.get("district_code");
        const subdistrictCode = urlObj.searchParams.get("subdistrict_code");
        const q = urlObj.searchParams.get("q");
        const limit = urlObj.searchParams.get("limit") || "1000";
        const villages = queryVillages(
          { stateCode, districtCode, subdistrictCode, q, limit },
          db
        );
        return sendJson(res, 200, { ok: true, villages });
      }

      if (action === "directory") {
        await ensurePostgresHydrated(db);
        const level = urlObj.searchParams.get("level") || "states";
        const stateCode = urlObj.searchParams.get("state_code");
        const districtCode = urlObj.searchParams.get("district_code");
        const subdistrictCode = urlObj.searchParams.get("subdistrict_code");
        const q = urlObj.searchParams.get("q");
        const page = Number(urlObj.searchParams.get("page") || "1");
        const pageSize = Number(urlObj.searchParams.get("page_size") || "24");
        const result = queryDirectory(
          { level, stateCode, districtCode, subdistrictCode, q, page, pageSize },
          db
        );
        return sendJson(res, 200, { ok: true, ...result });
      }

      if (action === "public-families") {
        await ensurePostgresHydrated(db);
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
        return sendJson(res, 200, { ok: true, ...result });
      }

      if (action === "summary") {
        await ensurePostgresHydrated(db);
        const stats = querySummaryStats(db);
        return sendJson(res, 200, { ok: true, stats, summary: stats });
      }

      if (action === "map-aggregates") {
        await ensurePostgresHydrated(db);
        const stateCode = urlObj.searchParams.get("state_code");
        const districtCode = urlObj.searchParams.get("district_code");
        const aggregates = queryMapAggregates({ stateCode, districtCode }, db);
        const summary = querySummaryStats(db);
        return sendJson(res, 200, { ok: true, aggregates, summary });
      }

      if (action === "admin-data") {
        await ensurePostgresHydrated(db);
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
        await ensurePostgresHydrated(db);
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
        await ensurePostgresHydrated(db, { force: true });
        const result = insertParivaarRegistration(body, db);
        if (result.ok) {
          const pgSync = await persistRegistrationToPostgres(result, db);
          result.pg_persisted = Boolean(pgSync.pg_persisted);
        }
        const statusCode = result.ok ? 201 : result.code === "DUPLICATE_REGISTRATION" ? 409 : 400;
        return sendJson(res, statusCode, result);
      }

      if (postAction === "missing-location") {
        await ensurePostgresHydrated(db, { force: true });
        const result = insertMissingLocationReport(body, db);
        if (result.ok) {
          await syncDatabaseStateToPostgres(db);
        }
        const statusCode = result.ok ? 201 : 400;
        return sendJson(res, statusCode, result);
      }

      if (postAction === "admin-update") {
        await ensurePostgresHydrated(db, { force: true });
        const result = updateAdminRecord(body, db);
        if (result.ok) {
          const deletedId =
            body?.entity === "registration" && body?.operation === "delete"
              ? body?.id
              : null;
          await syncDatabaseStateToPostgres(db, { deletedId });
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
