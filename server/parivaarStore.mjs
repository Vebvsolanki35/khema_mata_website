/**
 * Parivaar durable store (Supabase PostgreSQL over PostgREST)
 * ---------------------------------------------------------------------------
 * The existing architecture kept every registration inside ONE encrypted JSON
 * document (`site_content.key = 'parivaar_pg_store_v1'`).  Every registration
 * therefore had to read, decrypt, re-encrypt and re-upload the *entire* dataset
 * (twice: `site_content` + Supabase Storage).  That is O(N) per write, is prone
 * to lost updates when two serverless instances write concurrently, and makes
 * new registrations progressively slower.
 *
 * This module stores one independent row per registration instead:
 *
 *   site_content.key = 'parivaar_reg_v1:<registration id>'  -> one record
 *   site_content.key = 'parivaar_del_v1:<registration id>'  -> tombstone
 *   site_content.key = 'parivaar_rev_v1'                    -> revision token
 *   site_content.key = 'parivaar_store_v2'                  -> v1 -> v2 marker
 *
 * Benefits:
 *  - A write touches one small row (no read-modify-write of the whole dataset).
 *  - Concurrent registrations can never overwrite each other.
 *  - A tiny revision row lets every serverless instance detect "something
 *    changed" with a single cheap query instead of re-downloading everything.
 *
 * Privacy is unchanged: `phone_number`, `current_address`, and private record
 * names are encrypted with AES-256-GCM before they are stored, exactly as
 * before.  The legacy document is never deleted and is still readable, so no
 * existing registration can be lost.
 */

import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const KV_TABLE = "site_content";
export const LEGACY_STORE_KEY = "parivaar_pg_store_v1";
export const REVISION_KEY = "parivaar_rev_v1";
export const MIGRATION_KEY = "parivaar_store_v2";
export const RECORD_KEY_PREFIX = "parivaar_reg_v1:";
export const TOMBSTONE_KEY_PREFIX = "parivaar_del_v1:";
export const AUDIT_KEY_PREFIX = "parivaar_audit_v1:";
export const STORAGE_BUCKET = "gallery";
export const STORAGE_OBJECT_PATH = "_system/parivaar_pg_store_v1.json";

const DEFAULT_TIMEOUT_MS = 4000;

let cachedClient = null;
let cachedClientKey = "";

/* ------------------------------------------------------------------ */
/* Client + environment                                                */
/* ------------------------------------------------------------------ */

export function getSupabaseServerCredentials() {
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

export function isStoreConfigured() {
  return Boolean(getSupabaseServerCredentials());
}

/**
 * Returns a process-wide Supabase client.  `@supabase/supabase-js` performs
 * HTTP requests through a keep-alive fetch dispatcher, so reusing one client
 * instance reuses TCP/TLS connections instead of reconnecting per query.
 * There are no long-lived PostgreSQL sockets to leak because PostgREST is
 * HTTP-based and connection pooling is handled by Supabase (PgBouncer).
 */
export function getSupabaseServerClient() {
  const creds = getSupabaseServerCredentials();
  if (!creds) return null;
  const signature = `${creds.url}|${creds.key}`;
  if (!cachedClient || cachedClientKey !== signature) {
    cachedClient = createClient(creds.url, creds.key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: { "x-application-name": "khema-mata-parivaar" },
        // Bound every request so a slow database can never hang a serverless
        // function until the platform timeout.
        fetch: (input, init = {}) => {
          const controller = new AbortController();
          const timer = setTimeout(
            () => controller.abort(new Error("DATABASE_TIMEOUT")),
            DEFAULT_TIMEOUT_MS
          );
          const signal =
            init.signal && typeof AbortSignal.any === "function"
              ? AbortSignal.any([init.signal, controller.signal])
              : controller.signal;
          return fetch(input, { ...init, signal }).finally(() =>
            clearTimeout(timer)
          );
        },
      },
    });
    cachedClientKey = signature;
  }
  return cachedClient;
}

