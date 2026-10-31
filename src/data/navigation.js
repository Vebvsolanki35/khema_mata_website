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
 * The five fixed bottom-navigation tabs (phones/tablets only).
 *
 * This is a *view* of the routes above — it introduces no new pages and no
 * second navigation config. `SECTIONS` remains the single source of truth for
 * the header/footer; the bottom bar simply surfaces the five most important
 * destinations, and "More" opens a sheet that links to the remaining existing
 * routes (see `MORE_MENU_GROUPS`).
 *
 * Home, Parivaar, Temple and Seva map to existing section hubs. `more` has no
 * route of its own: it is a button that opens the sheet.
 */
export const BOTTOM_TABS = [
  {
    id: "home",
    to: "/",
    labelKey: "homeShort",
    icon: "🏠",
    description: "Home",
    matches: ["/"],
  },
  {
    id: "parivaar",
    to: "/parivaar",
    labelKey: "parivaarShort",
    icon: "👨‍👩‍👧‍👦",
    description: "Parivaar",
    matches: ["/parivaar"],
  },
  {
    id: "temple",
    to: "/temple",
    labelKey: "temple",
    icon: "🛕",
    description: "Temple",
    matches: ["/temple", "/history", "/facilities", "/gallery", "/darshan", "/calendar"],
  },
  {
    id: "seva",
    to: "/donation",
    labelKey: "sevaShort",
    icon: "🙏",
    description: "Seva",
    matches: ["/donation", "/trust", "/contact"],
  },
  {
    id: "more",
    to: null,
    labelKey: "more",
    icon: "☰",
    description: "More",
    matches: ["/visit", "/planner"],
  },
];

/**
 * Everything that is not one of the four primary bottom tabs, grouped for the
 * "More" sheet. Built only from routes that already exist — no page is added,
 * renamed or removed. `/admin/login` is listed here because the public site has
 * no other way to reach the protected console on a phone.
 */
export const MORE_MENU_GROUPS = [
  {
    id: "heritage",
    titleKey: "heritage",
    items: [
      { to: "/temple", labelKey: "temple", icon: "🛕" },
      { to: "/history", labelKey: "history", icon: "👑" },
      { to: "/facilities", labelKey: "facilities", icon: "⭐" },
      { to: "/gallery", labelKey: "gallery", icon: "📷" },
    ],
  },
  {
    id: "darshan",
    titleKey: "darshanTab",
    items: [
      { to: "/darshan", labelKey: "darshanTab", icon: "🔔" },
      { to: "/calendar", labelKey: "calendar", icon: "📅" },
    ],
  },
  {
    id: "visit",
    titleKey: "visitTab",
    items: [
      { to: "/visit", labelKey: "visit", icon: "🗺️" },
      { to: "/planner", labelKey: "planner", icon: "🧳" },
    ],
  },
  {
    id: "seva",
    titleKey: "seva",
    items: [
      { to: "/donation", labelKey: "donation", icon: "💰" },
      { to: "/trust", labelKey: "trust", icon: "🏛️" },
      { to: "/contact", labelKey: "contact", icon: "📞" },
    ],
  },
  {
    id: "account",
    titleKey: "moreAccountGroup",
    items: [{ to: "/admin/login", labelKey: "adminLogin", icon: "🔐" }],
  },
];

/** Normalises a trailing slash so `/parivaar/` and `/parivaar` match. */
function normalizePath(pathname = "/") {
  const clean = String(pathname).split("?")[0].split("#")[0];
  if (clean.length > 1 && clean.endsWith("/")) return clean.slice(0, -1);
  return clean || "/";
}

/**
 * True when `pathname` belongs to the given bottom tab.
 * Admin routes belong to no public tab, so nothing is highlighted there.
 */
export function isBottomTabActive(tab, pathname) {
  const path = normalizePath(pathname);
  if (path.startsWith("/admin")) return false;
  if (!tab) return false;
  const matches = tab.matches || (tab.to ? [tab.to] : []);
  return matches.some((route) => normalizePath(route) === path);
}

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
