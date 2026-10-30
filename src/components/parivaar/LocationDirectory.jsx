import { useEffect, useMemo, useState } from "react";
import SearchableSelect from "./SearchableSelect";

/**
 * Solanki Rajput Parivaar Directory — Section 3: परिवार खोजें (Family Directory)
 * Full Hierarchy: India -> State/UT -> District -> Tehsil/Block -> Village -> Family Listings
 * - Supports both:
 *   1. Registered Family Listings (`families` view): Search by Family ID (e.g. 94494-001),
 *      Family Head's Name, or official location names; drill down by State/District/Tehsil/Village.
 *      Family IDs are publicly visible for all registered records (including private records, which
 *      show a privacy-safe notice instead of personal fields). Never exposes phone numbers or current addresses.
 *   2. Official LGD Location Hierarchy (`locations` view): Paginated 153,070-village directory
 *      showing registered family counts & reported member counts per location, with one-click drill-down
 *      into that village's Family Listings.
 */
function LocationDirectory({
  states = [],
  fetchDistricts,
  fetchSubdistricts,
  fetchVillages,
  queryDirectory,
  queryPublicFamilies,
  aggregates,
  initialPublicFamilies = [],
  onSelectLocationForMap,
  onPrefillRegistration,
  externalFilter,
  refreshTick = 0,
  t,
}) {
  const [directoryTab, setDirectoryTab] = useState("families"); // "families" | "locations"
  const [selectedState, setSelectedState] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedSubdistrict, setSelectedSubdistrict] = useState("");
  const [selectedVillage, setSelectedVillage] = useState("");
  const [selectedVillageName, setSelectedVillageName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyWithRegs, setOnlyWithRegs] = useState(false);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  const [districts, setDistricts] = useState([]);
  const [subdistricts, setSubdistricts] = useState([]);
  const [villages, setVillages] = useState([]);

  // Location Hierarchy state
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [dirError, setDirError] = useState(null);

  // Public Family Listings state
  const [families, setFamilies] = useState([]);
  const [totalFamilies, setTotalFamilies] = useState(0);
  const [totalMembersInFilter, setTotalMembersInFilter] = useState(0);
  const [familyPage, setFamilyPage] = useState(1);
  const [loadingFamilies, setLoadingFamilies] = useState(false);
  const [familyError, setFamilyError] = useState(null);

  const [retryTick, setRetryTick] = useState(0);
  const pageSize = 15;

  // Apply external drill-down filter (e.g., from Registration Confirmation "View in Family Directory")
  useEffect(() => {
    if (!externalFilter) return;
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      if (externalFilter.stateCode !== undefined) {
        setSelectedState(externalFilter.stateCode || "");
      }
      if (externalFilter.districtCode !== undefined) {
        setSelectedDistrict(externalFilter.districtCode || "");
      }
      if (externalFilter.subdistrictCode !== undefined) {
        setSelectedSubdistrict(externalFilter.subdistrictCode || "");
      }
      if (externalFilter.villageCode !== undefined) {
        setSelectedVillage(externalFilter.villageCode || "");
      }
      if (externalFilter.familyId) {
        setSearchQuery(externalFilter.familyId);
      }
      if (externalFilter.tab) {
        setDirectoryTab(externalFilter.tab);
      } else {
        setDirectoryTab("families");
      }
      setPage(1);
      setFamilyPage(1);
    });
    return () => {
      active = false;
    };
  }, [externalFilter]);

  // Build lookup maps for registration & member counts
  const regCountMaps = useMemo(() => {
    const byVillage = new Map();
    const membersByVillage = new Map();
    const bySubdistrict = new Map();
    const byDistrict = new Map();
    const byState = new Map();

    for (const v of aggregates?.villages || []) {
      byVillage.set(String(v.village_code), Number(v.registration_count) || 0);
      membersByVillage.set(String(v.village_code), Number(v.member_count) || 0);
    }
    for (const sb of aggregates?.subdistricts || []) {
      bySubdistrict.set(
        String(sb.subdistrict_code),
        Number(sb.registration_count) || 0
      );
    }
    for (const d of aggregates?.districts || []) {
      byDistrict.set(String(d.district_code), Number(d.registration_count) || 0);
    }
    for (const s of aggregates?.states || []) {
      byState.set(String(s.state_code), Number(s.registration_count) || 0);
    }

    return { byVillage, membersByVillage, bySubdistrict, byDistrict, byState };
  }, [aggregates]);

  // Load districts when state changes
  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => (selectedState ? fetchDistricts(selectedState) : []))
      .then((list) => {
        if (active) setDistricts(list || []);
      })
      .catch(() => {
        if (active) setDistricts([]);
      });
    return () => {
      active = false;
    };
  }, [selectedState, fetchDistricts]);

  // Load subdistricts when district changes
  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() =>
        selectedDistrict
          ? fetchSubdistricts(selectedDistrict, selectedState)
          : []
      )
      .then((list) => {
        if (active) setSubdistricts(list || []);
      })
      .catch(() => {
        if (active) setSubdistricts([]);
      });
    return () => {
      active = false;
    };
  }, [selectedDistrict, selectedState, fetchSubdistricts]);

  // Load villages when subdistrict changes
  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() =>
        selectedSubdistrict && fetchVillages
          ? fetchVillages(selectedSubdistrict, "", {
              districtCode: selectedDistrict,
              stateCode: selectedState,
              limit: 1000,
            })
          : []
      )
      .then((list) => {
        if (active) setVillages(list || []);
      })
      .catch(() => {
        if (active) setVillages([]);
      });
    return () => {
      active = false;
    };
  }, [selectedSubdistrict, selectedDistrict, selectedState, fetchVillages]);

  // Helper to filter `initialPublicFamilies` by active filters as a fallback/consistent source of truth
  const matchedInitialFamilies = useMemo(() => {
    const list = Array.isArray(initialPublicFamilies) ? initialPublicFamilies : [];
    if (list.length === 0) return [];
    const q = searchQuery.trim().toLowerCase();
    return list.filter((f) => {
      if (!f) return false;
      if (selectedVillage && String(f.village_code) !== String(selectedVillage)) {
        return false;
      }
      if (selectedState && String(f.state_code) !== String(selectedState)) {
        return false;
      }
      if (selectedDistrict && String(f.district_code) !== String(selectedDistrict)) {
        return false;
      }
      if (selectedSubdistrict && !selectedVillage) {
        const sub = String(selectedSubdistrict);
        const stripped = sub.startsWith("BLK-") ? sub.slice(4) : sub;
        if (
          String(f.subdistrict_code) !== sub &&
          String(f.subdistrict_code) !== stripped
        ) {
          // Also check if the family's village belongs to this subdistrict in `aggregates.villages`
          const aggV = (aggregates?.villages || []).find(
            (v) => String(v.village_code) === String(f.village_code)
          );
          if (
            !aggV ||
            (String(aggV.subdistrict_code) !== sub &&
              String(aggV.block_code) !== sub)
          ) {
            return false;
          }
        }
      }
      if (q) {
        const hay = [
          f.family_id,
          f.is_public ? f.family_head_name : "",
          f.is_public ? f.father_name : "",
          f.village_name,
          f.official_village_name,
          f.village_code,
          f.subdistrict_name,
          f.district_name,
          f.state_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    initialPublicFamilies,
    aggregates,
    selectedState,
    selectedDistrict,
    selectedSubdistrict,
    selectedVillage,
    searchQuery,
  ]);

  // Fetch paginated Location Hierarchy rows
  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => {
        setLoading(true);
        setDirError(null);
        return queryDirectory({
          stateCode: selectedState,
          districtCode: selectedDistrict,
          subdistrictCode: selectedSubdistrict,
          villageCode: selectedVillage,
          onlyWithRegistrations: onlyWithRegs,
          search: searchQuery,
          page,
          pageSize,
        });
      })
      .then((res) => {
        if (!active) return;
        setRows(res.rows || []);
        setTotalCount(res.totalCount || 0);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setRows([]);
        setTotalCount(0);
        setDirError(
          err?.message || "Failed to load directory records from database."
        );
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    selectedState,
    selectedDistrict,
    selectedSubdistrict,
    selectedVillage,
    onlyWithRegs,
    searchQuery,
    page,
    retryTick,
    refreshTick,
    queryDirectory,
  ]);

  // Fetch paginated Public Family Listings
  useEffect(() => {
    if (!queryPublicFamilies) return;
    let active = true;
    Promise.resolve()
      .then(() => {
        setLoadingFamilies(true);
        setFamilyError(null);
        return queryPublicFamilies({
          stateCode: selectedState,
          districtCode: selectedDistrict,
          subdistrictCode: selectedSubdistrict,
          villageCode: selectedVillage,
          search: searchQuery,
          page: familyPage,
          pageSize,
        });
      })
      .then((res) => {
        if (!active) return;
        const apiFamilies = Array.isArray(res.families) ? res.families : [];
        if (apiFamilies.length > 0 || matchedInitialFamilies.length === 0) {
          setFamilies(apiFamilies);
          setTotalFamilies(Number(res.totalCount || 0));
          setTotalMembersInFilter(Number(res.totalMembers || 0));
        } else {
          // Consistent fallback when `map-aggregates` has verified matching families
          const fallbackMembers = matchedInitialFamilies.reduce(
            (sum, fam) => sum + (Number(fam.member_count) || 1),
            0
          );
          setFamilies(matchedInitialFamilies);
          setTotalFamilies(matchedInitialFamilies.length);
          setTotalMembersInFilter(fallbackMembers);
        }
        setLoadingFamilies(false);
      })
      .catch((err) => {
        if (!active) return;
        setFamilies([]);
        setTotalFamilies(0);
        setTotalMembersInFilter(0);
        setFamilyError(
          err?.message || "Failed to load public family listings."
        );
        setLoadingFamilies(false);
      });
    return () => {
      active = false;
    };
  }, [
    selectedState,
    selectedDistrict,
    selectedSubdistrict,
    selectedVillage,
    searchQuery,
    familyPage,
    retryTick,
    refreshTick,
    queryPublicFamilies,
    matchedInitialFamilies,
  ]);

  // Automatically switch to Family Listings if user types a Family ID pattern (e.g. "94494-001")
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    setPage(1);
    setFamilyPage(1);
    if (/^\d{2,10}-\d{1,6}$/.test(val.trim())) {
      setDirectoryTab("families");
    }
  };

  const getRowRegistrationCount = (row) => {
    const rowCnt =
      typeof row.registration_count === "number" ? row.registration_count : 0;
    const mapCnt = row.village_code
      ? regCountMaps.byVillage.get(String(row.village_code)) || 0
      : row.subdistrict_code
      ? regCountMaps.bySubdistrict.get(String(row.subdistrict_code)) || 0
      : row.district_code
      ? regCountMaps.byDistrict.get(String(row.district_code)) || 0
      : 0;
    return Math.max(rowCnt, mapCnt);
  };

  const getRowMemberCount = (row) => {
    const rowMem = typeof row.member_count === "number" ? row.member_count : 0;
    const mapMem = row.village_code
      ? regCountMaps.membersByVillage.get(String(row.village_code)) || 0
      : 0;
    return Math.max(rowMem, mapMem);
  };

  const displayedRows = useMemo(() => {
    let filtered = rows;
    if (selectedVillage) {
      filtered = filtered.filter(
        (r) => String(r.village_code) === String(selectedVillage)
      );
    }
    if (!onlyWithRegs) return filtered;
    return filtered.filter((r) => getRowRegistrationCount(r) > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, onlyWithRegs, selectedVillage, regCountMaps]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const totalFamilyPages = Math.max(1, Math.ceil(totalFamilies / pageSize));

  const stateOptions = useMemo(
    () =>
      states.map((s) => ({
        value: s.state_code,
        label: s.name_local ? `${s.name_en} (${s.name_local})` : s.name_en,
        sublabel: `${s.state_or_ut} • LGD Code: ${s.state_code}`,
      })),
    [states]
  );

  const districtOptions = useMemo(
    () =>
      districts.map((d) => ({
        value: d.district_code,
        label: d.name_en,
        sublabel: `LGD District Code: ${d.district_code}`,
      })),
    [districts]
  );

  const subdistrictOptions = useMemo(
    () =>
      subdistricts.map((sb) => ({
        value: sb.subdistrict_code,
        label: sb.name_en,
        sublabel: `${sb.admin_type || "Tehsil"} • Code: ${sb.subdistrict_code}`,
      })),
    [subdistricts]
  );

  const villageOptions = useMemo(
    () =>
      villages.map((v) => ({
        value: v.village_code,
        label: v.name_local ? `${v.name_en} (${v.name_local})` : v.name_en,
        sublabel: `LGD Village Code: ${v.village_code}`,
      })),
    [villages]
  );

  const activeStateObj = states.find(
    (s) => String(s.state_code) === String(selectedState)
  );
  const activeDistrictObj = districts.find(
    (d) => String(d.district_code) === String(selectedDistrict)
  );
  const activeSubdistrictObj = subdistricts.find(
    (sb) => String(sb.subdistrict_code) === String(selectedSubdistrict)
  );
  const activeVillageObj = villages.find(
    (v) => String(v.village_code) === String(selectedVillage)
  );

  const handleViewOnMap = (row, regCnt) => {
    onSelectLocationForMap?.({
      name_en:
        row.name_en ||
        row.subdistrict_name ||
        row.district_name ||
        row.state_name,
      level: row.village_code ? "Village" : row.admin_type || "Tehsil",
      state_code: row.state_code,
      state_name: row.state_name,
      district_code: row.district_code,
      district_name: row.district_name,
      subdistrict_code: row.subdistrict_code,
      subdistrict_name: row.subdistrict_name,
      village_code: row.village_code,
      latitude: row.latitude,
      longitude: row.longitude,
      coord_source: row.coord_source,
      registration_count: regCnt,
    });
    document
      .getElementById("parivaar-map")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  const handlePrefill = (row) => {
    onPrefillRegistration?.({
      stateCode: String(row.state_code || ""),
      districtCode: String(row.district_code || ""),
      subdistrictCode: String(row.subdistrict_code || ""),
      villageCode: row.village_code ? String(row.village_code) : "",
    });
  };

  const handleDrillIntoVillageFamilies = (row) => {
    setSelectedState(String(row.state_code || ""));
    setSelectedDistrict(String(row.district_code || ""));
    setSelectedSubdistrict(String(row.subdistrict_code || ""));
    setSelectedVillage(String(row.village_code || ""));
    setSelectedVillageName(
      row.display_name_override || row.name_en || String(row.village_code || "")
    );
    setFamilyPage(1);
    setDirectoryTab("families");
  };

  return (
    <section
      id="parivaar-directory"
      className="py-8 sm:py-12 px-3.5 sm:px-4 overflow-x-hidden scroll-mt-20"
      style={{ backgroundColor: "var(--cream)" }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-4">
          <span
            className="inline-block px-3.5 py-1 rounded-full text-xs font-bold mb-2"
            style={{
              backgroundColor: "rgba(212,175,55,0.18)",
              color: "var(--maroon)",
              border: "1px solid var(--gold)",
            }}
          >
            {t.section3Label || "3. परिवार खोजें (Family Directory)"}
          </span>
          <h2 className="section-title text-xl sm:text-2xl md:text-3xl font-bold">
            📂 {t.directoryTitle}
          </h2>
          <p
            className="text-center max-w-3xl mx-auto text-xs sm:text-sm md:text-base -mt-2"
            style={{ color: "#4A3728" }}
          >
            {t.directorySubtitle}
          </p>
        </div>

        {/* View Mode Switcher: Registered Family Listings vs Official Location Hierarchy */}
        <div
          className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2"
          role="tablist"
          aria-label="Directory View Mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={directoryTab === "families"}
            data-testid="tab-family-listings"
            onClick={() => setDirectoryTab("families")}
            className="px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2"
            style={{
              minHeight: "46px",
              backgroundColor:
                directoryTab === "families" ? "var(--maroon)" : "#FFFFFF",
              color:
                directoryTab === "families" ? "var(--gold)" : "var(--maroon)",
              border: "1.5px solid var(--gold)",
            }}
          >
            <span>👨‍👩‍👧‍👦</span>
            <span>
              {t.familiesTabLabel ||
                "पंजीकृत परिवार सूची (Registered Family Listings)"}
            </span>
            <span
              className="px-2 py-0.5 rounded-full text-xs font-extrabold"
              style={{
                backgroundColor:
                  directoryTab === "families"
                    ? "var(--gold)"
                    : "rgba(107,15,26,0.1)",
                color: "var(--maroon)",
              }}
            >
              {totalFamilies.toLocaleString()}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={directoryTab === "locations"}
            data-testid="tab-location-hierarchy"
            onClick={() => setDirectoryTab("locations")}
            className="px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2"
            style={{
              minHeight: "46px",
              backgroundColor:
                directoryTab === "locations" ? "var(--maroon)" : "#FFFFFF",
              color:
                directoryTab === "locations" ? "var(--gold)" : "var(--maroon)",
              border: "1.5px solid var(--gold)",
            }}
          >
            <span>🗺️</span>
            <span>
              {t.locationsTabLabel ||
                "प्रशासनिक स्थान पदानुक्रम (Administrative Location Hierarchy)"}
            </span>
            <span
              className="px-2 py-0.5 rounded-full text-xs font-extrabold"
              style={{
                backgroundColor:
                  directoryTab === "locations"
                    ? "var(--gold)"
                    : "rgba(107,15,26,0.1)",
                color: "var(--maroon)",
              }}
            >
              {totalCount.toLocaleString()}
            </span>
          </button>
        </div>

        {/* Full Hierarchy Breadcrumb Trail: India -> State/UT -> District -> Tehsil/Block -> Village -> Family Listings */}
        <nav
          aria-label="Administrative Hierarchy Breadcrumb"
          data-testid="directory-hierarchy-breadcrumb"
          className="mb-4 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center gap-1.5 text-xs sm:text-sm"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid rgba(212,175,55,0.6)",
          }}
        >
          <span className="font-bold" style={{ color: "var(--maroon)" }}>
            🧭 {t.hierarchyLabel}:
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedState("");
              setSelectedDistrict("");
              setSelectedSubdistrict("");
              setSelectedVillage("");
              setSelectedVillageName("");
              setPage(1);
              setFamilyPage(1);
            }}
            className="font-bold underline-offset-2 hover:underline cursor-pointer"
            style={{ color: "var(--maroon)" }}
          >
            🇮🇳 भारत (India)
          </button>

          <span>→</span>
          {activeStateObj ? (
            <button
              type="button"
              onClick={() => {
                setSelectedDistrict("");
                setSelectedSubdistrict("");
                setSelectedVillage("");
                setSelectedVillageName("");
                setPage(1);
                setFamilyPage(1);
              }}
              className="font-bold px-2.5 py-0.5 rounded-full cursor-pointer"
              style={{
                backgroundColor: "rgba(139,26,26,0.1)",
                color: "var(--maroon)",
              }}
            >
              {activeStateObj.name_en}
            </button>
          ) : (
            <span className="text-gray-500">{t.allStatesCrumb}</span>
          )}

          <span>→</span>
          {activeDistrictObj ? (
            <button
              type="button"
              onClick={() => {
                setSelectedSubdistrict("");
                setSelectedVillage("");
                setSelectedVillageName("");
                setPage(1);
                setFamilyPage(1);
              }}
              className="font-bold px-2.5 py-0.5 rounded-full cursor-pointer"
              style={{
                backgroundColor: "rgba(139,26,26,0.1)",
                color: "var(--maroon)",
              }}
            >
              {activeDistrictObj.name_en}
            </button>
          ) : (
            <span className="text-gray-500">{t.allDistrictsCrumb}</span>
          )}

          <span>→</span>
          {activeSubdistrictObj ? (
            <button
              type="button"
              onClick={() => {
                setSelectedVillage("");
                setSelectedVillageName("");
                setPage(1);
                setFamilyPage(1);
              }}
              className="font-bold px-2.5 py-0.5 rounded-full cursor-pointer"
              style={{
                backgroundColor: "rgba(139,26,26,0.1)",
                color: "var(--maroon)",
              }}
            >
              {activeSubdistrictObj.name_en} ({activeSubdistrictObj.admin_type})
            </button>
          ) : (
            <span className="text-gray-500">{t.allSubdistrictsCrumb}</span>
          )}

          <span>→</span>
          {selectedVillage ? (
            <span
              className="font-bold px-2.5 py-0.5 rounded-full"
              style={{
                backgroundColor: "rgba(21,128,61,0.12)",
                color: "#15803D",
              }}
            >
              🏡{" "}
              {activeVillageObj?.name_en ||
                selectedVillageName ||
                `LGD #${selectedVillage}`}
            </span>
          ) : (
            <span className="text-gray-500">गाँव (Village)</span>
          )}

          <span>→</span>
          <button
            type="button"
            onClick={() => setDirectoryTab("families")}
            className="font-bold px-2.5 py-0.5 rounded-full cursor-pointer"
            style={{
              backgroundColor:
                directoryTab === "families"
                  ? "var(--maroon)"
                  : "rgba(212,175,55,0.2)",
              color:
                directoryTab === "families" ? "var(--gold)" : "var(--maroon)",
            }}
          >
            👨‍👩‍👧‍👦 परिवार सूची (Family Listings)
          </button>
        </nav>

        {/* Mobile-First Directory Search and Collapsible Filters */}
        <div
          className="rounded-2xl p-3.5 sm:p-5 mb-5 shadow-sm space-y-3"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid rgba(212,175,55,0.65)",
          }}
        >
          {/* Row 1: Search Input + Mobile Filter Toggle */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5">
            <div className="flex-1 min-w-0">
              <label
                htmlFor="directory-search-input"
                className="block text-xs sm:text-sm font-bold mb-1"
                style={{ color: "var(--maroon)" }}
              >
                🔍{" "}
                {directoryTab === "families"
                  ? "Family ID, मुखिया का नाम या गाँव खोजें (Search by Family ID, Head Name or Location)"
                  : t.directorySearchLabel}
              </label>
              <input
                id="directory-search-input"
                data-testid="directory-search-input"
                type="search"
                inputMode="search"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder={
                  t.familySearchPlaceholder || t.directorySearchPlaceholder
                }
                className="w-full rounded-xl px-3.5 py-2.5 text-base focus:outline-none"
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid rgba(212,175,55,0.7)",
                  color: "#2D1B0E",
                  minHeight: "48px",
                  fontSize: "16px",
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => setShowFiltersMobile((v) => !v)}
              aria-expanded={showFiltersMobile}
              aria-controls="directory-hierarchy-filters"
              data-testid="directory-mobile-filter-toggle"
              className="md:hidden px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm border transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              style={{
                minHeight: "48px",
                backgroundColor:
                  showFiltersMobile ||
                  selectedState ||
                  selectedDistrict ||
                  selectedSubdistrict ||
                  selectedVillage
                    ? "var(--maroon)"
                    : "var(--cream)",
                color:
                  showFiltersMobile ||
                  selectedState ||
                  selectedDistrict ||
                  selectedSubdistrict ||
                  selectedVillage
                    ? "var(--gold)"
                    : "var(--maroon)",
                borderColor: "var(--gold)",
              }}
            >
              <span aria-hidden="true">⚙️</span>
              <span>
                राज्य / जिला / तहसील / गाँव चुनें (Filter by Location)
              </span>
              <span aria-hidden="true" className="text-xs">
                {showFiltersMobile ? "▲" : "▼"}
              </span>
            </button>
          </div>

          {/* Row 2: State / District / Subdistrict / Village Filters */}
          <div
            id="directory-hierarchy-filters"
            className={`${
              showFiltersMobile ||
              selectedState ||
              selectedDistrict ||
              selectedSubdistrict ||
              selectedVillage
                ? "grid"
                : "hidden md:grid"
            } grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t`}
            style={{ borderColor: "rgba(212,175,55,0.3)" }}
          >
            <SearchableSelect
              id="dir-state-select"
              label={t.stateLabel}
              optionalText={t.allLabel}
              options={stateOptions}
              value={selectedState}
              onChange={(val) => {
                setSelectedState(val);
                setSelectedDistrict("");
                setSelectedSubdistrict("");
                setSelectedVillage("");
                setSelectedVillageName("");
                setPage(1);
                setFamilyPage(1);
              }}
              placeholder={t.allStatesPlaceholder}
              searchPlaceholder={t.searchStatePlaceholder}
              testId="directory-state-filter"
            />

            <SearchableSelect
              id="dir-district-select"
              label={t.districtLabel}
              optionalText={t.allLabel}
              options={districtOptions}
              value={selectedDistrict}
              onChange={(val) => {
                setSelectedDistrict(val);
                setSelectedSubdistrict("");
                setSelectedVillage("");
                setSelectedVillageName("");
                setPage(1);
                setFamilyPage(1);
              }}
              disabled={!selectedState}
              placeholder={
                selectedState ? t.allDistrictsPlaceholder : t.selectStateFirst
              }
              searchPlaceholder={t.searchDistrictPlaceholder}
              testId="directory-district-filter"
            />

            <SearchableSelect
              id="dir-subdistrict-select"
              label={t.subdistrictLabel}
              optionalText={t.allLabel}
              options={subdistrictOptions}
              value={selectedSubdistrict}
              onChange={(val) => {
                setSelectedSubdistrict(val);
                setSelectedVillage("");
                setSelectedVillageName("");
                setPage(1);
                setFamilyPage(1);
              }}
              disabled={!selectedDistrict}
              placeholder={
                selectedDistrict
                  ? t.allSubdistrictsPlaceholder
                  : t.selectDistrictFirst
              }
              searchPlaceholder={t.searchSubdistrictPlaceholder}
              testId="directory-subdistrict-filter"
            />

            <SearchableSelect
              id="dir-village-select"
              label={t.fieldVillageLabel || "गाँव (Village)"}
              optionalText={t.allLabel}
              options={villageOptions}
              value={selectedVillage}
              onChange={(val) => {
                setSelectedVillage(val);
                const found = villages.find(
                  (v) => String(v.village_code) === String(val)
                );
                setSelectedVillageName(found ? found.name_en : "");
                setPage(1);
                setFamilyPage(1);
              }}
              disabled={!selectedSubdistrict}
              placeholder={
                selectedSubdistrict
                  ? "सभी गाँव (All Villages)"
                  : t.selectSubdistrictFirst
              }
              searchPlaceholder={t.searchVillagePlaceholder}
              testId="directory-village-filter"
            />
          </div>

          <div
            className="pt-2.5 border-t flex flex-wrap items-center justify-between gap-2.5"
            style={{ borderColor: "rgba(212,175,55,0.3)" }}
          >
            {directoryTab === "locations" ? (
              <label
                className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold cursor-pointer py-1"
                style={{ color: "#4A3728", minHeight: "38px" }}
              >
                <input
                  type="checkbox"
                  data-testid="directory-only-with-registrations-toggle"
                  checked={onlyWithRegs}
                  onChange={(e) => {
                    setOnlyWithRegs(e.target.checked);
                    setPage(1);
                  }}
                  className="w-4 h-4 accent-red-900 rounded"
                />
                <span>{t.onlyLocationsWithRegistrations}</span>
              </label>
            ) : (
              <div
                className="text-xs sm:text-sm font-semibold"
                style={{ color: "var(--maroon)" }}
                data-testid="family-listings-summary-bar"
              >
                पंजीकृत परिवार (Registered Families):{" "}
                <strong>{totalFamilies.toLocaleString()}</strong> • कुल सदस्य (Reported Members):{" "}
                <strong>{totalMembersInFilter.toLocaleString()}</strong>
              </div>
            )}

            <div
              className="flex items-center gap-3 text-xs sm:text-sm"
              style={{ color: "#5C4A38" }}
            >
              {directoryTab === "locations" && (
                <span>
                  {t.showingLocationsCount}:{" "}
                  <strong>{totalCount.toLocaleString()}</strong>
                </span>
              )}
              {(selectedState ||
                selectedDistrict ||
                selectedSubdistrict ||
                selectedVillage ||
                searchQuery ||
                onlyWithRegs) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedState("");
                    setSelectedDistrict("");
                    setSelectedSubdistrict("");
                    setSelectedVillage("");
                    setSelectedVillageName("");
                    setSearchQuery("");
                    setOnlyWithRegs(false);
                    setPage(1);
                    setFamilyPage(1);
                  }}
                  className="font-bold underline cursor-pointer px-2 py-1"
                  style={{ color: "var(--maroon)" }}
                >
                  {t.clearFiltersBtn}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* VIEW 1: REGISTERED FAMILY LISTINGS (`families` tab) */}
        {directoryTab === "families" ? (
          <div
            className="rounded-2xl overflow-hidden shadow-md bg-white"
            style={{ border: "1.5px solid var(--gold)" }}
            data-testid="public-family-listings-panel"
          >
            {loadingFamilies ? (
              <div
                className="p-6 text-center text-sm font-semibold"
                style={{ color: "var(--maroon)" }}
              >
                ⏳ पंजीकृत परिवार सूची लोड हो रही है (Loading registered family listings)…
              </div>
            ) : familyError ? (
              <div className="p-6 text-center space-y-3" role="alert">
                <p
                  className="font-bold text-sm"
                  style={{ color: "#B91C1C" }}
                >
                  ⚠️ {familyError}
                </p>
                <button
                  type="button"
                  onClick={() => setRetryTick((n) => n + 1)}
                  className="px-5 py-2.5 rounded-full text-xs font-bold cursor-pointer"
                  style={{
                    backgroundColor: "var(--maroon)",
                    color: "var(--gold)",
                  }}
                >
                  पुनः प्रयास करें (Retry)
                </button>
              </div>
            ) : families.length === 0 ? (
              <div
                className="p-8 text-center space-y-3"
                data-testid="empty-family-listings"
              >
                <p
                  className="font-bold text-base"
                  style={{ color: "var(--maroon)" }}
                >
                  {t.noRegistrationsRecordedYet ||
                    "इस चयन में अभी कोई पंजीकृत परिवार नहीं है (0 Registered Families Found)"}
                </p>
                <p className="text-xs sm:text-sm text-gray-600 max-w-lg mx-auto">
                  नीचे दिए गए पंजीकरण फ़ॉर्म से अपने परिवार को जोड़ें या सभी 1,53,070 आधिकारिक गाँव देखने के लिए &ldquo;प्रशासनिक स्थान पदानुक्रम&rdquo; टैब खोलें।
                </p>
                <div className="pt-1 flex flex-wrap justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDirectoryTab("locations")}
                    className="px-4 py-2 rounded-xl text-xs font-bold border cursor-pointer"
                    style={{
                      borderColor: "var(--gold)",
                      color: "var(--maroon)",
                      backgroundColor: "#FFFBF2",
                    }}
                  >
                    🗺️ आधिकारिक स्थान पदानुक्रम देखें (Browse Official Locations)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onPrefillRegistration?.({
                        stateCode: selectedState,
                        districtCode: selectedDistrict,
                        subdistrictCode: selectedSubdistrict,
                        villageCode: selectedVillage,
                      })
                    }
                    className="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
                    style={{
                      backgroundColor: "var(--gold)",
                      color: "var(--maroon)",
                    }}
                  >
                    + परिवार पंजीकरण करें (Register Family)
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Mobile & Tablet Cards (< 1024px) */}
                <div
                  className="lg:hidden p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3"
                  data-testid="public-families-mobile-cards"
                >
                  {families.map((fam) => (
                    <article
                      key={fam.family_id}
                      data-testid="public-family-card"
                      className="rounded-xl p-4 space-y-2.5 shadow-xs"
                      style={{
                        backgroundColor: "#FFFDF9",
                        border: "1.5px solid rgba(212,175,55,0.6)",
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="px-2.5 py-1 rounded-lg font-mono text-xs sm:text-sm font-extrabold"
                          style={{
                            backgroundColor: "var(--maroon)",
                            color: "var(--gold)",
                          }}
                          data-testid="public-family-id"
                        >
                          {fam.family_id}
                        </span>
                        {fam.is_public ? (
                          <span
                            className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                            style={{
                              backgroundColor: "rgba(21,128,61,0.12)",
                              color: "#15803D",
                            }}
                          >
                            👥 {fam.member_count || 1} सदस्य (Members)
                          </span>
                        ) : (
                          <span
                            className="px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                            style={{
                              backgroundColor: "#FEF3C7",
                              color: "#92400E",
                            }}
                          >
                            🔒 गोपनीय (Private)
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="block text-[11px] font-semibold text-[#6E5840]">
                          {t.familyHeadCol ||
                            "परिवार के मुखिया का नाम (Family Head's Name)"}
                        </span>
                        {fam.is_public ? (
                          <div>
                            <h3
                              className="text-base font-bold text-[#2D1B0E] leading-snug"
                              data-testid="public-family-head"
                            >
                              {fam.family_head_name}
                            </h3>
                            {fam.father_name &&
                              String(fam.father_name).trim() && (
                                <p
                                  className="text-xs text-[#6E5840] font-normal mt-0.5 leading-snug"
                                  data-testid="public-family-father"
                                >
                                  S/o {String(fam.father_name).trim()}
                                </p>
                              )}
                          </div>
                        ) : (
                          <p
                            className="text-xs italic font-semibold text-amber-900"
                            data-testid="private-family-notice"
                          >
                            {t.privateRecordPlaceholder ||
                              "गोपनीय पंजीकरण — व्यक्तिगत विवरण सार्वजनिक नहीं (Private Record — Details Not Publicly Listed)"}
                          </p>
                        )}
                      </div>

                      <div
                        className="pt-2 border-t text-xs space-y-1"
                        style={{ borderColor: "rgba(212,175,55,0.3)" }}
                      >
                        <div>
                          <span className="font-semibold text-[#6E5840]">
                            पैतृक गाँव / ठिकाना (Ancestral Village / Thikana):{" "}
                          </span>
                          <strong style={{ color: "var(--maroon)" }}>
                            {fam.village_name || fam.thikana_name || "—"}
                          </strong>{" "}
                          {fam.village_code && (
                            <span className="font-mono text-[11px] text-gray-500">
                              (LGD #{fam.village_code})
                            </span>
                          )}
                        </div>
                        <div className="text-[#4A3728]">
                          {fam.subdistrict_name || fam.subdistrict_code} •{" "}
                          {fam.district_name || fam.district_code} •{" "}
                          {fam.state_name || fam.state_code}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {/* Desktop Table (>= 1024px) */}
                <div className="hidden lg:block overflow-x-auto">
                  <table
                    className="w-full text-sm info-table"
                    data-testid="public-families-table"
                  >
                    <thead>
                      <tr>
                        <th className="text-left">
                          {t.familyIdCol || "Family ID"}
                        </th>
                        <th className="text-left">
                          {t.familyHeadCol ||
                            "परिवार के मुखिया का नाम (Family Head's Name)"}
                        </th>
                        <th className="text-center">
                          {t.memberCountCol || "सदस्य संख्या (Family Members)"}
                        </th>
                        <th className="text-left">
                          {t.ancestralVillageThikanaCol ||
                            "पैतृक गाँव / ठिकाना (Ancestral Village / Thikana)"}
                        </th>
                        <th className="text-left">
                          तहसील / जिला / राज्य (Tehsil / District / State)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {families.map((fam) => (
                        <tr
                          key={fam.family_id}
                          data-testid="public-family-row"
                          className="hover:bg-amber-50/40 transition-colors"
                        >
                          <td>
                            <span
                              className="inline-block px-2.5 py-1 rounded-lg font-mono text-xs font-extrabold"
                              style={{
                                backgroundColor: "var(--maroon)",
                                color: "var(--gold)",
                              }}
                              data-testid="public-family-id"
                            >
                              {fam.family_id}
                            </span>
                          </td>
                          <td>
                            {fam.is_public ? (
                              <div>
                                <div
                                  className="font-bold text-[#2D1B0E] leading-snug"
                                  data-testid="public-family-head"
                                >
                                  {fam.family_head_name}
                                </div>
                                {fam.father_name &&
                                  String(fam.father_name).trim() && (
                                    <div
                                      className="text-xs text-[#6E5840] font-normal mt-0.5 leading-snug"
                                      data-testid="public-family-father"
                                    >
                                      S/o {String(fam.father_name).trim()}
                                    </div>
                                  )}
                              </div>
                            ) : (
                              <span
                                className="text-xs italic font-semibold text-amber-900"
                                data-testid="private-family-notice"
                              >
                                🔒{" "}
                                {t.privateRecordPlaceholder ||
                                  "गोपनीय पंजीकरण — व्यक्तिगत विवरण सार्वजनिक नहीं (Private Record — Details Not Publicly Listed)"}
                              </span>
                            )}
                          </td>
                          <td className="text-center">
                            {fam.is_public ? (
                              <span
                                className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold"
                                style={{
                                  backgroundColor: "rgba(21,128,61,0.12)",
                                  color: "#15803D",
                                }}
                              >
                                {fam.member_count || 1}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td>
                            <span
                              className="font-bold"
                              style={{ color: "var(--maroon)" }}
                            >
                              {fam.village_name || fam.thikana_name || "—"}
                            </span>
                            {fam.village_code && (
                              <span className="block text-[11px] text-gray-500 font-mono">
                                LGD #{fam.village_code}
                              </span>
                            )}
                          </td>
                          <td className="text-xs text-gray-700">
                            {fam.subdistrict_name || fam.subdistrict_code} (
                            {fam.admin_type || "Tehsil"}) •{" "}
                            {fam.district_name || fam.district_code} •{" "}
                            {fam.state_name || fam.state_code}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Family Listings Pagination */}
                {totalFamilies > pageSize && (
                  <div
                    className="px-3.5 sm:px-4 py-3 border-t flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs sm:text-sm"
                    style={{
                      backgroundColor: "var(--cream)",
                      borderColor: "rgba(212,175,55,0.45)",
                    }}
                  >
                    <span style={{ color: "#4A3728" }}>
                      पृष्ठ (Page) <strong>{familyPage}</strong> /{" "}
                      <strong>{totalFamilyPages}</strong> — पंजीकृत परिवार (Families):{" "}
                      <strong>{totalFamilies.toLocaleString()}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={familyPage <= 1}
                        onClick={() => setFamilyPage((p) => Math.max(1, p - 1))}
                        className="px-4 py-2 rounded-xl font-bold disabled:opacity-40 cursor-pointer"
                        style={{
                          minHeight: "44px",
                          backgroundColor: "#FFFFFF",
                          color: "var(--maroon)",
                          border: "1.5px solid var(--gold)",
                        }}
                      >
                        ← {t.prevPageBtn}
                      </button>
                      <button
                        type="button"
                        disabled={familyPage >= totalFamilyPages}
                        onClick={() =>
                          setFamilyPage((p) =>
                            Math.min(totalFamilyPages, p + 1)
                          )
                        }
                        className="px-4 py-2 rounded-xl font-bold disabled:opacity-40 cursor-pointer"
                        style={{
                          minHeight: "44px",
                          backgroundColor: "var(--maroon)",
                          color: "var(--gold)",
                        }}
                      >
                        {t.nextPageBtn} →
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          /* VIEW 2: ADMINISTRATIVE LOCATION HIERARCHY (`locations` tab) */
          <div
            className="rounded-2xl overflow-hidden shadow-md bg-white"
            style={{ border: "1.5px solid var(--gold)" }}
          >
            {loading ? (
              <div
                className="p-4 sm:p-6 space-y-3 animate-pulse"
                role="status"
                aria-live="polite"
              >
                <p
                  className="text-center text-sm font-semibold"
                  style={{ color: "var(--maroon)" }}
                >
                  ⏳ {t.directoryLoading}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="h-32 rounded-xl"
                      style={{ backgroundColor: "rgba(212,175,55,0.14)" }}
                    />
                  ))}
                </div>
              </div>
            ) : dirError ? (
              <div className="p-6 sm:p-8 text-center space-y-3" role="alert">
                <p
                  className="font-bold text-sm sm:text-base"
                  style={{ color: "#B91C1C" }}
                >
                  ⚠️ {dirError}
                </p>
                <button
                  type="button"
                  onClick={() => setRetryTick((n) => n + 1)}
                  className="px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold cursor-pointer"
                  style={{
                    backgroundColor: "var(--maroon)",
                    color: "var(--gold)",
                    minHeight: "44px",
                  }}
                >
                  पुनः प्रयास करें (Retry Loading Directory)
                </button>
              </div>
            ) : displayedRows.length === 0 ? (
              <div className="p-6 sm:p-8 text-center space-y-2">
                <p
                  className="font-bold text-sm sm:text-base"
                  style={{ color: "var(--maroon)" }}
                >
                  {onlyWithRegs
                    ? t.noRegistrationsRecordedYet
                    : t.noLocationsFound}
                </p>
                <p className="text-xs sm:text-sm text-gray-600">
                  {t.noLocationsSubtext}
                </p>
              </div>
            ) : (
              <>
                {/* 1. MOBILE & TABLET LOCATION CARDS (< 1024px) */}
                <div
                  className="lg:hidden p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
                  data-testid="location-directory-mobile-cards"
                >
                  {displayedRows.map((row, idx) => {
                    const regCnt = getRowRegistrationCount(row);
                    const memCnt = getRowMemberCount(row);
                    const rowKey =
                      row.village_code ||
                      `${row.state_code}-${row.district_code}-${row.subdistrict_code}-${idx}`;
                    const villageDisplayName = row.name_en
                      ? row.display_name_override || row.name_en
                      : t.subdistrictLevelEntry;
                    const isVerifiedCoords = Boolean(
                      row.coord_verified && row.latitude && row.longitude
                    );

                    return (
                      <article
                        key={`card-${rowKey}`}
                        data-testid="location-directory-card"
                        className="rounded-xl p-3.5 flex flex-col justify-between gap-3 shadow-xs"
                        style={{
                          backgroundColor: "#FFFDF9",
                          border: "1.5px solid rgba(212,175,55,0.6)",
                        }}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span
                                className="block text-[11px] font-bold uppercase tracking-wide"
                                style={{ color: "#6E5840" }}
                              >
                                गाँव / ठिकाना (Village / Thikana)
                              </span>
                              <h3
                                className="text-base font-extrabold leading-snug break-words"
                                style={{ color: "var(--maroon)" }}
                              >
                                {villageDisplayName}
                                {row.name_local ? ` (${row.name_local})` : ""}
                              </h3>
                              {row.village_code && (
                                <span className="inline-block text-[11px] text-gray-500 font-mono">
                                  LGD #{row.village_code}
                                </span>
                              )}
                            </div>

                            <div className="shrink-0 text-right">
                              <span
                                className="block text-[10px] font-bold"
                                style={{ color: "#6E5840" }}
                              >
                                पंजीकृत परिवार (Families)
                              </span>
                              {regCnt > 0 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDrillIntoVillageFamilies(row)
                                  }
                                  className="inline-block font-extrabold px-2.5 py-1 rounded-full text-xs mt-0.5 cursor-pointer"
                                  style={{
                                    backgroundColor: "var(--maroon)",
                                    color: "var(--gold)",
                                  }}
                                >
                                  {regCnt} परिवार ({memCnt} सदस्य) →
                                </button>
                              ) : (
                                <span
                                  className="inline-block font-semibold px-2.5 py-0.5 rounded-full text-xs mt-0.5"
                                  style={{
                                    backgroundColor: "#F5EFE8",
                                    color: "#5C4A38",
                                  }}
                                >
                                  0
                                </span>
                              )}
                            </div>
                          </div>

                          <dl
                            className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-2 border-t text-xs"
                            style={{ borderColor: "rgba(212,175,55,0.3)" }}
                          >
                            <div>
                              <dt className="text-[11px] font-semibold text-[#6E5840]">
                                तहसील / ब्लॉक (Tehsil / Block)
                              </dt>
                              <dd className="font-bold text-[#2D1B0E] break-words">
                                {row.subdistrict_name ||
                                  row.subdistrict_code ||
                                  "—"}{" "}
                                {row.admin_type && (
                                  <span
                                    className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded"
                                    style={{
                                      backgroundColor: "rgba(212,175,55,0.22)",
                                      color: "var(--maroon)",
                                    }}
                                  >
                                    {row.admin_type}
                                  </span>
                                )}
                              </dd>
                            </div>

                            <div>
                              <dt className="text-[11px] font-semibold text-[#6E5840]">
                                जिला (District)
                              </dt>
                              <dd className="font-bold text-[#2D1B0E] break-words">
                                {row.district_name || row.district_code || "—"}
                              </dd>
                            </div>

                            <div>
                              <dt className="text-[11px] font-semibold text-[#6E5840]">
                                राज्य (State)
                              </dt>
                              <dd className="font-bold text-[#2D1B0E] break-words">
                                {row.state_name || row.state_code || "—"}
                              </dd>
                            </div>

                            <div>
                              <dt className="text-[11px] font-semibold text-[#6E5840]">
                                सत्यापन स्थिति (Verification)
                              </dt>
                              <dd className="mt-0.5">
                                {isVerifiedCoords ? (
                                  <span
                                    className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
                                    style={{
                                      backgroundColor: "#F0FDF4",
                                      color: "#15803D",
                                    }}
                                  >
                                    ✓ {t.coordVerifiedBadge}
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
                                    style={{
                                      backgroundColor: "#FFFBEB",
                                      color: "#92400E",
                                    }}
                                  >
                                    📂 {t.directoryOnlyBadge}
                                  </span>
                                )}
                              </dd>
                            </div>
                          </dl>
                        </div>

                        <div
                          className="pt-2 border-t flex items-center gap-2"
                          style={{ borderColor: "rgba(212,175,55,0.3)" }}
                        >
                          {regCnt > 0 && (
                            <button
                              type="button"
                              onClick={() => handleDrillIntoVillageFamilies(row)}
                              className="flex-1 px-2.5 py-2 rounded-xl text-xs font-bold border cursor-pointer"
                              style={{
                                minHeight: "44px",
                                borderColor: "var(--maroon)",
                                color: "var(--maroon)",
                                backgroundColor: "#FFFFFF",
                              }}
                            >
                              👨‍👩‍👧‍👦 परिवार देखें ({regCnt})
                            </button>
                          )}
                          {isVerifiedCoords && (
                            <button
                              type="button"
                              onClick={() => handleViewOnMap(row, regCnt)}
                              className="flex-1 px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center justify-center gap-1"
                              style={{
                                minHeight: "44px",
                                borderColor: "var(--gold)",
                                color: "var(--maroon)",
                                backgroundColor: "#FFF8F0",
                              }}
                            >
                              🗺️ {t.viewOnMapBtn}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handlePrefill(row)}
                            className="flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
                            style={{
                              minHeight: "44px",
                              backgroundColor: "var(--gold)",
                              color: "var(--maroon)",
                            }}
                          >
                            + {t.registerHereBtn}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {/* 2. DESKTOP TABLE (>= 1024px) */}
                <div className="hidden lg:block overflow-x-auto">
                  <table
                    className="w-full text-sm info-table"
                    data-testid="location-directory-table"
                  >
                    <thead>
                      <tr>
                        <th className="text-left">{t.stateCol}</th>
                        <th className="text-left">{t.districtCol}</th>
                        <th className="text-left">{t.subdistrictCol}</th>
                        <th className="text-left">{t.villageCol}</th>
                        <th className="text-left">
                          {t.mapCoordinateStatusCol}
                        </th>
                        <th className="text-right">{t.registrationsCol}</th>
                        <th className="text-center">{t.actionCol}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedRows.map((row, idx) => {
                        const regCnt = getRowRegistrationCount(row);
                        const memCnt = getRowMemberCount(row);
                        const rowKey =
                          row.village_code ||
                          `${row.state_code}-${row.district_code}-${row.subdistrict_code}-${idx}`;

                        return (
                          <tr
                            key={rowKey}
                            className="hover:bg-amber-50/40 transition-colors"
                          >
                            <td className="font-medium text-gray-800">
                              {row.state_name || row.state_code}
                            </td>
                            <td className="font-medium text-gray-800">
                              {row.district_name || row.district_code}
                            </td>
                            <td>
                              <span className="font-medium text-gray-800">
                                {row.subdistrict_name || row.subdistrict_code}
                              </span>{" "}
                              <span
                                className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ml-1"
                                style={{
                                  backgroundColor: "rgba(212,175,55,0.22)",
                                  color: "var(--maroon)",
                                }}
                              >
                                {row.admin_type || "Tehsil"}
                              </span>
                            </td>
                            <td>
                              {row.name_en ? (
                                <div>
                                  <span
                                    className="font-bold"
                                    style={{ color: "var(--maroon)" }}
                                  >
                                    {row.display_name_override || row.name_en}
                                  </span>
                                  {row.name_local && (
                                    <span className="text-xs text-gray-500 ml-1">
                                      ({row.name_local})
                                    </span>
                                  )}
                                  <span className="block text-[11px] text-gray-500">
                                    LGD #{row.village_code}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 italic">
                                  {t.subdistrictLevelEntry}
                                </span>
                              )}
                            </td>
                            <td>
                              {row.coord_verified &&
                              row.latitude &&
                              row.longitude ? (
                                <span
                                  className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full"
                                  style={{
                                    backgroundColor: "#F0FDF4",
                                    color: "#15803D",
                                  }}
                                >
                                  ✓ {t.coordVerifiedBadge}
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full"
                                  style={{
                                    backgroundColor: "#FFFBEB",
                                    color: "#92400E",
                                  }}
                                  title={t.coordUnverifiedTooltip}
                                >
                                  📂 {t.directoryOnlyBadge}
                                </span>
                              )}
                            </td>
                            <td className="text-right">
                              {regCnt > 0 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDrillIntoVillageFamilies(row)
                                  }
                                  className="inline-block font-bold px-3 py-1 rounded-full text-xs cursor-pointer"
                                  style={{
                                    backgroundColor: "var(--maroon)",
                                    color: "var(--gold)",
                                  }}
                                >
                                  {regCnt} {t.registeredUnit} ({memCnt} सदस्य) →
                                </button>
                              ) : (
                                <span className="text-xs text-gray-500 italic">
                                  {t.noRegistrationsRecordedYet}
                                </span>
                              )}
                            </td>
                            <td className="text-center whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                {regCnt > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDrillIntoVillageFamilies(row)
                                    }
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer"
                                    style={{
                                      borderColor: "var(--maroon)",
                                      color: "var(--maroon)",
                                      backgroundColor: "#FFFFFF",
                                    }}
                                  >
                                    👨‍👩‍👧‍👦 परिवार देखें
                                  </button>
                                )}
                                {row.coord_verified &&
                                  row.latitude &&
                                  row.longitude && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleViewOnMap(row, regCnt)
                                      }
                                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer"
                                      style={{
                                        borderColor: "var(--gold)",
                                        color: "var(--maroon)",
                                        backgroundColor: "#FFF8F0",
                                      }}
                                    >
                                      🗺️ {t.viewOnMapBtn}
                                    </button>
                                  )}
                                <button
                                  type="button"
                                  onClick={() => handlePrefill(row)}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                  style={{
                                    backgroundColor: "var(--gold)",
                                    color: "var(--maroon)",
                                  }}
                                >
                                  + {t.registerHereBtn}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Touch-Friendly Pagination Footer */}
            {totalCount > pageSize && (
              <div
                className="px-3.5 sm:px-4 py-3 border-t flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs sm:text-sm"
                style={{
                  backgroundColor: "var(--cream)",
                  borderColor: "rgba(212,175,55,0.45)",
                }}
              >
                <span
                  className="text-center sm:text-left"
                  style={{ color: "#4A3728" }}
                >
                  पृष्ठ (Page) <strong>{page}</strong> /{" "}
                  <strong>{totalPages}</strong> — आधिकारिक स्थान डेटा (Official LGD Entries):{" "}
                  <strong>{totalCount.toLocaleString()}</strong>
                </span>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="flex-1 sm:flex-initial px-4 py-2 rounded-xl font-bold disabled:opacity-40 cursor-pointer"
                    style={{
                      minHeight: "44px",
                      backgroundColor: "#FFFFFF",
                      color: "var(--maroon)",
                      border: "1.5px solid var(--gold)",
                    }}
                  >
                    ← {t.prevPageBtn}
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="flex-1 sm:flex-initial px-4 py-2 rounded-xl font-bold disabled:opacity-40 cursor-pointer"
                    style={{
                      minHeight: "44px",
                      backgroundColor: "var(--maroon)",
                      color: "var(--gold)",
                    }}
                  >
                    {t.nextPageBtn} →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Directory Privacy Note */}
        <p
          className="mt-3 text-xs text-center leading-relaxed"
          style={{ color: "#5C4A38" }}
        >
          🔒 {t.directoryPrivacyNote}
        </p>
      </div>
    </section>
  );
}

export default LocationDirectory;
