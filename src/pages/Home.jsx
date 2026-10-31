import { Link } from "react-router-dom";
import { useLanguage } from "../context/useLanguage";
import NoticesSection from "../components/notices/NoticesSection";
import { EXTERNAL_LINK_REL } from "../config/constants";

/**
 * Quick action: one large, obvious tap target with a short label.
 * `href` is used for external destinations (WhatsApp), `to` for in-app routes.
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

/**
 * Home — intentionally short.
 *
 * A devotee on a phone sees, in order:
 *   1. temple name, location and one hero photograph
 *   2. four clear actions: darshan timings · Parivaar · donate · WhatsApp
 *   3. important notices (when the trust has published any)
 *   4. a short temple introduction with a link to the heritage page
 *
 * Everything else (aarti schedule, history, facilities, gallery, donation
 * details, trust committee, contact) lives on its own page. No repeated card
 * grids, no statistics band, no duplicate donation blocks.
 */
function Home() {
  const { t } = useLanguage();
  const ui = t.mobileUi || {};
  const actions = ui.quickActions || [];

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
          <Link
            to="/darshan"
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
          </Link>
        </div>
      </section>

      {/* Four primary actions */}
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
            className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3"
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
