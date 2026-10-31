import { Link, useLocation } from "react-router-dom";
import { useLanguage } from "../../context/useLanguage";
import { BOTTOM_TABS, isBottomTabActive } from "../../data/navigation";

/**
 * Fixed bottom navigation (phones/tablets only, hidden on `md`+ where the full
 * header tab bar is visible).
 *
 * Exactly the five required destinations — Home · Temple & Heritage · Darshan &
 * Aarti · Solanki Parivaar · Trust & Seva. No "More" drawer: every tab is one
 * tap away, labels stay short enough for a 360px screen, and the full Hindi name
 * is exposed to assistive technology via `aria-label`.
 */
function BottomNav() {
  const { t } = useLanguage();
  const { pathname } = useLocation();

  // Bottom tabs must stay short on a 360px screen, so bilingual labels are
  // reduced to their primary name ("परिवार (Parivaar)" → "परिवार").
  const shortLabel = (value) => String(value || "").split("(")[0].trim();

  return (
    <nav
      className="bottom-nav md:hidden"
      aria-label="मुख्य नेविगेशन (Primary mobile navigation)"
      data-testid="bottom-nav"
    >
      <ul className="max-w-lg mx-auto grid grid-cols-5">
        {BOTTOM_TABS.map((tab) => {
          const active = isBottomTabActive(tab, pathname);
          const fullLabel = t.nav[tab.fullLabelKey] || tab.id;

          return (
            <li key={tab.id}>
              {/* A plain Link, not NavLink: NavLink recomputes aria-current from
                  its own exact match, which would drop the active state on
                  sub-pages such as /gallery or /contact. */}
              <Link
                to={tab.to}
                aria-current={active ? "page" : undefined}
                aria-label={fullLabel}
                data-testid={`bottom-nav-${tab.id}`}
                className="bottom-nav-item"
                style={{
                  color: active ? "var(--maroon)" : "#FFF8F0",
                  backgroundColor: active ? "var(--gold)" : "transparent",
                }}
              >
                <span aria-hidden="true" className="text-xl leading-none">
                  {tab.icon}
                </span>
                <span className="text-xs font-bold leading-tight text-center">
                  {shortLabel(t.nav[tab.labelKey]) || fullLabel}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default BottomNav;
