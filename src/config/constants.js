/**
 * Central configuration for contact links used across the temple website.
 *
 * IMPORTANT
 * - `WHATSAPP_GROUP_INVITE` is the official WhatsApp *group* invitation link.
 *   Every "join the group" button on the site points here.
 * - The old placeholder direct-chat link `https://wa.me/919001234567` has been
 *   REMOVED. It was never a real trust phone number. If the trust later supplies
 *   a genuine number, put it in `WHATSAPP_DIRECT_NUMBER` below and every
 *   direct-message button on the site lights up again — no component changes needed.
 */

/** Official WhatsApp group invitation URL. */
export const WHATSAPP_GROUP_INVITE =
  "https://chat.whatsapp.com/FnhkHgQ21rJ0Zs0HLxck0c";

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
 * to the group invitation so the button is never dead.
 */
export function whatsAppDirectUrl(message = "") {
  if (!HAS_DIRECT_WHATSAPP) return WHATSAPP_GROUP_INVITE;
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
