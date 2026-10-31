import { Component, Suspense, lazy, useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useLanguage } from "../context/useLanguage";
import {
  useParivaarDirectory,
  useParivaarLocations,
} from "../hooks/useParivaarData";
import LocationDirectory from "../components/parivaar/LocationDirectory";
import ParivaarRegistrationForm from "../components/parivaar/ParivaarRegistrationForm";

const CommunityMap = lazy(() => import("../components/parivaar/CommunityMap"));

/**
 * Friendly deep-link hashes (used by the Home action cards, the More sheet and
 * the footer) mapped onto the section wrappers that already exist on this page.
 * `ScrollToTop` in App.jsx also tries the raw hash, so both work.
 */
const HASH_TO_SECTION = {
  register: "parivaar-register",
  directory: "parivaar-directory",
  map: "parivaar-map",
  help: "parivaar-help",
  overview: "parivaar-overview",
};

function MapLoadingSkeleton() {
  return (
    <section
      id="parivaar-map"
      className="py-8 sm:py-10 px-3.5 sm:px-4 scroll-mt-20"
      style={{ backgroundColor: "#FFFFFF" }}
    >
      <div className="max-w-6xl mx-auto space-y-3 animate-pulse">
        <div
          className="h-7 w-64 mx-auto rounded-lg"
          style={{ backgroundColor: "rgba(139,26,26,0.12)" }}
        />
        <div
          className="h-14 rounded-2xl"
          style={{ backgroundColor: "rgba(212,175,55,0.16)" }}
        />
        <div
          className="h-[340px] sm:h-[420px] rounded-2xl"
          style={{ backgroundColor: "#d8e6f2" }}
        />
      </div>
    </section>
  );
}

class MapErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Unexpected map rendering error.",
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <section
          id="parivaar-map"
          className="py-8 px-3.5 sm:px-4 scroll-mt-20"
          style={{ backgroundColor: "#FFFFFF" }}
        >
          <div
            className="max-w-6xl mx-auto rounded-2xl p-5 sm:p-6 text-center space-y-3"
            style={{
              backgroundColor: "#FFF8F0",
              border: "1.5px solid #B91C1C",
              color: "#7F1D1D",
            }}
            role="alert"
          >
            <p className="font-bold text-sm sm:text-base">
              ⚠️ मानचित्र प्रदर्शित नहीं किया जा सका (Interactive map could not be displayed:{" "}
              {this.state.errorMessage})
            </p>
            <p className="text-xs sm:text-sm">
              आप नीचे आधिकारिक स्थान निर्देशिका (Location Directory) देख सकते हैं और अपना परिवार पंजीकरण (Family Registration) कर सकते हैं।
            </p>
            <button
              type="button"
              onClick={() =>
                this.setState({ hasError: false, errorMessage: "" })
              }
              className="px-4 py-2.5 rounded-xl text-xs font-bold"
              style={{
                backgroundColor: "var(--maroon)",
                color: "var(--gold)",
                minHeight: "44px",
              }}
            >
              पुनः प्रयास करें (Retry Map)
            </button>
          </div>
        </section>
      );
    }
    return this.props.children;
  }
}

