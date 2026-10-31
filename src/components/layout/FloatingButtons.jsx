import { Link } from "react-router-dom";
import WhatsAppButton, { WhatsAppIcon } from "../WhatsAppButton";
import { WHATSAPP_CHANNEL_URL, WHATSAPP_GREEN } from "../../config/constants";
import { useLanguage } from "../../context/useLanguage";

/**
 * Desktop-only floating shortcuts.
 *
 * On phones (`< md`) this dock is hidden entirely — the fixed bottom navigation
 * already offers Donate (Seva tab) and WhatsApp (footer + contact page), so no
 * floating control can ever cover a form field or the nav. On desktop the two
 * pills stay in the corner where they have room and cover nothing.
 */
function FloatingButtons() {
  const { t } = useLanguage();

  return (
    <div
      className="float-dock hidden md:flex"
      role="region"
      aria-label="त्वरित संपर्क एवं सेवा (Quick Contact & Seva Actions)"
      data-testid="floating-actions-dock"
    >
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
        href={WHATSAPP_CHANNEL_URL}
        className="float-btn float-whatsapp"
        style={{ backgroundColor: WHATSAPP_GREEN, color: "#FFFFFF" }}
        showIcon={false}
        ariaLabel={t.whatsappGroup?.button || "Follow Channel"}
      >
        <WhatsAppIcon size={18} />
        <span>WhatsApp</span>
      </WhatsAppButton>
    </div>
  );
}

export default FloatingButtons;
