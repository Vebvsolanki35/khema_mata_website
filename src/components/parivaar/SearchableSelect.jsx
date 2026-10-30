import { useEffect, useId, useMemo, useRef, useState } from "react";
import { normalizePlaceSearch } from "../../lib/validateParivaar";

/**
 * Mobile-first accessible, searchable combobox dropdown for administrative hierarchy selection
 * (State/UT -> District -> Tehsil/Block -> Village).
 * - Uses >= 16px text in trigger and search input to prevent unwanted browser zoom on mobile.
 * - Keeps dropdown strictly inside the viewport on 320px+ screens.
 * - Supports both Hindi and English location queries.
 */
function SearchableSelect({
  id,
  label,
  required = false,
  requiredText = "आवश्यक / Required",
  optionalText = "वैकल्पिक / Optional",
  options = [],
  value = "",
  onChange,
  onSearchChange,
  placeholder = "चुनें (Select)…",
  searchPlaceholder = "खोजने के लिए लिखें (Type to search)…",
  emptyText = "कोई स्थान नहीं मिला (No matching locations found)",
  disabled = false,
  loading = false,
  error,
  renderSublabel,
  testId,
}) {
  const autoId = useId();
  const inputId = id || `searchable-select-${autoId}`;
  const listboxId = `${inputId}-listbox`;

  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  const selectedOption = useMemo(
    () => options.find((o) => String(o.value) === String(value)) || null,
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    const normQ = normalizePlaceSearch(q);
    return options.filter((o) => {
      const rawLabel = String(o.label || "").toLowerCase();
      const rawSub = String(o.sublabel || "").toLowerCase();
      const rawCode = String(o.value || "").toLowerCase();
      const labelMatch =
        rawLabel.includes(q) || normalizePlaceSearch(rawLabel).includes(normQ);
      const subMatch =
        rawSub.includes(q) || normalizePlaceSearch(rawSub).includes(normQ);
      const codeMatch = rawCode.includes(q);
      return labelMatch || subMatch || codeMatch;
    });
  }, [options, query]);

  useEffect(() => {
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, []);

  const openDropdown = () => {
    if (disabled) return;
    if (containerRef.current && typeof window !== "undefined") {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setOpenUpward(spaceBelow < 240 && spaceAbove > spaceBelow);
    }
    setOpen(true);
    setQuery("");
    setActiveIndex(0);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 15);
  };

  const handleSelect = (opt) => {
    onChange(opt ? opt.value : "");
    setOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        openDropdown();
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) =>
        filteredOptions.length > 0 ? (prev + 1) % filteredOptions.length : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        filteredOptions.length > 0
          ? (prev - 1 + filteredOptions.length) % filteredOptions.length
          : 0
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredOptions[activeIndex]) {
        handleSelect(filteredOptions[activeIndex]);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative min-w-0" data-testid={testId}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs sm:text-sm font-bold mb-1.5 leading-snug"
          style={{ color: "var(--maroon)" }}
        >
          {label}{" "}
          <span
            className="font-normal text-xs"
            style={{ color: "#6E5840" }}
          >
            ({required ? requiredText : optionalText})
          </span>
        </label>
      )}

      <div className="relative flex items-center">
        <button
          id={inputId}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-disabled={disabled}
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openDropdown())}
          onKeyDown={handleKeyDown}
          className="w-full text-left rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 transition-colors focus:outline-none focus:ring-2"
          style={{
            backgroundColor: disabled ? "#F5EFE8" : "#FFFFFF",
            border: error
              ? "1.5px solid #B91C1C"
              : open
                ? "1.5px solid var(--maroon)"
                : "1px solid rgba(212,175,55,0.7)",
            color: selectedOption ? "#2D1B0E" : "#6E5840",
            cursor: disabled ? "not-allowed" : "pointer",
            minHeight: "48px",
            fontSize: "16px",
          }}
        >
          <span className="truncate text-base">
            {loading
              ? "⏳ लोड हो रहा है (Loading)…"
              : selectedOption
                ? selectedOption.label
                : placeholder}
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            {selectedOption && !disabled && (
              <span
                role="button"
                tabIndex={0}
                aria-label="चयन हटाएं (Clear selection)"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    handleSelect(null);
                  }
                }}
                className="px-2 py-1 rounded text-xs font-bold hover:bg-red-50"
                style={{ color: "var(--maroon)" }}
              >
                ✕
              </span>
            )}
            <span
              aria-hidden="true"
              className="text-xs font-bold"
              style={{ color: "var(--maroon)" }}
            >
              {open ? "▲" : "▼"}
            </span>
          </span>
        </button>
      </div>

      {open && !disabled && (
        <div
          className={`absolute left-0 right-0 z-50 w-full rounded-xl shadow-2xl overflow-hidden ${
            openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
          style={{
            backgroundColor: "#FFFFFF",
            border: "1.5px solid var(--gold)",
            maxWidth: "calc(100vw - 24px)",
          }}
        >
          <div
            className="p-2 border-b flex items-center gap-2"
            style={{
              backgroundColor: "var(--cream)",
              borderColor: "rgba(212,175,55,0.45)",
            }}
          >
            <input
              ref={searchInputRef}
              type="search"
              inputMode="search"
              value={query}
              onChange={(e) => {
                const v = e.target.value;
                setQuery(v);
                setActiveIndex(0);
                if (onSearchChange) onSearchChange(v);
              }}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="w-full rounded-lg px-3 py-2 text-base focus:outline-none"
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid rgba(212,175,55,0.65)",
                color: "#2D1B0E",
                fontSize: "16px",
                minHeight: "42px",
              }}
            />
          </div>

          <ul
            id={listboxId}
            role="listbox"
            className="max-h-56 sm:max-h-64 overflow-y-auto overscroll-contain divide-y divide-amber-100/60"
          >
            {loading ? (
              <li className="px-3.5 py-4 text-sm text-center font-semibold" style={{ color: "var(--maroon)" }}>
                ⏳ आधिकारिक स्थान लोड हो रहे हैं (Loading official locations)…
              </li>
            ) : filteredOptions.length === 0 ? (
              <li className="px-3.5 py-3.5 text-sm text-gray-500 text-center">
                {emptyText}
              </li>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = idx === activeIndex;
                return (
                  <li
                    key={opt.value}
                    id={`${inputId}-opt-${opt.value}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => handleSelect(opt)}
                    className="px-3.5 py-2.5 text-sm sm:text-base cursor-pointer flex items-center justify-between gap-2 transition-colors"
                    style={{
                      minHeight: "44px",
                      backgroundColor: isSelected
                        ? "rgba(139,26,26,0.1)"
                        : isHighlighted
                          ? "#FFF8F0"
                          : "#FFFFFF",
                      color: isSelected ? "var(--maroon)" : "#2D1B0E",
                      fontWeight: isSelected ? 700 : 500,
                    }}
                  >
                    <div className="min-w-0">
                      <span className="block truncate">{opt.label}</span>
                      {(opt.sublabel || renderSublabel) && (
                        <span className="block text-xs text-gray-500 truncate">
                          {renderSublabel ? renderSublabel(opt) : opt.sublabel}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <span
                        aria-hidden="true"
                        className="text-xs font-bold shrink-0"
                        style={{ color: "var(--maroon)" }}
                      >
                        ✓
                      </span>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      {error && (
        <p
          className="text-xs font-semibold mt-1"
          style={{ color: "#B91C1C" }}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default SearchableSelect;
