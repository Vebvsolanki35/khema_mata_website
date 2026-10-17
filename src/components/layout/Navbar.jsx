import { useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { useLanguage } from "../../context/useLanguage";
import { WHATSAPP_GROUP_INVITE } from "../../config/constants";
import WhatsAppButton from "../WhatsAppButton";

function Navbar() {
  const { language, setLanguage, t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { to: "/", label: t.nav.home },
    { to: "/temple", label: t.nav.temple },
    { to: "/history", label: t.nav.history },
    { to: "/visit", label: t.nav.visit },
    { to: "/donation", label: t.nav.donation },
    { to: "/facilities", label: t.nav.facilities },
    { to: "/gallery", label: t.nav.gallery },
    { to: "/trust", label: t.nav.trust },
    { to: "/calendar", label: t.nav.calendar },
    { to: "/contact", label: t.nav.contact },
  ];

  const LANGS = [
    { code: "hi", label: "HI" },
    { code: "en", label: "EN" },
    { code: "gu", label: "GU" },
  ];

  return (
    <>
      <nav
      className="sticky-nav shadow-md"
      style={{ backgroundColor: "rgba(139,26,26,0.97)", borderBottom: "2px solid var(--gold)" }}
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-2">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2 shrink-0"
          style={{ color: "var(--gold)" }}
        >
          <span className="text-2xl">🛕</span>
          <span className="font-bold text-base leading-tight hidden sm:block" style={{ fontFamily: "'Tiro Devanagari Hindi', serif" }}>
            खेमज माता
          </span>
        </Link>

        {/* Desktop links */}
        <ul className="hidden lg:flex gap-4 items-center" style={{ color: "#FFF8F0" }}>
          {navLinks.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                className={({ isActive }) =>
                  isActive
                    ? `text-sm font-bold pb-0.5 transition-colors`
                    : `text-sm transition-colors hover:opacity-80`
                }
                style={({ isActive }) =>
                  isActive
                    ? { color: "var(--gold)", borderBottom: "2px solid var(--gold)" }
                    : { color: "#FFF8F0" }
                }
                end={l.to === "/"}
              >
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Right section */}
        <div className="hidden lg:flex items-center gap-2">
          {/* Language toggles */}
          <div className="flex gap-1">
            {LANGS.map(({ code, label }) => (
              <button
                key={code}
                onClick={() => setLanguage(code)}
                className="px-2 py-1 rounded text-xs font-bold border transition-colors"
                style={
                  language === code
                    ? { backgroundColor: "var(--gold)", color: "var(--maroon)", borderColor: "var(--gold)" }
                    : { backgroundColor: "transparent", color: "var(--gold)", borderColor: "var(--gold)" }
                }
              >
                {label}
              </button>
            ))}
          </div>

          {/* WhatsApp group button */}
          <WhatsAppButton
            href={WHATSAPP_GROUP_INVITE}
            iconSize={14}
            className="px-3 py-1.5 rounded-full text-xs"
            ariaLabel={t.whatsappGroup?.button || "WhatsApp"}
          >
            WhatsApp
          </WhatsAppButton>

          {/* Donate button */}
          <Link
            to="/donation"
            className="px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
            style={{ backgroundColor: "var(--gold)", color: "var(--maroon)" }}
          >
            🙏 दान
          </Link>
        </div>

        {/* Mobile: lang + hamburger */}
        <div className="lg:hidden flex items-center gap-2">
          <div className="flex gap-1">
            {LANGS.map(({ code, label }) => (
              <button
                key={code}
                onClick={() => setLanguage(code)}
                className="px-1.5 py-0.5 rounded text-xs font-bold border"
                style={
                  language === code
                    ? { backgroundColor: "var(--gold)", color: "var(--maroon)", borderColor: "var(--gold)" }
                    : { backgroundColor: "transparent", color: "var(--gold)", borderColor: "var(--gold)" }
                }
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
            style={{ color: "var(--gold)" }}
          >
            {menuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="lg:hidden border-t px-4 pb-4" style={{ backgroundColor: "var(--maroon-dark)", borderColor: "var(--gold)" }}>
          <ul className="flex flex-col gap-3 pt-3">
            {navLinks.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  style={({ isActive }) =>
                    isActive ? { color: "var(--gold)", fontWeight: "bold" } : { color: "#FFF8F0" }
                  }
                  className="text-sm block py-1"
                  end={l.to === "/"}
                  onClick={() => setMenuOpen(false)}
                >
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 mt-4">
            <WhatsAppButton
              href={WHATSAPP_GROUP_INVITE}
              iconSize={16}
              className="flex-1 text-center py-2 rounded-full text-sm"
              onClick={() => setMenuOpen(false)}
              ariaLabel={t.whatsappGroup?.button || "WhatsApp"}
            >
              💬 WhatsApp
            </WhatsAppButton>
            <Link
              to="/donation"
              className="flex-1 text-center py-2 rounded-full text-sm font-bold"
              style={{ backgroundColor: "var(--gold)", color: "var(--maroon)" }}
              onClick={() => setMenuOpen(false)}
            >
              {t.mobileDonateBtnLabel}
            </Link>
          </div>
        </div>
      )}
    </nav>
    </>
  );
}

export default Navbar;
