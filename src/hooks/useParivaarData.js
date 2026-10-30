import { useCallback, useEffect, useRef, useState } from "react";
import { callSupabaseRpc, isSupabaseClientConfigured } from "../lib/supabase";
import {
  normalizeIndianPhone,
  validateMissingLocationReport,
  validateParivaarRegistration,
} from "../lib/validateParivaar";

const EMPTY_STATS = {
  total_registrations: 0,
  total_members: 0,
  states_represented: 0,
  districts_covered: 0,
  villages_represented: 0,
  lgd_totals: {
    states: 0,
    districts: 0,
    subdistricts_blocks: 0,
    villages: 0,
  },
};

const EMPTY_AGGREGATES = {
  states: [],
  districts: [],
  subdistricts: [],
  villages: [],
};

/**
 * Checks whether real Supabase credentials are configured in the client environment.
 */
export function isSupabaseConfigured() {
  return isSupabaseClientConfigured();
}

function formatRegistrationErrorMessage(err, messages = {}) {
  const code = String(err?.code || "").toUpperCase();
  const rawMsg = String(err?.message || "").trim();

  if (code === "DUPLICATE_REGISTRATION") {
    return (
      rawMsg ||
      "इस नाम, मोबाइल नंबर और जिले के साथ परिवार पहले से पंजीकृत है। (A registration with this name, mobile number, and district is already recorded.)"
    );
  }
  if (code === "RATE_LIMITED") {
    return (
      rawMsg ||
      "इस मोबाइल नंबर से हाल ही में कई पंजीकरण किए गए हैं। कृपया कुछ समय बाद पुनः प्रयास करें। (Too many registrations submitted recently from this number. Please try again later.)"
    );
  }
  if (
    code === "INVALID_NAME" ||
    code === "INVALID_FATHER_NAME" ||
    code === "INVALID_MEMBER_COUNT" ||
    code === "INVALID_PHONE" ||
    code === "INVALID_ADDRESS" ||
    code === "MISSING_LOCATION" ||
    code === "VILLAGE_REQUIRED_FOR_SAME_THIKANA" ||
    code === "INVALID_HIERARCHY"
  ) {
    return (
      rawMsg ||
      messages.errSubmitFailed ||
      "कृपया सभी आवश्यक विवरण सही से भरें और पुनः प्रयास करें। (Please verify your registration details and try again.)"
    );
  }

  if (rawMsg && !rawMsg.includes(".catch is not a function")) {
    return rawMsg;
  }

  return (
    messages.errSubmitFailed ||
    "पंजीकरण सहेजते समय त्रुटि हुई। कृपया अपना विवरण जाँचकर पुनः प्रयास करें। (Could not save registration. Please verify your details and try again.)"
  );
}

// Module-level query caches keyed by official LGD codes (invalidated on retry)
const statesCache = { data: null };
const districtsCache = new Map();
const subdistrictsCache = new Map();
const villagesCache = new Map();

export function clearParivaarLocationCaches() {
  statesCache.data = null;
  districtsCache.clear();
  subdistrictsCache.clear();
  villagesCache.clear();
}

async function fetchJsonApi(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.ok === false) {
    const err = new Error(data?.message || `Database query failed (HTTP ${res.status})`);
    err.code = data?.code || `HTTP_${res.status}`;
    err.status = res.status;
    throw err;
  }
  return data;
}

/**
 * Hook for official LGD administrative hierarchy (States -> Districts -> Subdistricts/Blocks -> Villages)
 * and paginated directory exploration.
 *
 * STRICT DATA INTEGRITY:
 * - Zero hardcoded location arrays or static browser JSON bundles.
 * - All queries hit the relational SQL database via `/api/parivaar` (or Supabase when migrated).
 * - Never loads the entire 153,070-village table into browser memory.
 * - Surfaces honest error states with a retry trigger if a database query fails.
 */
