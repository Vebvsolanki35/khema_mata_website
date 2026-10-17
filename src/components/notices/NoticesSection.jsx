import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../context/useLanguage";
import useNotices from "../../hooks/useNotices";
import { previewText, needsReadMore, shareNotice } from "../../lib/broadcastShare";

/**
 * Live Temple Notices — public homepage feed.
 *
 * Shows only what an authorised Trust member has published, inside its
 * schedule window and not expired. Drafts, scheduled and archived items are
 * invisible here — that is enforced by RLS and the read-time query, not by
 * this component.
 *
 * Nothing is auto-generated. With nothing published the section shows one
 * neutral line and nothing else.
 */

const PRIORITY_STYLE = {
  urgent: { border: "2px solid #B91C1C", accent: "#B91C1C", bg: "#FFF5F5", chipBg: "#B91C1C", chipFg: "#FFFFFF" },
  important: { border: "2px solid var(--saffron)", accent: "#92400E", bg: "#FFFBF2", chipBg: "var(--saffron)", chipFg: "#FFFFFF" },
  normal: { border: "1px solid rgba(212,175,55,0.5)", accent: "var(--maroon)", bg: "#FFFFFF", chipBg: "var(--maroon)", chipFg: "var(--gold)" },
};

const CATEGORY_ICON = {
  general: "📢",
  darshan_timings: "⏰",
  aarti_puja: "🪔",
  festival: "🎉",
  closure: "🚫",
  event: "🎊",
  visitor_instruction: "ℹ️",
  seva: "🙏",
  emergency: "⚠️",
};

const fmt = (value, language, opts) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString(
      language === "en" ? "en-IN" : language === "gu" ? "gu-IN" : "hi-IN",
      opts
    );
  } catch {
    return "";
  }
};

