import { useLanguage } from "../context/LanguageContext";

function History() {
  const { t } = useLanguage();
  const hp = t.historyPage;

  return (
    <main>
      {/* Hero */}
      <section
        className="py-20 px-4 text-center"
        style={{ background: "linear-gradient(135deg, var(--maroon) 0%, #5A0E0E 100%)" }}
      >
        <div className="text-5xl mb-4">👑</div>
        <h1
          className="text-3xl md:text-5xl font-bold mb-3"
          style={{ color: "var(--gold)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
        >
          {hp.title}
        </h1>
        <p className="text-lg opacity-90" style={{ color: "#FFF8F0" }}>
          {hp.subtitle}
        </p>
      </section>

      {/* Agnikula Legend */}
      <section className="py-12 px-4" style={{ backgroundColor: "#FFF0E0" }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="section-title text-2xl font-bold">{hp.agnikulaTitle}</h2>
          <div
            className="mt-8 p-6 rounded-2xl leading-relaxed text-gray-700"
            style={{
              backgroundColor: "white",
              borderLeft: "5px solid var(--gold)",
              fontFamily: "'Tiro Devanagari Hindi', serif",
              fontSize: "1.05rem",
            }}
          >
            {hp.agnikulaDesc}
          </div>
        </div>
      </section>

      {/* Solanki Kings Timeline */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="section-title text-2xl font-bold">{hp.dynastyTitle}</h2>
          <div className="timeline-line ml-6 pl-8 space-y-8 mt-10 relative">
            {hp.kings.map((king, i) => (
              <div key={i} className="relative">
                {/* Dot */}
                <span
                  className="absolute -left-11 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs"
                  style={{
                    backgroundColor: "var(--gold)",
                    borderColor: "var(--maroon)",
                    color: "var(--maroon)",
                    fontWeight: "bold",
                  }}
                >
                  {i + 1}
                </span>
                <div
                  className="rounded-xl p-5 shadow-sm temple-card"
                  style={{ backgroundColor: "var(--cream)" }}
                >
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h3
                      className="font-bold text-lg"
                      style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
                    >
                      👑 {king.name}
                    </h3>
                    <span
                      className="text-sm font-semibold px-3 py-1 rounded-full"
                      style={{ backgroundColor: "var(--gold)", color: "var(--maroon)" }}
                    >
                      {king.years}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm">{king.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Battle of Kasahrada */}
      <section className="py-12 px-4" style={{ backgroundColor: "var(--maroon)" }}>
        <div className="max-w-3xl mx-auto">
          <h2
            className="text-2xl md:text-3xl font-bold mb-8 text-center"
            style={{ color: "var(--gold)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
          >
            ⚔️ {hp.kasahradaTitle}
          </h2>
          <div
            className="p-6 rounded-2xl mb-4"
            style={{ backgroundColor: "rgba(255,255,255,0.1)", border: "1px solid var(--gold)" }}
          >
            <p className="leading-relaxed" style={{ color: "#FFF8F0", fontFamily: "'Tiro Devanagari Hindi', serif" }}>
              {hp.kasahradaDesc}
            </p>
          </div>
          <div
            className="p-4 rounded-xl text-center font-semibold"
            style={{ backgroundColor: "var(--gold)", color: "var(--maroon)" }}
          >
            🏆 {hp.imprisonDesc}
          </div>
        </div>
      </section>

      {/* Solanki Heritage */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="section-title text-2xl font-bold">{hp.heritageTitle}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8">
            {hp.heritage.map((item, i) => (
              <div
                key={i}
                className="temple-card rounded-2xl p-6"
                style={{ backgroundColor: "var(--cream)", borderTop: "4px solid var(--saffron)" }}
              >
                <h3
                  className="font-bold text-lg mb-2"
                  style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
                >
                  🏛️ {item.name}
                </h3>
                <p className="text-gray-600 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export default History;
