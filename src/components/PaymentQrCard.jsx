import { useLanguage } from "../context/useLanguage";
import { DONATION_QR } from "../config/donation";
import { MEDIA } from "../config/media";

/**
 * The QR printed on the bank card supplied by the trust.
 *
 * IMPORTANT — this is the PAYMENT / BANK QR. It is intentionally a separate
 * component from <WhatsAppChannelSection /> so the payment QR is never confused
 * with any other QR the site may show.
 *
 * The QR has NOT been decoded. It is therefore not described as a UPI QR, no
 * UPI ID is derived from it, and no claim is made that scanning it completes a
 * payment. Until it is verified it is shown with an explicit unverified notice
 * and donors are directed to the bank account details instead.
 */
function PaymentQrCard() {
  const { t } = useLanguage();
  const b = t.bank;
  const qrSrc = MEDIA.bankQr || DONATION_QR.src;
  const isVerified = DONATION_QR.verifiedAsPaymentQr;

  return (
    <div
      className="inline-block p-5 sm:p-6 rounded-2xl text-center"
      style={{
        backgroundColor: "#FFFFFF",
        border: "2px solid var(--gold)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
      }}
    >
      <h3
        className="font-bold text-base mb-3"
        style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
      >
        📱 {b.qrTitle}
      </h3>

      {qrSrc ? (
        <img
          src={qrSrc}
          alt={isVerified ? b.qrTitle : `${b.qrTitle} — ${b.qrUnverified}`}
          width={200}
          height={200}
          loading="lazy"
          decoding="async"
          className="w-40 h-40 sm:w-52 sm:h-52 mx-auto object-contain"
        />
      ) : (
        <div
          className="w-40 h-40 sm:w-52 sm:h-52 mx-auto rounded-xl flex flex-col items-center justify-center gap-2 px-4 text-center"
          style={{
            backgroundColor: "var(--cream)",
            border: "2px dashed var(--gold)",
            color: "var(--maroon)",
          }}
        >
          <span className="text-3xl" aria-hidden="true">
            📱
          </span>
          <span className="text-xs font-semibold leading-snug">{b.pending}</span>
        </div>
      )}

      {/* Verification state */}
      <div className="mt-4">
        <span
          className="inline-block text-[11px] font-bold px-3 py-1 rounded-full"
          style={{
            backgroundColor: isVerified ? "#DCFCE7" : "#FEF3C7",
            color: isVerified ? "#15803D" : "#92400E",
          }}
        >
          {isVerified ? `✓ ${b.verified}` : `⚠️ ${b.qrUnverified}`}
        </span>
      </div>

      <p
        className="mt-3 text-xs leading-relaxed max-w-xs mx-auto"
        style={{ color: "#6B5B4B" }}
      >
        {isVerified ? b.verifiedNote : b.disclaimer}
      </p>
    </div>
  );
}

export default PaymentQrCard;