export async function withTimeout(promise, ms = DEFAULT_TIMEOUT_MS, label = "DB") {
  let timer = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label}_TIMEOUT`)),
          Math.max(1, ms)
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Field encryption (unchanged format: enc1:iv:tag:ciphertext)         */
/* ------------------------------------------------------------------ */

export function deriveEncryptionKey(secret) {
  return crypto
    .createHash("sha256")
    .update(`khema_mata_parivaar_pii_v1:${secret}`)
    .digest();
}

export function encryptText(plainText, secret) {
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

export function decryptText(cipherText, secret) {
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

/**
 * Serializes a SQLite registration row into the encrypted record shape that is
 * persisted for that single registration.
 */
export function serializeRecord(row, secret) {
  const isPrivate = String(row.public_visibility) === "private";
  return {
    v: 2,
    id: row.id,
    family_id: row.family_id || null,
    full_name: isPrivate ? "" : row.full_name,
    full_name_enc: encryptText(row.full_name, secret),
    father_name: isPrivate ? null : row.father_name || null,
    father_name_enc: row.father_name ? encryptText(row.father_name, secret) : null,
    member_count: Number(row.member_count) || 1,
    state_code: row.state_code,
    district_code: row.district_code,
    subdistrict_code: row.subdistrict_code,
    village_code: row.village_code || null,
    thikana: row.thikana || "",
    thikana_same_as_village: Boolean(row.thikana_same_as_village),
    current_address: "",
    current_address_enc: encryptText(row.current_address, secret),
    phone_number: "",
    phone_number_enc: encryptText(row.phone_number, secret),
    public_visibility: row.public_visibility || "default",
    status: row.status || "approved",
    admin_note: row.admin_note || null,
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
    idempotency_key: row.idempotency_key || null,
  };
}

/**
 * Converts a stored record (per-record row or legacy document entry) back into
 * the plain registration fields written into the SQLite replica.
 */
export function deserializeRecord(record, secret) {
  if (!record || !record.id) return null;
  const fullName = record.full_name_enc
    ? decryptText(record.full_name_enc, secret)
    : record.full_name || "";
  if (!fullName) return null;
  return {
    id: String(record.id),
    family_id: record.family_id ? String(record.family_id) : null,
    full_name: String(fullName),
    father_name: record.father_name_enc
      ? decryptText(record.father_name_enc, secret) || null
      : record.father_name || null,
    member_count: Math.max(1, Number(record.member_count) || 1),
    state_code: String(record.state_code || "8"),
    district_code: String(record.district_code || "94"),
    subdistrict_code: String(record.subdistrict_code || "6033"),
    village_code: record.village_code ? String(record.village_code) : null,
    thikana: String(record.thikana || ""),
    thikana_same_as_village: record.thikana_same_as_village === false ? 0 : 1,
    current_address: record.current_address_enc
      ? decryptText(record.current_address_enc, secret) || "India"
      : record.current_address || "India",
    phone_number: record.phone_number_enc
      ? decryptText(record.phone_number_enc, secret) || "9000000000"
      : record.phone_number || "9000000000",
    public_visibility: String(record.public_visibility || "default"),
    status: String(record.status || "approved"),
    admin_note: record.admin_note ? String(record.admin_note) : null,
    created_at: record.created_at || new Date().toISOString(),
    updated_at: record.updated_at || record.created_at || new Date().toISOString(),
    idempotency_key: record.idempotency_key || null,
  };
}

/* ------------------------------------------------------------------ */
/* Revision token                                                      */
/* ------------------------------------------------------------------ */

function makeRevisionToken(writer = "server") {
  return `${Date.now().toString(36)}-${crypto.randomBytes(6).toString("hex")}-${writer}`;
}

export async function readRevision({ timeoutMs = 2000 } = {}) {
  const client = getSupabaseServerClient();
  if (!client) return null;
  try {
    const { data, error } = await withTimeout(
      client
        .from(KV_TABLE)
        .select("key, value")
        .eq("key", REVISION_KEY)
        .maybeSingle(),
      timeoutMs,
      "REVISION"
    );
    if (error || !data?.value) return null;
    const parsed = JSON.parse(data.value);
    return {
      rev: String(parsed.rev || ""),
      updatedAt: parsed.updated_at || null,
      counts: parsed.counts || null,
    };
  } catch {
    return null;
  }
}

/**
 * Publishes a new revision token.  Called only AFTER the record write has been
 * acknowledged by the database, so a reader that sees a new token can always
 * read the committed record.
 */
export async function bumpRevision({ writer = "server", counts = null } = {}) {
  const client = getSupabaseServerClient();
  if (!client) return null;
  const token = makeRevisionToken(writer);
  const payload = {
    key: REVISION_KEY,
    value: JSON.stringify({
      rev: token,
      updated_at: new Date().toISOString(),
      writer,
      counts,
    }),
  };
  try {
    const { error } = await withTimeout(
      client.from(KV_TABLE).upsert(payload, { onConflict: "key" }),
      2500,
      "REVISION_WRITE"
    );
    if (error) return null;
    return {
      rev: token,
      updatedAt: JSON.parse(payload.value).updated_at,
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Per-record rows                                                     */
/* ------------------------------------------------------------------ */

function recordKey(id) {
  return `${RECORD_KEY_PREFIX}${id}`;
}

function tombstoneKey(id) {
  return `${TOMBSTONE_KEY_PREFIX}${id}`;
}

/**
 * Lists every stored registration record.  PostgREST caps response size, so
 * rows are paged; in practice the dataset is small and one page is enough.
 */
export async function listRecordRows({ pageSize = 1000, maxPages = 20 } = {}) {
  const client = getSupabaseServerClient();
  if (!client) return { rows: [], error: "unconfigured" };
  const rows = [];
  try {
    for (let page = 0; page < maxPages; page += 1) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await withTimeout(
        client
          .from(KV_TABLE)
          .select("key, value")
          .like("key", `${RECORD_KEY_PREFIX}*`)
          .order("key", { ascending: true })
          .range(from, to),
        5000,
        "RECORDS_READ"
      );
      if (error) return { rows, error: error.message || "records read failed" };
      const pageRows = Array.isArray(data) ? data : [];
      rows.push(...pageRows);
      if (pageRows.length < pageSize) break;
    }
    return { rows, error: null };
  } catch (err) {
    return { rows, error: err?.message || "records read failed" };
  }
}

export async function listTombstones() {
  const client = getSupabaseServerClient();
  if (!client) return { ids: [], error: "unconfigured" };
  try {
    const { data, error } = await withTimeout(
      client
        .from(KV_TABLE)
        .select("key")
        .like("key", `${TOMBSTONE_KEY_PREFIX}*`)
        .limit(1000),
      3000,
      "TOMBSTONES_READ"
    );
    if (error) return { ids: [], error: error.message };
    const ids = (Array.isArray(data) ? data : [])
      .map((row) => String(row.key || "").slice(TOMBSTONE_KEY_PREFIX.length))
      .filter(Boolean);
    return { ids, error: null };
  } catch (err) {
    return { ids: [], error: err?.message || "tombstones read failed" };
  }
}

/**
 * Writes a single registration record.  This is one small row, so concurrent
 * writers cannot clobber each other and write cost no longer grows with the
 * number of registered families.
 */
export async function upsertRecord(
  row,
  secret,
  { timeoutMs = 3500, extraRows = [] } = {}
) {
  const client = getSupabaseServerClient();
  if (!client || !row?.id) return { ok: false, reason: "unconfigured" };
  const record = serializeRecord(row, secret);
  const payload = [
    { key: recordKey(record.id), value: JSON.stringify(record) },
    ...extraRows,
  ];
  try {
    const { error } = await withTimeout(
      client.from(KV_TABLE).upsert(payload, { onConflict: "key" }),
      timeoutMs,
      "RECORD_WRITE"
    );
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err?.message || "record write failed" };
  }
}

export async function deleteRecord(id, { deletedAt = null, timeoutMs = 3000 } = {}) {
  const client = getSupabaseServerClient();
  if (!client || !id) return { ok: false, reason: "unconfigured" };
  try {
    const tombstone = {
      key: tombstoneKey(id),
      value: JSON.stringify({
        id: String(id),
        deleted_at: deletedAt || new Date().toISOString(),
      }),
    };
    const [tomb, del] = await Promise.all([
      withTimeout(
        client.from(KV_TABLE).upsert(tombstone, { onConflict: "key" }),
        timeoutMs,
        "TOMBSTONE_WRITE"
      ),
      withTimeout(
        client.from(KV_TABLE).delete().eq("key", recordKey(id)),
        timeoutMs,
        "RECORD_DELETE"
      ),
    ]);
    if (tomb.error || del.error) {
      return { ok: false, reason: tomb.error?.message || del.error?.message };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err?.message || "record delete failed" };
  }
}

export async function readMigrationMarker() {
  const client = getSupabaseServerClient();
  if (!client) return null;
  try {
    const { data, error } = await withTimeout(
      client.from(KV_TABLE).select("key, value").eq("key", MIGRATION_KEY).maybeSingle(),
      2000,
      "MARKER_READ"
    );
    if (error || !data?.value) return null;
    return JSON.parse(data.value);
  } catch {
    return null;
  }
}

export async function writeMigrationMarker(info) {
  const client = getSupabaseServerClient();
  if (!client) return false;
  try {
    const { error } = await withTimeout(
      client
        .from(KV_TABLE)
        .upsert(
          { key: MIGRATION_KEY, value: JSON.stringify({ ...info, migrated_at: new Date().toISOString() }) },
          { onConflict: "key" }
        ),
      2500,
      "MARKER_WRITE"
    );
    return !error;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Legacy document (read-only compatibility)                           */
/* ------------------------------------------------------------------ */

export async function readLegacyBlob() {
  const client = getSupabaseServerClient();
  if (!client) return null;

  try {
    const { data, error } = await withTimeout(
      client
        .from(KV_TABLE)
        .select("key, value")
        .eq("key", LEGACY_STORE_KEY)
        .maybeSingle(),
      3500,
      "LEGACY_READ"
    );
    if (!error && data?.value) return JSON.parse(data.value);
  } catch {
    /* fall through to storage */
  }

  try {
    const { data, error } = await withTimeout(
      client.storage.from(STORAGE_BUCKET).download(STORAGE_OBJECT_PATH),
      3500,
      "LEGACY_STORAGE_READ"
    );
    if (!error && data) {
      const text = await data.text();
      if (text) return JSON.parse(text);
    }
  } catch {
    /* no legacy blob available */
  }

  return null;
}

export async function writeLegacyBlob(payload) {
  const client = getSupabaseServerClient();
  if (!client) return { ok: false };
  const serialized = JSON.stringify(payload);
  try {
    const { error } = await withTimeout(
      client
        .from(KV_TABLE)
        .upsert({ key: LEGACY_STORE_KEY, value: serialized }, { onConflict: "key" }),
      4000,
      "LEGACY_WRITE"
    );
    return { ok: !error, error: error?.message || null };
  } catch (err) {
    return { ok: false, error: err?.message };
  }
}

/* ------------------------------------------------------------------ */
/* Audit trail (admin screen)                                          */
/* ------------------------------------------------------------------ */

/**
 * Audit rows are persisted individually (never as part of a whole-dataset
 * document) with their previous/new values encrypted, so the admin audit view
 * survives serverless cold starts.
 */
export function buildAuditRow(row, secret) {
  return {
    key: `${AUDIT_KEY_PREFIX}${row.id}`,
    value: JSON.stringify({
      v: 2,
      id: String(row.id),
      registration_id: String(row.registration_id || ""),
      family_id: String(row.family_id || ""),
      action: String(row.action || "updated"),
      changed_fields_enc: encryptText(row.changed_fields || "[]", secret),
      previous_values_enc: encryptText(row.previous_values || "{}", secret),
      new_values_enc: encryptText(row.new_values || "{}", secret),
      admin_note: row.admin_note || null,
      created_at: row.created_at || new Date().toISOString(),
    }),
  };
}

export async function upsertAuditRows(rows, secret, { timeoutMs = 3000 } = {}) {
  const client = getSupabaseServerClient();
  if (!client || !Array.isArray(rows) || rows.length === 0) {
    return { ok: false, skipped: true };
  }
  const payload = rows
    .filter((row) => row?.id)
    .map((row) => ({
      key: `${AUDIT_KEY_PREFIX}${row.id}`,
      value: JSON.stringify({
        v: 2,
        id: String(row.id),
        registration_id: String(row.registration_id || ""),
        family_id: String(row.family_id || ""),
        action: String(row.action || "updated"),
        changed_fields_enc: encryptText(row.changed_fields || "[]", secret),
        previous_values_enc: encryptText(row.previous_values || "{}", secret),
        new_values_enc: encryptText(row.new_values || "{}", secret),
        admin_note: row.admin_note || null,
        created_at: row.created_at || new Date().toISOString(),
      }),
    }));
  if (!payload.length) return { ok: false, skipped: true };
  try {
    const { error } = await withTimeout(
      client.from(KV_TABLE).upsert(payload, { onConflict: "key" }),
      timeoutMs,
      "AUDIT_WRITE"
    );
    if (error) return { ok: false, reason: error.message };
    return { ok: true, written: payload.length };
  } catch (err) {
    return { ok: false, reason: err?.message };
  }
}

export async function listAuditRows({ limit = 200 } = {}) {
  const client = getSupabaseServerClient();
  if (!client) return { rows: [], error: "unconfigured" };
  try {
    const { data, error } = await withTimeout(
      client
        .from(KV_TABLE)
        .select("key, value")
        .like("key", `${AUDIT_KEY_PREFIX}*`)
        .order("key", { ascending: false })
        .limit(limit),
      4000,
      "AUDIT_READ"
    );
    if (error) return { rows: [], error: error.message };
    return { rows: Array.isArray(data) ? data : [], error: null };
  } catch (err) {
    return { rows: [], error: err?.message };
  }
}

export function deserializeAuditRow(row, secret) {
  try {
    const parsed = JSON.parse(row.value);
    return {
      id: String(parsed.id),
      registration_id: String(parsed.registration_id || ""),
      family_id: String(parsed.family_id || ""),
      action: String(parsed.action || "updated"),
      changed_fields: decryptText(parsed.changed_fields_enc, secret) || "[]",
      previous_values: decryptText(parsed.previous_values_enc, secret) || "{}",
      new_values: decryptText(parsed.new_values_enc, secret) || "{}",
      admin_note: parsed.admin_note || null,
      created_at: parsed.created_at || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
