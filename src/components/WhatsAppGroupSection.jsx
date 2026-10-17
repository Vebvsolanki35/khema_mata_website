import { useLanguage } from "../context/useLanguage";
import { WHATSAPP_GROUP_INVITE } from "../config/constants";
import { MEDIA } from "../config/media";
import WhatsAppButton from "./WhatsAppButton";

/**
 * Dedicated "Join Our WhatsApp Group" section.
 *
 * This is the GROUP QR only. It is deliberately kept separate from the bank /
 * payment QR shown on the Donation page so the two are never confused.
 *
 * The invitation button is always rendered and always functional — the QR image
 * is an optional extra, so a missing or unscannable QR never breaks joining.
 */
function WhatsAppGroupSection({ className = "" }) {
  const { t } = useLanguage();
  const g = t.whatsappGroup;
  const qrSrc = MEDIA.whatsappGroupQr;

  return (
    <section
      className={`py-14 px-4 ${className}`}
      style={{ backgroundColor: "var(--cream)" }}
      aria-labelledby="whatsapp-group-heading"
    >
      <div className="max-w-4xl mx-auto">
        <div
          className="rounded-3xl p-6 sm:p-10 text-center"
          style={{
            backgroundColor: "#FFFFFF",
            border: "2px solid var(--gold)",
            boxShadow: "0 8px 32px rgba(139, 26, 26, 0.10)",
          }}
        >
          <div className="text-4xl sm:text-5xl mb-3" aria-hidden="true">
            💬
          </div>

          <h2
            id="whatsapp-group-heading"
            className="text-2xl sm:text-3xl font-bold mb-3"
            style={{
              color: "var(--maroon)",
              fontFamily: "'Tiro Devanagari Hindi', serif",
            }}
          >
            {g.title}
          </h2>

          <p
            className="max-w-2xl mx-auto text-sm sm:text-base leading-relaxed mb-8"
            style={{ color: "#4A3728" }}
          >
            {g.desc}
          </p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            {/* QR panel */}
            <div
              className="shrink-0 p-4 rounded-2xl"
              style={{
                backgroundColor: "#FFFFFF",
                border: "2px solid rgba(212,175,55,0.6)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
              }}
            >
              {qrSrc ? (
                <img
                  src={qrSrc}
                  alt={g.qrAlt}
                  width={220}
                  height={220}
                  loading="lazy"
                  decoding="async"
                  className="w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] object-contain"
                />
              ) : (
                <div
                  className="w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] flex flex-col items-center justify-center gap-2 rounded-xl text-center px-3"
                  style={{
                    backgroundColor: "var(--cream)",
                    border: "2px dashed var(--gold)",
                    color: "var(--maroon)",
                  }}
                  role="img"
                  aria-label={g.qrPending}
                >
                  <span className="text-3xl" aria-hidden="true">
                    📱
                  </span>
                  <span className="text-xs font-semibold leading-snug">
                    {g.qrPending}
                  </span>
                </div>
              )}
              <p
                className="mt-3 text-xs font-semibold"
                style={{ color: "var(--maroon)" }}
              >
                {g.scanHint}
              </p>
            </div>

            {/* Copy + CTA panel */}
            <div className="text-center md:text-left max-w-sm">
              <p className="text-sm mb-2" style={{ color: "#4A3728" }}>
                {g.orUse}
              </p>

              <WhatsAppButton
                href={WHATSAPP_GROUP_INVITE}
                iconSize={20}
                className="px-7 py-3.5 rounded-full text-base shadow-lg hover:shadow-xl"
              >
                {g.button}
              </WhatsAppButton>

              <p className="mt-3 text-xs" style={{ color: "#6B5B4B" }}>
                {g.linkNote}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default WhatsAppGroupSection;
