import { useLanguage } from "../context/useLanguage";
import { FESTIVALS } from "../data/festivals";
import { CalendarContent } from "./Calendar";

/**
 * The "Darshan" tab — one complete, vertically scrollable page.
 *
 * Everything a visitor needs for darshan is rendered here in order:
 *   1. daily darshan timings
 *   2. complete aarti schedule
 *   3. the full, interactive Hindu Panchang (rendered via <CalendarContent/>)
 *   4. festival calendar / upcoming festivals
 *
 * The Panchang is the real interactive component from /calendar — month
 * navigation, tithi colour legend, date selection and the vrat modal all work
 * exactly as before. /calendar still renders the same content standalone.
 */
function Darshan() {
  const { t } = useLanguage();
  const d = t.darshanPage;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = FESTIVALS.filter((f) => new Date(f.date) >= today).slice(0, 6);
  // Falls back to the temple's recurring annual festivals so the section is
  // never empty. No festival dates are invented.
  const festivals =
    upcoming.length > 0
      ? upcoming
      : t.temple.festivals.map((f) => ({ name: f.name, desc: f.desc }));

  return (
    <main>
      {/* Hero */}
      <section
        className="py-16 px-4 text-center"
        style={{ background: "linear-gradient(135deg, var(--maroon) 0%, #6B1313 100%)" }}
      >
        <div className="text-5xl mb-4">🔔</div>
        <h1
          className="text-3xl md:text-4xl font-bold mb-2"
          style={{ color: "var(--gold)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
        >
          {d.title}
        </h1>
        <p className="text-lg opacity-90" style={{ color: "#FFF8F0" }}>
          {d.subtitle}
        </p>
      </section>

      {/* 1 — Daily darshan timings */}
      <section className="py-12 px-4" style={{ backgroundColor: "var(--cream)" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="section-title text-2xl font-bold">⏰ {d.timingsTitle}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            {[
              { icon: "🌅", label: t.darshan.morning, time: t.darshan.morningTime },
              { icon: "🌇", label: t.darshan.evening, time: t.darshan.eveningTime },
              { icon: "🎉", label: t.darshan.navratri, time: t.darshan.navratriTime },
            ].map((item, i) => (
              <div
                key={i}
                className="temple-card bg-white rounded-2xl p-6 text-center"
                style={{ borderLeft: "4px solid var(--saffron)" }}
              >
                <div className="text-3xl mb-2">{item.icon}</div>
                <h3 className="font-semibold text-gray-700 mb-1">{item.label}</h3>
                <p className="text-lg font-bold" style={{ color: "var(--saffron)" }}>
                  {item.time}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2 — Complete aarti schedule */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="section-title text-xl md:text-2xl font-bold">🪔 {d.aartiTitle}</h2>
          <div
            className="mt-8 rounded-2xl overflow-hidden shadow-md"
            style={{ border: "1px solid var(--gold)" }}
          >
            {t.temple.aartis.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 px-5 py-4"
                style={{
                  backgroundColor: i % 2 === 0 ? "var(--cream)" : "#FFFFFF",
                  borderBottom: "1px solid rgba(212,175,55,0.2)",
                }}
              >
                <span
                  className="font-semibold"
                  style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
                >
                  🔔 {a.name}
                </span>
                <span className="font-bold" style={{ color: "var(--saffron)" }}>
                  {a.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3 — Hindu Panchang (full, interactive) */}
      <section className="py-12 px-4" style={{ backgroundColor: "var(--cream)" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="section-title text-xl md:text-2xl font-bold">📅 {d.panchangTitle}</h2>
          <p className="mt-3 text-sm md:text-base" style={{ color: "#6B5B4B" }}>
            {d.panchangDesc}
          </p>
          <div className="mt-8 rounded-2xl bg-white p-4 sm:p-6 shadow-md" style={{ border: "1px solid var(--gold)" }}>
            <CalendarContent showUpcomingFestivals={false} />
          </div>
        </div>
      </section>

      {/* 4 — Festivals */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="section-title text-xl md:text-2xl font-bold">🎉 {d.festivalsTitle}</h2>
          <div
            className="mt-8 rounded-2xl overflow-hidden shadow-md"
            style={{ border: "1px solid var(--gold)" }}
          >
            {festivals.map((f, i) => (
              <div
                key={i}
                className="px-5 py-4"
                style={{
                  backgroundColor: i % 2 === 0 ? "var(--cream)" : "#FFFFFF",
                  borderBottom: "1px solid rgba(212,175,55,0.2)",
                }}
              >
                <p
                  className="font-bold"
                  style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
                >
                  {f.name}
                </p>
                <p className="text-sm" style={{ color: "#6B5B4B" }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export default Darshan;
