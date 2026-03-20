import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/useLanguage";
import Testimonials from "../components/Testimonials";

const HERO_IMG = "https://images.unsplash.com/photo-1599661046289-e31897846e41?w=1920";

const PHOTO_STRIP = [
  "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600",
  "https://images.unsplash.com/photo-1477587458883-47145ed6a800?w=600",
  "https://images.unsplash.com/photo-1548013146-72479768bada?w=600",
  "https://images.unsplash.com/photo-1514222134-b57cbb8ce073?w=600",
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

  return (
    <main>
      {/* Hero Section */}
      <section
        className="relative min-h-screen flex items-center justify-center text-center overflow-hidden"
        style={{ minHeight: "100vh" }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${HERO_IMG})` }}
        />
        <div className="absolute inset-0 hero-overlay" />
        <div className="relative z-10 px-4 max-w-4xl mx-auto">
          <div className="mb-4" style={{ color: "var(--gold)", fontSize: "3rem" }}>🛕</div>
          <h1
            className="text-4xl md:text-6xl font-bold mb-4 drop-shadow-lg"
            style={{ color: "#FFF8F0", fontFamily: "'Tiro Devanagari Hindi', serif", lineHeight: 1.3 }}
          >
            {t.hero.title}
          </h1>
          <p
            className="text-xl md:text-2xl font-semibold mb-4 drop-shadow"
            style={{ color: "var(--gold)" }}
          >
            {t.hero.subtitle}
          </p>
          <p
            className="text-base md:text-lg mb-10 max-w-2xl mx-auto leading-relaxed opacity-90"
            style={{ color: "#FFF8F0" }}
          >
            {t.hero.description}
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/temple"
              className="px-8 py-3 rounded-full font-bold text-lg shadow-xl transition-transform hover:scale-105"
              style={{ backgroundColor: "var(--saffron)", color: "#FFF8F0" }}
            >
              {t.hero.cta}
            </Link>
            <Link
              to="/visit"
              className="px-8 py-3 rounded-full font-bold text-lg shadow-xl transition-transform hover:scale-105 border-2"
              style={{ borderColor: "var(--gold)", color: "var(--gold)", backgroundColor: "transparent" }}
            >
              {t.hero.ctaVisit}
            </Link>
          </div>
        </div>
        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2" style={{ color: "var(--gold)" }}>
          <div className="animate-bounce text-2xl">↓</div>
        </div>
      </section>

      {/* Quick Stats Bar */}
      <section
        className="py-4 px-4"
        style={{ backgroundColor: "var(--maroon)" }}
      >
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
                className="text-center py-3 px-4 text-sm md:text-base font-semibold"
                style={{ color: "var(--gold)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
              >
                {stat}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Animated Stats */}
      <section
        ref={statsRef}
        className="py-12 px-4"
        style={{ backgroundColor: "var(--maroon)" }}
      >
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {t.stats.map((s, i) => (
            <AnimatedStat key={i} value={s.value} label={s.label} />
          ))}
        </div>
      </section>

      {/* Gold divider */}
      <div className="gold-divider" />

      {/* Quick Access Cards */}
      <section className="py-16 px-4" style={{ backgroundColor: "var(--cream)" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="section-title text-2xl md:text-3xl font-bold">
            🙏 {t.quickServicesTitle}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
            {t.quickCards.map((card, i) => (
              <a
                key={i}
                href={card.link}
                className="temple-card bg-white rounded-2xl p-6 text-center block"
                style={{ textDecoration: "none" }}
              >
                <div className="text-4xl mb-3">{card.icon}</div>
                <h3
                  className="font-bold text-lg mb-2"
                  style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
                >
                  {card.title}
                </h3>
                <p className="text-sm text-gray-600">{card.desc}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Darshan Timings */}
      <section className="py-14 px-4" style={{ backgroundColor: "#FFF0E0" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="section-title text-2xl md:text-3xl font-bold">
            ⏰ {t.darshan.title}
          </h2>
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
                <p
                  className="text-lg font-bold"
                  style={{ color: "var(--saffron)" }}
                >
                  {item.time}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <Testimonials />

      {/* Photo Strip */}
      <section className="py-8 px-4" style={{ backgroundColor: "var(--maroon)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PHOTO_STRIP.map((src, i) => (
              <div key={i} className="overflow-hidden rounded-xl" style={{ aspectRatio: "4/3" }}>
                <img
                  src={src}
                  alt={`Temple ${i + 1}`}
                  className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* History Teaser */}
      <section className="py-16 px-4 bg-white">
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