function Parivaar() {
  const { language, lang, t } = useLanguage();
  const activeLang = language || lang || "hi";
  const p = t.parivaarPage;

  // Configurable Directory Administrator Contact (never hardcoded with an invented phone number)
  const adminContactPhone = String(
    import.meta.env.VITE_PARIVAAR_ADMIN_CONTACT || ""
  ).trim();

  const {
    states,
    statesError,
    retryStates,
    fetchDistricts,
    fetchSubdistricts,
    fetchVillages,
    queryDirectory,
    queryPublicFamilies,
  } = useParivaarLocations();

  const {
    stats,
    aggregates,
    publicFamilies,
    loadingStats,
    refreshing,
    dbStatus,
    dbError,
    degraded,
    dataWarning,
    reloadStats,
    refreshNow,
    submitRegistration,
    submitMissingLocation,
    resetSubmission,
    submitting,
    submitSuccess,
    submitError,
    savedRegistration,
    directoryRefreshTick,
  } = useParivaarDirectory();

  const [selectedMapLocation, setSelectedMapLocation] = useState(null);
  const [prefillLocation, setPrefillLocation] = useState(null);
  const [directoryExternalFilter, setDirectoryExternalFilter] = useState(null);
  const [showListMapFallback, setShowListMapFallback] = useState(false);

  const scrollToSection = (id) => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    document.getElementById(id)?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  // Deep links: /parivaar#register, #directory, #map, #help, #overview
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return undefined;
    const key = decodeURIComponent(hash.replace(/^#/, ""));
    const sectionId = HASH_TO_SECTION[key] || key;
    const timer = window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: "auto",
        block: "start",
      });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [hash]);

  // Three landing actions — Register / Find / Map (existing sections, no new pages)
  const parivaarActions = (
    t.mobileUi?.parivaarActions || [
      { icon: "📝", title: p.registerCtaLocal || "परिवार पंजीकरण", desc: "", action: "register" },
      { icon: "🔍", title: p.familiesTabLabel || "परिवार खोजें", desc: "", action: "directory" },
      { icon: "🗺️", title: p.exploreMapCtaLocal || "समाज का मानचित्र", desc: "", action: "map" },
    ]
  ).map((item) => ({
    ...item,
    sectionId: HASH_TO_SECTION[item.action] || "parivaar-overview",
    testId:
      item.action === "register"
        ? "hero-register-btn"
        : item.action === "directory"
          ? "hero-directory-btn"
          : "hero-map-btn",
  }));

  const handlePrefillRegistration = (loc) => {
    setPrefillLocation({ ...loc, _ts: Date.now() });
    scrollToSection("parivaar-register");
  };

  const handleViewInDirectory = (filterSpec) => {
    setDirectoryExternalFilter({
      ...filterSpec,
      tab: "families",
      _ts: Date.now(),
    });
    scrollToSection("parivaar-directory");
  };

  const handleMapFilterChange = useCallback(
    ({ stateCode = "", districtCode = "" } = {}) => {
      reloadStats(stateCode || null, districtCode || null);
    },
    [reloadStats]
  );

  const sectionNavItems = [
    {
      id: "parivaar-overview",
      label: p.section1Label || "1. परिचय (Overview)",
    },
    {
      id: "parivaar-map",
      label: p.section2Label || "2. समाज का मानचित्र (Community Map)",
    },
    {
      id: "parivaar-directory",
      label: p.section3Label || "3. परिवार खोजें (Family Directory)",
    },
    {
      id: "parivaar-register",
      label: p.section4Label || "4. परिवार पंजीकरण (Register Family)",
    },
    {
      id: "parivaar-help",
      label: p.section5Label || "5. सुधार एवं सहायता (Corrections & Help)",
    },
  ];

  const statCards = [
    {
      id: "total-registrations",
      icon: "👨‍👩‍👧‍👦",
      value: stats.total_registrations,
      title:
        activeLang === "hi"
          ? "कुल पंजीकृत परिवार (Total Registered Families)"
          : p.statTotalRegistrations ||
            "कुल पंजीकृत परिवार (Total Registered Families)",
    },
    {
      id: "total-members",
      icon: "👥",
      value: stats.total_members,
      title:
        activeLang === "hi"
          ? "कुल पंजीकृत सदस्य (Total Reported Family Members)"
          : p.statTotalMembers ||
            "कुल पंजीकृत सदस्य (Total Reported Family Members)",
    },
    {
      id: "states-represented",
      icon: "🏛️",
      value: stats.states_represented,
      title:
        activeLang === "hi"
          ? "शामिल राज्य / UT (Represented States / UTs)"
          : p.statStatesRepresented || "शामिल राज्य (States Represented)",
    },
    {
      id: "districts-covered",
      icon: "🗺️",
      value: stats.districts_covered,
      title:
        activeLang === "hi"
          ? "शामिल जिले (Represented Districts)"
          : p.statDistrictsCovered || "शामिल जिले (Districts Covered)",
    },
    {
      id: "villages-represented",
      icon: "🏡",
      value: stats.villages_represented,
      title:
        activeLang === "hi"
          ? "पंजीकरण वाले गाँव (Villages with Registrations)"
          : p.statVillagesRepresented ||
            "पंजीकरण वाले गाँव (Villages with Registrations)",
    },
  ];

  return (
    <main className="overflow-x-hidden">
      {/* ====================================================================
          SECTION 1: 1. परिचय (Overview) — Hero, 5-Area Navigation & Live Statistics
          ==================================================================== */}
      <section
        id="parivaar-overview"
        className="relative py-6 sm:py-10 md:py-14 px-3.5 sm:px-4 text-center overflow-hidden scroll-mt-20"
        style={{
          background:
            "linear-gradient(135deg, var(--maroon) 0%, var(--maroon-dark) 55%, #4A0D0D 100%)",
          borderBottom: "3px solid var(--gold)",
        }}
      >
        <div
          aria-hidden="true"
          className="max-w-3xl mx-auto mb-2.5 flex items-center justify-center gap-2 opacity-95"
          style={{ color: "var(--gold)" }}
        >
          <span className="h-[1px] w-6 sm:w-16 bg-current inline-block" />
          <span className="text-sm sm:text-base">🪷</span>
          <span
            className="text-[11px] sm:text-xs font-bold tracking-wide px-2.5 py-0.5 rounded-full"
            style={{
              fontFamily: "'Tiro Devanagari Hindi', serif",
              backgroundColor: "rgba(212,175,55,0.16)",
              border: "1px solid rgba(212,175,55,0.5)",
            }}
          >
            {p.communityBadge ||
              "राजपूत समाज • सोलंकी परिवार (Rajput Community • Solanki Families)"}
          </span>
          <span className="text-sm sm:text-base">🪷</span>
          <span className="h-[1px] w-6 sm:w-16 bg-current inline-block" />
        </div>

        <div className="max-w-3xl mx-auto relative z-10">
          <h1
            className="text-xl sm:text-3xl md:text-4xl font-bold mb-1.5 leading-snug drop-shadow"
            style={{
              color: "#FFF8F0",
              fontFamily: "'Tiro Devanagari Hindi', serif",
            }}
          >
            {activeLang === "hi" ? (
              <>
                <span className="block">सोलंकी परिवार — एक समाज, एक पहचान</span>
                <span
                  className="block text-sm sm:text-lg md:text-xl font-semibold mt-0.5 italic"
                  style={{ color: "var(--gold)" }}
                >
                  (Solanki Families — One Community, One Identity)
                </span>
              </>
            ) : (
              p.heroHeading ||
              "सोलंकी परिवार — एक समाज, एक पहचान (Solanki Families — One Community, One Identity)"
            )}
          </h1>

          <p
            className="text-sm sm:text-base md:text-lg max-w-2xl mx-auto leading-relaxed opacity-95 mt-2 mb-4"
            style={{ color: "#FFF8F0" }}
          >
            {activeLang === "hi"
              ? "अपने परिवार का पैतृक गाँव / ठिकाना दर्ज करें, अपनी स्थायी Family ID प्राप्त करें और जानें कि हमारा समाज भारत भर में किन-किन क्षेत्रों में बसा है।"
              : p.heroDescription}
          </p>

        </div>
      </section>

      {/* Landing actions: Register Family · Find Family · Community Map.
          Each one scrolls to the section that already exists below. */}
      <section
        aria-labelledby="parivaar-actions-title"
        className="px-3.5 sm:px-4 py-4 sm:py-6"
        style={{ backgroundColor: "var(--cream)" }}
      >
        <div className="max-w-3xl mx-auto">
          <h2
            id="parivaar-actions-title"
            className="text-sm sm:text-base font-bold text-center mb-2.5"
            style={{ color: "var(--maroon)" }}
          >
            {t.mobileUi?.parivaarActionsTitle || "आप क्या करना चाहते हैं?"}
          </h2>
          <div
            className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3"
            data-testid="parivaar-landing-actions"
          >
            {parivaarActions.map((item) => (
              <button
                key={item.action}
                type="button"
                onClick={() => scrollToSection(item.sectionId)}
                data-testid={item.testId}
                className="flex items-center sm:flex-col sm:items-start gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm transition-transform active:scale-[0.98] cursor-pointer"
                style={{
                  border: "1.5px solid rgba(212,175,55,0.7)",
                  minHeight: "76px",
                }}
              >
                <span
                  aria-hidden="true"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                  style={{ backgroundColor: "rgba(212,175,55,0.2)" }}
                >
                  {item.icon}
                </span>
                <span className="min-w-0">
                  <span
                    className="block font-bold text-sm leading-tight"
                    style={{ color: "var(--maroon)" }}
                  >
                    {item.title}
                  </span>
                  {item.desc && (
                    <span
                      className="block text-xs leading-snug mt-0.5"
                      style={{ color: "#6B5B4B" }}
                    >
                      {item.desc}
                    </span>
                  )}
                </span>
                <span
                  aria-hidden="true"
                  className="ml-auto sm:hidden text-base"
                  style={{ color: "var(--gold)" }}
                >
                  ›
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 5-Section Quick Navigation Bar */}
      <nav
        aria-label="Parivaar Directory Sections"
        data-testid="parivaar-section-nav"
        className="py-2 px-3.5 border-b static md:sticky md:top-[60px] z-30 backdrop-blur-md"
        style={{
          backgroundColor: "rgba(255,248,240,0.95)",
          borderColor: "rgba(212,175,55,0.5)",
        }}
      >
        <div className="max-w-6xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar">
          {sectionNavItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollToSection(item.id)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer"
              style={{
                backgroundColor: "#FFFFFF",
                color: "var(--maroon)",
                border: "1px solid rgba(212,175,55,0.7)",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Live Registration Statistics (1. परिचय / Overview) */}
      <section
        aria-label="Community Registration Statistics"
        className="py-6 sm:py-10 px-3.5 sm:px-4"
        style={{ backgroundColor: "var(--cream)" }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-4 sm:mb-6">
            <span
              className="inline-block px-3 py-0.5 rounded-full text-[11px] font-bold mb-1.5"
              style={{
                backgroundColor: "rgba(212,175,55,0.18)",
                color: "var(--maroon)",
                border: "1px solid var(--gold)",
              }}
            >
              {p.section1Label || "1. परिचय (Overview)"}
            </span>
            <h2
              className="text-base sm:text-xl font-bold"
              style={{
                color: "var(--maroon)",
                fontFamily: "'Tiro Devanagari Hindi', serif",
              }}
            >
              {p.statsSectionTitle}
            </h2>
            <p
              className="text-[11px] sm:text-xs mt-1 max-w-2xl mx-auto leading-relaxed"
              style={{ color: "#5C4A38" }}
            >
              {p.statsDisclaimer}
            </p>
          </div>

          <div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3.5"
            data-testid="parivaar-stats-grid"
          >
            {statCards.map((card) => (
              <div
                key={card.id}
                data-testid={`stat-card-${card.id}`}
                className="rounded-2xl p-3.5 sm:p-4 text-center shadow-sm temple-card bg-white flex flex-col justify-between"
                style={{ border: "1.5px solid rgba(212,175,55,0.65)" }}
              >
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className="text-lg sm:text-2xl" aria-hidden="true">
                    {card.icon}
                  </span>
                  <div
                    className="text-2xl sm:text-3xl font-extrabold tabular-nums"
                    style={{ color: "var(--maroon)" }}
                  >
                    {loadingStats ? (
                      <span
                        className="inline-block w-10 h-7 rounded animate-pulse"
                        style={{ backgroundColor: "rgba(139,26,26,0.12)" }}
                      />
                    ) : (
                      Number(card.value || 0).toLocaleString()
                    )}
                  </div>
                </div>
                <p
                  className="text-xs font-bold leading-snug"
                  style={{ color: "#2D1B0E" }}
                >
                  {card.title}
                </p>
              </div>
            ))}
          </div>

          {!loadingStats && !degraded && stats.total_registrations === 0 && (
            <div
              className="mt-4 rounded-xl px-3.5 py-2.5 text-center text-xs sm:text-sm font-medium"
              style={{
                backgroundColor: "#FFFBF2",
                border: "1px dashed var(--gold)",
                color: "#5C4A38",
              }}
            >
              ℹ️ {p.zeroRegistrationsNotice}
            </div>
          )}

          {(statesError || dbError || dataWarning) && (
            <div
              className="mt-4 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold"
              style={{
                backgroundColor: "#FFF5F5",
                border: "1px solid #B91C1C",
                color: "#B91C1C",
              }}
              role="alert"
            >
              <span>⚠️ {statesError || dbError || dataWarning}</span>
              {refreshing && (
                <span className="text-[11px] font-medium opacity-70">
                  रीफ़्रेश हो रहा है… (Refreshing…)
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  retryStates?.();
                  refreshNow?.() || reloadStats?.();
                }}
                className="px-3.5 py-2 rounded-lg text-xs font-bold"
                style={{
                  backgroundColor: "var(--maroon)",
                  color: "var(--gold)",
                  minHeight: "40px",
                }}
              >
                पुनः प्रयास करें (Retry)
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ====================================================================
          SECTION 2: 2. समाज का मानचित्र (Community Map) + List-Based Alternative
          ==================================================================== */}
      <MapErrorBoundary>
        <Suspense fallback={<MapLoadingSkeleton />}>
          <CommunityMap
            lang={activeLang}
            t={p}
            states={states}
            fetchDistricts={fetchDistricts}
            aggregates={aggregates}
            loadingStats={loadingStats}
            dbStatus={dbStatus}
            selectedLocation={selectedMapLocation}
            onSelectLocation={setSelectedMapLocation}
            onFilterChange={handleMapFilterChange}
          />
        </Suspense>
      </MapErrorBoundary>

      {/* List-Based Alternative for Community Distribution */}
      <div
        className="py-3 px-4 border-t border-b"
        style={{
          backgroundColor: "#FFFBF2",
          borderColor: "rgba(212,175,55,0.4)",
        }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold" style={{ color: "var(--maroon)" }}>
              📊 सूची-आधारित भौगोलिक सारांश (List-Based Geographic Distribution Summary)
            </span>
            <button
              type="button"
              onClick={() => setShowListMapFallback((v) => !v)}
              data-testid="toggle-list-distribution-btn"
              className="px-3.5 py-1.5 rounded-full text-xs font-bold border cursor-pointer"
              style={{
                backgroundColor: showListMapFallback ? "var(--maroon)" : "#FFFFFF",
                color: showListMapFallback ? "var(--gold)" : "var(--maroon)",
                borderColor: "var(--gold)",
              }}
            >
              {showListMapFallback
                ? "सूची छुपाएं (Hide List Summary) ▲"
                : "राज्य / जिला / गाँव सूची देखें (View State/District/Village List) ▼"}
            </button>
          </div>

          {showListMapFallback && (
            <div
              className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs"
              data-testid="list-distribution-summary"
            >
              {/* States Summary */}
              <div className="rounded-xl p-3 bg-white border border-amber-200">
                <h4 className="font-bold mb-2" style={{ color: "var(--maroon)" }}>
                  🏛️ राज्य सारांश (State Summary)
                </h4>
                {(aggregates?.states || []).filter((s) => s.registration_count > 0)
                  .length === 0 ? (
                  <p className="text-gray-500 italic">0 पंजीकृत परिवार (0 registrations)</p>
                ) : (
                  <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                    {(aggregates?.states || [])
                      .filter((s) => s.registration_count > 0)
                      .map((s) => (
                        <li
                          key={s.state_code}
                          className="flex items-center justify-between border-b border-amber-100 pb-1"
                        >
                          <span className="font-semibold">{s.name_en}</span>
                          <span className="font-mono font-bold text-[#6B0F1A]">
                            {s.registration_count} परिवार ({s.member_count || 0} सदस्य)
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>

              {/* Districts Summary */}
              <div className="rounded-xl p-3 bg-white border border-amber-200">
                <h4 className="font-bold mb-2" style={{ color: "var(--maroon)" }}>
                  🗺️ जिला सारांश (District Summary)
                </h4>
                {(aggregates?.districts || []).filter(
                  (d) => d.registration_count > 0
                ).length === 0 ? (
                  <p className="text-gray-500 italic">0 पंजीकृत परिवार (0 registrations)</p>
                ) : (
                  <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                    {(aggregates?.districts || [])
                      .filter((d) => d.registration_count > 0)
                      .map((d) => (
                        <li
                          key={d.district_code}
                          className="flex items-center justify-between border-b border-amber-100 pb-1"
                        >
                          <span className="font-semibold">{d.name_en}</span>
                          <span className="font-mono font-bold text-[#6B0F1A]">
                            {d.registration_count} परिवार ({d.member_count || 0} सदस्य)
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>

              {/* Villages / Thikanas Summary */}
              <div className="rounded-xl p-3 bg-white border border-amber-200">
                <h4 className="font-bold mb-2" style={{ color: "var(--maroon)" }}>
                  🏡 गाँव / ठिकाना सारांश (Village / Thikana Summary)
                </h4>
                {(aggregates?.villages || []).length === 0 ? (
                  <p className="text-gray-500 italic">0 पंजीकृत परिवार (0 registrations)</p>
                ) : (
                  <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                    {(aggregates?.villages || []).map((v) => (
                      <li
                        key={v.village_code}
                        className="flex items-center justify-between border-b border-amber-100 pb-1"
                      >
                        <span className="font-semibold">
                          {v.name_en} (#{v.village_code})
                        </span>
                        <span className="font-mono font-bold text-[#6B0F1A]">
                          {v.registration_count} परिवार ({v.member_count || 0} सदस्य)
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ====================================================================
          SECTION 3: 3. परिवार खोजें (Family Directory)
          ==================================================================== */}
      <LocationDirectory
        lang={activeLang}
        t={p}
        states={states}
        fetchDistricts={fetchDistricts}
        fetchSubdistricts={fetchSubdistricts}
        fetchVillages={fetchVillages}
        queryDirectory={queryDirectory}
        queryPublicFamilies={queryPublicFamilies}
        aggregates={aggregates}
        initialPublicFamilies={publicFamilies}
        onSelectLocationForMap={setSelectedMapLocation}
        onPrefillRegistration={handlePrefillRegistration}
        externalFilter={directoryExternalFilter}
        refreshTick={directoryRefreshTick}
        mobileUi={t.mobileUi}
      />

      {/* ====================================================================
          SECTION 4: 4. परिवार पंजीकरण (Register Family) + Confirmation View
          ==================================================================== */}
      <ParivaarRegistrationForm
        lang={activeLang}
        t={p}
        states={states}
        fetchDistricts={fetchDistricts}
        fetchSubdistricts={fetchSubdistricts}
        fetchVillages={fetchVillages}
        submitRegistration={submitRegistration}
        submitMissingLocation={submitMissingLocation}
        resetSubmission={resetSubmission}
        submitting={submitting}
        submitSuccess={submitSuccess}
        submitError={submitError}
        savedRegistration={savedRegistration}
        prefillLocation={prefillLocation}
        onViewInDirectory={handleViewInDirectory}
        adminContactPhone={adminContactPhone}
        mobileUi={t.mobileUi}
      />

      {/* ====================================================================
          SECTION 5: 5. सुधार एवं सहायता (Corrections & Help)
          ==================================================================== */}
      <section
        id="parivaar-help"
        data-testid="parivaar-help-section"
        className="py-12 px-4 scroll-mt-20"
        style={{
          backgroundColor: "var(--cream)",
          borderTop: "2px solid rgba(212,175,55,0.5)",
        }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <span
              className="inline-block px-3.5 py-1 rounded-full text-xs font-bold mb-2"
              style={{
                backgroundColor: "rgba(212,175,55,0.18)",
                color: "var(--maroon)",
                border: "1px solid var(--gold)",
              }}
            >
              {p.section5Label || "5. सुधार एवं सहायता (Corrections & Help)"}
            </span>
            <h2
              className="section-title text-xl sm:text-2xl md:text-3xl font-bold"
              style={{ fontFamily: "'Tiro Devanagari Hindi', serif" }}
            >
              🛠️{" "}
              {p.helpSectionTitle ||
                "पंजीकरण सुधार एवं छूटे हुए गाँव की सहायता (Registration Corrections & Missing Location Help)"}
            </h2>
            <p
              className="text-xs sm:text-sm max-w-2xl mx-auto -mt-2"
              style={{ color: "#4A3728" }}
            >
              {p.helpSectionSubtitle ||
                "अपनी स्थायी Family ID के माध्यम से विवरण में सुधार का अनुरोध करें या आधिकारिक LGD सूची में छूटे हुए गाँव की सूचना दें।"}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Incorrect Registration Info / Corrections */}
            <div
              className="rounded-2xl p-5 bg-white shadow-sm space-y-3"
              style={{ border: "1.5px solid var(--gold)" }}
            >
              <h3
                className="text-base font-bold"
                style={{ color: "var(--maroon)" }}
              >
                ✏️{" "}
                {p.foundErrorHeading ||
                  "जानकारी में कोई गलती है? (Found an Error?)"}
              </h3>
              <p
                className="text-xs sm:text-sm leading-relaxed"
                style={{ color: "#2D1B0E" }}
              >
                {p.foundErrorBody ||
                  "यदि आपके द्वारा भरी गई जानकारी में कोई गलती है, तो कृपया अपने Family ID के साथ directory administrator से संपर्क करें। (If any submitted information is incorrect, contact the directory administrator and provide your Family ID.)"}
              </p>
              <div
                className="rounded-xl p-3 text-xs space-y-1.5"
                style={{
                  backgroundColor: "#FFFBF2",
                  border: "1px solid rgba(212,175,55,0.5)",
                  color: "#4A3728",
                }}
              >
                <p>
                  <strong>स्थायी Family ID नियम (Permanent Family ID Rule):</strong>{" "}
                  विवरण या पैतृक स्थान में सुधार होने पर भी आपकी मूल{" "}
                  <span className="font-mono font-bold">
                    LGD_VILLAGE_CODE-SEQUENCE
                  </span>{" "}
                  Family ID कभी नहीं बदलती; सभी संशोधन ऑडिट इतिहास (Audit History) में दर्ज किए जाते हैं।
                </p>
                {adminContactPhone ? (
                  <p className="font-bold" style={{ color: "var(--maroon)" }}>
                    📞 Directory Administrator Contact: {adminContactPhone}
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-600">
                    ℹ️ व्यवस्थापक संपर्क नंबर पर्यावरण सेटिंग (
                    <code className="font-mono">VITE_PARIVAAR_ADMIN_CONTACT</code>
                    ) या मंदिर संपर्क पृष्ठ के माध्यम से कॉन्फ़िगर किया जाता है।
                  </p>
                )}
              </div>
            </div>

            {/* Card 2: Missing Official LGD Village */}
            <div
              className="rounded-2xl p-5 bg-white shadow-sm space-y-3 flex flex-col justify-between"
              style={{ border: "1.5px solid var(--gold)" }}
            >
              <div className="space-y-2">
                <h3
                  className="text-base font-bold"
                  style={{ color: "var(--maroon)" }}
                >
                  📍{" "}
                  {p.missingLocationBannerTitle ||
                    "क्या आपका गाँव आधिकारिक LGD सूची में नहीं है? (Missing Village in Official LGD List?)"}
                </h3>
                <p
                  className="text-xs sm:text-sm leading-relaxed"
                  style={{ color: "#2D1B0E" }}
                >
                  डेटा की शुद्धता बनाए रखने के लिए बिना सत्यापन के मनमाने गाँव नहीं जोड़े जाते। यदि आपका पैतृक गाँव 1,53,070 आधिकारिक LGD गाँवों की सूची में नहीं मिल रहा है, तो व्यवस्थापक समीक्षा के लिए रिपोर्ट भेजें।
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    scrollToSection("parivaar-missing-location-drawer");
                    const toggleBtn = document.querySelector(
                      '[data-testid="toggle-missing-location-btn"]'
                    );
                    if (toggleBtn && toggleBtn.textContent?.includes("रिपोर्ट")) {
                      toggleBtn.click();
                    }
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
                  style={{
                    minHeight: "44px",
                    backgroundColor: "var(--maroon)",
                    color: "var(--gold)",
                  }}
                >
                  📍 {p.openMissingFormBtn || "छूटा हुआ स्थान रिपोर्ट करें (Report Missing Location)"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Parivaar;
