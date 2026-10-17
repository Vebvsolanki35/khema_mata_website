import { useLanguage } from "../../context/useLanguage";
import useNotices from "../../hooks/useNotices";

/**
 * Live Temple Notices — public homepage section.
 *
 * Shows only notices that an authorised Trust member has published and that are
 * currently inside their schedule window. Archived, expired, draft and
 * scheduled notices are never shown here (enforced again by RLS, so this is
 * display logic, not the security boundary).
 *
 * Nothing is ever auto-generated: if the Trust has not published anything the
 * section shows a single neutral line.
 */

const PRIORITY_STYLE = {
  urgent: {
    border: "2px solid #B91C1C",
    accent: "#B91C1C",
    bg: "#FFF5F5",
    chipBg: "#B91C1C",
    chipFg: "#FFFFFF",
  },
  important: {
    border: "2px solid var(--saffron)",
    accent: "#92400E",
    bg: "#FFFBF2",
    chipBg: "var(--saffron)",
    chipFg: "#FFFFFF",
  },
  normal: {
    border: "1px solid rgba(212,175,55,0.5)",
    accent: "var(--maroon)",
    bg: "#FFFFFF",
    chipBg: "var(--maroon)",
    chipFg: "var(--gold)",
  },
};

const CATEGORY_ICON = {
  general: "📢",
  darshan_timings: "⏰",
  aarti_puja: "🪔",
  festival: "🎉",
  closure: "🚫",
  event: "🎊",
  visitor_instruction: "ℹ️",
};

function formatDateTime(value, language) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString(
      language === "en" ? "en-IN" : language === "gu" ? "gu-IN" : "hi-IN",
      { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
    );
  } catch {
    return "";
  }
}

function formatDate(value, language) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString(
      language === "en" ? "en-IN" : language === "gu" ? "gu-IN" : "hi-IN",
      { day: "numeric", month: "short", year: "numeric" }
    );
  } catch {
    return "";
  }
}

function NoticeCard({ notice, t, language }) {
  const style = PRIORITY_STYLE[notice.priority] || PRIORITY_STYLE.normal;
  const n = t.noticesSection;

  return (
    <article
      className="rounded-2xl p-4 sm:p-5 shadow-sm"
      style={{ backgroundColor: style.bg, border: style.border }}
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
        {notice.body}
      </p>

      {(notice.event_start || notice.event_end) && (
        <p className="text-xs font-semibold mt-3" style={{ color: style.accent }}>
          🗓️ {n.eventFrom}{" "}
          {notice.event_start ? formatDate(notice.event_start, language) : ""}
          {notice.event_start && notice.event_end ? ` ${n.to} ` : " "}
          {notice.event_end ? formatDate(notice.event_end, language) : ""}
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

      <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
        <p className="text-[11px] text-gray-500">
          {n.publishedOn}: {formatDateTime(notice.published_at || notice.created_at, language)}
        </p>
        {notice.link_url && (
          <a
            href={notice.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold"
            style={{ color: style.accent }}
          >
            {n.readMore}
          </a>
        )}
      </div>
    </article>
  );
}

function NoticesSection() {
  const { t, language } = useLanguage();
  const { notices, loading, missing } = useNotices();
  const n = t.noticesSection;

  // Nothing published (or the table isn't set up yet) — one neutral line, so
  // the section never implies there are announcements when there aren't.
  if (!loading && (missing || notices.length === 0)) {
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
            {notices.map((notice) => (
              <NoticeCard key={notice.id} notice={notice} t={t} language={language} />
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
