import { useCopyToClipboard } from "../hooks/useCopyToClipboard";

/**
 * Reusable "copy to clipboard" button.
 * Used by the bank account number, IFSC code and UPI IDs.
 */
function CopyButton({
  value,
  label,
  copiedLabel,
  className = "",
  ariaLabel,
  ...rest
}) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <button
      type="button"
      onClick={() => copy(value)}
      aria-label={ariaLabel || `${label}: ${value}`}
      className={`shrink-0 px-3.5 py-2 rounded-xl text-sm font-bold transition-colors ${className}`}
      style={{
        // Maroon/cream and dark-green/white both clear WCAG AA (saffron + white
        // was only 2.86:1).
        backgroundColor: copied ? "#15803D" : "var(--maroon)",
        color: "#FFF8F0",
      }}
      {...rest}
    >
      {copied ? `✓ ${copiedLabel}` : `📋 ${label}`}
    </button>
  );
}

export default CopyButton;
