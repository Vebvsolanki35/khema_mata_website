/**
 * Central configuration for contact links used across the temple website.
 *
 * IMPORTANT
 * - `WHATSAPP_CHANNEL_URL` is the official WhatsApp *Channel* of the temple.
 *   Every WhatsApp call-to-action on the site points here and is worded as
 *   "Follow Channel" — the old group invitation link was retired because a
 *   group exposes members' phone numbers to each other, while a channel is
 *   broadcast-only.
 * - The old placeholder direct-chat link `https://wa.me/919001234567` has been
 *   REMOVED. It was never a real trust phone number. If the trust later supplies
 *   a genuine number, put it in `WHATSAPP_DIRECT_NUMBER` below and every
 *   direct-message button on the site lights up again — no component changes needed.
 */

/** Official WhatsApp Channel URL (broadcast-only, managed by the trust). */
export const WHATSAPP_CHANNEL_URL =
  "https://whatsapp.com/channel/0029VbDXHj74NVihUYAHIc1U";

/**
 * Official invitation message, supplied verbatim by the Temple Trust.
 *
 * Kept here (not in translations.js) because it is a single formal message that
 * is shown identically in every language, and because it contains the channel
 * link — so the link lives in exactly one place.
 */
export const WHATSAPP_CHANNEL_INVITATION = `🙏 जय श्री खेवज मातेश्वरी 🙏
🙏 जय श्री क्षेमकारी मातेश्वरी 🙏

श्री खेमकरी मातेश्वरी मंदिर, देई (बूंदी) के आधिकारिक WhatsApp चैनल से जुड़ने हेतु आप सभी सादर आमंत्रित हैं।

मंदिर की धार्मिक गतिविधियों, महत्वपूर्ण सूचनाओं एवं आयोजनों की जानकारी प्राप्त करने के लिए चैनल को Follow करें।

🔗 Channel Link: ${WHATSAPP_CHANNEL_URL}

🙏 जय माता दी 🙏`;

/**
 * Direct 1-to-1 WhatsApp chat number (digits only, with country code, no "+").
 * Leave as an empty string until the trust provides a real, published number.
 * Example: "919876543210"
 */
export const WHATSAPP_DIRECT_NUMBER = "";

/** True only when a real direct-chat number has been configured. */
export const HAS_DIRECT_WHATSAPP = WHATSAPP_DIRECT_NUMBER.trim().length > 0;

/**
 * Returns a direct-message URL when a real number exists, otherwise falls back
 * to the official channel so the button is never dead.
 */
export function whatsAppDirectUrl(message = "") {
  if (!HAS_DIRECT_WHATSAPP) return WHATSAPP_CHANNEL_URL;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${WHATSAPP_DIRECT_NUMBER.trim()}${text}`;
}

/** `rel` attribute required on every external link we open in a new tab. */
export const EXTERNAL_LINK_REL = "noopener noreferrer";

/**
 * WhatsApp button background.
 *
 * The official WhatsApp green (#25D366) gives only 1.98:1 against white text,
 * which fails WCAG AA. #188748 is the LIGHTEST colour at WhatsApp's exact hue
 * and saturation that reaches 4.5:1 with white — so it stays recognisably
 * "WhatsApp" while being readable. Revert to "#25D366" here if you prefer the
 * brighter brand green over the contrast ratio.
 */
export const WHATSAPP_GREEN = "#188748";
