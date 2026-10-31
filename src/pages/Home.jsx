import { Link } from "react-router-dom";
import { useLanguage } from "../context/useLanguage";
import NoticesSection from "../components/notices/NoticesSection";
import { EXTERNAL_LINK_REL } from "../config/constants";

/**
 * Quick action: one large, obvious tap target with a short label.
 * `href` is used for external destinations (WhatsApp channel), `to` for routes.
 */
function QuickAction({ item }) {
  const content = (
    <>
      <span
        aria-hidden="true"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
        style={{ backgroundColor: "rgba(212,175,55,0.18)" }}
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
    </>
  );

  const className =
    "flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm transition-transform active:scale-[0.98]";
  const style = {
    border: "1.5px solid rgba(212,175,55,0.7)",
    minHeight: "76px",
  };

  if (item.href) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel={EXTERNAL_LINK_REL}
        className={className}
        style={style}
      >
        {content}
      </a>
    );
  }

  return (
    <Link to={item.to} className={className} style={style}>
      {content}
    </Link>
  );
}

/** One compact timing row: label on the left, time on the right. */
function TimingRow({ label, time }) {
  return (
    <li className="flex items-baseline justify-between gap-2 text-sm">
      <span className="font-semibold" style={{ color: "#4A3728" }}>
        {label}
      </span>
      <span
        className="font-bold text-right"
        style={{ color: "var(--saffron)" }}
      >
        {time}
      </span>
    </li>
  );
}

/**
 * Home — the whole site in one phone screen of scrolling.
 *
 *   1. temple name, location and one hero photograph
 *   2. the darshan + aarti timings (the only place they are published)
 *   3. three clear actions: Parivaar · donate · WhatsApp channel
 *   4. important notices (only when the trust has published any)
 *   5. a short temple introduction with a link to the heritage page
 *
 * The separate Darshan & Aarti page was removed: the timings below are the
 * single source, taken from the same translation data (`t.darshan.*`,
 * `t.temple.aartis`) the trust already edits — no timing was invented here.
 */
