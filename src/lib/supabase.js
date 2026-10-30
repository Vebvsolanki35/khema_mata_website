import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || "placeholder-key";

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Checks whether real Supabase credentials are configured in the client environment.
 */
export function isSupabaseClientConfigured() {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseKey) &&
    !supabaseUrl.includes("placeholder.supabase.co") &&
    supabaseKey !== "placeholder-key"
  );
}

/**
 * Safely executes a Supabase RPC (`supabase.rpc(fnName, params)`).
 *
 * Why this helper exists:
 * `@supabase/postgrest-js` returns a `PostgrestFilterBuilder` from `supabase.rpc(...)`.
 * That builder is a lazy thenable (`{ then }`), NOT a native `Promise`, so calling
 * `.catch(...)` on it throws `TypeError: l.rpc(...).catch is not a function`.
 * Additionally, when awaited, it resolves to `{ data, error }` instead of rejecting
 * on database/RPC errors.
 */
export async function callSupabaseRpc(fnName, params = {}) {
  if (!isSupabaseClientConfigured()) {
    return {
      ok: false,
      skipped: true,
      data: null,
      error: { code: "SUPABASE_UNCONFIGURED", message: "Supabase is not configured." },
    };
  }

  try {
    const { data, error } = await supabase.rpc(fnName, params);
    if (error) {
      return {
        ok: false,
        data: null,
        error: {
          code: error.code || "RPC_ERROR",
          message: error.message || `RPC ${fnName} failed.`,
          details: error.details || null,
          hint: error.hint || null,
        },
      };
    }

    if (data && typeof data === "object" && data.ok === false) {
      return {
        ok: false,
        data,
        error: {
          code: data.code || "RPC_VALIDATION_ERROR",
          message: data.message || `RPC ${fnName} returned ok=false.`,
        },
      };
    }

    return { ok: true, data, error: null };
  } catch (err) {
    return {
      ok: false,
      data: null,
      error: {
        code: err?.code || "RPC_NETWORK_ERROR",
        message: err?.message || `Network error calling RPC ${fnName}.`,
      },
    };
  }
}

/**
 * Safely awaits any Supabase PostgREST query builder (`supabase.from(...).select/insert/update/delete(...)`)
 * without calling `.catch()` on `PostgrestFilterBuilder`.
 */
export async function safeSupabaseQuery(queryBuilder) {
  if (!isSupabaseClientConfigured() || !queryBuilder) {
    return { ok: false, skipped: true, data: null, error: null };
  }
  try {
    const { data, error } = await queryBuilder;
    if (error) {
      return { ok: false, data: null, error };
    }
    return { ok: true, data, error: null };
  } catch (err) {
    return { ok: false, data: null, error: err };
  }
}
