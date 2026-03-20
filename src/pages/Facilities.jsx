import { useLanguage } from "../context/LanguageContext";

function Facilities() {
  const { t } = useLanguage();
  const f = t.facilities;
  const aartis = t.temple.aartis;

  return (
    <main>
      {/* Hero */}
      <section
        className="py-16 px-4 text-center"
        style={{ background: "linear-gradient(135deg, var(--maroon), #5A0E0E)" }}
      >
        <div className="text-5xl mb-4">⭐</div>
        <h1
          className="text-3xl md:text-4xl font-bold mb-2"
          style={{ color: "var(--gold)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
        >
          {f.title}
        </h1>
        <p className="text-lg opacity-90" style={{ color: "#FFF8F0" }}>
          {f.subtitle}
        </p>
      </section>

      {/* Facility Cards */}
      <section className="py-14 px-4" style={{ backgroundColor: "var(--cream)" }}>
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
            {f.items.map((item, i) => (
              <div
                key={i}
                className="temple-card bg-white rounded-2xl p-5 text-center"
              >
                <div className="text-4xl mb-3">{item.icon}</div>
                <h3
                  className="font-bold text-sm mb-2"
                  style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
                >
                  {item.name}
                </h3>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Daily Aarti Timetable */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-2xl mx-auto">
          <h2 className="section-title text-2xl font-bold">{t.temple.aartiTitle}</h2>
          <div className="mt-8 rounded-2xl overflow-hidden shadow-lg" style={{ border: "1px solid var(--gold)" }}>
            <div
              className="py-3 px-4 text-center font-bold"
              style={{ backgroundColor: "var(--maroon)", color: "var(--gold)" }}
            >
              {t.aartiTableTitle}
            </div>
            {aartis.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-6 py-4"
                style={{
                  backgroundColor: i % 2 === 0 ? "var(--cream)" : "white",
                  borderBottom: "1px solid rgba(212,175,55,0.2)",
                }}
              >
                <span
                  className="font-semibold"
                  style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
                >
                  🪔 {a.name}
                </span>
                <span
                  className="font-bold text-lg"
                  style={{ color: "var(--saffron)" }}
                >
                  {a.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export default Facilities;
