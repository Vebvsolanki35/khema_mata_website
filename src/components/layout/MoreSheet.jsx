import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useLanguage } from "../../context/useLanguage";
import { MORE_MENU_GROUPS, SECTIONS } from "../../data/navigation";
import { WHATSAPP_GROUP_INVITE } from "../../config/constants";
import WhatsAppButton from "../WhatsAppButton";

const LANGS = [
  { code: "hi", label: "हिंदी" },
  { code: "en", label: "English" },
  { code: "gu", label: "ગુજરાતી" },
];

/**
 * "More" bottom sheet — the single place for every secondary destination.
 *
 * It lists only routes that already exist (see `MORE_MENU_GROUPS`), plus the
 * language switcher and the same WhatsApp group invitation the header/footer
 * use. No new pages, no duplicated navigation model.
 */
function MoreSheet({ open, onClose }) {
  const { t, language, setLanguage } = useLanguage();
  const { pathname } = useLocation();
  const ui = t.mobileUi || {};
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const lastPathname = useRef(pathname);

  // Close when navigation happens (any link inside was followed).
  useEffect(() => {
    if (lastPathname.current !== pathname) {
      lastPathname.current = pathname;
      onClose();
    }
  }, [pathname, onClose]);

  // Esc to close + lock background scroll while the sheet is open.
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll(
          'a[href], button:not([disabled])'
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const parivaarShort = SECTIONS.find((s) => s.id === "parivaar");

  return (
    <div className="more-sheet-root md:hidden" data-testid="more-sheet">
      <button
        type="button"
        aria-label={ui.close || "Close"}
        tabIndex={-1}
        onClick={onClose}
        className="more-sheet-backdrop"
      />

      <div
        id="more-sheet"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="more-sheet-title"
        className="more-sheet-panel"
      >
        <div className="more-sheet-handle" aria-hidden="true" />

        <div className="flex items-start justify-between gap-3 px-4 pb-2">
          <div className="min-w-0">
            <h2
              id="more-sheet-title"
              className="text-lg font-bold leading-tight"
              style={{ color: "var(--maroon)" }}
            >
              {ui.moreTitle || "More"}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "#6B5B4B" }}>
              {ui.moreSubtitle}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            data-testid="more-sheet-close"
            className="shrink-0 inline-flex items-center justify-center rounded-full font-bold cursor-pointer"
            style={{
              minWidth: "44px",
              minHeight: "44px",
              backgroundColor: "var(--maroon)",
              color: "var(--gold)",
              border: "1.5px solid var(--gold)",
              fontSize: "1rem",
            }}
            aria-label={ui.close || "Close"}
          >
            ✕
          </button>
        </div>

        <div className="more-sheet-body">
          {parivaarShort && (
            <Link
              to={parivaarShort.to}
              onClick={onClose}
              className="more-sheet-primary"
              data-testid="more-sheet-parivaar"
            >
              <span aria-hidden="true" className="text-xl">
                {parivaarShort.icon}
              </span>
              <span className="font-bold text-sm">
                {t.nav[parivaarShort.labelKey] || "Parivaar"}
              </span>
            </Link>
          )}

          {MORE_MENU_GROUPS.map((group) => (
            <section key={group.id} className="mt-3">
              <h3
                className="text-[11px] font-bold uppercase tracking-wide mb-1.5 px-1"
                style={{ color: "#8B7355" }}
              >
                {t.nav[group.titleKey] || ui[group.titleKey] || group.id}
              </h3>
              <ul className="grid grid-cols-2 gap-2">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onClose}
                      data-testid={`more-link-${item.to.replace(/\//g, "-")}`}
                      className="more-sheet-link"
                    >
                      <span aria-hidden="true" className="text-lg shrink-0">
                        {item.icon}
                      </span>
                      <span className="min-w-0 leading-tight">
                        {t.nav[item.labelKey] || item.labelKey}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="mt-4">
            <h3
              className="text-[11px] font-bold uppercase tracking-wide mb-1.5 px-1"
              style={{ color: "#8B7355" }}
            >
              भाषा (Language)
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {LANGS.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setLanguage(lang.code)}
                  aria-pressed={language === lang.code}
                  data-testid={`more-lang-${lang.code}`}
                  className="more-sheet-lang"
                  style={{
                    backgroundColor:
                      language === lang.code ? "var(--gold)" : "#FFFFFF",
                    color: "var(--maroon)",
                    borderColor:
                      language === lang.code
                        ? "var(--maroon)"
                        : "rgba(212,175,55,0.7)",
                  }}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </section>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link to="/donation" onClick={onClose} className="more-sheet-cta">
              🙏 {t.mobileDonateBtnLabel?.replace(/^🙏\s*/, "") || "Donate"}
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
      </div>
    </div>
  );
}

export default MoreSheet;
