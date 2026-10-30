import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const PG_STORE_KEY = "parivaar_pg_store_v1";
const HYDRATION_TTL_MS = 4000;

let cachedClient = null;
let cachedClientKey = "";
let lastHydratedAt = 0;

function getSupabaseServerCredentials() {
  const url = String(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ""
  ).trim();
  const key = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      ""
  ).trim();

  if (
    !url ||
    !key ||
    url.includes("placeholder.supabase.co") ||
    key === "placeholder-key"
  ) {
    return null;
  }

  return { url, key };
}

function getSupabaseServerClient() {
  const creds = getSupabaseServerCredentials();
  if (!creds) return null;
  const sig = `${creds.url}|${creds.key}`;
  if (!cachedClient || cachedClientKey !== sig) {
    cachedClient = createClient(creds.url, creds.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    cachedClientKey = sig;
  }
  return cachedClient;
}

function deriveEncryptionKey(secret) {
  return crypto
    .createHash("sha256")
    .update(`khema_mata_parivaar_pii_v1:${secret}`)
    .digest();
}

function encryptText(plainText, secret) {
  if (plainText === null || plainText === undefined || plainText === "") {
    return "";
  }
  const key = deriveEncryptionKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(plainText), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `enc1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptText(cipherText, secret) {
  if (!cipherText || typeof cipherText !== "string") return "";
  if (!cipherText.startsWith("enc1:")) return cipherText;
  try {
    const parts = cipherText.split(":");
    if (parts.length !== 4) return "";
    const iv = Buffer.from(parts[1], "base64");
    const tag = Buffer.from(parts[2], "base64");
    const data = Buffer.from(parts[3], "base64");
    const key = deriveEncryptionKey(secret);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      "utf8"
    );
  } catch {
    return "";
  }
}

async function withTimeout(promise, ms = 3500) {
  let timer = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("PG_TIMEOUT")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Hydrates the local SQLite database from PostgreSQL (`public.site_content` + `public.parivaar_registrations` RPC)
 * so that Vercel Serverless cold starts preserve all registrations, sequence counters, and audit logs.
 */
export async function ensurePostgresHydrated(db, { force = false } = {}) {
  const creds = getSupabaseServerCredentials();
  const client = getSupabaseServerClient();
  if (!creds || !client || !db) {
    return { hydrated: false, reason: "unconfigured" };
  }

  const now = Date.now();
  if (!force && lastHydratedAt > 0 && now - lastHydratedAt < HYDRATION_TTL_MS) {
    return { hydrated: true, cached: true };
  }

  let hydratedFromStore = false;
  let hydratedCount = 0;

  try {
    // 1. Read encrypted registry store from PostgreSQL `public.site_content`
    const { data: storeRow, error: storeErr } = await withTimeout(
      client
        .from("site_content")
        .select("key, value")
        .eq("key", PG_STORE_KEY)
        .maybeSingle(),
      3500
    );

    if (!storeErr && storeRow && storeRow.value) {
      let parsed = null;
      try {
        parsed = JSON.parse(storeRow.value);
      } catch {
        parsed = null;
      }

      if (parsed && typeof parsed === "object") {
        hydratedFromStore = true;
        const regs = Array.isArray(parsed.registrations)
          ? parsed.registrations
          : [];
        const counters = Array.isArray(parsed.counters) ? parsed.counters : [];
        const audits = Array.isArray(parsed.audit_logs)
          ? parsed.audit_logs
          : [];
        const reports = Array.isArray(parsed.missing_reports)
          ? parsed.missing_reports
          : [];
        const deletedIds = new Set(
          Array.isArray(parsed.deleted_ids) ? parsed.deleted_ids : []
        );

        db.exec("BEGIN IMMEDIATE");
        try {
          for (const delId of deletedIds) {
            db.prepare("DELETE FROM parivaar_registrations WHERE id = ?").run(
              String(delId)
            );
          }

          const upsertCounterStmt = db.prepare(
            `INSERT INTO village_family_id_counters (village_code, last_seq, updated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(village_code) DO UPDATE SET
               last_seq = MAX(village_family_id_counters.last_seq, excluded.last_seq),
               updated_at = excluded.updated_at`
          );

          for (const c of counters) {
            if (!c || !c.village_code) continue;
            upsertCounterStmt.run(
              String(c.village_code),
              Number(c.last_seq) || 0,
              c.updated_at || new Date().toISOString()
            );
          }

          const upsertRegStmt = db.prepare(
            `INSERT INTO parivaar_registrations (
               id, family_id, full_name, father_name, member_count,
               state_code, district_code, subdistrict_code, village_code,
               thikana, thikana_same_as_village, current_address, phone_number,
               consent_given, public_visibility, status, admin_note,
               created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               family_id = COALESCE(parivaar_registrations.family_id, excluded.family_id),
               full_name = excluded.full_name,
               father_name = excluded.father_name,
               member_count = excluded.member_count,
               state_code = excluded.state_code,
               district_code = excluded.district_code,
               subdistrict_code = excluded.subdistrict_code,
               village_code = excluded.village_code,
               thikana = excluded.thikana,
               thikana_same_as_village = excluded.thikana_same_as_village,
               current_address = excluded.current_address,
               phone_number = excluded.phone_number,
               public_visibility = excluded.public_visibility,
               status = excluded.status,
               admin_note = excluded.admin_note,
               updated_at = excluded.updated_at`
          );

          for (const r of regs) {
            if (!r || !r.id || deletedIds.has(String(r.id))) continue;
            const fullName = r.full_name_enc
              ? decryptText(r.full_name_enc, creds.key)
              : r.full_name || "";
            const fatherName = r.father_name_enc
              ? decryptText(r.father_name_enc, creds.key)
              : r.father_name || null;
            const currentAddress = r.current_address_enc
              ? decryptText(r.current_address_enc, creds.key)
              : r.current_address || "India";
            const phoneNumber = r.phone_number_enc
              ? decryptText(r.phone_number_enc, creds.key)
              : r.phone_number || "9000000000";

            if (!fullName) continue;

            try {
              upsertRegStmt.run(
                String(r.id),
                r.family_id ? String(r.family_id) : null,
                String(fullName),
                fatherName ? String(fatherName) : null,
                Math.max(1, Number(r.member_count) || 1),
                String(r.state_code || "8"),
                String(r.district_code || "94"),
                String(r.subdistrict_code || "6033"),
                r.village_code ? String(r.village_code) : null,
                String(r.thikana || ""),
                r.thikana_same_as_village === false ? 0 : 1,
                String(currentAddress),
                String(phoneNumber),
                1,
                String(r.public_visibility || "default"),
                String(r.status || "approved"),
                r.admin_note ? String(r.admin_note) : null,
                r.created_at || new Date().toISOString(),
                r.updated_at || r.created_at || new Date().toISOString()
              );
              hydratedCount += 1;
            } catch {
              // Ignore individual row conflict if duplicate phone+name+district exists under another id
            }

            if (r.family_id && r.village_code) {
              const seqPart = Number(
                String(r.family_id).split("-")[1]?.replace(/\D/g, "") || 0
              );
              if (seqPart > 0) {
                upsertCounterStmt.run(
                  String(r.village_code),
                  seqPart,
                  r.updated_at || new Date().toISOString()
                );
              }
            }
          }

          const upsertAuditStmt = db.prepare(
            `INSERT OR IGNORE INTO registration_audit_log (
               id, registration_id, family_id, action, changed_fields,
               previous_values, new_values, admin_note, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          );
          for (const a of audits) {
            if (!a || !a.id) continue;
            upsertAuditStmt.run(
              String(a.id),
              String(a.registration_id || ""),
              String(a.family_id || ""),
              String(a.action || "updated"),
              typeof a.changed_fields === "string"
                ? a.changed_fields
                : JSON.stringify(a.changed_fields || []),
              typeof a.previous_values === "string"
                ? a.previous_values
                : JSON.stringify(a.previous_values || {}),
              typeof a.new_values === "string"
                ? a.new_values
                : JSON.stringify(a.new_values || {}),
              a.admin_note || null,
              a.created_at || new Date().toISOString()
            );
          }

          const upsertReportStmt = db.prepare(
            `INSERT OR IGNORE INTO missing_location_reports (
               id, reporter_name, reporter_phone, state_code, district_code,
               subdistrict_code, missing_level, proposed_name, parent_context,
               pincode, notes, status, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          );
          for (const rep of reports) {
            if (!rep || !rep.id) continue;
            const repPhone = rep.reporter_phone_enc
              ? decryptText(rep.reporter_phone_enc, creds.key)
              : rep.reporter_phone || null;
            upsertReportStmt.run(
              String(rep.id),
              String(rep.reporter_name || ""),
              repPhone || null,
              rep.state_code || null,
              rep.district_code || null,
              rep.subdistrict_code || null,
              String(rep.missing_level || "village"),
              String(rep.proposed_name || ""),
              rep.parent_context || null,
              rep.pincode || null,
              rep.notes || null,
              String(rep.status || "pending"),
              rep.created_at || new Date().toISOString()
            );
          }

          db.exec("COMMIT");
        } catch (txErr) {
          try {
            db.exec("ROLLBACK");
          } catch {
            // ignore
          }
          throw txErr;
        }
      }
    }

    lastHydratedAt = Date.now();
    return {
      hydrated: true,
      hydratedFromStore,
      hydratedCount,
    };
  } catch (err) {
    return {
      hydrated: false,
      error: err?.message || "Failed to hydrate from PostgreSQL",
    };
  }
}

/**
 * Serializes and saves the current SQLite Parivaar state (`parivaar_registrations`,
 * `village_family_id_counters`, `registration_audit_log`, `missing_location_reports`)
 * into PostgreSQL (`public.site_content` key `parivaar_pg_store_v1`) with AES-256-GCM
 * encryption for all private fields (`phone_number`, `current_address`, and private records).
 */
export async function syncDatabaseStateToPostgres(
  db,
  { deletedId = null } = {}
) {
  const creds = getSupabaseServerCredentials();
  const client = getSupabaseServerClient();
  if (!creds || !client || !db) {
    return { ok: false, skipped: true };
  }

  try {
    let existingDeletedIds = [];
    const { data: existingRow } = await withTimeout(
      client
        .from("site_content")
        .select("value")
        .eq("key", PG_STORE_KEY)
        .maybeSingle(),
      3000
    );
    if (existingRow?.value) {
      try {
        const parsed = JSON.parse(existingRow.value);
        if (Array.isArray(parsed?.deleted_ids)) {
          existingDeletedIds = parsed.deleted_ids;
        }
      } catch {
        // ignore
      }
    }
    if (deletedId && !existingDeletedIds.includes(String(deletedId))) {
      existingDeletedIds.push(String(deletedId));
    }

    const registrations = db
      .prepare(
        `SELECT id, family_id, full_name, father_name, member_count,
                state_code, district_code, subdistrict_code, village_code,
                thikana, thikana_same_as_village, current_address, phone_number,
                consent_given, public_visibility, status, admin_note,
                created_at, updated_at
         FROM parivaar_registrations
         ORDER BY created_at ASC`
      )
      .all()
      .map((r) => {
        const isPrivate = String(r.public_visibility) === "private";
        return {
          id: r.id,
          family_id: r.family_id,
          full_name: isPrivate ? "" : r.full_name,
          full_name_enc: encryptText(r.full_name, creds.key),
          father_name: isPrivate ? null : r.father_name || null,
          father_name_enc: r.father_name
            ? encryptText(r.father_name, creds.key)
            : null,
          member_count: Number(r.member_count) || 1,
          state_code: r.state_code,
          district_code: r.district_code,
          subdistrict_code: r.subdistrict_code,
          village_code: r.village_code,
          thikana: r.thikana,
          thikana_same_as_village: Boolean(r.thikana_same_as_village),
          current_address_enc: encryptText(r.current_address, creds.key),
          phone_number_enc: encryptText(r.phone_number, creds.key),
          public_visibility: r.public_visibility || "default",
          status: r.status || "approved",
          admin_note: r.admin_note || null,
          created_at: r.created_at,
          updated_at: r.updated_at,
        };
      });

    const counters = db
      .prepare(
        `SELECT village_code, last_seq, updated_at
         FROM village_family_id_counters`
      )
      .all();

    const auditLogs = db
      .prepare(
        `SELECT id, registration_id, family_id, action, changed_fields,
                previous_values, new_values, admin_note, created_at
         FROM registration_audit_log
         ORDER BY created_at DESC
         LIMIT 200`
      )
      .all();

    const missingReports = db
      .prepare(
        `SELECT id, reporter_name, reporter_phone, state_code, district_code,
                subdistrict_code, missing_level, proposed_name, parent_context,
                pincode, notes, status, created_at
         FROM missing_location_reports
         ORDER BY created_at DESC
         LIMIT 200`
      )
      .all()
      .map((rep) => ({
        ...rep,
        reporter_phone: null,
        reporter_phone_enc: rep.reporter_phone
          ? encryptText(rep.reporter_phone, creds.key)
          : null,
      }));

    const payload = {
      version: 1,
      updated_at: new Date().toISOString(),
      deleted_ids: existingDeletedIds.slice(-500),
      registrations,
      counters,
      audit_logs: auditLogs,
      missing_reports: missingReports,
    };

    const { error: upsertErr } = await withTimeout(
      client
        .from("site_content")
        .upsert(
          { key: PG_STORE_KEY, value: JSON.stringify(payload) },
          { onConflict: "key" }
        ),
      3500
    );

    lastHydratedAt = Date.now();
    return { ok: !upsertErr, error: upsertErr || null };
  } catch (err) {
    return { ok: false, error: err };
  }
}

/**
 * Persists a newly created registration into PostgreSQL:
 * 1. Invokes `public.submit_parivaar_registration` RPC on Supabase PostgreSQL
 *    (trying the extended 17-param signature with `p_father_name`, `p_member_count`, `p_family_id`
 *    and falling back to the 10-param signature if the database migration hasn't been updated yet).
 * 2. Syncs the encrypted registry store in `public.site_content` (`parivaar_pg_store_v1`) so
 *    that all fields (`family_id`, `father_name`, `member_count`, etc.) and counters are
 *    guaranteed to persist in PostgreSQL across Vercel Serverless cold starts.
 */
export async function persistRegistrationToPostgres(regResult, db) {
  const client = getSupabaseServerClient();
  if (!client || !regResult?.registration) {
    return { ok: false, pg_persisted: false, reason: "unconfigured" };
  }

  const reg = regResult.registration;
  let rpcSaved = false;
  let rpcError = null;

  try {
    const fullRpcParams = {
      p_full_name: reg.full_name,
      p_state_code: reg.state_code,
      p_district_code: reg.district_code,
      p_subdistrict_code: reg.subdistrict_code,
      p_village_code: reg.village_code,
      p_thikana: reg.thikana,
      p_current_address: reg.current_address,
      p_phone_number: reg.phone_number,
      p_consent_given: true,
      p_thikana_same_as_village: Boolean(reg.thikana_same_as_village),
      p_father_name: reg.father_name || null,
      p_member_count: Number(reg.member_count) || 1,
      p_family_id: reg.family_id || null,
      p_state_name: reg.state_name || null,
      p_district_name: reg.district_name || null,
      p_subdistrict_name: reg.subdistrict_name || null,
      p_village_name: reg.village_name || null,
    };

    const { data, error } = await withTimeout(
      client.rpc("submit_parivaar_registration", fullRpcParams),
      3500
    );

    if (!error && data?.ok !== false) {
      rpcSaved = true;
    } else if (error) {
      // Fallback to 10-argument signature if the database still has the earlier RPC signature
      const legacyRpcParams = {
        p_full_name: reg.full_name,
        p_state_code: reg.state_code,
        p_district_code: reg.district_code,
        p_subdistrict_code: reg.subdistrict_code,
        p_village_code: reg.village_code,
        p_thikana: reg.thikana,
        p_current_address: reg.current_address,
        p_phone_number: reg.phone_number,
        p_consent_given: true,
        p_thikana_same_as_village: Boolean(reg.thikana_same_as_village),
      };
      const { data: legacyData, error: legacyErr } = await withTimeout(
        client.rpc("submit_parivaar_registration", legacyRpcParams),
        3500
      );
      if (!legacyErr && legacyData?.ok !== false) {
        rpcSaved = true;
      } else {
        rpcError = legacyErr?.message || error?.message || data?.message;
      }
    }
  } catch (err) {
    rpcError = err?.message || "RPC call failed";
  }

  const storeSync = await syncDatabaseStateToPostgres(db);
  const storeSaved = Boolean(storeSync?.ok);

  return {
    ok: rpcSaved || storeSaved,
    pg_persisted: rpcSaved || storeSaved,
    rpc_saved: rpcSaved,
    store_saved: storeSaved,
    rpc_error: rpcError,
  };
}
