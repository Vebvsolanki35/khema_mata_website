import { useState } from "react";
import { Link } from "react-router-dom";
import WhatsAppButton, { WhatsAppIcon } from "../WhatsAppButton";
import { WHATSAPP_GROUP_INVITE, WHATSAPP_GREEN } from "../../config/constants";
import { useLanguage } from "../../context/useLanguage";

/**
 * Mobile-first floating action dock.
 * - Never overlaps Donate and WhatsApp buttons.
 * - Respects phone safe areas (`env(safe-area-inset-bottom)`).
 * - Uses 44–48px touch targets.
 * - Includes a compact minimize/expand toggle on mobile so users can tuck it away
 *   at any time if desired, while keeping Donate and WhatsApp 1-tap accessible.
 */
function FloatingButtons() {
  const { t } = useLanguage();
  const [minimized, setMinimized] = useState(false);

  return (
    <div
      className="float-dock"
      role="region"
      aria-label="त्वरित संपर्क एवं सेवा (Quick Contact & Seva Actions)"
      data-testid="floating-actions-dock"
    >
      {!minimized && (
        <>
          <Link
            to="/donation"
            className="float-btn float-donate"
            aria-label={t.nav.donation}
            data-testid="float-donate-btn"
          >
            <span aria-hidden="true">🙏</span>
            <span>{t.mobileDonateBtnLabel.replace(/^🙏\s*/, "")}</span>
          </Link>

          <WhatsAppButton
            href={WHATSAPP_GROUP_INVITE}
            className="float-btn float-whatsapp"
            style={{ backgroundColor: WHATSAPP_GREEN, color: "#FFFFFF" }}
            showIcon={false}
            ariaLabel={t.whatsappGroup?.button || "WhatsApp"}
          >
            <WhatsAppIcon size={18} />
            <span>WhatsApp</span>
          </WhatsAppButton>
        </>
      )}

      <button
        type="button"
        onClick={() => setMinimized((v) => !v)}
        aria-expanded={!minimized}
        aria-label={
          minimized
            ? "सेवा और WhatsApp बटन दिखाएं (Show Donate & WhatsApp buttons)"
            : "सेवा और WhatsApp बटन छोटा करें (Minimize floating buttons)"
        }
        title={
          minimized
            ? "Show Donate & WhatsApp"
            : "Minimize floating buttons"
        }
        className="md:hidden inline-flex items-center justify-center rounded-full shadow-md font-bold transition-transform active:scale-95 cursor-pointer"
        style={{
          width: "44px",
          height: "44px",
          backgroundColor: "var(--maroon)",
          color: "var(--gold)",
          border: "1.5px solid var(--gold)",
          fontSize: "0.85rem",
        }}
        data-testid="float-toggle-btn"
      >
        {minimized ? "🙏" : "✕"}
      </button>
    </div>
  );
}

export default FloatingButtons;
