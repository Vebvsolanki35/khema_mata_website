import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/useLanguage";
import Testimonials from "../components/Testimonials";
import { EXTERNAL_LINK_REL } from "../config/constants";
import { FESTIVALS } from "../data/festivals";

const HERO_IMG = "https://images.unsplash.com/photo-1599661046289-e31897846e41?w=1920";

const PHOTO_STRIP = [
  "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600",
  "https://images.unsplash.com/photo-1568454537842-d933259bb258?w=600",
  "https://images.unsplash.com/photo-1548013146-72479768bada?w=600",
  "https://images.unsplash.com/photo-1586788680434-30d324b2d46f?w=600",
];

function AnimatedStat({ value, label }) {
  return (
    <div className="text-center fade-up">
      <div
        className="text-3xl md:text-4xl font-bold mb-1"
        style={{ color: "var(--gold)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
      >
        {value}
      </div>
      <div className="text-sm md:text-base opacity-90" style={{ color: "#FFF8F0" }}>
        {label}
      </div>
    </div>
  );
}

/**
 * Home — deliberately lean.
 *
 * Hero + introduction, today's darshan/aarti, festivals & notices, a short row
 * of quick-action buttons and one donation call-to-action. There is no
 * directory of the site's pages here; navigation lives in the five-tab header,
 * the SectionNav bar and the footer.
 */
function Home() {
  const { t } = useLanguage();
  const statsRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.querySelectorAll(".fade-up").forEach((el, i) => {
              el.style.animationDelay = `${i * 0.15}s`;
              el.style.opacity = "0";
              el.style.animation = "none";
              void el.offsetHeight;
              el.style.animation = "";
            });
          }
        });
      },
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

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
      {/* Hero */}
      <section
        className="relative min-h-[86vh] flex items-center justify-center text-center overflow-hidden"
        style={{ minHeight: "86vh" }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${HERO_IMG})` }}
        />
        <div className="absolute inset-0 hero-overlay" />
        <div className="relative z-10 px-4 max-w-3xl mx-auto">
          <div className="mb-3" style={{ color: "var(--gold)", fontSize: "2.75rem" }}>🛕</div>
          <h1
            className="text-4xl md:text-6xl font-bold mb-3 drop-shadow-lg"
            style={{ color: "#FFF8F0", fontFamily: "'Tiro Devanagari Hindi', serif", lineHeight: 1.3 }}
          >
            {t.hero.title}
          </h1>
          <p className="text-xl md:text-2xl font-semibold mb-4 drop-shadow" style={{ color: "var(--gold)" }}>
            {t.hero.subtitle}
          </p>
          <p
            className="text-base md:text-lg max-w-2xl mx-auto leading-relaxed opacity-90"
            style={{ color: "#FFF8F0" }}
          >
            {t.hero.description}
          </p>
        </div>
      </section>

      {/* Temple identity strip */}
      <section className="py-3.5 px-4" style={{ backgroundColor: "var(--maroon)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-yellow-600/40">
            {[
              "१०८०+ वर्ष पुराना मंदिर",
              "सोलंकी वंश की कुलदेवी",
              "देई, बूंदी, राजस्थान",
              "निःशुल्क दर्शन",
            ].map((stat) => (
              <div
                key={stat}
                className="text-center py-2 px-4 text-sm md:text-base font-semibold"
                style={{ color: "var(--gold)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
              >
                {stat}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Animated stats */}
      <section ref={statsRef} className="py-10 px-4" style={{ backgroundColor: "var(--maroon)" }}>
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {t.stats.map((s, i) => (
            <AnimatedStat key={i} value={s.value} label={s.label} />
          ))}
        </div>
      </section>

      {/* Today's darshan + aarti highlights */}
      <section className="py-14 px-4" style={{ backgroundColor: "var(--cream)" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="section-title text-2xl md:text-3xl font-bold">
            ⏰ {t.darshan.title}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
            {[
              { icon: "🌅", label: t.darshan.morning, time: t.darshan.morningTime },
              { icon: "🌇", label: t.darshan.evening, time: t.darshan.eveningTime },
              { icon: "🎉", label: t.darshan.navratri, time: t.darshan.navratriTime },
            ].map((item, i) => (
              <div
                key={i}
                className="temple-card bg-white rounded-2xl p-5 text-center"
                style={{ borderLeft: "4px solid var(--saffron)" }}
              >
                <div className="text-2xl mb-1.5">{item.icon}</div>
                <h3 className="font-semibold text-gray-700 text-sm mb-1">{item.label}</h3>
                <p className="text-base font-bold" style={{ color: "var(--saffron)" }}>
                  {item.time}
                </p>
              </div>
            ))}
          </div>

          {/* Aarti highlights */}
          <div className="mt-8 rounded-2xl overflow-hidden" style={{ border: "1px solid var(--gold)", backgroundColor: "#FFFFFF" }}>
            <div
              className="px-4 py-2.5 text-center font-bold text-sm"
              style={{ backgroundColor: "var(--maroon)", color: "var(--gold)" }}
            >
              🔔 {t.temple.aartiTitle}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
              {t.temple.aartis.map((a, i) => (
                <div
                  key={i}
                  className="px-4 py-3 text-center"
                  style={{
                    backgroundColor: i % 2 === 0 ? "var(--cream)" : "#FFFFFF",
                    borderRight: "1px solid rgba(212,175,55,0.25)",
                    borderBottom: "1px solid rgba(212,175,55,0.25)",
                  }}
                >
                  <p
                    className="font-semibold text-sm"
                    style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
                  >
                    🪔 {a.name}
                  </p>
                  <p className="text-xs font-bold mt-0.5" style={{ color: "var(--saffron)" }}>
                    {a.time}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Festivals + notices */}
      <section className="py-14 px-4 bg-white">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="section-title text-xl md:text-2xl font-bold">
              🎉 {t.upcomingFestTitle}
            </h2>
            <div className="space-y-2.5 mt-6">
              {festivals.map((f, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3.5 rounded-xl"
                  style={{ backgroundColor: "var(--cream)", border: "1px solid rgba(212,175,55,0.45)" }}
                >
                  <span aria-hidden="true" className="text-lg">🪔</span>
                  <div>
                    <p
                      className="font-bold text-sm sm:text-base"
                      style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
                    >
                      {f.name}
                    </p>
                    <p className="text-xs sm:text-sm" style={{ color: "#6B5B4B" }}>
                      {f.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <Link to="/darshan" className="inline-block mt-4 text-sm font-bold" style={{ color: "var(--saffron)" }}>
              {t.viewPanchang}
            </Link>
          </div>

          <div>
            <h2 className="section-title text-xl md:text-2xl font-bold">
              📢 {t.noticesTitle}
            </h2>
            <ul className="space-y-2.5 mt-6">
              {t.notices.map((notice, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 p-3.5 rounded-xl"
                  style={{ backgroundColor: "var(--cream)", border: "1px solid rgba(212,175,55,0.45)" }}
                >
                  <span style={{ color: "var(--gold)" }} aria-hidden="true">•</span>
                  <span className="text-sm sm:text-base" style={{ color: "#4A3728" }}>
                    {notice}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Quick actions — compact buttons, not a page directory */}
      <section className="py-10 px-4" style={{ backgroundColor: "var(--cream)" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="section-title text-xl md:text-2xl font-bold">
            🙏 {t.quickServicesTitle}
          </h2>
          <div className="flex flex-wrap justify-center gap-3 mt-7">
            {t.quickCards.map((card, i) =>
              card.external ? (
                <a
                  key={i}
                  href={card.link}
                  target="_blank"
                  rel={EXTERNAL_LINK_REL}
                  className="inline-flex items-center gap-2 rounded-full px-5 py-3 font-bold text-sm transition-transform hover:scale-105"
                  style={{ backgroundColor: "#FFFFFF", color: "var(--maroon)", border: "2px solid var(--gold)" }}
                >
                  <span aria-hidden="true">{card.icon}</span>
                  {card.title}
                </a>
              ) : (
                <Link
                  key={i}
                  to={card.link}
                  className="inline-flex items-center gap-2 rounded-full px-5 py-3 font-bold text-sm transition-transform hover:scale-105"
                  style={{ backgroundColor: "#FFFFFF", color: "var(--maroon)", border: "2px solid var(--gold)" }}
                >
                  <span aria-hidden="true">{card.icon}</span>
                  {card.title}
                </Link>
              )
            )}
          </div>
        </div>
      </section>

      {/* Donation call-to-action */}
      <section
        className="py-14 px-4 text-center"
        style={{ background: "linear-gradient(135deg, var(--maroon) 0%, #6B1313 100%)" }}
      >
        <div className="max-w-2xl mx-auto">
          <div className="text-4xl mb-3">🙏</div>
          <h2
            className="text-2xl md:text-3xl font-bold mb-2"
            style={{ color: "var(--gold)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
          >
            {t.donation.title}
          </h2>
          <p className="mb-7 text-sm md:text-base opacity-90" style={{ color: "#FFF8F0" }}>
            {t.donation.subtitle}
          </p>
          <Link
            to="/donation"
            className="inline-block px-9 py-3.5 rounded-full font-bold text-base transition-transform hover:scale-105"
            style={{ backgroundColor: "var(--gold)", color: "var(--maroon)" }}
          >
            {t.mobileDonateBtnLabel}
          </Link>
        </div>
      </section>

      {/* Testimonials */}
      <Testimonials />

      {/* Photo strip */}
      <section className="py-8 px-4" style={{ backgroundColor: "var(--maroon)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PHOTO_STRIP.map((src, i) => (
              <div key={i} className="overflow-hidden rounded-xl" style={{ aspectRatio: "4/3" }}>
                <img
                  src={src}
                  alt={`Temple ${i + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Heritage teaser */}
      <section className="py-14 px-4 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="section-title text-2xl md:text-3xl font-bold">
            📜 {t.history.title}
          </h2>
          <p
            className="text-gray-700 text-base md:text-lg leading-relaxed mt-4 mb-8"
            style={{ fontFamily: "'Tiro Devanagari Hindi', serif" }}
          >
            {t.history.summary}
          </p>
          <Link
            to="/history"
            className="inline-block px-8 py-3 rounded-full font-bold transition-transform hover:scale-105"
            style={{ backgroundColor: "var(--maroon)", color: "var(--gold)" }}
          >
            {t.history.readMore}
          </Link>
        </div>
      </section>
    </main>
  );
}

export default Home;
