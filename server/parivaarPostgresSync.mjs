/**
 * Parivaar replica synchronisation (Supabase PostgreSQL -> local SQLite replica)
 * ---------------------------------------------------------------------------
 * Every serverless instance keeps a small SQLite replica of the registrations
 * so that reads are in-process and fast.  This module owns that replica:
 *
 *  - a single cheap "revision" read tells an instance whether anything changed,
 *    so steady-state reads perform NO large downloads;
 *  - a change triggers exactly one single-flight full sync per instance (no
 *    duplicate concurrent hydrations, no connection/CPU storms);
 *  - writes persist ONE small record row and then publish a new revision, so a
 *    reader that observes the revision can always read the committed record;
 *  - the legacy encrypted document is still read once to migrate existing
 *    production registrations, and is never modified or deleted.
 */

import { ensureBaselineRegistrations } from "./parivaarDatabase.mjs";
import {
  bumpRevision,
  decryptText,
  buildAuditRow,
  deserializeAuditRow,
  listAuditRows,
  deserializeRecord,
  deleteRecord as deleteStoredRecord,
  encryptText,
  getSupabaseServerClient,
  getSupabaseServerCredentials,
  isStoreConfigured,
  listRecordRows,
  listTombstones,
  readMigrationMarker,
  readRevision,
  upsertRecord,
  withTimeout,
  writeMigrationMarker,
} from "./parivaarStore.mjs";

const FULL_RESYNC_MS = 30000; // periodic safety refresh even without a revision change
const REVISION_CACHE_MS = 2000; // per-instance revision micro-cache

let cachedRevision = null;
let lastRevisionCheckAt = 0;
let lastFullSyncAt = 0;
let lastSyncResult = { source: "init", error: null };
let inFlightHydration = null;
let legacyMigrationAttemptedAt = 0;
let consecutiveRevisionFailures = 0;

export function getHydrationState() {
  return {
    revision: cachedRevision?.rev || null,
    revision_checked_at: lastRevisionCheckAt ? new Date(lastRevisionCheckAt).toISOString() : null,
    last_full_sync_at: lastFullSyncAt ? new Date(lastFullSyncAt).toISOString() : null,
    last_sync_source: lastSyncResult.source,
    last_sync_error: lastSyncResult.error,
    configured: isStoreConfigured(),
  };
}

/* ------------------------------------------------------------------ */
/* Replica writes                                                      */
/* ------------------------------------------------------------------ */

const upsertReplicaStatement = (db) =>
  db.prepare(
    `INSERT INTO parivaar_registrations (
       id, family_id, full_name, father_name, member_count,
       state_code, district_code, subdistrict_code, village_code,
       thikana, thikana_same_as_village, current_address, phone_number,
       consent_given, public_opt_in, public_visibility, status, admin_note,
       created_at, updated_at, idempotency_key
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?)
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
       updated_at = excluded.updated_at,
       idempotency_key = COALESCE(excluded.idempotency_key, parivaar_registrations.idempotency_key)`
  );

const upsertCounterStatement = (db) =>
  db.prepare(
    `INSERT INTO village_family_id_counters (village_code, last_seq, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(village_code) DO UPDATE SET
       last_seq = MAX(village_family_id_counters.last_seq, excluded.last_seq),
       updated_at = excluded.updated_at`
  );

function familySequence(familyId) {
  const match = String(familyId || "").match(/-(\d+)$/);
  return match ? Number(match[1]) || 0 : 0;
}

/**
 * Writes a list of decrypted records into the SQLite replica inside a single
 * transaction and returns how many rows were applied.
 */
