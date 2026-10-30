import { useCallback, useEffect, useRef, useState } from "react";
import { isSupabaseClientConfigured } from "../lib/supabase";
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

// How often an open Family Directory checks for newly registered families.
// Only registration-dependent data is refreshed; the 153k official LGD location
// records are cached separately and are never polled.
const LIVE_REFRESH_INTERVAL_MS = 7000;

function createIdempotencyKey() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

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
      villageCode = "",
      onlyWithRegistrations = false,
      search = "",
      page = 1,
      pageSize = 15,
    }) => {
      const effectiveLevel =
        level ||
        (villageCode || subdistrictCode || districtCode || stateCode || search.trim()
          ? "villages"
          : "villages");

      const params = new URLSearchParams({
        action: "directory",
        level: effectiveLevel,
        page: String(page),
        page_size: String(pageSize),
      });
      if (stateCode) params.set("state_code", String(stateCode).trim());
      if (districtCode) params.set("district_code", String(districtCode).trim());
      if (subdistrictCode) params.set("subdistrict_code", String(subdistrictCode).trim());
      if (villageCode) params.set("village_code", String(villageCode).trim());
      if (onlyWithRegistrations) params.set("only_with_registrations", "1");
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
  const [publicFamilies, setPublicFamilies] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [dbStatus, setDbStatus] = useState("checking"); // 'connected' | 'migration_pending' | 'unconfigured' | 'error'
  const [dbError, setDbError] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [savedRegistration, setSavedRegistration] = useState(null);
  const [directoryRefreshTick, setDirectoryRefreshTick] = useState(0);
  const [degraded, setDegraded] = useState(false);
  const [dataWarning, setDataWarning] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const submitLockRef = useRef(false);
  const idempotencyKeyRef = useRef(null);

  // Live-sync bookkeeping
  const revisionRef = useRef(null);
  const inFlightRef = useRef(null);
  const requestSeqRef = useRef(0);
  const appliedSeqRef = useRef(0);
  const failureCountRef = useRef(0);
  const locationFilterRef = useRef({ stateCode: null, districtCode: null });
  const mountedRef = useRef(true);

  const applyConsistentSnapshot = useCallback((snapshot) => {
    if (!snapshot || typeof snapshot !== "object") return;
    const rawStats = snapshot.summary || {};
    const rawAgg = snapshot.aggregates || {};
    const rawPub = snapshot.public_families || {};

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

    if (Array.isArray(rawPub.families)) {
      setPublicFamilies(rawPub.families);
    }
  }, []);

  /**
   * Loads overview statistics, map aggregates and public listings in ONE
   * request, so the three sections can never disagree with each other.
   *
   * `silent` refreshes (polling / tab focus) never show a loading skeleton and
   * never replace good data with zeros when the database hiccups.
   */
  const loadStatsAndAggregates = useCallback(
    (stateFilter = null, districtFilter = null, options = {}) => {
      const { silent = false, force = false } = options;
      locationFilterRef.current = {
        stateCode: stateFilter || null,
        districtCode: districtFilter || null,
      };

      // De-duplicate concurrent requests instead of firing duplicates.
      if (inFlightRef.current && !force) return inFlightRef.current;

      const requestSeq = requestSeqRef.current + 1;
      requestSeqRef.current = requestSeq;

      const params = new URLSearchParams({ action: "map-aggregates" });
      if (stateFilter) params.set("state_code", String(stateFilter).trim());
      if (districtFilter) params.set("district_code", String(districtFilter).trim());
      if (!force && revisionRef.current) {
        params.set("revision", revisionRef.current);
      }

      const promise = Promise.resolve()
        .then(() => {
          if (!silent) setLoadingStats(true);
          else setRefreshing(true);
          return fetchJsonApi(`/api/parivaar?${params.toString()}`);
        })
        .then((data) => {
          // Ignore responses that arrive out of order (a slower, older request
          // must never overwrite newer server state).
          if (requestSeq < appliedSeqRef.current) return data;
          appliedSeqRef.current = requestSeq;

          if (data?.unchanged) {
            failureCountRef.current = 0;
            if (mountedRef.current) {
              setDbStatus("connected");
              setDbError(null);
              setDegraded(false);
              setDataWarning(null);
              setLastUpdatedAt(Date.now());
            }
            return data;
          }

          applyConsistentSnapshot(data);
          const nextRevision = data?.revision || null;
          const changed = nextRevision !== revisionRef.current;
          revisionRef.current = nextRevision;

          failureCountRef.current = 0;
          if (mountedRef.current) {
            setDbStatus("connected");
            setDbError(null);
            setDegraded(Boolean(data?.degraded));
            setDataWarning(data?.data_warning || null);
            setLastUpdatedAt(Date.now());
          }
          // Ask the directory to re-read only when something actually changed.
          if (changed) setDirectoryRefreshTick((n) => n + 1);
          return data;
        })
        .catch((err) => {
          failureCountRef.current += 1;
          if (mountedRef.current) {
            // IMPORTANT: keep the last known good numbers and say what happened.
            // An API failure is never rendered as "0 registrations".
            setDbStatus(failureCountRef.current >= 2 ? "error" : "reconnecting");
            setDbError(
              err?.message ||
                "Unable to reach the registration database. Showing the last verified data."
            );
            setDegraded(true);
          }
          throw err;
        })
        .finally(() => {
          if (inFlightRef.current === promise) inFlightRef.current = null;
          if (mountedRef.current) {
            setLoadingStats(false);
            setRefreshing(false);
          }
        })
        // Callers that do not care about the failure (background refresh) must
        // not produce unhandled rejections.
        .catch(() => null);

      inFlightRef.current = promise;
      return promise;
    },
    [applyConsistentSnapshot]
  );

  useEffect(() => {
    loadStatsAndAggregates();
  }, [loadStatsAndAggregates]);

  /**
   * Near-real-time synchronisation for visitors who keep the page open:
   *  - refreshes registration-dependent data every 7s, but only while the tab
   *    is visible;
   *  - refreshes immediately when the tab regains focus or becomes visible;
   *  - refreshes once when the browser comes back online.
   * The official LGD location lists are never re-fetched here.
   */
  useEffect(() => {
    mountedRef.current = true;
    if (typeof window === "undefined" || typeof document === "undefined") {
      return () => {
        mountedRef.current = false;
      };
    }

    let timer = null;

    const refreshIfVisible = () => {
      if (document.visibilityState !== "visible") return;
      loadStatsAndAggregates(
        locationFilterRef.current.stateCode,
        locationFilterRef.current.districtCode,
        { silent: true }
      );
    };

    const startTimer = () => {
      if (timer) return;
      timer = setInterval(refreshIfVisible, LIVE_REFRESH_INTERVAL_MS);
    };
    const stopTimer = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshIfVisible();
        startTimer();
      } else {
        stopTimer();
      }
    };

    const handleOnline = () => refreshIfVisible();

    if (document.visibilityState === "visible") startTimer();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", refreshIfVisible);
    window.addEventListener("online", handleOnline);

    return () => {
      mountedRef.current = false;
      stopTimer();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", refreshIfVisible);
      window.removeEventListener("online", handleOnline);
    };
  }, [loadStatsAndAggregates]);

  const refreshNow = useCallback(
    () =>
      loadStatsAndAggregates(
        locationFilterRef.current.stateCode,
        locationFilterRef.current.districtCode,
        { silent: true, force: true }
      ),
    [loadStatsAndAggregates]
  );

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

        // One idempotency key per attempt: a retry caused by a dropped
        // connection resolves to the SAME saved family instead of a duplicate.
        if (!idempotencyKeyRef.current) {
          idempotencyKeyRef.current = createIdempotencyKey();
        }
        payload.idempotency_key = idempotencyKeyRef.current;

        const data = await fetchJsonApi("/api/parivaar?action=register", {
          method: "POST",
          body: JSON.stringify(payload),
        });

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

        // The confirmation screen always shows the record the DATABASE saved —
        // never a client-side reconstruction of the submitted form values.
        if (data.registration) {
          setSavedRegistration(data.registration);
        } else {
          setSavedRegistration({
            id: data.id,
            family_id: data.family_id,
            created_at: data.created_at,
          });
        }

        if (data.summary) {
          applyConsistentSnapshot({ summary: data.summary });
        }
        if (data.revision) revisionRef.current = data.revision;

        setSubmitSuccess(true);
        idempotencyKeyRef.current = null;
        setDirectoryRefreshTick((n) => n + 1);
        await loadStatsAndAggregates(null, null, { silent: false, force: true });
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
    [applyConsistentSnapshot, loadStatsAndAggregates]
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

      // The server persists the report to PostgreSQL as part of this request,
      // so no second write is issued from the browser.
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
    publicFamilies,
    loadingStats,
    refreshing,
    dbStatus,
    dbError,
    degraded,
    dataWarning,
    lastUpdatedAt,
    reloadStats: loadStatsAndAggregates,
    refreshNow,
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
