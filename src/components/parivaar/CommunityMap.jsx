/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import SearchableSelect from "./SearchableSelect";
import { normalizePlaceSearch } from "../../lib/validateParivaar";

const INDIA_BOUNDS = [
  [6.5, 68.0],
  [37.5, 97.5],
];
const INDIA_CENTER = [22.8, 79.0];
const INITIAL_ZOOM = 5;

/**
 * Permitted, non-rate-limited, keyless raster basemap providers.
 * Primary: CARTO Voyager (OpenStreetMap data, keyless, CORS-friendly)
 * Automatic Fallback: Esri World Street Map (keyless, high availability)
 */
export const TILE_PROVIDERS = {
  CARTO_VOYAGER: {
    id: "carto_voyager",
    name: "CARTO Voyager",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    subdomains: ["a", "b", "c", "d"],
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  ESRI_WORLD_STREET: {
    id: "esri_world_street",
    name: "Esri World Street Map",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    subdomains: [],
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, HERE, Garmin, USGS, NGA",
  },
};

function isValidIndiaCoordinate(lat, lng) {
  const nLat = Number(lat);
  const nLng = Number(lng);
  return (
    Number.isFinite(nLat) &&
    Number.isFinite(nLng) &&
    nLat >= 6.0 &&
    nLat <= 38.0 &&
    nLng >= 68.0 &&
    nLng <= 98.0
  );
}

function resolveText(t, keys, fallback) {
  const keyList = Array.isArray(keys) ? keys : [keys];
  if (typeof t === "function") {
    for (const k of keyList) {
      try {
        const val = t(k);
        if (typeof val === "string" && val.trim() && val !== k) {
          return val;
        }
      } catch {
        // ignore and continue to fallback
      }
    }
  } else if (t && typeof t === "object") {
    for (const k of keyList) {
      const val = t[k];
      if (typeof val === "string" && val.trim()) {
        return val;
      }
    }
  }
  return fallback;
}

function normalizeRowCount(row) {
  if (!row || typeof row !== "object") return 0;
  const raw =
    row.registration_count !== undefined
      ? row.registration_count
      : row.count !== undefined
        ? row.count
        : 0;
  const num = Number(raw);
  return Number.isFinite(num) && num >= 0 ? num : 0;
}

/**
 * Cluster nearby markers when viewing at wider zoom levels so crowded locations
 * remain easy to tap on mobile touchscreens.
 */
function clusterMarkersForView(markers, zoom) {
  if (!Array.isArray(markers) || markers.length <= 1 || zoom >= 9) {
    return markers.map((m) => ({ ...m, isCluster: false }));
  }

  const cellSize = zoom <= 5 ? 0.85 : zoom <= 7 ? 0.35 : 0.14;
  const buckets = new Map();

  for (const m of markers) {
    const latKey = Math.round(Number(m.latitude) / cellSize);
    const lngKey = Math.round(Number(m.longitude) / cellSize);
    const key = `${m.level || "Loc"}:${latKey}:${lngKey}`;
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key).push(m);
  }

  const result = [];
  for (const group of buckets.values()) {
    if (group.length === 1) {
      result.push({ ...group[0], isCluster: false });
    } else {
      const sumLat = group.reduce((acc, item) => acc + Number(item.latitude), 0);
      const sumLng = group.reduce((acc, item) => acc + Number(item.longitude), 0);
      const sumCount = group.reduce(
        (acc, item) => acc + Number(item.count || 0),
        0
      );
      const primary = group[0];
      result.push({
        ...primary,
        isCluster: true,
        clusterSize: group.length,
        clusterItems: group,
        latitude: sumLat / group.length,
        longitude: sumLng / group.length,
        count: sumCount,
        registration_count: sumCount,
        name_en: `${primary.district_name || primary.state_name || primary.name_en} (${group.length} स्थान / Locations)`,
      });
    }
  }
  return result;
}

function createPinHtml(count, level, isSelected, isCluster = false, clusterSize = 1) {
  const safeCount = Math.max(0, Number(count) || 0);
  const bg = isSelected
    ? "#FF6B00"
    : isCluster
      ? "#5B0E14"
      : level === "State"
        ? "#8B1A1A"
        : level === "District"
          ? "#A12323"
          : "#6B1313";
  const ring = isSelected ? "#FFFFFF" : "#D4AF37";
  const size = isCluster
    ? 44
    : level === "State"
      ? 40
      : level === "District"
        ? 36
        : 32;
  const badgeText = isCluster ? `${safeCount} (${clusterSize})` : String(safeCount);

  return `
    <div style="
      min-width:${size}px;
      height:${size}px;
      padding:0 7px;
      border-radius:9999px;
      background:${bg};
      border:2.5px solid ${ring};
      color:#FFF8F0;
      font-weight:800;
      font-size:${size >= 38 ? "12px" : "11px"};
      display:flex;
      align-items:center;
      justify-content:center;
      box-shadow:0 4px 12px rgba(0,0,0,0.38);
      transform:${isSelected ? "scale(1.14)" : "scale(1)"};
      transition:transform 0.15s ease;
      white-space:nowrap;
    ">
      <span>${badgeText}</span>
    </div>
  `;
}