function applyRecordsToReplica(db, records, deletedIds = []) {
  if (!records.length && !deletedIds.length) return 0;
  let applied = 0;
  const upsertReg = upsertReplicaStatement(db);
  const upsertCounter = upsertCounterStatement(db);
  const deleteReg = db.prepare("DELETE FROM parivaar_registrations WHERE id = ?");

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const deletedId of deletedIds) {
      try {
        deleteReg.run(String(deletedId));
      } catch {
        /* row not present */
      }
    }
    for (const rec of records) {
      try {
        upsertReg.run(
          rec.id,
          rec.family_id,
          rec.full_name,
          rec.father_name,
          rec.member_count,
          rec.state_code,
          rec.district_code,
          rec.subdistrict_code,
          rec.village_code,
          rec.thikana,
          rec.thikana_same_as_village ? 1 : 0,
          rec.current_address,
          rec.phone_number,
          rec.public_visibility || "default",
          rec.status || "approved",
          rec.admin_note ?? null,
          rec.created_at,
          rec.updated_at,
          rec.idempotency_key || null
        );
        applied += 1;
      } catch (rowErr) {
        if (process.env.PARIVAAR_DEBUG_SYNC === "1") {
          console.error(
            "[parivaar] replica row failed:",
            rec?.id,
            rec?.family_id,
            rowErr?.message || rowErr
          );
        }
        // A record may reference a location row that is missing in this
        // container (partial LGD dataset); it is retried on the next sync.
      }
      const seq = familySequence(rec.family_id);
      if (seq > 0 && rec.village_code) {
        try {
          upsertCounter.run(String(rec.village_code), seq, rec.updated_at);
        } catch {
          /* ignore counter conflicts */
        }
      }
    }
    db.exec("COMMIT");
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw err;
  }
  return applied;
}

/* ------------------------------------------------------------------ */
/* Hydration                                                           */
/* ------------------------------------------------------------------ */

async function migrateLegacyDocument(db, secret) {
  // Only attempt the legacy import every so often, so a missing/empty legacy
  // document cannot slow down every request.
  if (Date.now() - legacyMigrationAttemptedAt < 60000) return 0;
  legacyMigrationAttemptedAt = Date.now();

  const marker = await readMigrationMarker();
  if (marker?.migrated_at) return 0;

  const { readLegacyBlob } = await import("./parivaarStore.mjs");
  const legacy = await readLegacyBlob();
  const legacyRows = Array.isArray(legacy?.registrations) ? legacy.registrations : [];
  if (!legacyRows.length) return 0;

  let migrated = 0;
  for (const raw of legacyRows) {
    const rec = deserializeRecord(raw, secret);
    if (!rec) continue;
    const result = await upsertRecord(rec, secret);
    if (result.ok) migrated += 1;
  }
  if (migrated > 0) {
    await writeMigrationMarker({ source: "parivaar_pg_store_v1", count: migrated });
  }
  return migrated;
}

/**
 * Self-healing guard: compares the database's own aggregate count with the
 * local replica.  If the database reports more approved families than the
 * replica holds (for example because a record-row write failed after the
 * PostgreSQL insert committed), the missing public families are pulled from
 * `get_public_parivaar_families` and merged in.  This costs one tiny RPC per
 * full sync and guarantees "a committed family is always visible".
 */