function Home() {
  const { t } = useLanguage();
  const ui = t.mobileUi || {};
  const actions = ui.quickActions || [];
  const d = t.darshanPage;

  const darshanTimings = [
    { icon: "🌅", label: t.darshan.morning, time: t.darshan.morningTime },
    { icon: "🌇", label: t.darshan.evening, time: t.darshan.eveningTime },
    { icon: "🎉", label: t.darshan.navratri, time: t.darshan.navratriTime },
  ];

  return (
    <main>
      {/* Hero — one photograph, temple name and location */}
      <section
        className="relative flex items-center justify-center text-center overflow-hidden px-4 py-11 sm:py-14"
        style={{ minHeight: "48vh" }}
      >
        <div
          className="absolute inset-0 home-hero-bg"
          role="img"
          aria-label={t.hero.title}
        />
        <div className="absolute inset-0 hero-overlay" />
        <div className="relative z-10 max-w-2xl mx-auto">
          <h1
            className="text-3xl sm:text-4xl font-bold mb-1.5 drop-shadow-lg leading-tight"
            style={{
              color: "#FFF8F0",
              fontFamily: "'Tiro Devanagari Hindi', serif",
            }}
          >
            {t.hero.title}
          </h1>
          <p
            className="text-sm sm:text-base font-semibold mb-1 drop-shadow"
            style={{ color: "var(--gold)" }}
          >
            {t.hero.subtitle}
          </p>
          <p className="text-xs sm:text-sm opacity-90" style={{ color: "#FFF8F0" }}>
            {t.hero.location || "देई, बूंदी, राजस्थान"}
          </p>
          <a
            href="#darshan-timings"
            className="inline-flex items-center justify-center gap-2 rounded-full font-bold text-sm sm:text-base mt-5"
            style={{
              minHeight: "48px",
              padding: "0 22px",
              backgroundColor: "var(--gold)",
              color: "var(--maroon)",
              border: "2px solid var(--gold)",
            }}
          >
            <span aria-hidden="true">🕉️</span>
            {ui.darshanLink || t.nav.darshanTab}
          </a>
        </div>
      </section>

      {/* Darshan + aarti timings — compact, right under the hero on a phone */}
      <section
        id="darshan-timings"
        className="px-3.5 sm:px-4 py-5 sm:py-7 scroll-mt-16"
        style={{ backgroundColor: "#FFFBF2" }}
        aria-labelledby="darshan-timings-title"
      >
        <div className="max-w-4xl mx-auto">
          <h2
            id="darshan-timings-title"
            className="text-lg sm:text-xl font-bold text-center mb-3"
            style={{
              color: "var(--maroon)",
              fontFamily: "'Tiro Devanagari Hindi', serif",
            }}
          >
            🔔 {d.title}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div
              className="rounded-2xl bg-white p-3.5 sm:p-4"
              style={{ border: "1.5px solid rgba(212,175,55,0.7)" }}
            >
              <h3
                className="text-sm font-bold mb-2"
                style={{ color: "var(--maroon)" }}
              >
                ⏰ {d.timingsTitle}
              </h3>
              <ul className="space-y-2" data-testid="darshan-timings">
                {darshanTimings.map((item) => (
                  <TimingRow
                    key={item.label}
                    label={`${item.icon} ${item.label}`}
                    time={item.time}
                  />
                ))}
              </ul>
            </div>

            <div
              className="rounded-2xl bg-white p-3.5 sm:p-4"
              style={{ border: "1.5px solid rgba(212,175,55,0.7)" }}
            >
              <h3
                className="text-sm font-bold mb-2"
                style={{ color: "var(--maroon)" }}
              >
                🪔 {d.aartiTitle}
              </h3>
              <ul className="space-y-2" data-testid="darshan-aarti-list">
                {t.temple.aartis.map((a) => (
                  <TimingRow key={a.name} label={a.name} time={a.time} />
                ))}
              </ul>
            </div>
          </div>

          <p
            className="mt-2.5 text-center text-[11px] sm:text-xs leading-relaxed"
            style={{ color: "#6B5B4B" }}
          >
            {d.timingsNote}
          </p>
        </div>
      </section>

      {/* Primary actions */}
      <section
        className="px-3.5 sm:px-4 py-5 sm:py-7"
        style={{ backgroundColor: "var(--cream)" }}
        aria-labelledby="home-actions-title"
      >
        <div className="max-w-3xl mx-auto">
          <h2
            id="home-actions-title"
            className="text-base sm:text-lg font-bold mb-0.5"
            style={{ color: "var(--maroon)" }}
          >
            {ui.quickActionsTitle || t.quickServicesTitle}
          </h2>
          {ui.quickActionsSubtitle && (
            <p className="text-[11px] sm:text-xs mb-3" style={{ color: "#6B5B4B" }}>
              {ui.quickActionsSubtitle}
            </p>
          )}
          <div
            className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3"
            data-testid="home-quick-actions"
          >
            {actions.map((item) => (
              <QuickAction key={item.title} item={item} />
            ))}
          </div>
        </div>
      </section>

      {/* Important notices — trust published only, renders nothing when empty */}
      <NoticesSection />

      {/* Short temple introduction */}
      <section
        className="px-3.5 sm:px-4 py-7 sm:py-9"
        style={{ backgroundColor: "#FFFFFF" }}
        aria-labelledby="home-intro-title"
      >
        <div className="max-w-2xl mx-auto text-center">
          <h2
            id="home-intro-title"
            className="text-base sm:text-lg font-bold mb-2"
            style={{
              color: "var(--maroon)",
              fontFamily: "'Tiro Devanagari Hindi', serif",
            }}
          >
            {ui.introTitle || t.temple.infoTitle}
          </h2>
          <p
            className="text-sm sm:text-base leading-relaxed"
            style={{ color: "#4A3728" }}
          >
            {t.hero.description}
          </p>
          <Link
            to="/temple"
            className="inline-flex items-center gap-1.5 mt-4 rounded-full font-bold text-sm"
            style={{
              minHeight: "44px",
              padding: "0 20px",
              backgroundColor: "var(--maroon)",
              color: "var(--gold)",
            }}
          >
            {ui.introLink || t.nav.heritage} →
          </Link>
        </div>
      </section>
    </main>
  );
}

export default Home;
