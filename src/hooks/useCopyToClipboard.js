import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Copy-to-clipboard with a fallback for browsers / non-secure origins where
 * `navigator.clipboard` is unavailable (older Android WebViews, http:// previews).
 *
 * Usage:
 *   const { copied, copy } = useCopyToClipboard();
 *   <button onClick={() => copy("686005601933")}>{copied ? "Copied" : "Copy"}</button>
 */
export function useCopyToClipboard(resetAfter = 2000) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const copy = useCallback(
    async (text) => {
      if (!text) return false;
      let ok = false;

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          ok = true;
        }
      } catch {
        ok = false;
      }

      if (!ok) {
        // Fallback: hidden textarea + execCommand
        try {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.setAttribute("readonly", "");
          ta.style.position = "fixed";
          ta.style.top = "-1000px";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          ta.setSelectionRange(0, ta.value.length);
          ok = document.execCommand("copy");
          document.body.removeChild(ta);
        } catch {
          ok = false;
        }
      }

      if (ok) {
        setCopied(true);
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), resetAfter);
      }
      return ok;
    },
    [resetAfter]
  );

  return { copied, copy };
}

export default useCopyToClipboard;
