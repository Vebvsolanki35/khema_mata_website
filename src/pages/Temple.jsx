import { useLanguage } from "../context/LanguageContext";

function Temple() {
  const { t } = useLanguage();
  const tp = t.temple;

  return (
    <main>
      {/* Hero Banner */}
      <section
        className="relative py-20 px-4 text-center"
        style={{
          backgroundImage: "linear-gradient(135deg, var(--maroon) 0%, #6B1313 100%)",
        }}
      >
        <div className="text-5xl mb-4">🛕</div>
        <h1
          className="text-3xl md:text-5xl font-bold mb-2"
          style={{ color: "var(--gold)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
        >
          {tp.title}
        </h1>
        <p className="text-lg" style={{ color: "#FFF8F0" }}>
          {tp.subtitle}
        </p>
      </section>

      {/* Temple Info Table */}
      <section className="py-12 px-4" style={{ backgroundColor: "var(--cream)" }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="section-title text-2xl font-bold">{tp.infoTitle}</h2>
          <div className="rounded-2xl overflow-hidden shadow-lg mt-8" style={{ border: "1px solid var(--gold)" }}>
            <table className="info-table w-full">
              <tbody>
                {tp.info.map((row, i) => (
                  <tr key={i}>
                    <th className="text-left w-1/3">{row.label}</th>
                    <td className="text-gray-800">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p
            className="mt-4 text-center font-semibold py-3 rounded-xl"
            style={{ color: "var(--maroon)", backgroundColor: "rgba(212,175,55,0.15)", border: "1px solid var(--gold)" }}
          >
            {tp.freeEntry}
          </p>
        </div>
      </section>

      <div className="gold-divider mx-8" />

      {/* Darshan Timings + Aarti */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* Darshan */}
          <div>
            <h2 className="section-title text-xl font-bold">{tp.darshanTitle}</h2>
            <div className="space-y-3 mt-6">
              {[
                { icon: "🌅", label: t.darshan.morning, time: t.darshan.morningTime },
                { icon: "🌇", label: t.darshan.evening, time: t.darshan.eveningTime },
                { icon: "🎉", label: t.darshan.navratri, time: t.darshan.navratriTime },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-4 rounded-xl"
                  style={{ backgroundColor: "var(--cream)", border: "1px solid rgba(212,175,55,0.3)" }}
                >
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <p className="text-sm text-gray-500">{item.label}</p>
                    <p className="font-bold" style={{ color: "var(--saffron)" }}>{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Aarti Schedule */}
          <div>
            <h2 className="section-title text-xl font-bold">{tp.aartiTitle}</h2>
            <div className="space-y-3 mt-6">
              {tp.aartis.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 rounded-xl"
                  style={{ backgroundColor: "var(--cream)", borderLeft: "4px solid var(--gold)" }}
                >
                  <span
                    className="font-semibold"
                    style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
                  >
                    🔔 {a.name}
                  </span>
                  <span className="font-bold" style={{ color: "var(--saffron)" }}>{a.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* History */}
      <section className="py-12 px-4" style={{ backgroundColor: "#FFF0E0" }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="section-title text-2xl font-bold">{tp.historyTitle}</h2>
          <div className="space-y-5 mt-8">
            {[tp.historyPara1, tp.historyPara2, tp.historyPara3].map((para, i) => (
              <p
                key={i}
                className="text-gray-700 leading-relaxed text-base md:text-lg"
                style={{ fontFamily: "'Tiro Devanagari Hindi', serif" }}
              >
                {para}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* Festivals */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="section-title text-2xl font-bold">{tp.festivalTitle}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8">
            {tp.festivals.map((f, i) => (
              <div
                key={i}
                className="temple-card rounded-2xl p-6 text-center"
                style={{ backgroundColor: "var(--cream)" }}
              >
                <div className="text-3xl mb-3">🎉</div>
                <h3
                  className="font-bold text-lg mb-2"
                  style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
                >
                  {f.name}
                </h3>
                <p className="text-sm text-gray-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export default Temple;
