import { useId, useState } from "react";

/**
 * Short summary + "Read more" toggle.
 *
 * Used instead of long prose blocks on phones (and everywhere else) so pages
 * stay scannable. The full text is always rendered in the DOM inside the
 * collapsible region — nothing is hidden from search engines or screen readers
 * (the trigger is a real `<button>` with `aria-expanded`/`aria-controls`).
 *
 * Props:
 *  - summary:      always-visible short text (string or node)
 *  - children:     the long content revealed on expand
 *  - moreLabel / lessLabel: accessible labels (already localised by the caller)
 *  - className / summaryClassName: optional layout hooks
 *  - defaultOpen:  start expanded (used by desktop-friendly layouts)
 */
function ReadMore({
  summary,
  children,
  moreLabel = "और पढ़ें (Read more)",
  lessLabel = "कम दिखाएं (Show less)",
  className = "",
  summaryClassName = "",
  contentClassName = "",
  defaultOpen = false,
  testId,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className={className}>
      <p
        className={`leading-relaxed ${summaryClassName}`}
        style={{ margin: 0 }}
      >
        {summary}
      </p>

      <div
        id={panelId}
        hidden={!open}
        className={`mt-3 space-y-3 ${contentClassName}`}
      >
        {children}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        data-testid={testId}
        className="mt-2 inline-flex items-center gap-1.5 rounded-full font-bold cursor-pointer transition-colors"
        style={{
          minHeight: "40px",
          padding: "0 14px",
          fontSize: "0.82rem",
          backgroundColor: "rgba(212,175,55,0.14)",
          color: "var(--maroon)",
          border: "1px solid rgba(212,175,55,0.7)",
        }}
      >
        <span>{open ? lessLabel : moreLabel}</span>
        <span aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>
    </div>
  );
}

export default ReadMore;
