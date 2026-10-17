import { NavLink, useLocation } from "react-router-dom";
import { useLanguage } from "../../context/useLanguage";
import { getActiveSection } from "../../data/navigation";

/**
 * Secondary navigation for the active four-tab section.
 *
 * This is what makes the four-tab refactor lossless: pages that are no longer a
 * primary tab (/history, /facilities, /gallery, /calendar, /planner, /trust,
 * /contact) are listed here, so every pre-existing page is one tap away.
 *
 * On mobile it scrolls horizontally — kept deliberately simple (no dropdowns,
 * no accordions) so it stays usable for less confident users.
 */
function SectionNav() {
  const { t } = useLanguage();
  const { pathname } = useLocation();

  const active = getActiveSection(pathname);
  if (!active || active.section.children.length === 0) return null;

  const { section } = active;

  return (
    <nav
      aria-label={t.nav[section.labelKey]}
      className="border-b"
      style={{
        backgroundColor: "#FFF8F0",
        borderColor: "rgba(212,175,55,0.55)",
      }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        <ul
          className="flex gap-2 overflow-x-auto py-2.5"
          style={{ scrollbarWidth: "thin" }}
        >
          {section.children.map((child) => (
            <li key={child.to} className="shrink-0">
              <NavLink
                to={child.to}
                className="flex items-center gap-2 rounded-full transition-colors whitespace-nowrap"
                style={({ isActive }) => ({
                  minHeight: "44px",
                  padding: "0 16px",
                  fontSize: "0.95rem",
                  fontWeight: isActive ? 700 : 600,
                  backgroundColor: isActive ? "var(--maroon)" : "#FFFFFF",
                  color: isActive ? "var(--gold)" : "var(--maroon)",
                  border: isActive
                    ? "2px solid var(--maroon)"
                    : "2px solid rgba(212,175,55,0.6)",
                })}
              >
                <span aria-hidden="true">{child.icon}</span>
                {t.nav[child.labelKey]}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

export default SectionNav;