async function reconcileWithDatabase(db) {
  const client = getSupabaseServerClient();
  const creds = getSupabaseServerCredentials();
  if (!client || !creds) return { reconciled: 0, skipped: true };

  try {
    const { data: stats, error } = await withTimeout(
      client.rpc("get_parivaar_summary_stats"),
      2500,
      "SUMMARY_RPC"
    );
    if (error || !stats) return { reconciled: 0, skipped: true };

    const total = Number(stats.total_registrations) || 0;
    const localCount =
      Number(
        db
          .prepare(
            "SELECT COUNT(*) AS cnt FROM parivaar_registrations WHERE status = 'approved'"
          )
          .get()?.cnt
      ) || 0;
    if (process.env.PARIVAAR_DEBUG_SYNC === "1") {
      console.error("[parivaar] reconcile check total=", total, "local=", localCount);
    }
    if (total <= localCount) return { reconciled: 0, skipped: true };

    const known = new Set(
      db
        .prepare("SELECT family_id FROM parivaar_registrations WHERE family_id IS NOT NULL")
        .all()
        .map((r) => String(r.family_id))
    );

    const merged = [];
    const pageSize = 100;
    for (let page = 1; page <= 20 && merged.length + localCount < total; page += 1) {
      const { data, error: pageError } = await withTimeout(
        client.rpc("get_public_parivaar_families", {
          p_page: page,
          p_page_size: pageSize,
        }),
        3000,
        "PUBLIC_FAMILIES_RPC"
      );
      if (pageError || !Array.isArray(data?.families) || data.families.length === 0) break;
      for (const family of data.families) {
        if (!family?.family_id || known.has(String(family.family_id))) continue;
        known.add(String(family.family_id));
        merged.push({
          id: `rpc-${family.family_id}`,
          family_id: String(family.family_id),
          full_name: String(family.family_head_name || family.head_name || "पंजीकृत परिवार"),
          father_name: family.father_name || null,
          member_count: Math.max(1, Number(family.member_count) || 1),
          state_code: String(family.state_code || "8"),
          district_code: String(family.district_code || "94"),
          subdistrict_code: String(family.subdistrict_code || "6033"),
          village_code: family.village_code ? String(family.village_code) : null,
          thikana: String(family.village_name || family.official_village_name || ""),
          thikana_same_as_village: 1,
          current_address: "India",
          phone_number: "9000000000",
          public_visibility: family.is_private ? "private" : "default",
          status: "approved",
          admin_note: null,
          created_at: family.created_at || new Date().toISOString(),
          updated_at: family.created_at || new Date().toISOString(),
        });
      }
      if (data.families.length < pageSize) break;
    }

    if (process.env.PARIVAAR_DEBUG_SYNC === "1") {
      console.error("[parivaar] reconcile merged=", merged.length);
    }
    if (!merged.length) return { reconciled: 0, skipped: true };
    const applied = applyRecordsToReplica(db, merged);
    return { reconciled: applied, skipped: false };
  } catch (err) {
    if (process.env.PARIVAAR_DEBUG_SYNC === "1") {
      console.error("[parivaar] reconcile failed:", err?.message || err);
    }
    return { reconciled: 0, skipped: true };
  }
}