export function useParivaarLocations() {
  const [states, setStates] = useState(statesCache.data || []);
  const [loadingStates, setLoadingStates] = useState(!statesCache.data);
  const [statesError, setStatesError] = useState(null);
  const [locationSource, setLocationSource] = useState("sql_database");

  const loadStates = useCallback(() => {
    setLoadingStates(true);
    setStatesError(null);

    return Promise.resolve()
      .then(async () => {
        if (statesCache.data && statesCache.data.length > 0) {
          setStates(statesCache.data);
          setLoadingStates(false);
          return statesCache.data;
        }

        const data = await fetchJsonApi("/api/parivaar?action=states");
        const list = Array.isArray(data.states) ? data.states : [];
        statesCache.data = list;
        setStates(list);
        setLocationSource("sql_database");
        setLoadingStates(false);
        return list;
      })
      .catch((err) => {
        setStates([]);
        setStatesError(err?.message || "Failed to load states from database.");
        setLoadingStates(false);
        return [];
      });
  }, []);

  useEffect(() => {
    let active = true;
    if (statesCache.data && statesCache.data.length > 0) return;

    fetchJsonApi("/api/parivaar?action=states")
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data.states) ? data.states : [];
        statesCache.data = list;
        setStates(list);
        setLocationSource("sql_database");
        setStatesError(null);
        setLoadingStates(false);
      })
      .catch((err) => {
        if (!active) return;
        setStates([]);
        setStatesError(err?.message || "Failed to load states from database.");
        setLoadingStates(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const retryStates = useCallback(() => {
    statesCache.data = null;
    return loadStates();
  }, [loadStates]);

  const fetchDistricts = useCallback(async (stateCode) => {
    if (!stateCode) return [];
    const key = String(stateCode).trim();
    if (districtsCache.has(key)) return districtsCache.get(key);

    const params = new URLSearchParams({ action: "districts", state_code: key });
    const data = await fetchJsonApi(`/api/parivaar?${params.toString()}`);
    const list = Array.isArray(data.districts) ? data.districts : [];
    districtsCache.set(key, list);
    return list;
  }, []);

  const fetchSubdistricts = useCallback(async (districtCode, stateCode = "") => {
    if (!districtCode) return [];
    const dKey = String(districtCode).trim();
    const sKey = stateCode ? String(stateCode).trim() : "";
    const cacheKey = `${sKey}|${dKey}`;
    if (subdistrictsCache.has(cacheKey)) return subdistrictsCache.get(cacheKey);

    const params = new URLSearchParams({
      action: "subdistricts",
      district_code: dKey,
    });
    if (sKey) params.set("state_code", sKey);

    const data = await fetchJsonApi(`/api/parivaar?${params.toString()}`);
    const list = Array.isArray(data.subdistricts) ? data.subdistricts : [];
    subdistrictsCache.set(cacheKey, list);
    return list;
  }, []);

  const fetchVillages = useCallback(
    async (subdistrictCode, search = "", { districtCode = "", stateCode = "", limit = 1000 } = {}) => {
      if (!subdistrictCode) return [];
      const subKey = String(subdistrictCode).trim();
      const dKey = districtCode ? String(districtCode).trim() : "";
      const sKey = stateCode ? String(stateCode).trim() : "";
      const q = search.trim();
      const cacheKey = `${sKey}|${dKey}|${subKey}|${q.toLowerCase()}|${limit}`;
      if (villagesCache.has(cacheKey)) return villagesCache.get(cacheKey);

      const params = new URLSearchParams({
        action: "villages",
        subdistrict_code: subKey,
        limit: String(limit),
      });
      if (dKey) params.set("district_code", dKey);
      if (sKey) params.set("state_code", sKey);
      if (q) params.set("q", q);

      const data = await fetchJsonApi(`/api/parivaar?${params.toString()}`);
      const list = Array.isArray(data.villages) ? data.villages : [];
      villagesCache.set(cacheKey, list);
      return list;
    },
    []
  );

  /**
   * Paginated, search-based SQL query for the Location Directory.
   * Never dumps the entire village dataset into browser memory.
   */
  const queryDirectory = useCallback(
    async ({
      level = "",
      stateCode = "",
      districtCode = "",
      subdistrictCode = "",
      search = "",
      page = 1,
      pageSize = 15,
    }) => {
      const effectiveLevel =
        level ||
        (subdistrictCode || districtCode || stateCode || search.trim() ? "villages" : "villages");

      const params = new URLSearchParams({
        action: "directory",
        level: effectiveLevel,
        page: String(page),
        page_size: String(pageSize),
      });
      if (stateCode) params.set("state_code", String(stateCode).trim());
      if (districtCode) params.set("district_code", String(districtCode).trim());
      if (subdistrictCode) params.set("subdistrict_code", String(subdistrictCode).trim());
      if (search.trim()) params.set("q", search.trim());

      const data = await fetchJsonApi(`/api/parivaar?${params.toString()}`);
      return {
        rows: Array.isArray(data.rows) ? data.rows : [],
        totalCount: Number(data.total ?? 0),
        page: Number(data.page ?? page),
        pageSize: Number(data.page_size ?? pageSize),
      };
    },
    []
  );

  /**
   * Paginated, privacy-safe query for Public Family Listings
   * (`India -> State/UT -> District -> Tehsil/Block -> Village -> Family Listings`).
   */
  const queryPublicFamilies = useCallback(
    async ({
      stateCode = "",
      districtCode = "",
      subdistrictCode = "",
      villageCode = "",
      search = "",
      page = 1,
      pageSize = 20,
    } = {}) => {
      const params = new URLSearchParams({
        action: "public-families",
        page: String(page),
        page_size: String(pageSize),
      });
      if (stateCode) params.set("state_code", String(stateCode).trim());
      if (districtCode) params.set("district_code", String(districtCode).trim());
      if (subdistrictCode) params.set("subdistrict_code", String(subdistrictCode).trim());
      if (villageCode) params.set("village_code", String(villageCode).trim());
      if (search.trim()) params.set("q", search.trim());

      const data = await fetchJsonApi(`/api/parivaar?${params.toString()}`);
      return {
        families: Array.isArray(data.families) ? data.families : [],
        totalCount: Number(data.total ?? 0),
        totalMembers: Number(data.total_members ?? 0),
        page: Number(data.page ?? page),
        pageSize: Number(data.page_size ?? pageSize),
        visibilityPolicy: data.visibility_policy || "public_basic",
      };
    },
    []
  );

  return {
    states,
    loadingStates,
    statesError,
    retryStates,
    locationSource,
    fetchDistricts,
    fetchSubdistricts,
    fetchVillages,
    queryDirectory,
    queryPublicFamilies,
  };
}

/**
 * Hook for live Parivaar aggregate statistics, map aggregates, and family registration submission.
 *
 * STRICT DATA INTEGRITY:
 * - Never fabricates registration totals or map counts.
 * - Shows 0 when no registrations exist in the database.
 * - Registration submission only reports `success = true` when confirmed by a real database write.
 */
export function useParivaarDirectory() {
  const [stats, setStats] = useState(EMPTY_STATS);
  const [aggregates, setAggregates] = useState(EMPTY_AGGREGATES);
  const [loadingStats, setLoadingStats] = useState(true);
  const [dbStatus, setDbStatus] = useState("checking"); // 'connected' | 'migration_pending' | 'unconfigured' | 'error'
  const [dbError, setDbError] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [savedRegistration, setSavedRegistration] = useState(null);
  const [directoryRefreshTick, setDirectoryRefreshTick] = useState(0);
  const submitLockRef = useRef(false);

  const loadStatsAndAggregates = useCallback(
    (stateFilter = null, districtFilter = null) =>
      Promise.resolve()
        .then(async () => {
          setLoadingStats(true);
          const params = new URLSearchParams({ action: "map-aggregates" });
          if (stateFilter) params.set("state_code", String(stateFilter).trim());
          if (districtFilter) params.set("district_code", String(districtFilter).trim());

          const data = await fetchJsonApi(`/api/parivaar?${params.toString()}`);
          const rawStats = data.summary || {};
          const rawAgg = data.aggregates || {};

          setStats({
            total_registrations: Number(rawStats.total_registrations) || 0,
            total_members: Number(rawStats.total_members) || 0,
            states_represented: Number(rawStats.states_represented) || 0,
            districts_covered: Number(rawStats.districts_covered) || 0,
            villages_represented: Number(rawStats.villages_represented) || 0,
            lgd_totals: rawStats.lgd_totals || EMPTY_STATS.lgd_totals,
          });

          setAggregates({
            states: Array.isArray(rawAgg.states) ? rawAgg.states : [],
            districts: Array.isArray(rawAgg.districts) ? rawAgg.districts : [],
            subdistricts: Array.isArray(rawAgg.subdistricts) ? rawAgg.subdistricts : [],
            villages: Array.isArray(rawAgg.villages) ? rawAgg.villages : [],
          });

          setDbStatus("connected");
          setDbError(null);
          setLoadingStats(false);
        })
        .catch((err) => {
          setStats(EMPTY_STATS);
          setAggregates(EMPTY_AGGREGATES);
          setDbStatus("error");
          setDbError(err?.message || "Unable to reach database.");
          setLoadingStats(false);
        }),
    []
  );

  useEffect(() => {
    loadStatsAndAggregates();
  }, [loadStatsAndAggregates]);

  /**
   * Submits a family registration to the database via `/api/parivaar` (and syncs to Supabase RPC when configured).
   */
  const submitRegistration = useCallback(
    async (values, messages = {}) => {
      if (submitLockRef.current) {
        return { ok: false, error: { code: "IN_FLIGHT", message: "Submission already in progress." } };
      }

      const validationErrors = validateParivaarRegistration(values, messages);
      if (Object.keys(validationErrors).length > 0) {
        return { ok: false, fieldErrors: validationErrors };
      }

      submitLockRef.current = true;
      setSubmitting(true);
      setSubmitError(null);
      setSubmitSuccess(false);

      try {
        const normalizedPhone = normalizeIndianPhone(values.phoneNumber);
        const memberCountNum = Math.max(
          1,
          Math.floor(Number(values.memberCount) || 1)
        );
        const villageName = String(
          values.selectedVillageName || values.thikana || ""
        ).trim();

        const payload = {
          action: "register",
          full_name: values.fullName.trim(),
          father_name: String(values.fatherName || "").trim(),
          require_father_name: true,
          member_count: memberCountNum,
          state_code: String(values.stateCode).trim(),
          district_code: String(values.districtCode).trim(),
          subdistrict_code: String(values.subdistrictCode).trim(),
          village_code: values.villageCode ? String(values.villageCode).trim() : null,
          thikana: villageName,
          thikana_same_as_village: true,
          require_village: true,
          current_address: values.currentAddress.trim(),
          phone_number: normalizedPhone,
          consent_given: true,
        };

        const data = await fetchJsonApi("/api/parivaar?action=register", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        // If Supabase is configured in the client environment and the server did not already
        // persist to PostgreSQL, sync to the Supabase RPC using async/await (`callSupabaseRpc`).
        if (isSupabaseConfigured() && !data?.pg_persisted) {
          const rpcResult = await callSupabaseRpc(
            "submit_parivaar_registration",
            {
              p_full_name: payload.full_name,
              p_state_code: payload.state_code,
              p_district_code: payload.district_code,
              p_subdistrict_code: payload.subdistrict_code,
              p_village_code: payload.village_code,
              p_thikana: payload.thikana,
              p_current_address: payload.current_address,
              p_phone_number: payload.phone_number,
              p_consent_given: payload.consent_given,
              p_thikana_same_as_village: payload.thikana_same_as_village,
              p_father_name: payload.father_name || null,
              p_member_count: payload.member_count,
              p_family_id: data?.family_id || null,
            }
          );

          // If the extended 13-arg RPC signature hasn't been migrated yet, fall back to the 10-arg signature
          if (
            !rpcResult.ok &&
            rpcResult.error &&
            rpcResult.error.code !== "DUPLICATE_REGISTRATION"
          ) {
            await callSupabaseRpc("submit_parivaar_registration", {
              p_full_name: payload.full_name,
              p_state_code: payload.state_code,
              p_district_code: payload.district_code,
              p_subdistrict_code: payload.subdistrict_code,
              p_village_code: payload.village_code,
              p_thikana: payload.thikana,
              p_current_address: payload.current_address,
              p_phone_number: payload.phone_number,
              p_consent_given: payload.consent_given,
              p_thikana_same_as_village: payload.thikana_same_as_village,
            });
          }
        }

        submitLockRef.current = false;
        setSubmitting(false);

        if (!data || data.ok !== true || !data.id || !data.family_id) {
          const errObj = {
            code: data?.code || "VALIDATION_FAILED",
            message: formatRegistrationErrorMessage(data, messages),
          };
          setSubmitError(errObj);
          return { ok: false, error: errObj };
        }

        setSavedRegistration(
          data.registration || {
            id: data.id,
            family_id: data.family_id,
            full_name: payload.full_name,
            father_name: payload.father_name,
            member_count: payload.member_count,
            state_code: payload.state_code,
            district_code: payload.district_code,
            subdistrict_code: payload.subdistrict_code,
            village_code: payload.village_code,
            village_name: villageName,
            current_address: payload.current_address,
            phone_number: payload.phone_number,
            created_at: data.created_at,
          }
        );
        setSubmitSuccess(true);
        setDirectoryRefreshTick((n) => n + 1);
        await loadStatsAndAggregates();
        return {
          ok: true,
          id: data.id,
          family_id: data.family_id,
          registration: data.registration,
        };
      } catch (err) {
        submitLockRef.current = false;
        setSubmitting(false);
        const errObj = {
          code: err?.code || "DATABASE_ERROR",
          message: formatRegistrationErrorMessage(err, messages),
        };
        setSubmitError(errObj);
        return { ok: false, error: errObj };
      }
    },
    [loadStatsAndAggregates]
  );

  /**
   * Submits a missing location report for administrator review (`missing_location_reports`).
   */
  const submitMissingLocation = useCallback(async (values, messages = {}) => {
    const fieldErrors = validateMissingLocationReport(values, messages);
    if (Object.keys(fieldErrors).length > 0) {
      return { ok: false, fieldErrors };
    }

    try {
      const payload = {
        action: "missing-location",
        reporter_name: values.reporterName.trim(),
        reporter_phone: values.reporterPhone ? normalizeIndianPhone(values.reporterPhone) : null,
        state_code: values.stateCode || null,
        district_code: values.districtCode || null,
        subdistrict_code: values.subdistrictCode || null,
        missing_level: values.missingLevel || "village",
        proposed_name: values.proposedName.trim(),
        parent_context: values.parentContext?.trim() || null,
        pincode: values.pincode?.trim() || null,
        notes: values.notes?.trim() || null,
      };

      const data = await fetchJsonApi("/api/parivaar?action=missing-location", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (isSupabaseConfigured()) {
        await callSupabaseRpc("submit_missing_location_report", {
          p_reporter_name: payload.reporter_name,
          p_reporter_phone: payload.reporter_phone,
          p_state_code: payload.state_code,
          p_district_code: payload.district_code,
          p_subdistrict_code: payload.subdistrict_code,
          p_missing_level: payload.missing_level,
          p_proposed_name: payload.proposed_name,
          p_parent_context: payload.parent_context,
          p_pincode: payload.pincode,
          p_notes: payload.notes,
        });
      }

      return { ok: true, id: data.id };
    } catch (err) {
      return {
        ok: false,
        error: {
          code: err?.code || "REPORT_ERROR",
          message: err?.message || "Could not submit missing location report.",
        },
      };
    }
  }, []);

  const resetSubmission = useCallback(() => {
    setSubmitSuccess(false);
    setSubmitError(null);
    setSavedRegistration(null);
    setSubmitting(false);
    submitLockRef.current = false;
  }, []);

  return {
    stats,
    aggregates,
    loadingStats,
    dbStatus,
    dbError,
    reloadStats: loadStatsAndAggregates,
    submitRegistration,
    submitMissingLocation,
    resetSubmission,
    submitting,
    submitSuccess,
    submitError,
    savedRegistration,
    directoryRefreshTick,
  };
}
