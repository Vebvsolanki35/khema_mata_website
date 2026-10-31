import { Link, useLocation } from "react-router-dom";
import { useLanguage } from "../../context/useLanguage";
import { WHATSAPP_GROUP_INVITE } from "../../config/constants";
import { SECTIONS, getActiveSection } from "../../data/navigation";
import WhatsAppButton from "../WhatsAppButton";

const LANGS = [
  { code: "hi", label: "हिं", fullLabel: "हिंदी (Hindi)" },
  { code: "en", label: "EN", fullLabel: "English" },
  { code: "gu", label: "ગુ", fullLabel: "ગુજરાતી (Gujarati)" },
];

/**
 * Compact top bar.
 *
 * Mobile (< lg): temple identity + language switcher only. Navigation lives in
 * the fixed bottom bar (`BottomNav` → Home / Parivaar / Temple / Seva / More),
 * so there is exactly one mobile navigation system — no drawer duplicating it.
 * Scrolls away naturally; the BottomNav stays fixed.
 *
 * Desktop (lg+): the full six-section tab bar, as before.
 */
function Navbar() {
  const { language, setLanguage, t } = useLanguage();
  const { pathname } = useLocation();

  const active = getActiveSection(pathname);
  const activeSectionId = active?.section?.id;

  const fullLabel = (s) => t.nav[s.labelKey] || s.id;
  const shortLabel = (s) => (s.shortKey && t.nav[s.shortKey]) || fullLabel(s);
  const isActive = (s) => activeSectionId === s.id;

  return (
    <nav
      aria-label="Primary Navigation"
      className="sticky-nav shadow-md"
      style={{
        backgroundColor: "rgba(139,26,26,0.98)",
        borderBottom: "2px solid var(--gold)",
      }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-2">
        {/* Temple identity */}
        <Link
          to="/"
          className="flex items-center gap-2 shrink-0 min-w-0 py-1"
          style={{ color: "var(--gold)" }}
        >
          <span className="text-xl sm:text-2xl shrink-0" aria-hidden="true">
            🛕
          </span>
          <span className="min-w-0">
            <span
              className="block font-bold text-sm sm:text-base leading-tight truncate"
              style={{ fontFamily: "'Tiro Devanagari Hindi', serif" }}
            >
              {language === "en" ? "Khemaj Mata" : "खेमज माता"}
            </span>
            <span className="block text-[10px] sm:text-[11px] leading-tight opacity-90 truncate">
              देई, बूंदी • राजस्थान
            </span>
          </span>
        </Link>

        {/* Desktop primary navigation (lg+) */}
        <ul className="hidden lg:flex items-center gap-1 flex-1 justify-center min-w-0">
          {SECTIONS.map((s) => {
            const on = isActive(s);
            return (
              <li key={s.id} className="min-w-0">
                {/* Link, not NavLink: aria-current must follow the section
                    (so /gallery highlights Heritage) rather than NavLink's own
                    exact-match logic. */}
                <Link
                  to={s.to}
                  aria-current={on ? "page" : undefined}
                  data-testid={`nav-tab-${s.id}-desktop`}
                  className="flex items-center justify-center gap-1.5 rounded-lg transition-colors whitespace-nowrap"
                  style={{
                    minHeight: "42px",
                    padding: "0 10px",
                    fontSize: "0.85rem",
                    fontWeight: on ? 700 : 500,
                    color: on ? "var(--maroon)" : "#FFF8F0",
                    backgroundColor: on ? "var(--gold)" : "transparent",
                    border: `2px solid ${on ? "var(--gold)" : "transparent"}`,
                  }}
                >
                  <span aria-hidden="true" className="text-base">
                    {s.icon}
                  </span>
                  <span className="hidden 2xl:inline">{fullLabel(s)}</span>
                  <span className="2xl:hidden">{shortLabel(s)}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Language switcher + desktop actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div
            className="flex rounded-lg overflow-hidden border"
            style={{ borderColor: "var(--gold)" }}
            role="group"
            aria-label="भाषा चुनें (Select Language)"
          >
            {LANGS.map(({ code, label, fullLabel: langTitle }) => (
              <button
                key={code}
                type="button"
                onClick={() => setLanguage(code)}
                aria-pressed={language === code}
                title={langTitle}
                data-testid={`lang-btn-${code}`}
                className="font-bold transition-colors cursor-pointer"
                style={{
                  minWidth: "34px",
                  minHeight: "44px",
                  padding: "0 6px",
                  fontSize: "0.78rem",
                  backgroundColor:
                    language === code ? "var(--gold)" : "transparent",
                  color: language === code ? "var(--maroon)" : "var(--gold)",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <WhatsAppButton
            href={WHATSAPP_GROUP_INVITE}
            showIcon
            iconSize={17}
            className="hidden sm:inline-flex rounded-full justify-center"
            style={{ minWidth: "38px", minHeight: "38px", padding: "0 10px" }}
            ariaLabel={t.whatsappGroup?.button || "WhatsApp"}
          >
            <span className="hidden 2xl:inline">WhatsApp</span>
          </WhatsAppButton>

          <Link
            to="/donation"
            className="hidden sm:inline-flex rounded-full font-bold items-center transition-colors"
            style={{
              backgroundColor: "var(--gold)",
              color: "var(--maroon)",
              minHeight: "38px",
              padding: "0 12px",
              fontSize: "0.82rem",
            }}
          >
            🙏{" "}
            <span className="hidden md:inline">
              &nbsp;{t.mobileDonateBtnLabel.replace(/^🙏\s*/, "")}
            </span>
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
