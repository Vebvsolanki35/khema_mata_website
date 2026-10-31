/**
 * The four public navigation sections.
 *
 * Exactly four destinations, shown identically in the desktop header, the fixed
 * mobile bottom bar and the footer:
 *
 *   1. मुख्य पृष्ठ            → /        (darshan + aarti timings live here)
 *   2. मंदिर एवं विरासत        → /temple  (+ /history, /gallery)
 *   3. सोलंकी परिवार          → /parivaar
 *   4. ट्रस्ट एवं सेवा         → /donation (+ /trust, /contact)
 *
 * Removed from the public site (see docs/MOBILE_UX.md):
 *   /visit, /planner   — Yatra planning
 *   /calendar          — Panchang / festival (Tyohar) calendar
 *   /darshan           — separate Darshan & Aarti page; the timings are on Home
 *   /facilities        — "Helpful services" card grid
 *
 * Sub-pages remain reachable from their section page and from the footer; they
 * are not extra primary tabs, so the tabs stay easy to scan on a phone.
 */
export const SECTIONS = [
  {
    id: "home",
    to: "/",
    labelKey: "home",
    shortKey: "homeShort",
    icon: "🏠",
    children: [],
  },
  {
    id: "heritage",
    to: "/temple",
    labelKey: "heritage",
    shortKey: "heritageShort",
    icon: "🛕",
    children: [
      { to: "/temple", labelKey: "temple", icon: "🛕" },
      { to: "/history", labelKey: "history", icon: "👑" },
      { to: "/gallery", labelKey: "gallery", icon: "📷" },
    ],
  },
  {
    id: "parivaar",
    to: "/parivaar",
    labelKey: "parivaar",
    shortKey: "parivaarShort",
    icon: "👨‍👩‍👧‍👦",
    children: [],
  },
  {
    id: "seva",
    to: "/donation",
    labelKey: "seva",
    shortKey: "sevaShort",
    icon: "🙏",
    children: [
      { to: "/donation", labelKey: "donation", icon: "💰" },
      { to: "/trust", labelKey: "trust", icon: "🏛️" },
      { to: "/contact", labelKey: "contact", icon: "📞" },
    ],
  },
];

/**
 * The fixed bottom tabs — derived from `SECTIONS` so there is exactly one
 * navigation source of truth and no possibility of the two drifting apart.
 */
export const BOTTOM_TABS = SECTIONS.map((section) => ({
  id: section.id,
  to: section.to,
  labelKey: section.shortKey || section.labelKey,
  fullLabelKey: section.labelKey,
  icon: section.icon,
}));

/** Every public route, used to sanity-check that nothing unexpected remains. */
export const ALL_PUBLIC_ROUTES = SECTIONS.flatMap((s) => [
  s.to,
  ...s.children.map((c) => c.to),
]);

/**
 * Returns the section whose hub or children match `pathname`.
 * Admin routes deliberately return null so no public tab is highlighted.
 */
export function getActiveSection(pathname) {
  if (pathname.startsWith("/admin")) return null;

  let best = null;
  for (const section of SECTIONS) {
    for (const child of section.children) {
      if (pathname === child.to) return { section, child };
    }
    if (pathname === section.to) best = best || { section, child: null };
  }
  return best;
}

/** True when `pathname` belongs to the given bottom tab. */
export function isBottomTabActive(tab, pathname) {
  if (!tab) return false;
  return getActiveSection(pathname)?.section?.id === tab.id;
}

export default SECTIONS;