/**
 * Interactive India Community Distribution Map (Mobile-First)
 * - Compact search & collapsible secondary filter drawer on mobile.
 * - Hindi + English location search.
 * - Large 44x44px touch zoom buttons positioned at top-right (never covered by bottom floating dock).
 * - Automatic marker clustering at wider zoom levels for crowded regions.
 * - Keyless CARTO Voyager + Esri World Street Map automatic fallback.
 * - Displays aggregate counts only; never exposes personal data.
 */
export default function CommunityMap({
  t,
  states = [],
  districts: districtsProp,
  fetchDistricts,
  mapAggregates: mapAggregatesProp,
  aggregates,
  selectedState: controlledSelectedState,
  onStateChange,
  selectedDistrict: controlledSelectedDistrict,
  onDistrictChange,
  selectedLocation,
  onSelectLocation,
  onFilterChange,
  loading: loadingProp = false,
  loadingStats = false,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersLayerRef = useRef(null);

  const [internalState, setInternalState] = useState("");
  const [internalDistrict, setInternalDistrict] = useState("");
  const [fetchedDistricts, setFetchedDistricts] = useState([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [mapSearchQuery, setMapSearchQuery] = useState("");
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  const selectedState =
    controlledSelectedState !== undefined ? controlledSelectedState : internalState;
  const selectedDistrict =
    controlledSelectedDistrict !== undefined
      ? controlledSelectedDistrict
      : internalDistrict;

  const [mapLevel, setMapLevel] = useState("auto"); // 'auto' | 'state' | 'district' | 'village'
  const [currentZoom, setCurrentZoom] = useState(INITIAL_ZOOM);
  const [tileStatus, setTileStatus] = useState("loading"); // 'loading' | 'ready' | 'fallback' | 'error'
  const [activeProvider, setActiveProvider] = useState(
    TILE_PROVIDERS.CARTO_VOYAGER.id
  );
  const [internalSelectedMarker, setInternalSelectedMarker] = useState(null);

  const selectedMarker =
    selectedLocation !== undefined ? selectedLocation : internalSelectedMarker;
  const setSelectedMarker = useCallback(
    (loc) => {
      setInternalSelectedMarker(loc);
      if (typeof onSelectLocation === "function") {
        onSelectLocation(loc);
      }
    },
    [onSelectLocation]
  );

  useEffect(() => {
    if (Array.isArray(districtsProp)) return;
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (!selectedState || typeof fetchDistricts !== "function") {
          return [];
        }
        setLoadingDistricts(true);
        return fetchDistricts(selectedState);
      })
      .then((rows) => {
        if (!cancelled) {
          setFetchedDistricts(Array.isArray(rows) ? rows : []);
          setLoadingDistricts(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFetchedDistricts([]);
          setLoadingDistricts(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedState, districtsProp, fetchDistricts]);

  const districts = useMemo(() => {
    if (Array.isArray(districtsProp)) return districtsProp;
    return fetchedDistricts;
  }, [districtsProp, fetchedDistricts]);

  const normalizedAggregates = useMemo(() => {
    const raw = mapAggregatesProp || aggregates || {};
    const rawStates = Array.isArray(raw.states) ? raw.states : [];
    const rawDistricts = Array.isArray(raw.districts) ? raw.districts : [];
    const rawVillages = Array.isArray(raw.villages) ? raw.villages : [];
    const rawSubdistricts = Array.isArray(raw.subdistricts)
      ? raw.subdistricts
      : [];

    const normRow = (r, levelLabel) => {
      const count = normalizeRowCount(r);
      return {
        ...r,
        level: r.level || levelLabel,
        count,
        registration_count: count,
      };
    };

    const sRows = rawStates.map((r) => normRow(r, "State"));
    const dRows = rawDistricts.map((r) => normRow(r, "District"));
    const vRows = rawVillages.map((r) => normRow(r, "Village"));
    const subRows = rawSubdistricts.map((r) => normRow(r, "Tehsil"));

    const verifiedVillages = vRows.filter(
      (v) =>
        Boolean(v.coord_verified) &&
        isValidIndiaCoordinate(v.latitude, v.longitude) &&
        v.count > 0
    );
    const unverifiedCount = vRows.filter(
      (v) =>
        v.count > 0 &&
        (!v.coord_verified || !isValidIndiaCoordinate(v.latitude, v.longitude))
    ).length;

    return {
      states: sRows,
      districts: dRows,
      subdistricts: subRows,
      villages: verifiedVillages,
      allVillages: vRows,
      unverified_villages_with_registrations:
        typeof raw.unverified_villages_with_registrations === "number"
          ? raw.unverified_villages_with_registrations
          : unverifiedCount,
    };
  }, [mapAggregatesProp, aggregates]);

  const handleStateSelect = (val) => {
    const nextState = val || "";
    if (typeof onStateChange === "function") {
      onStateChange(nextState);
    } else {
      setInternalState(nextState);
    }
    if (typeof onDistrictChange === "function") {
      onDistrictChange("");
    } else {
      setInternalDistrict("");
    }
    setSelectedMarker(null);
    if (typeof onFilterChange === "function") {
      onFilterChange({ stateCode: nextState, districtCode: "" });
    }
  };

  const handleDistrictSelect = (val) => {
    const nextDistrict = val || "";
    if (typeof onDistrictChange === "function") {
      onDistrictChange(nextDistrict);
    } else {
      setInternalDistrict(nextDistrict);
    }
    setSelectedMarker(null);
    if (typeof onFilterChange === "function") {
      onFilterChange({ stateCode: selectedState, districtCode: nextDistrict });
    }
  };

  const stateOptions = useMemo(
    () =>
      (Array.isArray(states) ? states : []).map((s) => ({
        value: String(s.state_code),
        label: s.name_local ? `${s.name_en} (${s.name_local})` : s.name_en,
        sublabel: `${s.state_or_ut || "State"} • LGD #${s.state_code}`,
      })),
    [states]
  );

  const districtOptions = useMemo(
    () =>
      (Array.isArray(districts) ? districts : []).map((d) => ({
        value: String(d.district_code),
        label: d.name_local ? `${d.name_en} (${d.name_local})` : d.name_en,
        sublabel: `LGD #${d.district_code}`,
      })),
    [districts]
  );

  // Determine which markers to display based on level, zoom, filters, and Hindi/English search query
  const visibleMarkers = useMemo(() => {
    const sRows = normalizedAggregates.states;
    const dRows = normalizedAggregates.districts;
    const vRows = normalizedAggregates.villages;

    let effectiveLevel = mapLevel;
    if (effectiveLevel === "auto") {
      if (selectedDistrict || currentZoom >= 8) {
        effectiveLevel = "village";
      } else if (selectedState || currentZoom >= 6) {
        effectiveLevel = "district";
      } else {
        effectiveLevel = "state";
      }
    }

    let sourceRows = [];
    if (effectiveLevel === "state") {
      sourceRows = sRows.map((r) => ({ ...r, level: "State" }));
    } else if (effectiveLevel === "district") {
      sourceRows = dRows.map((r) => ({ ...r, level: "District" }));
      if (
        sourceRows.filter((r) => r.count > 0).length === 0 &&
        vRows.length > 0
      ) {
        sourceRows = vRows.map((r) => ({ ...r, level: "Village" }));
      }
    } else {
      sourceRows = vRows.map((r) => ({ ...r, level: "Village" }));
      if (sourceRows.filter((r) => r.count > 0).length === 0) {
        const dWithCount = dRows
          .filter((r) => r.count > 0)
          .map((r) => ({ ...r, level: "District" }));
        sourceRows =
          dWithCount.length > 0
            ? dWithCount
            : sRows
                .filter((r) => r.count > 0)
                .map((r) => ({ ...r, level: "State" }));
      }
    }

    const q = mapSearchQuery.trim().toLowerCase();
    const normQ = q ? normalizePlaceSearch(q) : "";

    const filtered = sourceRows.filter((row) => {
      if (!row.coord_verified) return false;
      if (!isValidIndiaCoordinate(row.latitude, row.longitude)) return false;
      if (Number(row.count || 0) <= 0) return false;
      if (selectedState && String(row.state_code) !== String(selectedState)) {
        return false;
      }
      if (
        selectedDistrict &&
        row.district_code &&
        String(row.district_code) !== String(selectedDistrict)
      ) {
        return false;
      }
      if (q) {
        const nameEn = String(row.name_en || "").toLowerCase();
        const nameLocal = String(row.name_local || "").toLowerCase();
        const stateName = String(row.state_name || "").toLowerCase();
        const distName = String(row.district_name || "").toLowerCase();
        const subName = String(row.subdistrict_name || "").toLowerCase();
        const combined = `${nameEn} ${nameLocal} ${stateName} ${distName} ${subName}`;
        const matchesRaw = combined.includes(q);
        const matchesNorm = normalizePlaceSearch(combined).includes(normQ);
        if (!matchesRaw && !matchesNorm) {
          return false;
        }
      }
      return true;
    });

    return clusterMarkersForView(filtered, currentZoom);
  }, [
    normalizedAggregates,
    mapLevel,
    currentZoom,
    selectedState,
    selectedDistrict,
    mapSearchQuery,
  ]);

  const totalDisplayedRegistrations = useMemo(() => {
    const sRows = normalizedAggregates.states;
    const dRows = normalizedAggregates.districts;
    if (selectedDistrict) {
      const d = dRows.find(
        (x) => String(x.district_code) === String(selectedDistrict)
      );
      return d ? Number(d.count || 0) : 0;
    }
    if (selectedState) {
      const s = sRows.find(
        (x) => String(x.state_code) === String(selectedState)
      );
      return s ? Number(s.count || 0) : 0;
    }
    return sRows.reduce((sum, r) => sum + Number(r.count || 0), 0);
  }, [normalizedAggregates, selectedState, selectedDistrict]);

  // Initialize Leaflet map once
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapInstanceRef.current) return;

    const map = L.map(container, {
      center: INDIA_CENTER,
      zoom: INITIAL_ZOOM,
      minZoom: 4,
      maxZoom: 15,
      maxBounds: INDIA_BOUNDS,
      maxBoundsViscosity: 0.85,
      zoomControl: false,
      scrollWheelZoom: false,
      tap: true,
    });

    // Place large touch-friendly zoom controls at top-right so they never collide with bottom floating dock
    L.control.zoom({ position: "topright" }).addTo(map);

    mapInstanceRef.current = map;
    markersLayerRef.current = L.layerGroup().addTo(map);

    let fallbackTriggered = false;
    let errorCount = 0;

    const attachProvider = (providerConfig, isFallback = false) => {
      if (tileLayerRef.current) {
        map.removeLayer(tileLayerRef.current);
      }

      const layerOpts = {
        attribution: providerConfig.attribution,
        maxZoom: 18,
      };
      if (providerConfig.subdomains && providerConfig.subdomains.length > 0) {
        layerOpts.subdomains = providerConfig.subdomains;
      }

      const layer = L.tileLayer(providerConfig.url, layerOpts);

      layer.on("tileload", () => {
        setTileStatus(isFallback ? "fallback" : "ready");
      });

      layer.on("load", () => {
        setTileStatus(isFallback ? "fallback" : "ready");
      });

      layer.on("tileerror", () => {
        errorCount += 1;
        if (!fallbackTriggered && errorCount >= 3) {
          fallbackTriggered = true;
          setActiveProvider(TILE_PROVIDERS.ESRI_WORLD_STREET.id);
          attachProvider(TILE_PROVIDERS.ESRI_WORLD_STREET, true);
        } else if (fallbackTriggered && errorCount >= 10) {
          setTileStatus("error");
        }
      });

      layer.addTo(map);
      tileLayerRef.current = layer;
    };

    attachProvider(TILE_PROVIDERS.CARTO_VOYAGER, false);

    map.on("zoomend", () => {
      setCurrentZoom(map.getZoom());
    });

    const invalidateTimer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    let resizeObserver = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(container);
    }

    let intersectionObserver = null;
    if (typeof IntersectionObserver !== "undefined") {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              map.invalidateSize();
            }
          }
        },
        { threshold: 0.1 }
      );
      intersectionObserver.observe(container);
    }

    return () => {
      clearTimeout(invalidateTimer);
      if (resizeObserver) resizeObserver.disconnect();
      if (intersectionObserver) intersectionObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  // Fly to selected State or District when filter changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (selectedDistrict) {
      const distRow =
        normalizedAggregates.districts.find(
          (d) => String(d.district_code) === String(selectedDistrict)
        ) ||
        districts.find(
          (d) => String(d.district_code) === String(selectedDistrict)
        );
      if (
        distRow &&
        distRow.coord_verified &&
        isValidIndiaCoordinate(distRow.latitude, distRow.longitude)
      ) {
        map.setView([Number(distRow.latitude), Number(distRow.longitude)], 9, {
          animate: true,
        });
        return;
      }
    }

    if (selectedState) {
      const stateRow =
        normalizedAggregates.states.find(
          (s) => String(s.state_code) === String(selectedState)
        ) ||
        states.find((s) => String(s.state_code) === String(selectedState));
      if (
        stateRow &&
        stateRow.coord_verified &&
        isValidIndiaCoordinate(stateRow.latitude, stateRow.longitude)
      ) {
        map.setView([Number(stateRow.latitude), Number(stateRow.longitude)], 6, {
          animate: true,
        });
        return;
      }
    }
  }, [selectedState, selectedDistrict, states, districts, normalizedAggregates]);

  // Fly to externally selected location (e.g. from LocationDirectory "View on Map")
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedLocation) return;
    if (
      isValidIndiaCoordinate(
        selectedLocation.latitude,
        selectedLocation.longitude
      )
    ) {
      map.setView(
        [Number(selectedLocation.latitude), Number(selectedLocation.longitude)],
        10,
        { animate: true }
      );
    }
  }, [selectedLocation]);

  // Render verified aggregate markers / clusters
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = markersLayerRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    visibleMarkers.forEach((m) => {
      const lat = Number(m.latitude);
      const lng = Number(m.longitude);
      if (!isValidIndiaCoordinate(lat, lng)) return;

      const count = normalizeRowCount(m);
      const isSelected =
        selectedMarker &&
        selectedMarker.name_en === m.name_en &&
        selectedMarker.level === m.level;

      const icon = L.divIcon({
        className: "parivaar-verified-pin",
        html: createPinHtml(
          count,
          m.level,
          isSelected,
          Boolean(m.isCluster),
          m.clusterSize || 1
        ),
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -18],
      });

      const marker = L.marker([lat, lng], {
        icon,
        title: `${m.name_en} (${count})`,
      });

      const hierarchyLine = [
        m.subdistrict_name ? `तहसील/ब्लॉक (Tehsil/Block): ${m.subdistrict_name}` : null,
        m.district_name ? `जिला (District): ${m.district_name}` : null,
        m.state_name ? `राज्य (State): ${m.state_name}` : null,
      ]
        .filter(Boolean)
        .join(" • ");

      const popupHtml = `
        <div style="min-width:190px;max-width:260px;font-family:'Tiro Devanagari Hindi',serif;color:#2D1B0E;">
          <div style="font-size:11px;font-weight:700;color:#8B1A1A;text-transform:uppercase;letter-spacing:0.04em;">
            ${m.isCluster ? "समूह पिन (Clustered Locations)" : `${m.level} • आधिकारिक स्थान डेटा (Verified LGD)`}
          </div>
          <div style="font-size:15px;font-weight:800;margin-top:2px;color:#2D1B0E;">
            ${m.name_en}${m.name_local ? ` (${m.name_local})` : ""}
          </div>
          ${
            hierarchyLine
              ? `<div style="font-size:12px;color:#5C4A38;margin-top:3px;">${hierarchyLine}</div>`
              : ""
          }
          <div style="margin-top:8px;padding:6px 10px;border-radius:8px;background:#FFF8F0;border:1px solid #D4AF37;display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <span style="font-size:12px;font-weight:700;color:#6B1313;">पंजीकरण (Registrations):</span>
            <span style="font-size:15px;font-weight:900;color:#8B1A1A;">${count}</span>
          </div>
          <div style="font-size:10px;color:#6E5840;margin-top:5px;">
            स्रोत (Source): ${m.coord_source || "Official LGD GIS"} (${lat.toFixed(4)}, ${lng.toFixed(4)})
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on("click", () => {
        setSelectedMarker(m);
        if (m.isCluster && map.getZoom() < 10) {
          map.setView([lat, lng], Math.min(map.getZoom() + 2, 11), {
            animate: true,
          });
        }
      });

      marker.addTo(layerGroup);
    });
  }, [visibleMarkers, selectedMarker, setSelectedMarker]);

  const handleResetView = () => {
    handleStateSelect("");
    setMapLevel("auto");
    setMapSearchQuery("");
    setSelectedMarker(null);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(INDIA_CENTER, INITIAL_ZOOM, {
        animate: true,
      });
    }
  };

  const isLoading = Boolean(loadingProp || loadingStats);
  const unverifiedWithRegsCount =
    normalizedAggregates.unverified_villages_with_registrations || 0;
  const hasActiveFilter = Boolean(
    selectedState || selectedDistrict || mapLevel !== "auto" || mapSearchQuery
  );

  return (
    <section
      id="parivaar-map"
      aria-labelledby="parivaar-map-heading"
      className="py-8 sm:py-12 px-3.5 sm:px-4 scroll-mt-20 overflow-x-hidden"
      style={{ backgroundColor: "#FFFFFF" }}
    >
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Section Heading */}
        <div className="text-center">
          <span
            className="inline-block text-[11px] sm:text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-1.5"
            style={{
              backgroundColor: "rgba(139, 26, 26, 0.1)",
              color: "var(--maroon)",
              border: "1px solid var(--gold)",
            }}
          >
            🗺️{" "}
            {resolveText(
              t,
              ["mapBadge", "mapTitle"],
              "समाज का भौगोलिक मानचित्र (Community Distribution Map)"
            )}
          </span>
          <h2
            id="parivaar-map-heading"
            className="section-title text-xl sm:text-2xl md:text-3xl font-bold"
          >
            {resolveText(
              t,
              ["mapTitle", "mapHeading"],
              "समाज का भौगोलिक मानचित्र (Community Distribution Map)"
            )}
          </h2>
          <p className="max-w-2xl mx-auto text-xs sm:text-sm md:text-base text-[#4A3525] -mt-3">
            {resolveText(
              t,
              ["mapSubtitle"],
              "भारत के मानचित्र पर राज्य, जिला और सत्यापित निर्देशांक वाले गाँवों के स्तर पर पंजीकरण की कुल संख्या देखें। (View aggregate registration counts across States, Districts and Villages with verified coordinates.)"
            )}
          </p>
        </div>

        {/* Mobile-First Map Controls Bar */}
        <div
          className="rounded-2xl p-3.5 sm:p-4 shadow-sm space-y-3"
          style={{
            backgroundColor: "var(--cream)",
            border: "1.5px solid rgba(212, 175, 55, 0.55)",
          }}
        >
          {/* Row 1 (Always visible on mobile & desktop): Search Location + Mobile Filter Toggle + Reset India View */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5">
            <div className="flex-1 min-w-0">
              <label
                htmlFor="map-search-location"
                className="block text-xs sm:text-sm font-bold mb-1"
                style={{ color: "var(--maroon)" }}
              >
                {resolveText(
                  t,
                  ["mapSearchLabel"],
                  "स्थान खोजें (Search Location)"
                )}
              </label>
              <input
                id="map-search-location"
                type="search"
                inputMode="search"
                value={mapSearchQuery}
                onChange={(e) => setMapSearchQuery(e.target.value)}
                placeholder={resolveText(
                  t,
                  ["mapSearchPlaceholder"],
                  "हिंदी या English में स्थान खोजें — जैसे राजस्थान, बूंदी, छापावदा…"
                )}
                data-testid="map-search-input"
                className="w-full rounded-xl px-3.5 py-2.5 text-base bg-white focus:outline-none"
                style={{
                  border: "1px solid rgba(212, 175, 55, 0.75)",
                  color: "#2D1B0E",
                  minHeight: "48px",
                  fontSize: "16px",
                }}
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Mobile collapsible secondary filter toggle button */}
              <button
                type="button"
                onClick={() => setShowFiltersMobile((v) => !v)}
                aria-expanded={showFiltersMobile}
                aria-controls="map-secondary-filters"
                data-testid="map-mobile-filter-toggle"
                className="md:hidden flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm border transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                style={{
                  minHeight: "48px",
                  backgroundColor:
                    showFiltersMobile || selectedState || selectedDistrict
                      ? "var(--maroon)"
                      : "#FFFFFF",
                  color:
                    showFiltersMobile || selectedState || selectedDistrict
                      ? "var(--gold)"
                      : "var(--maroon)",
                  borderColor: "var(--gold)",
                }}
              >
                <span aria-hidden="true">⚙️</span>
                <span>
                  राज्य / जिला फ़िल्टर (Filters)
                  {selectedState || selectedDistrict ? " • सक्रिय" : ""}
                </span>
                <span aria-hidden="true" className="text-xs">
                  {showFiltersMobile ? "▲" : "▼"}
                </span>
              </button>

              {/* Reset to All India button */}
              <button
                type="button"
                onClick={handleResetView}
                data-testid="map-reset-india-btn"
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                style={{
                  backgroundColor: hasActiveFilter ? "var(--maroon)" : "#FFFFFF",
                  color: hasActiveFilter ? "var(--gold)" : "var(--maroon)",
                  border: "1.5px solid var(--gold)",
                  minHeight: "48px",
                }}
              >
                <span aria-hidden="true">🇮🇳</span>
                <span>
                  {resolveText(
                    t,
                    ["resetMapBtn", "mapResetIndia"],
                    "पूरा भारत देखें (View All India)"
                  )}
                </span>
              </button>
            </div>
          </div>

          {/* Row 2: Secondary Filters (Collapsible on mobile, always visible on md+) */}
          <div
            id="map-secondary-filters"
            className={`${
              showFiltersMobile || selectedState || selectedDistrict
                ? "grid"
                : "hidden md:grid"
            } grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t`}
            style={{ borderColor: "rgba(212,175,55,0.35)" }}
          >
            {/* 1. Select State */}
            <SearchableSelect
              id="map-filter-state"
              label={resolveText(
                t,
                ["filterStateLabel", "mapFilterState"],
                "राज्य चुनें (Select State)"
              )}
              optionalText={resolveText(t, ["allLabel"], "सभी (All)")}
              options={stateOptions}
              value={selectedState}
              onChange={handleStateSelect}
              placeholder={resolveText(
                t,
                ["allStatesPlaceholder", "mapAllStates"],
                "राज्य चुनें (Select State)"
              )}
              searchPlaceholder={resolveText(
                t,
                ["searchStatePlaceholder", "searchPlaceholder"],
                "राज्य खोजें (Search State)…"
              )}
              testId="map-state-select"
            />

            {/* 2. Select District */}
            <SearchableSelect
              id="map-filter-district"
              label={resolveText(
                t,
                ["filterDistrictLabel", "mapFilterDistrict"],
                "जिला चुनें (Select District)"
              )}
              optionalText={resolveText(t, ["allLabel"], "सभी (All)")}
              options={districtOptions}
              value={selectedDistrict}
              onChange={handleDistrictSelect}
              disabled={!selectedState}
              loading={loadingDistricts}
              placeholder={
                selectedState
                  ? resolveText(
                      t,
                      ["allDistrictsPlaceholder", "mapAllDistricts"],
                      "जिला चुनें (Select District)"
                    )
                  : resolveText(
                      t,
                      ["selectStateFirst"],
                      "पहले राज्य चुनें (Select State First)"
                    )
              }
              searchPlaceholder={resolveText(
                t,
                ["searchDistrictPlaceholder", "searchPlaceholder"],
                "जिला खोजें (Search District)…"
              )}
              testId="map-district-select"
            />

            {/* 3. Map Level */}
            <div>
              <label
                htmlFor="map-level-select"
                className="block text-xs sm:text-sm font-bold mb-1.5"
                style={{ color: "var(--maroon)" }}
              >
                {resolveText(
                  t,
                  ["mapLevelLabel"],
                  "मानचित्र स्तर (Map Level)"
                )}
              </label>
              <select
                id="map-level-select"
                value={mapLevel}
                onChange={(e) => setMapLevel(e.target.value)}
                className="w-full rounded-xl px-3.5 py-2.5 text-base bg-white focus:outline-none"
                style={{
                  border: "1px solid rgba(212, 175, 55, 0.7)",
                  color: "#2D1B0E",
                  minHeight: "48px",
                  fontSize: "16px",
                }}
              >
                <option value="auto">
                  {resolveText(
                    t,
                    ["levelAuto", "mapLevelAuto"],
                    "ज़ूम के अनुसार स्वतः (Auto by Zoom)"
                  )}
                </option>
                <option value="state">
                  {resolveText(
                    t,
                    ["levelState", "mapLevelState"],
                    "राज्य स्तर (State Summary)"
                  )}
                </option>
                <option value="district">
                  {resolveText(
                    t,
                    ["levelDistrict", "mapLevelDistrict"],
                    "जिला स्तर (District Summary)"
                  )}
                </option>
                <option value="village">
                  {resolveText(
                    t,
                    ["levelVillage", "mapLevelVillage"],
                    "गाँव स्तर (Verified Villages)"
                  )}
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* Map Canvas + Selected Location Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div
            className="lg:col-span-3 relative rounded-2xl overflow-hidden shadow-md"
            style={{
              border: "2px solid var(--gold)",
            }}
          >
            {/* Practical Mobile Height: 350px on phones, 430px on sm, 490px on md+ */}
            <div
              ref={mapContainerRef}
              data-testid="parivaar-leaflet-map"
              className="w-full h-[350px] sm:h-[430px] md:h-[490px]"
            />

            {/* Loading overlay */}
            {(isLoading || tileStatus === "loading") && (
              <div
                className="pointer-events-none absolute top-3 left-3 z-[400] px-3 py-1.5 rounded-full text-xs font-bold shadow"
                style={{
                  backgroundColor: "rgba(255, 248, 240, 0.94)",
                  color: "var(--maroon)",
                  border: "1px solid var(--gold)",
                }}
              >
                ⏳{" "}
                {resolveText(
                  t,
                  ["mapLoading"],
                  "मानचित्र टाइल लोड हो रही हैं (Loading map tiles)…"
                )}
              </div>
            )}

            {/* Tile error banner */}
            {tileStatus === "error" && (
              <div
                className="absolute inset-x-3 top-3 z-[400] p-3 rounded-xl text-xs font-semibold shadow-lg"
                style={{
                  backgroundColor: "#FEF2F2",
                  color: "#991B1B",
                  border: "1px solid #F87171",
                }}
                role="alert"
              >
                ⚠️{" "}
                {resolveText(
                  t,
                  ["mapTileError"],
                  "मानचित्र टाइल लोड नहीं हो सकीं। नीचे स्थान निर्देशिका पूर्णतः उपलब्ध है। (Map tiles could not be loaded; the Location Directory below remains available.)"
                )}
              </div>
            )}

            {/* Empty registrations badge (non-blocking bottom pill on mobile) */}
            {!isLoading && visibleMarkers.length === 0 && (
              <div
                data-testid="map-empty-registrations-banner"
                className="pointer-events-none absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-md z-[400] px-3.5 py-2.5 rounded-xl shadow-md"
                style={{
                  backgroundColor: "rgba(255, 248, 240, 0.95)",
                  border: "1.5px solid var(--gold)",
                  color: "#2D1B0E",
                }}
              >
                <div
                  className="text-xs sm:text-sm font-bold"
                  style={{ color: "var(--maroon)" }}
                >
                  📍{" "}
                  {resolveText(
                    t,
                    ["emptyRegistrationsTitle", "mapZeroRegistrationsTitle"],
                    "0 पंजीकरण दर्ज (0 Registrations in View)"
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-[#5C4A38] mt-0.5 leading-snug">
                  {resolveText(
                    t,
                    ["emptyRegistrationsMapNote", "mapZeroRegistrationsHint"],
                    "नीचे परिवार पंजीकरण फ़ॉर्म में अपना परिवार जोड़ें — केवल सत्यापित डेटाबेस पंजीकरण ही मानचित्र पर पिन किए जाते हैं।"
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Right/Bottom Side Panel: Selected Location Details & Legend */}
          <div
            className="rounded-2xl p-4 flex flex-col justify-between space-y-3"
            style={{
              backgroundColor: "var(--cream)",
              border: "1.5px solid rgba(212, 175, 55, 0.55)",
            }}
          >
            <div className="space-y-3">
              <h3
                className="text-sm sm:text-base font-bold border-b pb-2"
                style={{
                  color: "var(--maroon)",
                  borderColor: "rgba(212, 175, 55, 0.4)",
                }}
              >
                📌{" "}
                {resolveText(
                  t,
                  ["selectedLocationStatsTitle", "mapSummaryPanelTitle"],
                  "चयनित स्थान का विवरण (Selected Location Details)"
                )}
              </h3>

              <div className="grid grid-cols-2 lg:grid-cols-1 gap-2.5">
                <div className="p-3 rounded-xl bg-white border border-amber-200/80">
                  <div className="text-[11px] font-semibold text-[#6E5840]">
                    {resolveText(
                      t,
                      [
                        "registrationsInCurrentView",
                        "registeredFamiliesCountLabel",
                      ],
                      "पंजीकरण की कुल संख्या (Total Registrations)"
                    )}
                  </div>
                  <div
                    className="text-xl sm:text-2xl font-extrabold mt-0.5"
                    style={{ color: "var(--maroon)" }}
                    data-testid="map-view-registration-total"
                  >
                    {totalDisplayedRegistrations}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white border border-amber-200/80">
                  <div className="text-[11px] font-semibold text-[#6E5840]">
                    {resolveText(
                      t,
                      ["plottedMarkersLabel", "verifiedMarkersShown"],
                      "सत्यापित मानचित्र पिन (Verified Map Pins)"
                    )}
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-[#2D1B0E] mt-0.5">
                    {visibleMarkers.length}
                  </div>
                </div>
              </div>

              {unverifiedWithRegsCount > 0 && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900">
                  <strong>{unverifiedWithRegsCount}</strong>{" "}
                  {resolveText(
                    t,
                    ["directoryOnlyLocationsLabel"],
                    "गाँव केवल निर्देशिका में सूचीबद्ध हैं (निर्देशांक सत्यापित होने तक मानचित्र पिन से अलग)"
                  )}
                </div>
              )}

              {selectedMarker ? (
                <div
                  className="p-3 rounded-xl space-y-1"
                  style={{
                    backgroundColor: "#FFF2E2",
                    border: "1.5px solid var(--maroon)",
                  }}
                >
                  <div
                    className="text-[11px] font-bold uppercase"
                    style={{ color: "var(--maroon)" }}
                  >
                    चयनित (Selected): {selectedMarker.level}
                  </div>
                  <div className="text-sm font-extrabold text-[#2D1B0E]">
                    {selectedMarker.name_en}
                  </div>
                  {selectedMarker.district_name && (
                    <div className="text-xs text-[#5C4A38]">
                      {[
                        selectedMarker.subdistrict_name,
                        selectedMarker.district_name,
                        selectedMarker.state_name,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  )}
                  <div
                    className="text-xs font-bold pt-1"
                    style={{ color: "var(--maroon)" }}
                  >
                    पंजीकरण की कुल संख्या (Total Registrations):{" "}
                    {normalizeRowCount(selectedMarker)}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#5C4A38] leading-relaxed">
                  {resolveText(
                    t,
                    ["selectMarkerPrompt"],
                    "किसी राज्य, जिले या गाँव के पंजीकरण आँकड़े देखने के लिए मानचित्र पर किसी पिन पर टैप करें या ऊपर फ़िल्टर चुनें। (Tap any pin on the map or choose a filter above to view registration counts.)"
                  )}
                </p>
              )}
            </div>

            {/* Privacy & Coordinate Integrity Notice */}
            <div
              className="pt-2.5 border-t text-[11px] text-[#5C4A38] space-y-1"
              style={{ borderColor: "rgba(212, 175, 55, 0.4)" }}
            >
              <div>
                🔒{" "}
                {resolveText(
                  t,
                  ["mapPrivacyRule", "mapPrivacyNotice"],
                  "गोपनीयता सूचना (Privacy Notice): मानचित्र पर केवल पंजीकरण की कुल संख्या दिखाई जाती है; किसी भी सदस्य का नाम, मोबाइल नंबर या वर्तमान पता सार्वजनिक नहीं किया जाता।"
                )}
              </div>
              <div className="text-[10px] text-[#8B7355]">
                Basemap:{" "}
                {activeProvider === TILE_PROVIDERS.CARTO_VOYAGER.id
                  ? "CARTO Voyager"
                  : "Esri World Street Map"}{" "}
                • Official LGD GIS Coordinates
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
