/**
 * The six primary navigation sections.
 *
 * IMPORTANT — nothing here deletes a route. Every page that existed before the
 * refactor still has its own URL; pages that are no longer a *primary* tab are
 * listed under the section they belong to and reached through:
 *   1. their parent section page (Virasat/Darshan/Yatra), where the
 *      sub-page's real component is rendered inline,
 *   2. the links in the page footer, and
 *   3. their original direct URL, which is unchanged.
 *
 * Route → section map:
 *   /             → Home                (primary tab)
 *   /temple       → Temple & Heritage   (primary tab hub)
 *   /history      → Temple & Heritage
 *   /facilities   → Temple & Heritage
 *   /gallery      → Temple & Heritage
 *   /darshan      → Darshan & Festivals (primary tab hub)
 *   /calendar     → Darshan & Festivals
 *   /visit        → Plan Your Visit     (primary tab hub)
 *   /planner      → Plan Your Visit
 *   /donation     → Trust & Seva        (primary tab hub)
 *   /trust        → Trust & Seva
 *   /contact      → Trust & Seva
 *   /parivaar     → Solanki Parivaar    (primary tab)
 *   /admin, /admin/login → intentionally NOT in public navigation (protected)
 */
export const SECTIONS = [
  {
    id: "home",
    to: "/",
    labelKey: "home",
    shortKey: "homeShort",
    icon: "🛕",
    children: [],
  },
  {
    id: "heritage",
    to: "/temple",
    labelKey: "heritage",
    shortKey: "heritageShort",
    icon: "📜",
    children: [
      { to: "/temple", labelKey: "temple", icon: "🛕" },
      { to: "/history", labelKey: "history", icon: "👑" },
      { to: "/facilities", labelKey: "facilities", icon: "⭐" },
      { to: "/gallery", labelKey: "gallery", icon: "📷" },
    ],
  },
  {
    id: "darshan",
    to: "/darshan",
    labelKey: "darshanTab",
    shortKey: "darshanShort",
    icon: "🔔",
    children: [
      { to: "/darshan", labelKey: "darshanTab", icon: "🔔" },
      { to: "/calendar", labelKey: "calendar", icon: "📅" },
    ],
  },
  {
    id: "visit",
    to: "/visit",
    labelKey: "visitTab",
    shortKey: "visitShort",
    icon: "🗺️",
    children: [
      { to: "/visit", labelKey: "visit", icon: "🗺️" },
      { to: "/planner", labelKey: "planner", icon: "🧳" },
    ],
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
  {
    id: "parivaar",
    to: "/parivaar",
    labelKey: "parivaar",
    shortKey: "parivaarShort",
    icon: "👨‍👩‍👧‍👦",
    children: [],
  },
];

/** Every public route, used to sanity-check that nothing was dropped. */
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

export default SECTIONS;
