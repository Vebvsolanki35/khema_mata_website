import { useRef, useState } from "react";
import { useLanguage } from "../context/useLanguage";
import { WHATSAPP_GROUP_INVITE, HAS_DIRECT_WHATSAPP, whatsAppDirectUrl } from "../config/constants";
import { UPI_IDS } from "../config/donation";
import BankDetailsCard from "../components/BankDetailsCard";
import PaymentQrCard from "../components/PaymentQrCard";
import CopyButton from "../components/CopyButton";
import WhatsAppButton from "../components/WhatsAppButton";

/** Builds the message a donor would send the trust after paying. */
function donationMessage(amount, d) {
  const amountText = amount ? `₹${amount}` : "";
  return [
    "🙏 दान - " + amountText,
    d.messageLine,
  ]
    .filter(Boolean)
    .join("\n");
}

function Donation() {
  const { t } = useLanguage();
  const d = t.donation;
  const [selectedAmt, setSelectedAmt] = useState(null);
  const payPanelRef = useRef(null);

  const scrollToPayPanel = () => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    payPanelRef.current?.scrollIntoView({
      behavior: prefersReduced ? "auto" : "smooth",
      block: "center",
    });
  };

  const handleAmount = (amount) => {
    setSelectedAmt(amount);
    scrollToPayPanel();
  };

  const handleSeva = (seva) => {
    setSelectedAmt(seva.amount.replace(/[^\d]/g, ""));
    scrollToPayPanel();
  };

  return (
    <main>
      {/* Hero */}
      <section
        className="py-16 px-4 text-center"
        style={{ background: "linear-gradient(135deg, var(--maroon), #5A0E0E)" }}
      >
        <div className="text-5xl mb-4">🙏</div>
        <h1
          className="text-3xl md:text-4xl font-bold mb-2"
          style={{ color: "var(--gold)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
        >
          {d.title}
        </h1>
        <p className="text-lg opacity-90" style={{ color: "#FFF8F0" }}>
          {d.subtitle}
        </p>
      </section>

      <div className="max-w-3xl mx-auto px-4 py-12 space-y-10">
        {/* Bank account details (verified block, with copy buttons) */}
        <section>
          <h2 className="section-title text-xl font-bold">{d.bankSectionTitle}</h2>
          <BankDetailsCard />
        </section>

        {/* Payment QR — separate from the WhatsApp group QR */}
        <section className="text-center">
          <PaymentQrCard />
        </section>

        {/* UPI IDs */}
        <section>
          <h2 className="section-title text-xl font-bold">{d.upiTitle}</h2>
          <div className="space-y-4 mt-8">
            {UPI_IDS.map((upi, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 p-4 rounded-2xl"
                style={{
                  backgroundColor: "white",
                  border: "1px solid rgba(212,175,55,0.4)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                }}
              >
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 mb-1">{upi.label}</p>
                  <p
                    className="font-bold text-base sm:text-lg break-all"
                    style={{ color: "var(--maroon)" }}
                  >
                    {upi.id}
                  </p>
                  {!upi.verified && (
                    <p className="text-[11px] mt-1" style={{ color: "#92400E" }}>
                      ⏳ {t.bank.pending}
                    </p>
                  )}
                </div>
                <CopyButton
                  value={upi.id}
                  label={t.bank.copy}
                  copiedLabel={t.bank.copied}
                  ariaLabel={`${upi.label} ${t.bank.copy}`}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Amount Buttons */}
        <section>
          <h2 className="section-title text-xl font-bold">{d.amountTitle}</h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-8">
            {d.amounts.map((amt, i) => (
              <button
                key={i}
                onClick={() => handleAmount(amt)}
                aria-pressed={selectedAmt === amt}
                className="py-3 px-2 rounded-xl font-bold text-base transition-all hover:scale-105"
                style={
                  selectedAmt === amt
                    ? { backgroundColor: "var(--maroon)", color: "var(--gold)", border: "2px solid var(--gold)" }
                    : { backgroundColor: "var(--cream)", color: "var(--maroon)", border: "2px solid var(--gold)" }
                }
              >
                ₹{amt}
              </button>
            ))}
          </div>
        </section>

        {/* Seva List */}
        <section>
          <h2 className="section-title text-xl font-bold">{d.sevaTitle}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
            {d.sevas.map((seva, i) => (
              <button
                key={i}
                onClick={() => handleSeva(seva)}
                aria-pressed={selectedAmt === seva.amount.replace(/[^\d]/g, "")}
                className="flex items-center justify-between gap-3 p-4 rounded-xl text-left temple-card transition-all"
                style={{ backgroundColor: "white", border: "1px solid rgba(212,175,55,0.3)" }}
              >
                <span
                  className="font-semibold"
                  style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
                >
                  🪔 {seva.name}
                </span>
                <span
                  className="font-bold px-3 py-1 rounded-full text-sm"
                  style={{ backgroundColor: "var(--gold)", color: "var(--maroon)" }}
                >
                  {seva.amount}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* How to complete the donation */}
        <section ref={payPanelRef} className="scroll-mt-24">
          <div
            className="rounded-2xl p-6"
            style={{
              backgroundColor: "#FFFFFF",
              border: "2px solid var(--gold)",
              boxShadow: "0 4px 20px rgba(139,26,26,0.10)",
            }}
          >
            <h3
              className="text-lg font-bold mb-2"
              style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
            >
              {d.howToTitle}
              {selectedAmt ? ` — ₹${selectedAmt}` : ""}
            </h3>
            <p className="text-sm mb-5" style={{ color: "#4A3728" }}>
              {d.howToDesc}
            </p>

            <ol
              className="space-y-3 text-sm mb-6"
              style={{ color: "#4A3728" }}
            >
              {[d.howToStep1, d.howToStep2, d.howToStep3].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: "var(--gold)", color: "var(--maroon)" }}
                  >
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            <div className="flex flex-col sm:flex-row gap-3">
              <WhatsAppButton
                href={
                  HAS_DIRECT_WHATSAPP
                    ? whatsAppDirectUrl(donationMessage(selectedAmt, d))
                    : WHATSAPP_GROUP_INVITE
                }
                iconSize={18}
                className="flex-1 px-6 py-3 rounded-full text-sm sm:text-base"
              >
                {HAS_DIRECT_WHATSAPP ? d.sendReceiptRequest : d.notifyGroupBtn}
              </WhatsAppButton>
            </div>
          </div>
        </section>

        {/* WhatsApp contact */}
        <section
          className="p-6 rounded-2xl text-center"
          style={{ backgroundColor: "var(--maroon)", border: "1px solid var(--gold)" }}
        >
          <h3
            className="text-xl font-bold mb-2"
            style={{ color: "var(--gold)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
          >
            💬 {d.whatsappTitle}
          </h3>
          <p className="mb-4 text-sm opacity-90" style={{ color: "#FFF8F0" }}>
            {d.whatsappDesc}
          </p>
          <WhatsAppButton
            href={WHATSAPP_GROUP_INVITE}
            iconSize={18}
            className="px-8 py-3 rounded-full text-base"
          >
            {d.joinGroupBtn}
          </WhatsAppButton>
        </section>
      </div>
    </main>
  );
}

export default Donation;
