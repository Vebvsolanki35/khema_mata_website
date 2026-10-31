import { useLanguage } from "../context/useLanguage";

/**
 * दर्शन एवं आरती — the single place on the site that shows darshan and aarti
 * timings. Timing values come from the existing translation data
 * (`t.darshan.*`, `t.temple.aartis`); nothing is invented here and the trust can
 * update them in one place.
 */
function Darshan() {
  const { t } = useLanguage();
  const d = t.darshanPage;

  return (
    <main>
      {/* Hero */}
      <section
        className="py-9 sm:py-12 px-4 text-center"
        style={{ background: "linear-gradient(135deg, var(--maroon) 0%, #6B1313 100%)" }}
      >
        <h1
          className="text-2xl sm:text-4xl font-bold mb-1.5"
          style={{ color: "var(--gold)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
        >
          {d.title}
        </h1>
        <p className="text-sm sm:text-base opacity-90" style={{ color: "#FFF8F0" }}>
          {d.subtitle}
        </p>
      </section>

      {/* Daily darshan timings */}
      <section
        className="py-7 sm:py-10 px-3.5 sm:px-4"
        style={{ backgroundColor: "var(--cream)" }}
        aria-labelledby="darshan-timings-title"
      >
        <div className="max-w-3xl mx-auto">
          <h2
            id="darshan-timings-title"
            className="section-title text-xl sm:text-2xl font-bold"
          >
            ⏰ {d.timingsTitle}
          </h2>
          <ul className="mt-6 space-y-2.5" data-testid="darshan-timings">
            {[
              { icon: "🌅", label: t.darshan.morning, time: t.darshan.morningTime },
              { icon: "🌇", label: t.darshan.evening, time: t.darshan.eveningTime },
              { icon: "🎉", label: t.darshan.navratri, time: t.darshan.navratriTime },
            ].map((item) => (
              <li
                key={item.label}
                className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3.5"
                style={{ borderLeft: "4px solid var(--saffron)", border: "1px solid rgba(212,175,55,0.55)" }}
              >
                <span
                  className="flex items-center gap-2 text-sm font-semibold"
                  style={{ color: "#4A3728" }}
                >
                  <span aria-hidden="true" className="text-base">
                    {item.icon}
                  </span>
                  {item.label}
                </span>
                <span
                  className="font-bold text-sm sm:text-base whitespace-nowrap"
                  style={{ color: "var(--saffron)" }}
                >
                  {item.time}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Aarti schedule */}
      <section className="py-7 sm:py-10 px-3.5 sm:px-4 bg-white" aria-labelledby="aarti-title">
        <div className="max-w-3xl mx-auto">
          <h2 id="aarti-title" className="section-title text-xl sm:text-2xl font-bold">
            🪔 {d.aartiTitle}
          </h2>
          <ul
            className="mt-6 rounded-2xl overflow-hidden"
            style={{ border: "1px solid var(--gold)" }}
            data-testid="darshan-aarti-list"
          >
            {t.temple.aartis.map((a, i) => (
              <li
                key={a.name}
                className="flex items-center justify-between gap-3 px-4 py-3.5"
                style={{
                  backgroundColor: i % 2 === 0 ? "var(--cream)" : "#FFFFFF",
                  borderBottom: "1px solid rgba(212,175,55,0.2)",
                }}
              >
                <span
                  className="text-sm font-semibold"
                  style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
                >
                  🔔 {a.name}
                </span>
                <span
                  className="font-bold text-sm whitespace-nowrap"
                  style={{ color: "var(--saffron)" }}
                >
                  {a.time}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

export default Darshan;
