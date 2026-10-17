import { useState, useEffect } from "react";
import { useLanguage } from "../context/useLanguage";
import { useContactForm } from "../hooks/useContactForm";
import { WHATSAPP_GROUP_INVITE, WHATSAPP_GREEN } from "../config/constants";
import { supabase } from "../lib/supabase";
import WhatsAppButton from "../components/WhatsAppButton";
import WhatsAppGroupSection from "../components/WhatsAppGroupSection";

/**
 * Only the official, verified group invitation is listed.
 * The previous placeholder links (chat.whatsapp.com/temple, /solanki, /tirtha,
 * /navratri) were not real and have been removed so the page never shows
 * duplicate or contradictory group links.
 */
const DEFAULT_WA_GROUPS = [
  { name: "मंदिर अपडेट ग्रुप (आधिकारिक)", link: WHATSAPP_GROUP_INVITE },
];

function Contact() {
  const { t } = useLanguage();
  const c = t.contact;
  const [waGroups, setWaGroups] = useState(DEFAULT_WA_GROUPS);

  useEffect(() => {
    supabase
      .from("whatsapp_groups")
      .select("name, link")
      .limit(4)
      .then(({ data }) => {
        if (data && data.length > 0) setWaGroups(data);
      });
  }, []);

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
        className="py-16 px-4 text-center"
        style={{ background: "linear-gradient(135deg, var(--maroon), #5A0E0E)" }}
      >
        <div className="text-5xl mb-4">📞</div>
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
                  href={WHATSAPP_GROUP_INVITE}
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
              <p>⏰ प्रातः ५:०० – १२:०० | सायं ४:०० – ९:००</p>
              <p>🎉 चैत्र नवरात्रि (मार्च–अप्रैल)</p>
              <p>🎉 शारदीय नवरात्रि (अक्टूबर)</p>
            </div>
          </div>

          {/* WhatsApp Groups */}
          <div
            className="rounded-2xl p-6"
            style={{ backgroundColor: "var(--cream)", border: "1px solid rgba(212,175,55,0.4)" }}
          >
            <h3
              className="font-bold text-lg mb-4"
              style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
            >
              💬 WhatsApp Groups
            </h3>
            <div className="space-y-3">
              {waGroups.map((grp, i) => (
                <a
                  key={i}
                  href={grp.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl font-semibold text-sm transition-colors hover:opacity-80"
                  style={{ backgroundColor: WHATSAPP_GREEN, color: "#FFFFFF" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  {grp.name}
                </a>
              ))}
            </div>
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
                href={WHATSAPP_GROUP_INVITE}
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
      <WhatsAppGroupSection />
    </main>
  );
}

export default Contact;
