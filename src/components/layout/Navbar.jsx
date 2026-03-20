import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";

const LANGS = ["hi", "en", "gu"];

function Navbar() {
  const { language, setLanguage, t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);

  const linkClass = ({ isActive }) =>
    isActive
      ? "text-orange-600 font-bold border-b-2 border-orange-600 pb-0.5"
      : "hover:text-orange-500 transition-colors";

  const navLinks = [
    { to: "/", label: t.nav.home },
    { to: "/temple", label: t.nav.temple },
    { to: "/visit", label: t.nav.visit },
    { to: "/gallery", label: t.nav.gallery },
    { to: "/contact", label: t.nav.contact },
  ];

  return (
    <nav className="bg-amber-50 border-b-2 border-orange-300 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo / Title */}
        <span className="text-orange-700 font-bold text-lg tracking-wide">
          🕌 {language === "en" ? "Khemaj Mata" : "खेमज माता"}
        </span>

        {/* Desktop links */}
        <ul className="hidden md:flex gap-6 text-gray-700">
          {navLinks.map((l) => (
            <li key={l.to}>
              <NavLink to={l.to} className={linkClass} end={l.to === "/"}>
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Language toggles */}
        <div className="hidden md:flex gap-1">
          {LANGS.map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`px-2 py-1 rounded text-sm font-semibold border transition-colors ${
                language === lang
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-white text-orange-600 border-orange-300 hover:bg-orange-50"
              }`}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Hamburger */}
        <button
          className="md:hidden text-orange-700 focus:outline-none"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle menu"
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

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-amber-50 border-t border-orange-200 px-4 pb-4">
          <ul className="flex flex-col gap-3 pt-3 text-gray-700">
            {navLinks.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  className={linkClass}
                  end={l.to === "/"}
                  onClick={() => setMenuOpen(false)}
                >
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 mt-4">
            {LANGS.map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`px-3 py-1 rounded text-sm font-semibold border transition-colors ${
                  language === lang
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-white text-orange-600 border-orange-300 hover:bg-orange-50"
                }`}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;