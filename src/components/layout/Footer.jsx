import { Link } from "react-router-dom";
import { useLanguage } from "../../context/useLanguage";
import { WHATSAPP_CHANNEL_URL } from "../../config/constants";
import { SECTIONS } from "../../data/navigation";
import WhatsAppButton from "../WhatsAppButton";

/**
 * Footer — the quiet, secondary directory.
 *
 * It lists the sub-pages that are not primary tabs (history, gallery, trust,
 * contact) plus the temple address and the official WhatsApp channel link.
 * Darshan timings are deliberately not repeated here; the home page publishes
 * them once.
 */
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
      <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
        {/* Temple identity + contact */}
        <div>
          <div
            className="font-bold text-base mb-1.5"
            style={{ color: "var(--gold)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
          >
            🛕 {f.templeName}
          </div>
          <address className="text-sm not-italic leading-relaxed" style={{ color: "#FFF8F0" }}>
            देई, बूंदी, राजस्थान ३२३८०२
          </address>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <WhatsAppButton
              href={WHATSAPP_CHANNEL_URL}
              iconSize={16}
              className="px-4 py-2 rounded-full text-xs font-bold justify-center"
            >
              {t.whatsappGroup.button}
            </WhatsAppButton>
            <Link
              to="/contact"
              className="inline-block px-4 py-2 rounded-full text-xs font-bold"
              style={{ backgroundColor: "var(--gold)", color: "var(--maroon)" }}
            >
              📞 {t.nav.contact}
            </Link>
          </div>
        </div>

        {/* Sub-pages, grouped by their primary section */}
        <nav aria-label={f.quickLinks} className="lg:col-span-2">
          <h3 className="font-bold text-sm mb-2" style={{ color: "var(--gold)" }}>
            🔗 {f.quickLinks}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {SECTIONS.map((section) => (
              <div key={section.id}>
                <Link
                  to={section.to}
                  className="font-bold text-[13px] block mb-1.5"
                  style={{ color: "var(--gold)" }}
                >
                  {section.icon} {t.nav[section.labelKey]}
                </Link>
                <ul className="text-[13px] space-y-1">
                  {(section.children.length
                    ? section.children.filter((child) => child.to !== section.to)
                    : [{ to: section.to, labelKey: section.labelKey }]
                  ).map((child) => (
                    <li key={child.to}>
                      <Link
                        to={child.to}
                        className="transition-opacity hover:opacity-70"
                        style={{ color: "#FFF8F0" }}
                      >
                        {t.nav[child.labelKey]}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>
      </div>

      <div
        className="text-center text-xs py-3.5 px-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1"
        style={{
          color: "#FFF8F0",
          borderTop: "1px solid rgba(212,175,55,0.35)",
          opacity: 0.85,
        }}
      >
        <span>
          © {year} {f.templeName} — {f.rights} · {f.builtWith} 🙏
        </span>
        <span aria-hidden="true">·</span>
        <Link to="/admin/login" style={{ color: "#FFF8F0", textDecoration: "underline" }}>
          एडमिन लॉगिन (Admin)
        </Link>
      </div>
    </footer>
  );
}

export default Footer;
