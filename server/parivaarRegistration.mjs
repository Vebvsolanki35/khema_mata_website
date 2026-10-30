/**
 * Parivaar registration write path
 * ---------------------------------------------------------------------------
 * Order of operations (fast, safe, no false success):
 *
 *   1. Server-side validation (pure, no writes) -> rejects bad input instantly.
 *   2. Idempotent replay check -> a retried submission returns the SAME family.
 *   3. PostgreSQL `submit_parivaar_registration` RPC -> authoritative,
 *      transactional INSERT that allocates the permanent Family ID with an
 *      atomic counter (never COUNT(*), never in the browser).
 *   4. Mirror the committed row into the local replica + write ONE small
 *      encrypted record row + publish a new revision, so every other device
 *      sees the family on its next refresh.
 *   5. Only the SAVED record is returned to the client; the confirmation screen
 *      never reconstructs data that the database did not confirm.
 *
 * If the database write cannot be confirmed, the API returns an explicit error
 * instead of a success screen.
 */

import {
  applyPostgresRegistrationToReplica,
  insertParivaarRegistration,
  removeReplicaRegistration,
} from "./parivaarDatabase.mjs";
import {
  getSupabaseServerClient,
  isStoreConfigured,
  withTimeout,
} from "./parivaarStore.mjs";
import { persistRegistrationRecord } from "./parivaarPostgresSync.mjs";

const RPC_TIMEOUT_MS = 6000;
const RPC_RETRY_DELAY_MS = 250;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isTransientRpcError(error) {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "");
  return (
    !message ||
    message.includes("fetch failed") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("socket hang up") ||
    /^5\d\d$/.test(code) ||
    /^PGRST(5|000)/.test(code)
  );
}

function isSignatureMismatch(error) {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "");
  return (
    code === "PGRST202" ||
    message.includes("could not find the function") ||
    message.includes("no function matches the given name") ||
    message.includes("function public.submit_parivaar_registration")
  );
}

function buildRpcParams(normalized, familyIdHint = null) {
  return {
    p_full_name: normalized.fullName,
    p_state_code: normalized.stateCode,
    p_district_code: normalized.districtCode,
    p_subdistrict_code: normalized.subdistrictCode,
    p_village_code: normalized.villageCode,
    p_thikana: normalized.thikana,
    p_current_address: normalized.currentAddress,
    p_phone_number: normalized.phone,
    p_consent_given: true,
    p_thikana_same_as_village: Boolean(normalized.thikanaSameAsVillage),
    p_father_name: normalized.fatherName || null,
    p_member_count: Number(normalized.memberCount) || 1,
    p_family_id: familyIdHint,
    p_state_name: normalized.stateName || null,
    p_district_name: normalized.districtName || null,
    p_subdistrict_name: normalized.subdistrictName || null,
    p_village_name: normalized.villageName || null,
  };
}

function buildLegacyRpcParams(normalized) {
  return {
    p_full_name: normalized.fullName,
    p_state_code: normalized.stateCode,
    p_district_code: normalized.districtCode,
    p_subdistrict_code: normalized.subdistrictCode,
    p_village_code: normalized.villageCode,
    p_thikana: normalized.thikana,
    p_current_address: normalized.currentAddress,
    p_phone_number: normalized.phone,
    p_consent_given: true,
    p_thikana_same_as_village: Boolean(normalized.thikanaSameAsVillage),
  };
}

/**
 * Calls the authoritative PostgreSQL registration RPC with one transient-error
 * retry.  Returns `{ ok, record }` or `{ ok:false, code, message, transient }`.
 */
export async function submitRegistrationToPostgres(normalized, { familyIdHint = null } = {}) {
  const client = getSupabaseServerClient();
  if (!client) return { ok: false, code: "UNCONFIGURED", transient: false };

  const attempt = async (params) =>
    withTimeout(
      client.rpc("submit_parivaar_registration", params),
      RPC_TIMEOUT_MS,
      "REGISTRATION_RPC"
    );

  let lastError = null;
  for (let tryIndex = 0; tryIndex < 2; tryIndex += 1) {
    try {
      let { data, error } = await attempt(buildRpcParams(normalized, familyIdHint));

      if (error && isSignatureMismatch(error)) {
        const legacy = await attempt(buildLegacyRpcParams(normalized));
        data = legacy.data;
        error = legacy.error;
      }

      if (!error && data && data.ok !== false) {
        return { ok: true, record: data };
      }

      if (error) {
        lastError = error;
        if (tryIndex === 0 && isTransientRpcError(error)) {
          await sleep(RPC_RETRY_DELAY_MS);
          continue;
        }
        return {
          ok: false,
          code: error.code || "DATABASE_ERROR",
          message: error.message || "Database rejected the registration.",
          transient: isTransientRpcError(error),
        };
      }

      // The RPC returned a structured validation / duplicate response.
      return {
        ok: false,
        code: data?.code || "REGISTRATION_REJECTED",
        message: data?.message || "Registration was not accepted.",
        transient: false,
      };
    } catch (err) {
      lastError = err;
      if (tryIndex === 0) {
        await sleep(RPC_RETRY_DELAY_MS);
        continue;
      }
    }
  }

  return {
    ok: false,
    code: "DATABASE_UNAVAILABLE",
    message:
      lastError?.message ||
      "The registration database is temporarily unavailable. Your family was not saved.",
    transient: true,
  };
}

