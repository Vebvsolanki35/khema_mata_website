import { useState } from "react";
import { useLanguage } from "../context/useLanguage";
import routes from "../data/routes";
import WeatherWidget from "../components/WeatherWidget";
import { PlannerContent } from "./Planner";

/**
 * The "Yatra" tab — one complete, vertically scrollable page.
 *
 * Ordered the way a visitor actually plans a journey:
 *   1. trip planner — enter your city, get live directions
 *   2. temple location and maps
 *   3. routes and directions from major cities
 *   4. travel planner tools — best time to visit, packing checklist, map
 *   5. accommodation
 *   6. travel tips and guidance
 *
 * There is no secondary tab bar: the travel planner's real components are
 * rendered inline, so the city input, route data, maps and the interactive
 * packing checklist all keep working. /planner still renders them standalone.
 */
function Visit() {
  const { t, language } = useLanguage();
  const v = t.visit;
  const [inputCity, setInputCity] = useState("");
  const [showDirections, setShowDirections] = useState(false);

  const selectedRoute = routes.find((r) => {
    if (!inputCity) return false;
    return (
      r.fromEn?.toLowerCase() === inputCity.toLowerCase() ||
      r.from === inputCity
    );
  });

  const getRouteLabel = (route) => {
    if (!route) return null;
    if (language === "en") return { from: route.fromEn, desc: route.descEn };
    if (language === "gu") return { from: route.fromGu, desc: route.descGu };
    return { from: route.from, desc: route.desc };
  };

  return (
    <main>
      {/* Hero */}
      <section
        className="py-16 px-4 text-center"
        style={{ background: "linear-gradient(135deg, var(--maroon) 0%, #6B1313 100%)" }}
      >
        <div className="text-5xl mb-4">🗺️</div>
        <h1
          className="text-3xl md:text-5xl font-bold mb-2"
          style={{ color: "var(--gold)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
        >
          {v.title}
        </h1>
        <p className="text-lg opacity-90 mb-6" style={{ color: "#FFF8F0" }}>
          {v.subtitle}
        </p>
        {/* Live weather — carried over from the travel planner page */}
        <div className="flex justify-center">
          <WeatherWidget />
        </div>
      </section>

      {/* Trip Planner */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="section-title text-2xl font-bold">
            🗓️ {language === "en" ? "Trip Planner" : language === "gu" ? "યાત્રા આયોજનકાર" : "यात्रा योजनाकार"}
          </h2>
          <div className="mt-8">
            <label
              className="block text-sm font-semibold mb-2"
              style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
            >
              {language === "en" ? "Enter your departure city:" : language === "gu" ? "તમારું શહેર લખો:" : "अपना शहर लिखें:"}
            </label>
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                value={inputCity}
                onChange={(e) => { setInputCity(e.target.value); setShowDirections(false); }}
                placeholder={language === "en" ? "e.g. Jaipur" : language === "gu" ? "દા.ત. જયપુર" : "जैसे जयपुर"}
                className="flex-1 md:flex-none md:w-64 border-2 rounded-xl px-4 py-2 text-base font-medium focus:outline-none"
                style={{ borderColor: "var(--gold)", color: "var(--maroon)" }}
              />
              <button
                type="button"
                onClick={() => setShowDirections(true)}
                disabled={!inputCity.trim()}
                className="px-5 py-2 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
                style={{ backgroundColor: "var(--saffron)", color: "white" }}
              >
                {language === "en" ? "Get Directions" : language === "gu" ? "દિશા જુઓ" : "दिशा दिखाएं"}
              </button>
            </div>

            {showDirections && inputCity && (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl overflow-hidden shadow-lg" style={{ border: "2px solid var(--gold)" }}>
                  <iframe
                    title={`Route from ${inputCity}`}
                    src={`https://maps.google.com/maps?saddr=${encodeURIComponent(inputCity + ", India")}&daddr=Dei,Bundi,Rajasthan+323802&output=embed`}
                    width="100%"
                    height="400"
                    style={{ border: 0, display: "block" }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
                {selectedRoute && (() => {
                  const label = getRouteLabel(selectedRoute);
                  return (
                    <div
                      className="rounded-2xl p-5"
                      style={{ backgroundColor: "var(--cream)", borderLeft: "4px solid var(--saffron)" }}
                    >
                      <div className="flex gap-6 mb-2">
                        <span className="text-sm font-semibold" style={{ color: "var(--saffron)" }}>
                          📏 {selectedRoute.distance}
                        </span>
                        <span className="text-sm font-semibold" style={{ color: "var(--maroon)" }}>
                          ⏱️ {selectedRoute.time}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm leading-relaxed" style={{ fontFamily: "'Tiro Devanagari Hindi', serif" }}>
                        🚗 {label.desc}
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Three Temple Locations */}
      <section className="py-12 px-4" style={{ backgroundColor: "var(--cream)" }}>
        <div className="max-w-6xl mx-auto">
          <h2 className="section-title text-2xl font-bold">{v.mapTitle}</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-10">
            {v.locations.map((loc, i) => (
              <div
                key={i}
                className="rounded-2xl overflow-hidden shadow-lg temple-card"
                style={{ border: i === 0 ? "2px solid var(--gold)" : "1px solid rgba(212,175,55,0.4)" }}
              >
                <div
                  className="px-4 py-3 flex items-center justify-between"
                  style={{
                    backgroundColor: i === 0 ? "var(--maroon)" : "#5A0E0E",
                    color: "var(--gold)",
                  }}
                >
                  <h3
                    className="font-bold text-base"
                    style={{ fontFamily: "'Tiro Devanagari Hindi', serif" }}
                  >
                    📍 {loc.name}
                  </h3>
                  <span
                    className="text-xs px-2 py-1 rounded-full font-bold"
                    style={{
                      backgroundColor: i === 0 ? "var(--gold)" : "rgba(212,175,55,0.3)",
                      color: i === 0 ? "var(--maroon)" : "var(--gold)",
                    }}
                  >
                    {loc.badge}
                  </span>
                </div>
                <div className="overflow-hidden">
                  <iframe
                    title={loc.name}
                    src={`https://maps.google.com/maps?q=${loc.coords}&z=14&output=embed`}
                    width="100%"
                    height="220"
                    style={{ border: 0, display: "block" }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
                <div className="p-4 bg-white">
                  <p className="text-sm text-gray-600 flex gap-2">
                    <span>📌</span>
                    <span>{loc.address}</span>
                  </p>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${loc.coords}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block w-full text-center py-2 rounded-lg text-sm font-bold transition-colors"
                    style={{ backgroundColor: "var(--saffron)", color: "white" }}
                  >
                    {v.openInMaps}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Routes */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="section-title text-2xl font-bold">{v.routesTitle}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
            {v.routes.map((route, i) => (
              <div
                key={i}
                className="temple-card rounded-2xl p-5 bg-white"
                style={{ borderLeft: "4px solid var(--saffron)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🚗</span>
                  <h3
                    className="font-bold text-gray-800"
                    style={{ fontFamily: "'Tiro Devanagari Hindi', serif" }}
                  >
                    {route.from}
                  </h3>
                </div>
                <div className="flex gap-4 mb-2">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "var(--saffron)" }}
                  >
                    📏 {route.distance}
                  </span>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "var(--maroon)" }}
                  >
                    ⏱️ {route.time}
                  </span>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">{route.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/*
        4 — Travel planner tools, rendered inline from /planner:
        routes from major cities, best time to visit, the interactive packing
        checklist and the temple location map.
      */}
      <PlannerContent showChecklist={false} showMapEmbed={false} />

      {/* 5 — Accommodation */}
      <section className="py-12 px-4" style={{ backgroundColor: "#FFF0E0" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="section-title text-2xl font-bold">{v.accomTitle}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-8">
            {v.accom.map((a, i) => (
              <div
                key={i}
                className="temple-card rounded-2xl p-5 bg-white flex items-start gap-4"
              >
                <span className="text-3xl">🏠</span>
                <div>
                  <h3
                    className="font-bold text-lg mb-1"
                    style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
                  >
                    {a.type}
                  </h3>
                  <p
                    className="font-semibold text-sm mb-1"
                    style={{ color: "var(--saffron)" }}
                  >
                    💰 {a.price}
                  </p>
                  <p className="text-gray-600 text-sm">{a.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Travel Tips */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="section-title text-2xl font-bold">{v.tipsTitle}</h2>
          <ul className="mt-8 space-y-3">
            {v.tips.map((tip, i) => (
              <li
                key={i}
                className="flex items-start gap-3 p-4 rounded-xl"
                style={{ backgroundColor: "var(--cream)", border: "1px solid rgba(212,175,55,0.3)" }}
              >
                <span style={{ color: "var(--gold)", fontSize: "1.2rem" }}>✓</span>
                <span
                  className="text-gray-700"
                  style={{ fontFamily: "'Tiro Devanagari Hindi', serif" }}
                >
                  {tip}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

export default Visit;
