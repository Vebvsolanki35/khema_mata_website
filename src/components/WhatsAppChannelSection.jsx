import { useLanguage } from "../context/useLanguage";
import {
  WHATSAPP_CHANNEL_URL,
  WHATSAPP_CHANNEL_INVITATION,
  WHATSAPP_GREEN,
  EXTERNAL_LINK_REL,
} from "../config/constants";
import WhatsAppButton from "./WhatsAppButton";

/**
 * Official WhatsApp Channel section.
 *
 * The temple retired its WhatsApp *group*: a group exposes every member's phone
 * number to the other members, while a channel is broadcast-only and can be
 * followed without sharing a number. This section therefore contains:
 *
 *   1. the trust's invitation message, copied verbatim, and
 *   2. a single "Follow Channel" button opening the official channel URL.
 *
 * There is no QR code any more — the old QR encoded the retired group invite.
 */
function WhatsAppChannelSection({ className = "" }) {
  const { t } = useLanguage();
  const g = t.whatsappGroup;

  return (
    <section
      className={`px-3.5 sm:px-4 py-8 sm:py-12 ${className}`}
      style={{ backgroundColor: "var(--cream)" }}
      aria-labelledby="whatsapp-channel-heading"
      data-testid="whatsapp-channel-section"
    >
      <div className="max-w-3xl mx-auto">
        <div
          className="rounded-2xl p-5 sm:p-8 text-center"
          style={{
            backgroundColor: "#FFFFFF",
            border: "2px solid var(--gold)",
            boxShadow: "0 8px 32px rgba(139, 26, 26, 0.10)",
          }}
        >
          <div className="text-3xl sm:text-4xl mb-2" aria-hidden="true">
            💬
          </div>

          <h2
            id="whatsapp-channel-heading"
            className="text-xl sm:text-2xl font-bold mb-2"
            style={{
              color: "var(--maroon)",
              fontFamily: "'Tiro Devanagari Hindi', serif",
            }}
          >
            {g.title}
          </h2>

          <p
            className="max-w-xl mx-auto text-sm sm:text-base leading-relaxed mb-4"
            style={{ color: "#4A3728" }}
          >
            {g.desc}
          </p>

          {/* Invitation message, supplied verbatim by the trust */}
          <div
            className="text-left rounded-xl px-3.5 py-3.5 sm:px-5 sm:py-4 mb-5"
            style={{
              backgroundColor: "#FFFBF2",
              border: "1px solid rgba(212,175,55,0.6)",
            }}
            data-testid="whatsapp-channel-invitation"
          >
            <p
              className="text-[11px] font-bold uppercase tracking-wide mb-2"
              style={{ color: "#8B7355" }}
            >
              {g.invitationTitle}
            </p>
            <p
              className="text-sm leading-relaxed whitespace-pre-line break-words"
              style={{
                color: "#3F2D1E",
                fontFamily: "'Tiro Devanagari Hindi', serif",
              }}
            >
              {WHATSAPP_CHANNEL_INVITATION}
            </p>
          </div>

          <WhatsAppButton
            href={WHATSAPP_CHANNEL_URL}
            iconSize={20}
            className="px-6 py-3.5 rounded-full text-sm sm:text-base shadow-lg hover:shadow-xl"
            ariaLabel={`${g.button} — WhatsApp Channel`}
          >
            {g.button}
          </WhatsAppButton>

          <p className="mt-3 text-xs leading-relaxed" style={{ color: "#6B5B4B" }}>
            {g.note}
          </p>

          {/* The link is also printed in plain text so it still works if the
              button is blocked by an in-app browser. */}
          <a
            href={WHATSAPP_CHANNEL_URL}
            target="_blank"
            rel={EXTERNAL_LINK_REL}
            className="mt-3 inline-block text-[11px] break-all underline"
            style={{ color: WHATSAPP_GREEN, minHeight: "44px", paddingTop: "8px" }}
          >
            {WHATSAPP_CHANNEL_URL}
          </a>
        </div>
      </div>
    </section>
  );
}

export default WhatsAppChannelSection;
