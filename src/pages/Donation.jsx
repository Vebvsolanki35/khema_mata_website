import { useState } from "react";
import { useLanguage } from "../context/useLanguage";
import { WHATSAPP_NUMBER } from "../config/constants";

function Donation() {
  const { t } = useLanguage();
  const d = t.donation;
  const [copied, setCopied] = useState(null);
  const [selectedAmt, setSelectedAmt] = useState(null);

  const handleCopy = (id, idx) => {
    navigator.clipboard.writeText(id).then(() => {
      setCopied(idx);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const handleDonate = (amount) => {
    const msg = encodeURIComponent(
      `🙏 दान - ₹${amount}\nखेमज माता मंदिर देई बूंदी को दान`
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
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
        {/* UPI IDs */}
        <section>
          <h2 className="section-title text-xl font-bold">{d.upiTitle}</h2>
          <div className="space-y-4 mt-8">
            {d.upiIds.map((upi, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 rounded-2xl"
                style={{ backgroundColor: "white", border: "1px solid rgba(212,175,55,0.4)", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
              >
                <div>
                  <p className="text-xs text-gray-500 mb-1">{upi.label}</p>
                  <p
                    className="font-bold text-lg"
                    style={{ color: "var(--maroon)" }}
                  >
                    {upi.id}
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(upi.id, i)}
                  className="px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                  style={
                    copied === i
                      ? { backgroundColor: "#22c55e", color: "white" }
                      : { backgroundColor: "var(--saffron)", color: "white" }
                  }
                >
                  {copied === i ? "✓ " + d.copied : d.copyBtn}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* QR Code Placeholder */}
        <section className="text-center">
          <div
            className="inline-block p-6 rounded-2xl"
            style={{ backgroundColor: "white", border: "2px solid var(--gold)", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
          >
            <div
              className="w-40 h-40 mx-auto rounded-xl flex items-center justify-center text-4xl"
              style={{ backgroundColor: "var(--cream)", border: "2px dashed var(--gold)" }}
            >
              📱
            </div>
            <p className="mt-3 font-semibold text-sm" style={{ color: "var(--maroon)" }}>
              QR Code - kheemajmata.dei@upi
            </p>
          </div>
        </section>

        {/* Amount Buttons */}
        <section>
          <h2 className="section-title text-xl font-bold">{d.amountTitle}</h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-8">
            {d.amounts.map((amt, i) => (
              <button
                key={i}
                onClick={() => { setSelectedAmt(amt); handleDonate(amt); }}
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
                onClick={() => handleDonate(seva.amount.replace(/[^\d]/g, ""))}
                className="flex items-center justify-between p-4 rounded-xl text-left temple-card transition-all"
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

        {/* WhatsApp Contact */}
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
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("🙏 मैं मंदिर में दान करना चाहता/चाहती हूँ")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-8 py-3 rounded-full font-bold text-base transition-transform hover:scale-105"
            style={{ backgroundColor: "#25D366", color: "white" }}
          >
            📞 WhatsApp करें
          </a>
        </section>
      </div>
    </main>
  );
}

export default Donation;
