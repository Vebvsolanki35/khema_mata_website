import { useState } from "react";
import { useLanguage } from "../context/useLanguage";
import { useContactForm } from "../hooks/useContactForm";
import {
  WHATSAPP_CHANNEL_URL,
  WHATSAPP_GREEN,
  EXTERNAL_LINK_REL,
} from "../config/constants";
import WhatsAppButton from "../components/WhatsAppButton";
import WhatsAppChannelSection from "../components/WhatsAppChannelSection";

/**
 * The temple now runs a single official WhatsApp *Channel* instead of a group.
 * The old group list (and the `whatsapp_groups` table it was read from) is no
 * longer rendered, so a stale group link can never reappear on this page.
 */

function Contact() {
  const { t } = useLanguage();
  const c = t.contact;

  const [form, setForm] = useState({
    name: "",
    phone: "",
    city: "",
    email: "",
    subject: "",
    message: "",
  });
  const { submit, loading, success, error } = useContactForm();

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await submit({
      name: form.name,
      phone: form.phone,
      message: `${form.subject}: ${form.message} | City: ${form.city} | Email: ${form.email}`,
    });
    if (ok) {
      // The message is stored in Supabase; no direct-chat number exists, so we
      // no longer open a wa.me link. The success panel below offers the group.
      setForm({ name: "", phone: "", city: "", email: "", subject: "", message: "" });
    }
  };

  return (
    <main>
      {/* Hero */}
      <section
        className="py-10 sm:py-14 px-4 text-center"
        style={{ background: "linear-gradient(135deg, var(--maroon), #5A0E0E)" }}
      >
        <div className="text-3xl sm:text-4xl mb-2.5">📞</div>
        <h1
          className="text-3xl md:text-4xl font-bold mb-2"
          style={{ color: "var(--gold)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
        >
          {c.title}
        </h1>
      </section>

      <div className="max-w-5xl mx-auto px-4 py-12 grid grid-cols-1 lg:grid-cols-5 gap-10">
        {/* Contact Form */}
        <div className="lg:col-span-3">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl shadow-lg p-6 space-y-4"
            style={{ border: "1px solid rgba(212,175,55,0.3)" }}
          >
            {/* Row 1: Name + Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1" style={{ color: "var(--maroon)" }}>
                  {c.nameLabel} *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={form.name}
                  onChange={handleChange}
                  placeholder={c.namePlaceholder}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                  style={{ borderColor: "rgba(212,175,55,0.4)", focusRingColor: "var(--saffron)" }}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1" style={{ color: "var(--maroon)" }}>
                  {c.phoneLabel} *
                </label>
                <input
                  type="tel"
                  name="phone"
                  required
                  value={form.phone}
                  onChange={handleChange}
                  placeholder={c.phonePlaceholder}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                  style={{ borderColor: "rgba(212,175,55,0.4)" }}
                />
              </div>
            </div>

            {/* Row 2: City + Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1" style={{ color: "var(--maroon)" }}>
                  {c.cityLabel}
                </label>
                <input
                  type="text"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  placeholder={c.cityPlaceholder}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                  style={{ borderColor: "rgba(212,175,55,0.4)" }}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1" style={{ color: "var(--maroon)" }}>
                  {c.emailLabel}
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder={c.emailPlaceholder}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                  style={{ borderColor: "rgba(212,175,55,0.4)" }}
                />
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: "var(--maroon)" }}>
                {c.subjectLabel}
              </label>
              <select
                name="subject"
                value={form.subject}
                onChange={handleChange}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 bg-white"
                style={{ borderColor: "rgba(212,175,55,0.4)" }}
              >
                <option value="">-- {c.subjectLabel} --</option>
                {c.subjects.map((s, i) => (
                  <option key={i} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: "var(--maroon)" }}>
                {c.messageLabel}
              </label>
              <textarea
                name="message"
                rows={4}
                value={form.message}
                onChange={handleChange}
                placeholder={c.messagePlaceholder}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 resize-none"
                style={{ borderColor: "rgba(212,175,55,0.4)" }}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-base transition-colors flex items-center justify-center gap-2"
              style={{ backgroundColor: "var(--maroon)", color: "#FFF8F0" }}
            >
              {loading ? (
                <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>💬 {c.submit}</>
              )}
            </button>

            {success && (
              <div
                className="rounded-xl p-4 text-center"
                style={{ backgroundColor: "#F0FDF4", border: "1px solid #86EFAC" }}
              >
                <p className="text-green-700 text-sm font-semibold mb-3">
                  ✅ {c.successMessage}
                </p>
                <WhatsAppButton
                  href={WHATSAPP_CHANNEL_URL}
                  iconSize={16}
                  className="px-5 py-2.5 rounded-full text-sm"
                >
                  {t.whatsappGroup.button}
                </WhatsAppButton>
              </div>
            )}
            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}
          </form>
        </div>

        {/* Right Panel: Address + WhatsApp Groups */}
        <div className="lg:col-span-2 space-y-6">
          {/* Address Card */}
          <div
            className="rounded-2xl p-6"
            style={{ backgroundColor: "var(--maroon)", border: "1px solid var(--gold)" }}
          >
            <h3
              className="font-bold text-lg mb-4"
              style={{ color: "var(--gold)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
            >
              📍 {c.addressTitle}
            </h3>
            <div className="space-y-3 text-sm" style={{ color: "#FFF8F0" }}>
              <p>🛕 श्री खेमज माता मंदिर न्यास</p>
              <p>📌 देई, बूंदी, राजस्थान ३२३८०२</p>
            </div>
          </div>

          {/* Official WhatsApp Channel (single source of truth) */}
          <div
            className="rounded-2xl p-5 sm:p-6"
            style={{ backgroundColor: "var(--cream)", border: "1px solid rgba(212,175,55,0.4)" }}
            data-testid="contact-whatsapp-channel"
          >
            <h3
              className="font-bold text-lg mb-2"
              style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
            >
              💬 {t.whatsappGroup.title}
            </h3>
            <p className="text-sm leading-relaxed mb-4" style={{ color: "#4A3728" }}>
              {t.whatsappGroup.desc}
            </p>
            <WhatsAppButton
              href={WHATSAPP_CHANNEL_URL}
              iconSize={18}
              className="px-5 py-3 rounded-full text-sm w-full sm:w-auto"
            >
              {t.whatsappGroup.button}
            </WhatsAppButton>
            <a
              href={WHATSAPP_CHANNEL_URL}
              target="_blank"
              rel={EXTERNAL_LINK_REL}
              className="mt-3 block text-[11px] break-all underline"
              style={{ color: WHATSAPP_GREEN }}
            >
              {WHATSAPP_CHANNEL_URL}
            </a>
          </div>

          {/* Social Links */}
          <div
            className="rounded-2xl p-6"
            style={{ backgroundColor: "white", border: "1px solid rgba(212,175,55,0.3)" }}
          >
            <h3
              className="font-bold text-lg mb-4"
              style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
            >
              🌐 {t.socialTitle}
            </h3>
            <div className="flex gap-3">
              <a
                href="#"
                title={t.comingSoon}
                onClick={e => e.preventDefault()}
                className="flex-1 text-center py-2.5 rounded-xl font-bold text-sm text-white opacity-75 cursor-not-allowed"
                style={{ backgroundColor: "#1877F2" }}
              >
                📘 Facebook
              </a>
              <WhatsAppButton
                href={WHATSAPP_CHANNEL_URL}
                showIcon={false}
                className="flex-1 text-center py-2.5 rounded-xl text-sm"
              >
                💬 WhatsApp
              </WhatsAppButton>
              <a
                href="#"
                title={t.comingSoon}
                onClick={e => e.preventDefault()}
                className="flex-1 text-center py-2.5 rounded-xl font-bold text-sm text-white opacity-75 cursor-not-allowed"
                style={{ backgroundColor: "#FF0000" }}
              >
                ▶ YouTube
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated WhatsApp group section (group QR — separate from the bank QR) */}
      <WhatsAppChannelSection />
    </main>
  );
}

export default Contact;