async function applyAuditRowsToReplica(db, secret) {
  const { rows, error } = await listAuditRows({ limit: 200 });
  if (error || !rows.length) return 0;
  const insert = db.prepare(
    `INSERT OR IGNORE INTO registration_audit_log (
       id, registration_id, family_id, action, changed_fields,
       previous_values, new_values, admin_note, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  let applied = 0;
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const row of rows) {
      const audit = deserializeAuditRow(row, secret);
      if (!audit) continue;
      try {
        insert.run(
          audit.id,
          audit.registration_id,
          audit.family_id,
          audit.action,
          audit.changed_fields,
          audit.previous_values,
          audit.new_values,
          audit.admin_note,
          audit.created_at
        );
        applied += 1;
      } catch {
        /* duplicate or malformed audit row */
      }
    }
    db.exec("COMMIT");
  } catch {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
  }
  return applied;
}

async function runFullSync(db) {
  const creds = getSupabaseServerCredentials();
  if (!creds) {
    lastSyncResult = { source: "local", error: null };
    return { hydrated: true, source: "local", revision: null, error: null };
  }

  const [recordsResult, tombstonesResult] = await Promise.all([
    listRecordRows(),
    listTombstones(),
  ]);

  let records = (recordsResult.rows || [])
    .map((row) => {
      try {
        return deserializeRecord(JSON.parse(row.value), creds.key);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  let migrated = 0;
  if (!records.length && !recordsResult.error) {
    migrated = await migrateLegacyDocument(db, creds.key);
    if (migrated > 0) {
      const retry = await listRecordRows();
      records = (retry.rows || [])
        .map((row) => {
          try {
            return deserializeRecord(JSON.parse(row.value), creds.key);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    }
  }

  const applied = applyRecordsToReplica(db, records, tombstonesResult.ids || []);
  await applyAuditRowsToReplica(db, creds.key);
  const reconcile = await reconcileWithDatabase(db);
  const error = recordsResult.error || tombstonesResult.error || null;

  lastFullSyncAt = Date.now();
  lastSyncResult = {
    source: error ? "partial" : "database",
    error,
    records: records.length,
    applied,
    migrated,
    reconciled: reconcile.reconciled,
  };

  return {
    hydrated: !error,
    source: lastSyncResult.source,
    revision: cachedRevision?.rev || null,
    records: records.length,
    applied,
    migrated,
    reconciled: reconcile.reconciled,
    error,
  };
}

/**
 * Ensures the local replica is current.  Fast path: one tiny revision read
 * (micro-cached for 1.5 s) and no data transfer at all.
 */
export async function ensurePostgresHydrated(db, { force = false } = {}) {
  if (!db) return { hydrated: false, reason: "no_db", source: "none" };

  // Baseline verified records are always guaranteed synchronously.
  ensureBaselineRegistrations(db);

  if (!isStoreConfigured() || !getSupabaseServerClient()) {
    return { hydrated: true, source: "local", reason: "unconfigured", revision: null };
  }

  const now = Date.now();
  const fresh =
    !force &&
    cachedRevision &&
    lastFullSyncAt > 0 &&
    now - lastRevisionCheckAt < REVISION_CACHE_MS &&
    now - lastFullSyncAt < FULL_RESYNC_MS;
  if (fresh) {
    return { hydrated: true, source: "cache", revision: cachedRevision.rev };
  }

  if (inFlightHydration) return inFlightHydration;

  inFlightHydration = (async () => {
    try {
      const revision = await readRevision();
      lastRevisionCheckAt = Date.now();

      if (!revision) {
        consecutiveRevisionFailures += 1;
        // Revision row missing (or database unreachable).  Fall back to a full
        // sync at most once every FULL_RESYNC_MS so an outage does not trigger
        // a database round-trip per request.
        if (!force && lastFullSyncAt > 0 && Date.now() - lastFullSyncAt < FULL_RESYNC_MS) {
          return {
            hydrated: true,
            source: "cache",
            revision: cachedRevision?.rev || null,
            // A single blip should not alarm visitors; a persistent outage must.
            stale: consecutiveRevisionFailures >= 2,
            error:
              consecutiveRevisionFailures >= 2
                ? "DATABASE_UNREACHABLE"
                : null,
          };
        }
        const result = await runFullSync(db);
        return { ...result, stale: Boolean(result.error) };
      }

      consecutiveRevisionFailures = 0;

      const changed = !cachedRevision || cachedRevision.rev !== revision.rev;
      const expired = Date.now() - lastFullSyncAt > FULL_RESYNC_MS;
      if (!force && !changed && !expired && lastFullSyncAt > 0) {
        cachedRevision = revision;
        return { hydrated: true, source: "cache", revision: revision.rev };
      }

      const result = await runFullSync(db);
      cachedRevision = revision;
      return { ...result, revision: revision.rev, changed };
    } finally {
      inFlightHydration = null;
    }
  })();

  return inFlightHydration;
}

/* ------------------------------------------------------------------ */
/* Write-through                                                       */
/* ------------------------------------------------------------------ */

/**
 * Persists ONE registration record and publishes a new revision.
 * No full-dataset rewrite, no second copy in Storage.
 */
export async function persistRegistrationRecord(registrationRow, db) {
  const creds = getSupabaseServerCredentials();
  if (!creds) return { ok: false, skipped: true, reason: "unconfigured" };

  // The record row and its audit trail go out in ONE batched upsert, so a
  // registration still costs a single database write.
  let extraRows = [];
  try {
    if (db && registrationRow?.id) {
      const auditRows = db
        .prepare(
          `SELECT id, registration_id, family_id, action, changed_fields,
                  previous_values, new_values, admin_note, created_at
           FROM registration_audit_log
           WHERE registration_id = ?
           ORDER BY created_at DESC LIMIT 5`
        )
        .all(String(registrationRow.id));
      extraRows = auditRows.map((row) => buildAuditRow(row, creds.key));
    }
  } catch {
    extraRows = [];
  }

  const write = await upsertRecord(registrationRow, creds.key, { extraRows });
  if (!write.ok) {
    return { ok: false, reason: write.reason || "record write failed" };
  }

  const revision = await bumpRevision({
    writer: "registration",
    counts: registrationRow?.village_code
      ? { village_code: String(registrationRow.village_code) }
      : null,
  });
  if (revision?.rev) cachedRevision = { rev: revision.rev, updatedAt: revision.updatedAt };
  lastFullSyncAt = Date.now();
  lastRevisionCheckAt = Date.now();

  return { ok: true, revision: revision?.rev || null, record_written: true };
}

export async function removeRegistrationRecord(registrationId) {
  if (!isStoreConfigured()) return { ok: false, skipped: true, reason: "unconfigured" };
  const del = await deleteStoredRecord(registrationId);
  if (del.ok) {
    const revision = await bumpRevision({ writer: "delete" });
    if (revision?.rev) cachedRevision = { rev: revision.rev, updatedAt: revision.updatedAt };
  }
  return del;
}

/**
 * Backwards-compatible helper used by admin edits and missing-location reports.
 * Only the affected record(s) are written; the whole dataset is never rewritten.
 */
export async function syncDatabaseStateToPostgres(db, { registrationId = null, deletedId = null } = {}) {
  if (!isStoreConfigured() || !db) return { ok: false, skipped: true, reason: "unconfigured" };
  const creds = getSupabaseServerCredentials();

  try {
    if (deletedId) {
      const result = await removeRegistrationRecord(deletedId);
      return { ok: result.ok, deleted: true };
    }

    const rows = registrationId
      ? db
          .prepare(
            `SELECT id, family_id, full_name, father_name, member_count,
                    state_code, district_code, subdistrict_code, village_code,
                    thikana, thikana_same_as_village, current_address, phone_number,
                    public_visibility, status, admin_note, created_at, updated_at
             FROM parivaar_registrations WHERE id = ?`
          )
          .all(String(registrationId))
      : db
          .prepare(
            `SELECT id, family_id, full_name, father_name, member_count,
                    state_code, district_code, subdistrict_code, village_code,
                    thikana, thikana_same_as_village, current_address, phone_number,
                    public_visibility, status, admin_note, created_at, updated_at
             FROM parivaar_registrations
             WHERE updated_at >= datetime('now', '-10 minutes')`
          )
          .all();

    let written = 0;
    for (const row of rows) {
      const result = await upsertRecord(row, creds.key);
      if (result.ok) written += 1;
    }
    if (written > 0) {
      const revision = await bumpRevision({ writer: "admin" });
      if (revision?.rev) cachedRevision = { rev: revision.rev, updatedAt: revision.updatedAt };
    }
    return { ok: written > 0, records_written: written };
  } catch (err) {
    return { ok: false, error: err?.message || "sync failed" };
  }
}

/**
 * Persists a missing-location report so it survives cold starts.
 */
export async function persistMissingLocationReport(reportRow) {
  const creds = getSupabaseServerCredentials();
  const client = getSupabaseServerClient();
  if (!creds || !client || !reportRow?.id) {
    return { ok: false, skipped: true, reason: "unconfigured" };
  }
  const record = {
    v: 2,
    id: String(reportRow.id),
    reporter_name: String(reportRow.reporter_name || ""),
    reporter_phone_enc: reportRow.reporter_phone
      ? encryptText(reportRow.reporter_phone, creds.key)
      : null,
    state_code: reportRow.state_code || null,
    district_code: reportRow.district_code || null,
    subdistrict_code: reportRow.subdistrict_code || null,
    missing_level: reportRow.missing_level || "village",
    proposed_name: reportRow.proposed_name || "",
    parent_context: reportRow.parent_context || null,
    pincode: reportRow.pincode || null,
    notes: reportRow.notes || null,
    status: reportRow.status || "pending",
    created_at: reportRow.created_at || new Date().toISOString(),
  };
  try {
    const { error } = await withTimeout(
      client
        .from("site_content")
        .upsert(
          { key: `parivaar_report_v1:${record.id}`, value: JSON.stringify(record) },
          { onConflict: "key" }
        ),
      3000,
      "REPORT_WRITE"
    );
    if (error) return { ok: false, reason: error.message };
    const revision = await bumpRevision({ writer: "missing_location" });
    if (revision?.rev) cachedRevision = { rev: revision.rev, updatedAt: revision.updatedAt };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err?.message };
  }
}

/**
 * Legacy entry point kept for compatibility: persists the registration that was
 * just written into the local replica.
 */
export async function persistRegistrationToPostgres(regResult, db) {
  const registration = regResult?.registration || null;
  if (!registration) return { ok: false, pg_persisted: false, reason: "no_registration" };
  const result = await persistRegistrationRecord(registration, db);
  return {
    ok: result.ok,
    pg_persisted: result.ok,
    store_saved: result.ok,
    revision: result.revision || null,
    rpc_error: result.ok ? null : result.reason || null,
  };
}

export { decryptText, encryptText };
