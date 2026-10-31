import { useLanguage } from "../context/useLanguage";
import TrustCommittee from "../components/TrustCommittee";
import WhatsAppGroupSection from "../components/WhatsAppGroupSection";

/**
 * Dedicated Trust Committee page.
 *
 * Everything rendered here comes from src/data/trustCommittee.js and only
 * entries flagged `published: true` appear — so no profile is shown until the
 * trust has supplied and approved the details.
 */
function Trust() {
  const { t } = useLanguage();

  return (
    <main>
      {/* Hero */}
      <section
        className="py-10 sm:py-14 px-4 text-center"
        style={{ background: "linear-gradient(135deg, var(--maroon), #5A0E0E)" }}
      >
        <div className="text-3xl sm:text-4xl mb-2.5">🏛️</div>
        <h1
          className="text-3xl md:text-4xl font-bold mb-2"
          style={{ color: "var(--gold)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
        >
          {t.trust.title}
        </h1>
        <p className="text-lg opacity-90" style={{ color: "#FFF8F0" }}>
          {t.trust.subtitle}
        </p>
      </section>

      <TrustCommittee />

      <WhatsAppGroupSection />
    </main>
  );
}

export default Trust;
