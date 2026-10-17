import { NavLink, Link, useLocation } from "react-router-dom";
import { useLanguage } from "../../context/useLanguage";
import { WHATSAPP_GROUP_INVITE } from "../../config/constants";
import { SECTIONS, getActiveSection } from "../../data/navigation";
import WhatsAppButton from "../WhatsAppButton";

const LANGS = [
  { code: "hi", label: "हिं" },
  { code: "en", label: "EN" },
  { code: "gu", label: "ગુ" },
];

/**
 * Primary navigation — exactly FIVE tabs, always visible.
 *
 * There is deliberately NO hamburger menu: on desktop the five tabs sit in the
 * compact header row, and on mobile they appear as a horizontally scrollable
 * row underneath it. Sub-pages (History, Gallery, Panchang, Planner, Trust…)
 * are rendered inside their parent section page and linked from the footer —
 * every original URL
 * still works.
 */
function Navbar() {
  const { language, setLanguage, t } = useLanguage();
  const { pathname } = useLocation();

  const active = getActiveSection(pathname);
  const activeSectionId = active?.section?.id;

  const fullLabel = (s) => t.nav[s.labelKey] || s.id;
  const shortLabel = (s) => (s.shortKey && t.nav[s.shortKey]) || fullLabel(s);

  const isActive = (s) => activeSectionId === s.id;

  /** One tab. `variant` controls only the wrapper sizing. */
  const Tab = ({ section, variant }) => {
    const on = isActive(section);
    return (
      <NavLink
        to={section.to}
        end={section.to === "/"}
        aria-current={on ? "page" : undefined}
        className="flex items-center justify-center gap-1.5 rounded-lg transition-colors whitespace-nowrap"
        style={{
          minHeight: variant === "mobile" ? "44px" : "40px",
          padding: variant === "mobile" ? "0 14px" : "0 10px",
          fontSize: variant === "mobile" ? "0.9rem" : "0.85rem",
          fontWeight: on ? 700 : 500,
          color: on ? "var(--maroon)" : "#FFF8F0",
          backgroundColor: on ? "var(--gold)" : "transparent",
          border: `2px solid ${on ? "var(--gold)" : "transparent"}`,
        }}
      >
        <span aria-hidden="true" className={variant === "mobile" ? "text-base" : "text-base"}>
          {section.icon}
        </span>
        {/* Compact label by default; the full label on very wide screens. */}
        <span className="hidden 2xl:inline">{fullLabel(section)}</span>
        <span className="2xl:hidden">{shortLabel(section)}</span>
      </NavLink>
    );
  };

  return (
    <nav
      className="sticky-nav shadow-md"
      style={{
        backgroundColor: "rgba(139,26,26,0.97)",
        borderBottom: "2px solid var(--gold)",
      }}
    >
      {/* Row 1 — identity, tabs (desktop), language, actions */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 flex items-center gap-2">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0" style={{ color: "var(--gold)" }}>
          <span className="text-2xl" aria-hidden="true">🛕</span>
          <span
            className="font-bold text-sm leading-tight hidden xl:block"
            style={{ fontFamily: "'Tiro Devanagari Hindi', serif" }}
          >
            खेमज माता
          </span>
        </Link>

        {/* Desktop tabs */}
        <ul className="hidden lg:flex items-center gap-1 flex-1 justify-center min-w-0">
          {SECTIONS.map((s) => (
            <li key={s.id} className="min-w-0">
              <Tab section={s} variant="desktop" />
            </li>
          ))}
        </ul>

        <div className="hidden lg:flex flex-1" />

        {/* Right controls */}
        <div className="flex items-center gap-1.5 ml-auto lg:ml-0 shrink-0">
          <div className="flex gap-0.5" role="group" aria-label="Language">
            {LANGS.map(({ code, label }) => (
              <button
                key={code}
                onClick={() => setLanguage(code)}
                aria-pressed={language === code}
                className="rounded font-bold border transition-colors"
                style={{
                  minWidth: "34px",
                  minHeight: "36px",
                  padding: "2px 7px",
                  fontSize: "0.78rem",
                  backgroundColor: language === code ? "var(--gold)" : "transparent",
                  color: language === code ? "var(--maroon)" : "var(--gold)",
                  borderColor: "var(--gold)",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* WhatsApp — icon only until there is room for the label */}
          <WhatsAppButton
            href={WHATSAPP_GROUP_INVITE}
            showIcon
            iconSize={17}
            className="rounded-full justify-center"
            style={{ minWidth: "36px", minHeight: "36px", padding: "0 9px" }}
            ariaLabel={t.whatsappGroup?.button || "WhatsApp"}
          >
            <span className="hidden 2xl:inline">WhatsApp</span>
          </WhatsAppButton>

          <Link
            to="/donation"
            className="rounded-full font-bold inline-flex items-center transition-colors"
            style={{
              backgroundColor: "var(--gold)",
              color: "var(--maroon)",
              minHeight: "36px",
              padding: "0 12px",
              fontSize: "0.82rem",
            }}
          >
            🙏 <span className="hidden sm:inline">&nbsp;{t.mobileDonateBtnLabel.replace("🙏 ", "")}</span>
          </Link>
        </div>
      </div>

      {/* Row 2 (mobile/tablet) — the same five tabs, scrollable */}
      <div
        className="lg:hidden border-t"
        style={{ borderColor: "rgba(212,175,55,0.45)" }}
      >
        <ul
          className="flex gap-1.5 overflow-x-auto px-2 sm:px-4 py-2"
          style={{ scrollbarWidth: "none" }}
        >
          {SECTIONS.map((s) => (
            <li key={s.id} className="shrink-0">
              <Tab section={s} variant="mobile" />
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;
