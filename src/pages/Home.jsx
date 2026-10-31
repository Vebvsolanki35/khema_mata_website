import { Link } from "react-router-dom";
import { useLanguage } from "../context/useLanguage";
import Testimonials from "../components/Testimonials";
import NoticesSection from "../components/notices/NoticesSection";
import VolunteerRegistration from "../components/seva/VolunteerRegistration";
import ReadMore from "../components/ui/ReadMore";
import { FESTIVALS } from "../data/festivals";

const PHOTO_STRIP = [
  "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600",
  "https://images.unsplash.com/photo-1568454537842-d933259bb258?w=600",
  "https://images.unsplash.com/photo-1548013146-72479768bada?w=600",
  "https://images.unsplash.com/photo-1586788680434-30d324b2d46f?w=600",
];

/** One action card: large touch target, short label, one-line description. */
function ActionCard({ icon, title, desc, to }) {
  const [path, hash] = String(to).split("#");
  const target = hash ? { pathname: path, hash: `#${hash}` } : path;

  return (
    <Link
      to={target}
      className="flex flex-col items-start gap-1.5 rounded-2xl bg-white p-3.5 sm:p-4 shadow-sm transition-transform active:scale-[0.98]"
      style={{ border: "1.5px solid rgba(212,175,55,0.7)", minHeight: "104px" }}
    >
      <span
        aria-hidden="true"
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-lg"
        style={{ backgroundColor: "rgba(212,175,55,0.18)" }}
      >
        {icon}
      </span>
      <span
        className="font-bold text-sm leading-tight"
        style={{ color: "var(--maroon)" }}
      >
        {title}
      </span>
      <span className="text-[11px] leading-snug" style={{ color: "#6B5B4B" }}>
        {desc}
      </span>
    </Link>
  );
}

/**
 * Home — mobile-first landing.
 *
 * Order of importance on a phone: who we are (compact hero) → the handful of
 * things people actually come for (six action cards) → live notices → timings
 * and festival information (collapsed) → donation → seva → heritage.
 *
 * Long prose lives behind "Read more" instead of pushing the actions far down
 * the page. Every section that existed before is still here — nothing removed.
 */