const DATE_OPTS = { day: "numeric", month: "short", year: "numeric" };
const TIME_OPTS = { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" };

function NoticeCard({ notice, t, language, highlighted, cardRef }) {
  const style = PRIORITY_STYLE[notice.priority] || PRIORITY_STYLE.normal;
  const n = t.noticesSection;
  const [expanded, setExpanded] = useState(false);
  const long = needsReadMore(notice.body);
  const shown = long && !expanded ? previewText(notice.body) : notice.body;

  return (
    <article
      ref={cardRef}
      className="rounded-2xl p-4 sm:p-5 shadow-sm transition-shadow"
      style={{
        backgroundColor: style.bg,
        border: style.border,
        outline: highlighted ? "3px solid var(--saffron)" : "none",
        outlineOffset: "2px",
        scrollMarginTop: "90px",
      }}
    >
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span
          className="text-[11px] font-bold px-2.5 py-1 rounded-full"
          style={{ backgroundColor: style.chipBg, color: style.chipFg }}
        >
          {(n.priority && n.priority[notice.priority]) || notice.priority}
        </span>
        <span className="text-xs text-gray-500">
          {CATEGORY_ICON[notice.category] || "📢"}{" "}
          {(n.category && n.category[notice.category]) || notice.category}
        </span>
      </div>

      <h3
        className="font-bold text-base sm:text-lg mb-1.5"
        style={{ color: style.accent, fontFamily: "'Tiro Devanagari Hindi', serif" }}
      >
        {notice.title}
      </h3>

      <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "#4A3728" }}>
        {shown}
      </p>

      {long && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="mt-1.5 text-xs font-bold underline"
          style={{ color: style.accent }}
        >
          {expanded ? n.readLess : n.readMore}
        </button>
      )}

      {(notice.event_start || notice.event_end) && (
        <p className="text-xs font-semibold mt-3" style={{ color: style.accent }}>
          🗓️ {n.eventFrom}{" "}
          {notice.event_start ? fmt(notice.event_start, language, DATE_OPTS) : ""}
          {notice.event_start && notice.event_end ? ` ${n.to} ` : " "}
          {notice.event_end ? fmt(notice.event_end, language, DATE_OPTS) : ""}
        </p>
      )}

      {notice.image_url && (
        <img
          src={notice.image_url}
          alt=""
          loading="lazy"
          decoding="async"
          className="mt-3 w-full rounded-xl object-cover"
          style={{ maxHeight: "260px" }}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3"
        style={{ borderTop: "1px solid rgba(212,175,55,0.35)" }}>
        <p className="text-[11px] text-gray-500">
          {n.publishedOn}: {fmt(notice.published_at || notice.created_at, language, TIME_OPTS)}
        </p>

        <div className="flex items-center gap-3">
          {notice.link_url && (
            <a
              href={notice.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold"
              style={{ color: style.accent }}
            >
              {n.openLink}
            </a>
          )}
          {/* Share: native sheet on mobile, WhatsApp link elsewhere.
              Sharing is a devotee action and is deliberately not tracked. */}
          <button
            type="button"
            onClick={() => shareNotice(notice)}
            className="text-xs font-bold px-3 py-1.5 rounded-full inline-flex items-center gap-1"
            style={{ backgroundColor: "#188748", color: "#FFFFFF" }}
            aria-label={`${n.share}: ${notice.title}`}
          >
            <span aria-hidden="true">📤</span> {n.share}
          </button>
        </div>
      </div>
    </article>
  );
}

function NoticesSection() {
  const { t, language } = useLanguage();
  const { notices, loading, missing } = useNotices();
  const n = t.noticesSection;

  // Deep link support: /?notice=<id> scrolls to and highlights that notice.
  // Read once during render (no effect, so no cascading state update).
  const [highlightId] = useState(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("notice");
  });
  const cardRefs = useRef({});

  useEffect(() => {
    if (!highlightId) return;
    const el = cardRefs.current[highlightId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId, notices]);

  // Prefer announcements written in the visitor's language. If none exist for
  // that language, show everything rather than an empty feed.
  const matching = notices.filter((x) => !x.language || x.language === language);
  const shown = matching.length > 0 ? matching : notices;

  // Urgent banner — one, static, no animation and no popup.
  const urgent = shown.filter((x) => x.priority === "urgent");
  const banner = urgent[0];

  if (!loading && (missing || shown.length === 0)) {
    return (
      <section className="py-10 px-4" style={{ backgroundColor: "var(--cream)" }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="section-title text-xl md:text-2xl font-bold">📢 {n.title}</h2>
          <div
            className="mt-6 rounded-2xl p-5 text-center"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(212,175,55,0.45)" }}
          >
            <p className="text-sm sm:text-base" style={{ color: "#6B5B4B" }}>
              {n.empty}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 px-4" style={{ backgroundColor: "var(--cream)" }}>
      <div className="max-w-4xl mx-auto">
        <h2 className="section-title text-xl md:text-2xl font-bold">📢 {n.title}</h2>
        <p className="text-sm mt-1.5" style={{ color: "#6B5B4B" }}>
          {n.subtitle}
        </p>

        {/* Respectful static banner for the top urgent notice */}
        {banner && (
          <div
            className="mt-5 rounded-xl px-4 py-3 flex items-start gap-2"
            style={{ backgroundColor: "#FFF5F5", border: "2px solid #B91C1C" }}
            role="status"
          >
            <span aria-hidden="true" className="text-lg leading-none">⚠️</span>
            <p className="text-sm font-semibold" style={{ color: "#7F1D1D" }}>
              {n.urgentBanner}: {banner.title}
            </p>
          </div>
        )}

        {loading ? (
          <div
            className="mt-7 rounded-2xl p-6 text-center text-sm"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(212,175,55,0.45)" }}
          >
            <span
              className="inline-block w-5 h-5 mr-2 align-middle border-2 rounded-full animate-spin"
              style={{ borderColor: "var(--gold)", borderTopColor: "transparent" }}
            />
            {n.loading}
          </div>
        ) : (
          <div className="mt-7 space-y-4">
            {shown.map((notice) => (
              <NoticeCard
                key={notice.id}
                notice={notice}
                t={t}
                language={language}
                highlighted={highlightId === notice.id}
                cardRef={(el) => {
                  cardRefs.current[notice.id] = el;
                }}
              />
            ))}
          </div>
        )}

        <p className="text-[11px] mt-4 text-center" style={{ color: "#8B7355" }}>
          {n.officialNote}
        </p>
      </div>
    </section>
  );
}

export default NoticesSection;
