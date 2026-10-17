import { Link } from "react-router-dom";
import { useLanguage } from "../context/useLanguage";
import { FESTIVALS } from "../data/festivals";

/**
 * Hub for the "Darshan & Festivals" tab.
 *
 * Groups content that already exists elsewhere on the site — it does not
 * duplicate it. The full Panchang calendar keeps its own page at /calendar,
 * which is linked from here and from the SectionNav bar.
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

      {/* Darshan timings */}
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

      {/* Aarti schedule + festivals */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Aarti */}
          <div>
            <h2 className="section-title text-xl md:text-2xl font-bold">
              🪔 {d.aartiTitle}
            </h2>
            <div className="mt-8 rounded-2xl overflow-hidden shadow-md" style={{ border: "1px solid var(--gold)" }}>
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

          {/* Festivals */}
          <div>
            <h2 className="section-title text-xl md:text-2xl font-bold">
              🎉 {d.festivalsTitle}
            </h2>
            <div className="mt-8 rounded-2xl overflow-hidden shadow-md" style={{ border: "1px solid var(--gold)" }}>
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
        </div>
      </section>

      {/* Panchang teaser -> full calendar */}
      <section className="py-12 px-4" style={{ backgroundColor: "var(--maroon)" }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: "var(--gold)" }}>
            📅 {d.panchangTitle}
          </h2>
          <p className="mb-7 text-sm md:text-base" style={{ color: "#FFF8F0" }}>
            {d.panchangDesc}
          </p>
          <Link
            to="/calendar"
            className="inline-block px-8 py-3 rounded-full font-bold transition-transform hover:scale-105"
            style={{ backgroundColor: "var(--gold)", color: "var(--maroon)" }}
          >
            {d.openPanchang}
          </Link>
        </div>
      </section>
    </main>
  );
}

export default Darshan;
