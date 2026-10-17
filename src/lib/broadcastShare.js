/**
 * Helpers for sharing a published announcement.
 *
 * IMPORTANT — honesty about delivery:
 * Opening a WhatsApp link does NOT send a message. WhatsApp opens with the
 * text prefilled and the administrator still has to pick a chat and press
 * send. Nothing in this module may report a message as "sent" or "delivered";
 * the caller records the status `link_opened` so the dashboard shows exactly
 * what is known.
 */

/** How much of the body is shown before "Read more". */
export const PREVIEW_LENGTH = 150;

/** Canonical public site, used when no browser origin is available. */
const DEFAULT_ORIGIN = "https://khemaj-mata.vercel.app";

function siteOrigin() {
  if (typeof window !== "undefined" && window.location && window.location.origin) {
    return window.location.origin;
  }
  return DEFAULT_ORIGIN;
}

/** Deep link to a single announcement on the public site. Always absolute. */
export function noticeDeepLink(noticeId) {
  return `${siteOrigin()}/?notice=${encodeURIComponent(noticeId)}`;
}

/** True when the message is long enough to need collapsing. */
export function needsReadMore(body) {
  return (body || "").length > PREVIEW_LENGTH;
}

/** Short preview text, cut on a word boundary where possible. */
export function previewText(body) {
  const text = body || "";
  if (text.length <= PREVIEW_LENGTH) return text;
  const cut = text.slice(0, PREVIEW_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > PREVIEW_LENGTH * 0.6 ? cut.slice(0, lastSpace) : cut) + "…";
}

/**
 * The approved message that gets shared: the announcement's own title and
 * text, plus a link back to it on the site. The text is never rewritten,
 * translated or embellished.
 */
export function buildShareText(notice) {
  const title = (notice.title || "").trim();
  const body = (notice.body || "").trim();
  const link = noticeDeepLink(notice.id);
  return [title, "", body, "", link].filter(Boolean).join("\n");
}

/** WhatsApp click-to-chat link with prefilled text (no phone number needed). */
export function whatsAppShareUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * Share an announcement.
 *
 * Uses the native share sheet when the browser offers it (mobile), otherwise
 * opens the WhatsApp share link.
 *
 * @returns {"native"|"whatsapp"|"cancelled"|"unsupported"} how it was handled
 */
export async function shareNotice(notice) {
  const text = buildShareText(notice);

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title: notice.title,
        text: notice.body,
        url: noticeDeepLink(notice.id),
      });
      return "native";
    } catch (err) {
      // AbortError means the user dismissed the sheet — not a failure.
      if (err && err.name === "AbortError") return "cancelled";
      // fall through to WhatsApp
    }
  }

  if (typeof window !== "undefined") {
    window.open(whatsAppShareUrl(text), "_blank", "noopener,noreferrer");
    return "whatsapp";
  }

  return "unsupported";
}
