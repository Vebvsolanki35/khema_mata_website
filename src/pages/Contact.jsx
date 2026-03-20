import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";

const WHATSAPP_NUMBER = "919001234567";
const UPI_ID = "khemajmata@upi";

function Contact() {
  const { t } = useLanguage();
  const c = t.contact;

  const [form, setForm] = useState({ name: "", phone: "", message: "" });
  const [copied, setCopied] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const msg = encodeURIComponent(
      `${c.nameLabel}: ${form.name}\n${c.phoneLabel}: ${form.phone}\n${c.messageLabel}: ${form.message}`
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(UPI_ID).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDonate = (amount) => {
    const msg = encodeURIComponent(`Donation of ₹${amount} to Khemaj Mata Temple`);
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-3xl md:text-4xl font-bold text-orange-700 text-center mb-10">
        📞 {c.title}
      </h1>

      {/* Contact Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-lg p-6 mb-10 space-y-4 border border-orange-100"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {c.nameLabel}
          </label>
          <input
            type="text"
            name="name"
            required
            value={form.name}
            onChange={handleChange}
            placeholder={c.namePlaceholder}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {c.phoneLabel}
          </label>
          <input
            type="tel"
            name="phone"
            required
            value={form.phone}
            onChange={handleChange}
            placeholder={c.phonePlaceholder}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {c.messageLabel}
          </label>
          <textarea
            name="message"
            rows={4}
            value={form.message}
            onChange={handleChange}
            placeholder={c.messagePlaceholder}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          💬 {c.submit}
        </button>
      </form>

      {/* Donation Section */}
      <div className="bg-amber-50 rounded-2xl shadow p-6 border border-orange-200">
        <h2 className="text-xl font-bold text-orange-700 mb-4 text-center">
          🙏 {c.donationTitle}
        </h2>

        {/* UPI ID */}
        <div className="flex items-center gap-3 bg-white rounded-xl border border-orange-200 px-4 py-3 mb-5">
          <div>
            <p className="text-xs text-gray-500">{c.upiLabel}</p>
            <p className="font-bold text-gray-800">{UPI_ID}</p>
          </div>
          <button
            onClick={handleCopy}
            className={`ml-auto px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              copied
                ? "bg-green-500 text-white"
                : "bg-orange-500 text-white hover:bg-orange-600"
            }`}
          >
            {copied ? c.copied : c.copyBtn}
          </button>
        </div>

        {/* Donation buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {c.donateAmounts.map((amt, idx) => (
            <button
              key={idx}
              onClick={() => handleDonate(c.donateValues[idx])}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl text-lg transition-colors shadow"
            >
              {amt}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

export default Contact;
