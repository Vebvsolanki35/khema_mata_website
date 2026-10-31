import { useLocation, NavLink } from "react-router-dom";
import { useLanguage } from "../../context/useLanguage";
import { BOTTOM_TABS, isBottomTabActive } from "../../data/navigation";
import MoreSheet from "./MoreSheet";

/**
 * Fixed bottom navigation (phones/tablets only, hidden on `md`+ where the full
 * header tab bar is visible).
 *
 * Five destinations: Home · Parivaar · Temple · Seva · More.
 * Four are real routes; "More" opens the existing-pages sheet. This is the only
 * mobile navigation system — the header's hamburger drawer has been removed so
 * the two never compete.
 */
function BottomNav({ open, onOpenChange }) {
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const ui = t.mobileUi || {};

  // Bottom tabs must stay short on a 360px screen, so bilingual labels are
  // reduced to their primary name ("परिवार (Parivaar)" → "परिवार").
  const shortLabel = (value) => String(value || "").split("(")[0].trim();

  const labelFor = (tab) => {
    if (tab.id === "more") return ui.more || "More";
    return shortLabel(t.nav[tab.labelKey]) || tab.description;
  };

  return (
    <>
      <nav
        className="bottom-nav md:hidden"
        aria-label="मुख्य नेविगेशन (Primary mobile navigation)"
        data-testid="bottom-nav"
      >
        <ul className="max-w-lg mx-auto grid grid-cols-5">
          {BOTTOM_TABS.map((tab) => {
            const active = isBottomTabActive(tab, pathname);
            const inner = (
              <>
                <span aria-hidden="true" className="text-xl leading-none">
                  {tab.icon}
                </span>
                <span className="text-[11px] font-bold leading-tight text-center">
                  {labelFor(tab)}
                </span>
              </>
            );

            if (tab.id === "more") {
              return (
                <li key={tab.id}>
                  <button
                    type="button"
                    onClick={() => onOpenChange(true)}
                    aria-expanded={open}
                    aria-controls="more-sheet"
                    aria-haspopup="dialog"
                    data-testid="bottom-nav-more"
                    className="bottom-nav-item"
                    style={{
                      color: open ? "var(--maroon)" : "#FFF8F0",
                      backgroundColor: open ? "var(--gold)" : "transparent",
                    }}
                  >
                    {inner}
                  </button>
                </li>
              );
            }

            return (
              <li key={tab.id}>
                <NavLink
                  to={tab.to}
                  end={tab.to === "/"}
                  aria-current={active ? "page" : undefined}
                  data-testid={`bottom-nav-${tab.id}`}
                  className="bottom-nav-item"
                  style={{
                    color: active ? "var(--maroon)" : "#FFF8F0",
                    backgroundColor: active ? "var(--gold)" : "transparent",
                  }}
                >
                  {inner}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <MoreSheet open={open} onClose={() => onOpenChange(false)} />
    </>
  );
}

export default BottomNav;
