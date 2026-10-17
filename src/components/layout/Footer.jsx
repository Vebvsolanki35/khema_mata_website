import { Link } from "react-router-dom";
import { useLanguage } from "../../context/useLanguage";
import { WHATSAPP_GROUP_INVITE } from "../../config/constants";
import WhatsAppButton from "../WhatsAppButton";

const QUICK_LINKS = [
  { to: "/temple", key: "temple" },
  { to: "/history", key: "history" },
  { to: "/visit", key: "visit" },
  { to: "/donation", key: "donation" },
  { to: "/facilities", key: "facilities" },
  { to: "/gallery", key: "gallery" },
  { to: "/trust", key: "trust" },
  { to: "/contact", key: "contact" },
];

function Footer() {
  const { t } = useLanguage();
  const f = t.footer;
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        backgroundColor: "var(--maroon-dark)",
        borderTop: "3px solid var(--gold)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {/* Temple identity */}
        <div>
          <div
            className="font-bold text-lg mb-2"
            style={{ color: "var(--gold)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
          >
            🛕 {f.templeName}
          </div>
          <address
            className="text-sm not-italic leading-relaxed"
            style={{ color: "#FFF8F0" }}
          >
            देई, बूंदी, राजस्थान ३२३८०२
          </address>
        </div>

        {/* Darshan timings */}
        <div>
          <h3 className="font-bold text-sm mb-2" style={{ color: "var(--gold)" }}>
            ⏰ {f.darshan}
          </h3>
          <ul className="text-sm space-y-1" style={{ color: "#FFF8F0" }}>
            <li>{f.morning}</li>
            <li>{f.evening}</li>
          </ul>
        </div>

        {/* Quick links */}
        <nav aria-label={f.quickLinks}>
          <h3 className="font-bold text-sm mb-2" style={{ color: "var(--gold)" }}>
            🔗 {f.quickLinks}
          </h3>
          <ul className="text-sm grid grid-cols-2 gap-x-3 gap-y-1">
            {QUICK_LINKS.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className="transition-opacity hover:opacity-70"
                  style={{ color: "#FFF8F0" }}
                >
                  {t.nav[l.key]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Connect */}
        <div>
          <h3 className="font-bold text-sm mb-2" style={{ color: "var(--gold)" }}>
            💬 {f.connect}
          </h3>
          <WhatsAppButton
            href={WHATSAPP_GROUP_INVITE}
            iconSize={16}
            className="px-4 py-2 rounded-full text-xs"
          >
            {t.whatsappGroup.button}
          </WhatsAppButton>
          <div className="mt-3">
            <Link
              to="/donation"
              className="inline-block px-4 py-2 rounded-full text-xs font-bold"
              style={{ backgroundColor: "var(--gold)", color: "var(--maroon)" }}
            >
              🙏 {t.mobileDonateBtnLabel}
            </Link>
          </div>
        </div>
      </div>

      <div
        className="text-center text-xs py-4 px-4"
        style={{
          color: "#FFF8F0",
          borderTop: "1px solid rgba(212,175,55,0.35)",
          opacity: 0.85,
        }}
      >
        © {year} {f.templeName} — {f.rights} · {f.builtWith} 🙏
      </div>
    </footer>
  );
}

export default Footer;
