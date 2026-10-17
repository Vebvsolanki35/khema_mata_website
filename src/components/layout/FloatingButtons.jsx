import { Link } from "react-router-dom";
import WhatsAppButton, { WhatsAppIcon } from "../WhatsAppButton";
import { WHATSAPP_GROUP_INVITE, WHATSAPP_GREEN } from "../../config/constants";
import { useLanguage } from "../../context/useLanguage";

function FloatingButtons() {
  const { t } = useLanguage();

  return (
    <>
      <WhatsAppButton
        href={WHATSAPP_GROUP_INVITE}
        className="float-btn float-whatsapp"
        style={{ backgroundColor: WHATSAPP_GREEN, color: "#FFFFFF" }}
        showIcon={false}
        ariaLabel={t.whatsappGroup?.button || "WhatsApp"}
      >
        <WhatsAppIcon size={22} />
        WhatsApp
      </WhatsAppButton>

      <Link
        to="/donation"
        className="float-btn float-donate"
        aria-label={t.nav.donation}
      >
        🙏 {t.mobileDonateBtnLabel}
      </Link>
    </>
  );
}

export default FloatingButtons;
