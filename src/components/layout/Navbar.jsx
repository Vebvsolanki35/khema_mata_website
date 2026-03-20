import { useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import { WHATSAPP_NUMBER } from "../../config/constants";

function Navbar() {
  const { language, setLanguage, t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);

  const activeCls = "font-bold border-b-2 pb-0.5";
  const baseCls = "transition-colors hover:opacity-80 text-sm";

  const linkClass = ({ isActive }) =>
    isActive ? `${baseCls} ${activeCls}` : baseCls;

  const navLinks = [
    { to: "/", label: t.nav.home },
    { to: "/temple", label: t.nav.temple },
    { to: "/history", label: t.nav.history },
    { to: "/visit", label: t.nav.visit },
    { to: "/donation", label: t.nav.donation },
    { to: "/facilities", label: t.nav.facilities },
    { to: "/gallery", label: t.nav.gallery },
    { to: "/contact", label: t.nav.contact },
    { to: "/planner", label: t.nav.planner },
  ];

  const LANGS = [
    { code: "hi", label: "HI" },
    { code: "en", label: "EN" },
    { code: "gu", label: "GU" },
  ];

  return (
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

          {/* WhatsApp button */}
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
            style={{ backgroundColor: "#25D366", color: "white" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            WhatsApp
          </a>

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
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center py-2 rounded-full text-sm font-bold"
              style={{ backgroundColor: "#25D366", color: "white" }}
              onClick={() => setMenuOpen(false)}
            >
              💬 WhatsApp
            </a>
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
  );
}

export default Navbar;
