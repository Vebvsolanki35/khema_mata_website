import { BANK_DETAILS } from "../config/donation";
import { useLanguage } from "../context/useLanguage";
import CopyButton from "./CopyButton";

/**
 * Bank account details for temple donations.
 *
 * - Only renders fields that actually have a value, so nothing is invented.
 * - Account number and IFSC get one-tap copy buttons.
 * - Shows a "pending confirmation" badge while `BANK_DETAILS.verified` is false.
 */
function BankDetailsCard() {
  const { t } = useLanguage();
  const b = t.bank;
  const { bankName, accountNumber, ifsc, accountHolderName, branch, verified } =
    BANK_DETAILS;

  const rows = [
    { label: b.bankName, value: bankName, copyable: false },
    {
      label: b.accountHolder,
      value: accountHolderName,
      copyable: true,
      placeholder: b.pending,
    },
    { label: b.accountNumber, value: accountNumber, copyable: true },
    { label: b.ifsc, value: ifsc, copyable: true },
    { label: b.branch, value: branch, copyable: false, placeholder: b.pending },
  ].filter((r) => r.value); // never render an empty row

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid rgba(212,175,55,0.45)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex flex-wrap items-center justify-between gap-2"
        style={{ backgroundColor: "var(--maroon)" }}
      >
        <div>
          <h3
            className="text-lg font-bold"
            style={{ color: "var(--gold)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
          >
            🏦 {b.title}
          </h3>
          <p className="text-xs opacity-90" style={{ color: "#FFF8F0" }}>
            {b.subtitle}
          </p>
        </div>
        {!verified && (
          <span
            className="text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: "var(--gold)", color: "var(--maroon)" }}
          >
            ⏳ {b.pending}
          </span>
        )}
      </div>

      {/* Rows */}
      <dl className="divide-y" style={{ borderColor: "rgba(212,175,55,0.25)" }}>
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-3 px-5 py-3.5"
          >
            <div className="min-w-0">
              <dt className="text-xs mb-0.5" style={{ color: "#6B5B4B" }}>
                {row.label}
              </dt>
              <dd
                className="font-bold text-base sm:text-lg break-all"
                style={
                  row.placeholder
                    ? { color: "#9A8B7A", fontStyle: "italic", fontWeight: 500 }
                    : { color: "var(--maroon)" }
                }
              >
                {row.value || row.placeholder}
              </dd>
            </div>
            {row.copyable && row.value && (
              <CopyButton
                value={row.value}
                label={b.copy}
                copiedLabel={b.copied}
                ariaLabel={`${row.label} ${b.copy}`}
              />
            )}
          </div>
        ))}
      </dl>

      {!verified && (
        <p
          className="px-5 py-3 text-xs leading-relaxed"
          style={{
            color: "#6B5B4B",
            backgroundColor: "rgba(255, 107, 0, 0.06)",
            borderTop: "1px solid rgba(212,175,55,0.25)",
          }}
        >
          ⚠️ {b.verificationNote}
        </p>
      )}
    </div>
  );
}

export default BankDetailsCard;