function Home() {
  const { t } = useLanguage();
  const ui = t.mobileUi || {};
  const actions = ui.homeActions || [];

  // Dated festivals that have not passed yet. Falls back to the temple's
  // recurring annual festivals so the section is never empty. Nothing invented.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = FESTIVALS.filter((f) => new Date(f.date) >= today).slice(0, 4);
  const festivals =
    upcoming.length > 0
      ? upcoming
      : t.temple.festivals.map((f) => ({ name: f.name, desc: f.desc }));

  return (
    <main>
      {/* Compact hero — headline, one-line intro, two primary actions */}
      <section
        className="relative flex items-center justify-center text-center overflow-hidden px-4 py-12 sm:py-16 md:py-20"
        style={{ minHeight: "52vh" }}
      >
        <div
          className="absolute inset-0 home-hero-bg"
          role="img"
          aria-label={t.hero.title}
        />
        <div className="absolute inset-0 hero-overlay" />
        <div className="relative z-10 max-w-2xl mx-auto">
          <div
            className="mb-2"
            style={{ color: "var(--gold)", fontSize: "2.25rem" }}
            aria-hidden="true"
          >
            🛕
          </div>
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 drop-shadow-lg leading-tight"
            style={{
              color: "#FFF8F0",
              fontFamily: "'Tiro Devanagari Hindi', serif",
            }}
          >
            {t.hero.title}
          </h1>
          <p
            className="text-base sm:text-lg font-semibold mb-1.5 drop-shadow"
            style={{ color: "var(--gold)" }}
          >
            {t.hero.subtitle}
          </p>
          <p className="text-xs sm:text-sm opacity-90 mb-5" style={{ color: "#FFF8F0" }}>
            📍 देई, बूंदी, राजस्थान • सोलंकी राजपूत कुलदेवी
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5">
            <Link
              to="/parivaar"
              className="inline-flex items-center justify-center gap-2 rounded-xl sm:rounded-full font-bold text-sm sm:text-base shadow-lg"
              style={{
                minHeight: "48px",
                padding: "0 20px",
                backgroundColor: "var(--gold)",
                color: "var(--maroon)",
                border: "2px solid var(--gold)",
              }}
            >
              <span aria-hidden="true">📝</span>
              {t.parivaarPage?.registerCtaLocal || "परिवार पंजीकरण"}
            </Link>
            <Link
              to="/temple"
              className="inline-flex items-center justify-center gap-2 rounded-xl sm:rounded-full font-bold text-sm sm:text-base"
              style={{
                minHeight: "48px",
                padding: "0 20px",
                backgroundColor: "rgba(255,248,240,0.1)",
                color: "#FFF8F0",
                border: "2px solid var(--gold)",
              }}
            >
              <span aria-hidden="true">🕉️</span>
              {t.hero.cta}
            </Link>
          </div>
        </div>
      </section>

      {/* Primary actions — the six things people come here to do */}
      <section
        className="px-3.5 sm:px-4 py-6 sm:py-8"
        style={{ backgroundColor: "var(--cream)" }}
        aria-labelledby="home-actions-title"
      >
        <div className="max-w-3xl mx-auto">
          <h2
            id="home-actions-title"
            className="text-base sm:text-lg font-bold text-center"
            style={{ color: "var(--maroon)" }}
          >
            {ui.homeActionsTitle || t.quickServicesTitle}
          </h2>
          {ui.homeActionsSubtitle && (
            <p
              className="text-[11px] sm:text-xs text-center mt-0.5 mb-3.5"
              style={{ color: "#6B5B4B" }}
            >
              {ui.homeActionsSubtitle}
            </p>
          )}
          <div
            className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3.5"
            data-testid="home-action-cards"
          >
            {actions.map((a) => (
              <ActionCard key={a.to} {...a} />
            ))}
          </div>
        </div>
      </section>

      {/* Live Temple Notices — published by authorised Trust members */}
      <NoticesSection />

      {/* Timings, aarti, festivals and general information — collapsed */}
      <section
        className="px-3.5 sm:px-4 py-7 sm:py-10"
        style={{ backgroundColor: "#FFFFFF" }}
      >
        <div className="max-w-3xl mx-auto">
          <ReadMore
            testId="home-temple-info-toggle"
            moreLabel={`${ui.readMore || "और पढ़ें"} — ${ui.templeInfoSummary || ""}`}
            lessLabel={ui.readLess || "कम दिखाएं"}
            summaryClassName="text-sm sm:text-base font-semibold"
            summary={
              <span style={{ color: "var(--maroon)" }}>
                ⏰ {t.darshan.title} — {t.darshan.morning} {t.darshan.morningTime} ·{" "}
                {t.darshan.evening} {t.darshan.eveningTime}
              </span>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: "🌅", label: t.darshan.morning, time: t.darshan.morningTime },
                { icon: "🌇", label: t.darshan.evening, time: t.darshan.eveningTime },
                { icon: "🎉", label: t.darshan.navratri, time: t.darshan.navratriTime },
              ].map((item) => (
                <div
                  key={item.label}
                  className="temple-card bg-white rounded-xl p-3.5 text-center"
                  style={{ borderLeft: "4px solid var(--saffron)" }}
                >
                  <div className="text-xl mb-1" aria-hidden="true">
                    {item.icon}
                  </div>
                  <h3 className="font-semibold text-gray-700 text-xs mb-0.5">
                    {item.label}
                  </h3>
                  <p
                    className="text-sm font-bold"
                    style={{ color: "var(--saffron)" }}
                  >
                    {item.time}
                  </p>
                </div>
              ))}
            </div>

            {/* Aarti highlights */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--gold)" }}
            >
              <div
                className="px-3 py-2 text-center font-bold text-xs sm:text-sm"
                style={{ backgroundColor: "var(--maroon)", color: "var(--gold)" }}
              >
                🔔 {t.temple.aartiTitle}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3">
                {t.temple.aartis.map((a, i) => (
                  <div
                    key={a.name}
                    className="px-3 py-2.5 text-center"
                    style={{
                      backgroundColor: i % 2 === 0 ? "var(--cream)" : "#FFFFFF",
                      borderRight: "1px solid rgba(212,175,55,0.25)",
                      borderBottom: "1px solid rgba(212,175,55,0.25)",
                    }}
                  >
                    <p
                      className="font-semibold text-xs sm:text-sm"
                      style={{
                        color: "var(--maroon)",
                        fontFamily: "'Tiro Devanagari Hindi', serif",
                      }}
                    >
                      🪔 {a.name}
                    </p>
                    <p
                      className="text-[11px] font-bold mt-0.5"
                      style={{ color: "var(--saffron)" }}
                    >
                      {a.time}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Festivals */}
            <div>
              <h3
                className="font-bold text-sm mb-2"
                style={{ color: "var(--maroon)" }}
              >
                🎉 {t.upcomingFestTitle}
              </h3>
              <ul className="space-y-2">
                {festivals.map((f) => (
                  <li
                    key={f.name}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl"
                    style={{
                      backgroundColor: "var(--cream)",
                      border: "1px solid rgba(212,175,55,0.45)",
                    }}
                  >
                    <span aria-hidden="true" className="text-base">
                      🪔
                    </span>
                    <div>
                      <p
                        className="font-bold text-xs sm:text-sm"
                        style={{
                          color: "var(--maroon)",
                          fontFamily: "'Tiro Devanagari Hindi', serif",
                        }}
                      >
                        {f.name}
                      </p>
                      <p className="text-[11px] sm:text-xs" style={{ color: "#6B5B4B" }}>
                        {f.desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <Link
                to="/darshan"
                className="inline-block mt-2.5 text-xs font-bold"
                style={{ color: "var(--saffron)" }}
              >
                {t.viewPanchang} →
              </Link>
            </div>

            {/* General information */}
            <div>
              <h3
                className="font-bold text-sm mb-2"
                style={{ color: "var(--maroon)" }}
              >
                ℹ️ {t.generalInfoTitle}
              </h3>
              <ul className="space-y-2">
                {t.notices.map((notice) => (
                  <li
                    key={notice}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl text-xs sm:text-sm"
                    style={{
                      backgroundColor: "var(--cream)",
                      border: "1px solid rgba(212,175,55,0.45)",
                      color: "#4A3728",
                    }}
                  >
                    <span style={{ color: "var(--gold)" }} aria-hidden="true">
                      •
                    </span>
                    <span>{notice}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ReadMore>
        </div>
      </section>

      {/* Temple identity — compact facts */}
      <section className="py-4 px-4" style={{ backgroundColor: "var(--maroon)" }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-2">
          {t.stats.map((s) => (
            <div key={s.label} className="text-center py-1.5">
              <div
                className="text-lg sm:text-2xl font-bold leading-tight"
                style={{
                  color: "var(--gold)",
                  fontFamily: "'Tiro Devanagari Hindi', serif",
                }}
              >
                {s.value}
              </div>
              <div className="text-[11px] sm:text-xs opacity-90" style={{ color: "#FFF8F0" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Donation call-to-action */}
      <section
        className="py-9 px-4 text-center"
        style={{ background: "linear-gradient(135deg, var(--maroon) 0%, #6B1313 100%)" }}
      >
        <div className="max-w-2xl mx-auto">
          <div className="text-3xl mb-2" aria-hidden="true">
            🙏
          </div>
          <h2
            className="text-xl sm:text-2xl md:text-3xl font-bold mb-1.5"
            style={{
              color: "var(--gold)",
              fontFamily: "'Tiro Devanagari Hindi', serif",
            }}
          >
            {t.donation.title}
          </h2>
          <p className="mb-5 text-xs sm:text-sm opacity-90" style={{ color: "#FFF8F0" }}>
            {t.donation.subtitle}
          </p>
          <Link
            to="/donation"
            className="inline-flex items-center justify-center rounded-full font-bold text-sm sm:text-base"
            style={{
              minHeight: "48px",
              padding: "0 26px",
              backgroundColor: "var(--gold)",
              color: "var(--maroon)",
            }}
          >
            {t.mobileDonateBtnLabel}
          </Link>
        </div>
      </section>

      {/* Seva & Volunteer Registration */}
      <VolunteerRegistration />

      <Testimonials />

      {/* Photo strip */}
      <section className="py-6 px-4" style={{ backgroundColor: "var(--maroon)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {PHOTO_STRIP.map((src, i) => (
              <div
                key={src}
                className="overflow-hidden rounded-xl"
                style={{ aspectRatio: "4/3" }}
              >
                <img
                  src={src}
                  alt={`Temple ${i + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Heritage teaser — summary with expandable detail */}
      <section className="py-9 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2
            className="text-xl sm:text-2xl font-bold mb-2 text-center"
            style={{
              color: "var(--maroon)",
              fontFamily: "'Tiro Devanagari Hindi', serif",
            }}
          >
            📜 {t.history.title}
          </h2>
          <ReadMore
            testId="home-heritage-toggle"
            moreLabel={ui.readMore || "और पढ़ें"}
            lessLabel={ui.readLess || "कम दिखाएं"}
            summaryClassName="text-sm sm:text-base text-center"
            summary={
              <span style={{ color: "#4A3728" }}>{t.history.summary}</span>
            }
          >
            <ul
              className="rounded-xl overflow-hidden text-sm"
              style={{ border: "1px solid rgba(212,175,55,0.55)" }}
            >
              {t.temple.info.map((row) => (
                <li
                  key={row.label}
                  className="flex items-start justify-between gap-3 px-3.5 py-2"
                  style={{
                    backgroundColor: "var(--cream)",
                    borderBottom: "1px solid rgba(212,175,55,0.25)",
                  }}
                >
                  <span className="font-bold" style={{ color: "var(--maroon)" }}>
                    {row.label}
                  </span>
                  <span className="text-right" style={{ color: "#4A3728" }}>
                    {row.value}
                  </span>
                </li>
              ))}
            </ul>
            <div className="text-center">
              <Link
                to="/history"
                className="inline-flex items-center justify-center rounded-full font-bold text-sm"
                style={{
                  minHeight: "46px",
                  padding: "0 22px",
                  backgroundColor: "var(--maroon)",
                  color: "var(--gold)",
                }}
              >
                {t.history.readMore} →
              </Link>
            </div>
          </ReadMore>
        </div>
      </section>
    </main>
  );
}

export default Home;