function findLocalDuplicateFamilyId(db, normalized) {
  try {
    const row = db
      .prepare(
        `SELECT family_id FROM parivaar_registrations
         WHERE phone_number = ? AND lower(trim(full_name)) = lower(?) AND district_code = ?
         LIMIT 1`
      )
      .get(normalized.phone, normalized.fullName, normalized.districtCode);
    return row?.family_id || null;
  } catch {
    return null;
  }
}

function findLocalByIdempotencyKey(db, key) {
  if (!key) return null;
  try {
    const row = db
      .prepare(
        `SELECT id, family_id, full_name, father_name, member_count, state_code,
                district_code, subdistrict_code, village_code, thikana,
                thikana_same_as_village, created_at, public_visibility, status
         FROM parivaar_registrations WHERE idempotency_key = ? LIMIT 1`
      )
      .get(key);
    if (!row) return null;
    return {
      ok: true,
      id: row.id,
      family_id: row.family_id,
      idempotent_replay: true,
      created_at: row.created_at,
      registration: {
        ...row,
        head_name: row.full_name,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Full registration flow.  Returns an API-ready result object.
 */
export async function createParivaarRegistration(payload, db) {
  const timings = {};
  const startedAt = performance.now();
  const mark = (label) => {
    timings[label] = Math.round(performance.now() - startedAt);
  };

  // 1. Validation only — nothing is written yet.
  const prepared = insertParivaarRegistration(payload, db, { dryRun: true });
  mark("validation");
  if (!prepared.ok) return { ...prepared, timings };

  const normalized = prepared.normalized;

  // 2. Idempotent replay of an already committed submission.
  const replay = findLocalByIdempotencyKey(db, normalized.idempotencyKey);
  if (replay) {
    mark("idempotent_replay");
    return { ...replay, pg_persisted: true, persistence: "replay", timings };
  }

  // 3. Authoritative PostgreSQL write (when configured).
  if (isStoreConfigured()) {
    const familyIdHint = findLocalDuplicateFamilyId(db, normalized);
    const rpc = await submitRegistrationToPostgres(normalized, { familyIdHint });
    mark("postgres_rpc");

    if (rpc.ok) {
      const mirrored = applyPostgresRegistrationToReplica(
        db,
        rpc.record,
        normalized,
        { idempotencyKey: normalized.idempotencyKey }
      );
      if (!mirrored.ok) {
        return {
          ok: false,
          code: "REPLICA_WRITE_FAILED",
          message:
            "Your registration was saved but could not be published to the directory. Please contact the trust administrator.",
          timings,
        };
      }

      const store = await persistRegistrationRecord(mirrored.row, db);
      mark("record_store");

      return {
        ok: true,
        id: mirrored.id,
        family_id: mirrored.family_id,
        created_at: mirrored.created_at,
        registration: mirrored.registration,
        persistence: store.ok ? "postgres" : "postgres_replica_pending",
        pg_persisted: true,
        revision: store.revision || null,
        replica_pending: !store.ok,
        timings,
      };
    }

    // Duplicate / validation rejected by the database: report exactly that.
    if (!rpc.transient) {
      return {
        ok: false,
        code: rpc.code,
        message: rpc.message,
        timings,
      };
    }
    // Transient database failure: continue to the local-commit fallback so a
    // short outage does not lose a family, but never claim a durable success
    // unless the record row was really written.
  }

  // 4. Local replica commit (also the primary path when Supabase is not
  //    configured, e.g. local development).
  const local = insertParivaarRegistration(payload, db);
  mark("local_insert");
  if (!local.ok) return { ...local, timings };

  const store = await persistRegistrationRecord(local.registration, db);
  mark("record_store");

  if (isStoreConfigured() && !store.ok) {
    // The database did not confirm the write.  Undo the local commit so this
    // device can never display (or count) a family that was never saved.  An
    // existing household record that was only *updated* is left untouched.
    if (!local.updated) {
      removeReplicaRegistration(db, local.id);
      mark("replica_rollback");
    }
    return {
      ok: false,
      code: "PERSISTENCE_FAILED",
      message:
        "We could not confirm that your registration reached the database, so it was not saved. Please try again in a moment.",
      replica_rolled_back: !local.updated,
      timings,
    };
  }

  return {
    ...local,
    persistence: store.ok ? "postgres_store" : "local_replica",
    pg_persisted: store.ok,
    revision: store.revision || null,
    timings,
  };
}
