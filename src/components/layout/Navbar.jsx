import { useEffect, useRef, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
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
 * Mobile-first Header & Navigation (`320px` upward)
 * - Single compact top bar (no cramped two-row horizontal scroll strip).
 * - Compact Temple identity (`🛕 खेमज माता`).
 * - Direct 1-tap `परिवार` discovery pill on mobile + accessible Mobile Menu drawer
 *   containing all 6 destinations (Home, Heritage, Darshan, Visit, Seva, Parivaar),
 *   language selector, and Donate / WhatsApp actions.
 * - Full keyboard (`Escape`, `Tab`, `Enter`) and touch support.
 */
function Navbar() {
  const { language, setLanguage, t } = useLanguage();
  const { pathname } = useLocation();
  const [openForPathname, setOpenForPathname] = useState(null);
  const menuOpen = openForPathname === pathname;
  const setMenuOpen = (next) => {
    const isNextOpen = typeof next === "function" ? next(menuOpen) : Boolean(next);
    setOpenForPathname(isNextOpen ? pathname : null);
  };
  const navRef = useRef(null);
  const menuBtnRef = useRef(null);

  const active = getActiveSection(pathname);
  const activeSectionId = active?.section?.id;

  const fullLabel = (s) => t.nav[s.labelKey] || s.id;
  const shortLabel = (s) => (s.shortKey && t.nav[s.shortKey]) || fullLabel(s);
  const isActive = (s) => activeSectionId === s.id;

  // Close mobile menu on Escape key or outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setOpenForPathname(null);
        menuBtnRef.current?.focus();
      }
    };
    const onOutsideClick = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setOpenForPathname(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onOutsideClick);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onOutsideClick);
    };
  }, [menuOpen]);

  const parivaarSection = SECTIONS.find((s) => s.id === "parivaar");
  const isParivaarActive = activeSectionId === "parivaar";

  return (
    <nav
      ref={navRef}
      aria-label="Primary Navigation"
      className="sticky-nav shadow-md"
      style={{
        backgroundColor: "rgba(139,26,26,0.98)",
        borderBottom: "2px solid var(--gold)",
      }}
    >
      {/* Single Compact Header Row (320px upward) */}
      <div className="max-w-7xl mx-auto px-2.5 sm:px-4 py-2 flex items-center justify-between gap-1.5 sm:gap-2">
        {/* Compact Temple Identity */}
        <Link
          to="/"
          className="flex items-center gap-1.5 shrink-0 min-w-0 py-1"
          style={{ color: "var(--gold)" }}
        >
          <span className="text-xl sm:text-2xl shrink-0" aria-hidden="true">
            🛕
          </span>
          <span
            className="font-bold text-xs sm:text-sm leading-tight truncate max-w-[96px] xs:max-w-[130px] sm:max-w-none"
            style={{ fontFamily: "'Tiro Devanagari Hindi', serif" }}
          >
            खेमज माता
          </span>
        </Link>

        {/* Desktop Primary Navigation (lg+) */}
        <ul className="hidden lg:flex items-center gap-1 flex-1 justify-center min-w-0">
          {SECTIONS.map((s) => {
            const on = isActive(s);
            return (
              <li key={s.id} className="min-w-0">
                <NavLink
                  to={s.to}
                  end={s.to === "/"}
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
                </NavLink>
              </li>
            );
          })}
        </ul>

        {/* Right Controls: Parivaar Quick Pill (mobile), Language Switcher, Desktop Actions & Mobile Menu Button */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Mobile Parivaar Quick Discovery Pill */}
          {parivaarSection && (
            <NavLink
              to={parivaarSection.to}
              aria-current={isParivaarActive ? "page" : undefined}
              data-testid="nav-parivaar-quick-pill"
              className="lg:hidden inline-flex items-center gap-1 rounded-full font-bold transition-colors whitespace-nowrap"
              style={{
                minHeight: "38px",
                padding: "0 10px",
                fontSize: "0.78rem",
                backgroundColor: isParivaarActive
                  ? "var(--gold)"
                  : "rgba(212,175,55,0.18)",
                color: isParivaarActive ? "var(--maroon)" : "#FFF8F0",
                border: "1.5px solid var(--gold)",
              }}
            >
              <span aria-hidden="true">👨‍👩‍👧‍👦</span>
              <span>{shortLabel(parivaarSection)}</span>
            </NavLink>
          )}

          {/* Compact Accessible Language Selector */}
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
                  minWidth: "30px",
                  minHeight: "38px",
                  padding: "0 6px",
                  fontSize: "0.76rem",
                  backgroundColor:
                    language === code ? "var(--gold)" : "transparent",
                  color:
                    language === code ? "var(--maroon)" : "var(--gold)",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Desktop WhatsApp & Donate buttons */}
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
              &nbsp;{t.mobileDonateBtnLabel.replace("🙏 ", "")}
            </span>
          </Link>

          {/* Accessible Mobile Navigation Menu Button (44x44px touch target) */}
          <button
            ref={menuBtnRef}
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-menu"
            aria-label={
              menuOpen
                ? "मेनू बंद करें (Close navigation menu)"
                : "मेनू खोलें (Open navigation menu)"
            }
            data-testid="mobile-menu-toggle"
            className="lg:hidden inline-flex items-center justify-center gap-1 rounded-lg font-bold border transition-colors cursor-pointer"
            style={{
              minWidth: "44px",
              minHeight: "40px",
              padding: "0 9px",
              backgroundColor: menuOpen ? "var(--gold)" : "transparent",
              color: menuOpen ? "var(--maroon)" : "#FFF8F0",
              borderColor: "var(--gold)",
              fontSize: "0.82rem",
            }}
          >
            <span aria-hidden="true" className="text-base leading-none">
              {menuOpen ? "✕" : "☰"}
            </span>
            <span className="hidden xs:inline text-xs">
              {language === "en" ? "Menu" : language === "gu" ? "મેનુ" : "मेनू"}
            </span>
          </button>
        </div>
      </div>

      {/* Accessible Mobile Navigation Drawer (All 6 destinations + Donate & WhatsApp) */}
      {menuOpen && (
        <div
          id="mobile-nav-menu"
          data-testid="mobile-nav-drawer"
          className="lg:hidden border-t px-3 py-3 space-y-3 shadow-xl"
          style={{
            backgroundColor: "var(--maroon-dark)",
            borderColor: "rgba(212,175,55,0.5)",
          }}
        >
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {SECTIONS.map((s) => {
              const on = isActive(s);
              return (
                <li key={s.id}>
                  <NavLink
                    to={s.to}
                    end={s.to === "/"}
                    aria-current={on ? "page" : undefined}
                    data-testid={`nav-tab-${s.id}-mobile`}
                    onClick={() => setMenuOpen(false)}
                    className="w-full flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 transition-colors"
                    style={{
                      minHeight: "48px",
                      fontSize: "0.95rem",
                      fontWeight: on ? 700 : 600,
                      color: on ? "var(--maroon)" : "#FFF8F0",
                      backgroundColor: on
                        ? "var(--gold)"
                        : "rgba(255,248,240,0.08)",
                      border: `1.5px solid ${
                        on ? "var(--gold)" : "rgba(212,175,55,0.35)"
                      }`,
                    }}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span aria-hidden="true" className="text-lg shrink-0">
                        {s.icon}
                      </span>
                      <span className="truncate">{fullLabel(s)}</span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-xs font-bold shrink-0"
                    >
                      {on ? "✓" : "→"}
                    </span>
                  </NavLink>
                </li>
              );
            })}
          </ul>

          {/* Mobile Drawer Quick Actions: Donate & WhatsApp */}
          <div
            className="pt-2.5 border-t grid grid-cols-2 gap-2"
            style={{ borderColor: "rgba(212,175,55,0.35)" }}
          >
            <Link
              to="/donation"
              onClick={() => setMenuOpen(false)}
              className="rounded-xl font-bold inline-flex items-center justify-center gap-1.5 text-sm shadow"
              style={{
                backgroundColor: "var(--gold)",
                color: "var(--maroon)",
                minHeight: "46px",
                padding: "0 12px",
              }}
            >
              🙏 {t.mobileDonateBtnLabel.replace(/^🙏\s*/, "")}
            </Link>

            <WhatsAppButton
              href={WHATSAPP_GROUP_INVITE}
              showIcon
              iconSize={18}
              className="rounded-xl justify-center text-sm font-bold"
              style={{ minHeight: "46px", padding: "0 12px" }}
              ariaLabel={t.whatsappGroup?.button || "WhatsApp"}
            >
              WhatsApp
            </WhatsAppButton>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
