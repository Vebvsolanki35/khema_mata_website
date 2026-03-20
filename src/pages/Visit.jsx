import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import routes from "../data/routes";

const CITIES = [
  { name: "Delhi", nameHi: "दिल्ली", coords: [28.6139, 77.2090] },
  { name: "Mumbai", nameHi: "मुंबई", coords: [19.0760, 72.8777] },
  { name: "Jaipur", nameHi: "जयपुर", coords: [26.9124, 75.7873] },
  { name: "Ahmedabad", nameHi: "अहमदाबाद", coords: [23.0225, 72.5714] },
  { name: "Surat", nameHi: "सूरत", coords: [21.1702, 72.8311] },
  { name: "Udaipur", nameHi: "उदयपुर", coords: [24.5854, 73.7125] },
  { name: "Kota", nameHi: "कोटा", coords: [25.2138, 75.8648] },
  { name: "Jodhpur", nameHi: "जोधपुर", coords: [26.2389, 73.0243] },
  { name: "Bhopal", nameHi: "भोपाल", coords: [23.2599, 77.4126] },
];

function Visit() {
  const { t, language } = useLanguage();
  const v = t.visit;
  const [selectedCity, setSelectedCity] = useState("");

  const selectedRoute = routes.find((r) => {
    if (!selectedCity) return false;
    return (
      r.fromEn === selectedCity ||
      r.from === CITIES.find((c) => c.name === selectedCity)?.nameHi
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
        <p className="text-lg opacity-90" style={{ color: "#FFF8F0" }}>
          {v.subtitle}
        </p>
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
              {language === "en" ? "Select your departure city:" : language === "gu" ? "તમારું શહેર પસંદ કરો:" : "अपना शहर चुनें:"}
            </label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full md:w-auto border-2 rounded-xl px-4 py-2 text-base font-medium focus:outline-none"
              style={{ borderColor: "var(--gold)", color: "var(--maroon)" }}
            >
              <option value="">
                {language === "en" ? "-- Choose City --" : language === "gu" ? "-- શહેર પસંદ કરો --" : "-- शहर चुनें --"}
              </option>
              {CITIES.map((city) => (
                <option key={city.name} value={city.name}>
                  {language === "hi" ? city.nameHi : city.name}
                </option>
              ))}
            </select>

            {selectedCity && (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl overflow-hidden shadow-lg" style={{ border: "2px solid var(--gold)" }}>
                  <iframe
                    title={`Route from ${selectedCity}`}
                    src={`https://maps.google.com/maps?saddr=${encodeURIComponent(selectedCity + ", India")}&daddr=Dei,Bundi,Rajasthan+323802&output=embed`}
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

      {/* Accommodation */}
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
