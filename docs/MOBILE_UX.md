# Mobile-first UX structure

This document describes the phone-first layout introduced for the Khemaj Mata
Temple / Solanki Parivaar site. **No route, API, Supabase table, RPC, Family ID
rule or admin permission changed** — only how existing pages are presented and
reached on small screens.

## 1. Navigation

| Surface | Contents |
|---|---|
| Top bar (all public pages) | Temple identity, `हिं / EN / ગુ` language switch, WhatsApp and Donate actions on `sm+` |
| Fixed bottom bar (`< md`) | **Home · Parivaar · Temple · Seva · More** |
| **More** sheet | Every remaining existing page: Temple & Heritage (`/temple`, `/history`, `/facilities`, `/gallery`), Darshan (`/darshan`, `/calendar`), Visit (`/visit`, `/planner`), Trust & Seva (`/donation`, `/trust`, `/contact`), Admin login, language switch, WhatsApp group |
| Desktop (`lg+`) | The original six-section tab bar (unchanged) |
| Footer | Full link list built from `SECTIONS` (unchanged) |

`src/data/navigation.js` remains the single source of truth:

- `SECTIONS` — the six public sections (id order is asserted by
  `scripts/test-parivaar.mjs`, unchanged).
- `BOTTOM_TABS` — the five bottom tabs (a view over existing routes).
- `MORE_MENU_GROUPS` — the More sheet contents; every entry must already exist
  as a public route (or `/admin/login`), which the test suite enforces.
- `isBottomTabActive()` — active-state helper (admin routes highlight nothing).

The old mobile hamburger drawer was **removed** so there is only one mobile
navigation system. Admin routes (`/admin`, `/admin/login`) still render with no
public chrome at all.

## 2. Home

Order: compact hero (two primary actions) → six action cards (Register Family,
Find Family, Community Map, Temple, Donate, Gallery) → live notices → collapsed
temple timings/aarti/festivals/general information → compact stats → donation
CTA → volunteer form → testimonials → photo strip → heritage summary.

Long content sits behind a shared `ReadMore` component
(`src/components/ui/ReadMore.jsx`), which renders a real `<button>` with
`aria-expanded` / `aria-controls`. Nothing is hidden from search engines.

## 3. Parivaar

`/parivaar` opens with a shortened hero plus **three** landing actions —
Register Family, Find Family, Community Map — which jump to the existing
sections `#parivaar-register`, `#parivaar-directory`, `#parivaar-map`.

The five original sections (Overview, Map, Directory, Register, Help) and their
labels are untouched. Deep links work from anywhere on the site:

```
/parivaar#register   → #parivaar-register
/parivaar#directory  → #parivaar-directory
/parivaar#map        → #parivaar-map
/parivaar#help       → #parivaar-help
```

`ScrollToTop` in `src/App.jsx` now respects `#hash`, so deep links do not land at
the top of the page.

## 4. Family directory

- One prominent search box: **Family ID, family-head name or village**
  (`data-testid="directory-search-input"`).
- Advanced location filters (State → District → Tehsil → Village) live in one
  collapsible panel (`data-testid="directory-mobile-filter-toggle"`), collapsed
  by default at every breakpoint, with an active-filter count badge and the
  existing "clear filters" action.

## 5. Registration wizard

Four steps over the **same** `values` state object, ending in the **same**
`submitRegistration` call:

1. **Family Details** — head name, father's name, mobile number
2. **Members** — number of family members
3. **Ancestral Village** — State → District → Tehsil/Block → Village (official
   LGD hierarchy, sequential and dependent)
4. **Current Address & Review** — private current address, a review card with
   "change" links back to earlier steps, then Submit

Behaviour:

- Progress chips + bar (`data-testid="reg-step-indicator"`); future steps are
  locked, completed steps can be revisited.
- Per-step validation reuses `src/lib/validateParivaar.js` — the same rules used
  by the server/API tests. No duplicate validation logic.
- Values survive Back/Next and jumping between steps.
- Submitting re-checks every step and jumps to the first invalid one, focusing
  the offending control.
- Family IDs are still generated in the database only; nothing about ID
  generation, editing or deletion changed.

## 6. Floating buttons

The Donate/WhatsApp floating dock is now **desktop-only**. On phones the same
actions are always one tap away in the bottom bar (Seva) and the More sheet, and
the page reserves bottom space (`--bottom-nav-h` + safe-area inset) so nothing
is ever covered.

## 7. Verification

```bash
npm run lint
npm run test:parivaar
npm run test:parivaar:sql
npm run build
```

Manual phone check (360 / 390 / 430 px):

- bottom bar always visible, all five labels readable, active tab highlighted
- More sheet scrolls, closes on Escape/backdrop/selection
- Home action cards tappable (≥ 44 px), "Read more" expands
- Parivaar 3 actions jump to the right sections
- wizard: Back/Next preserve values, invalid steps blocked, submit disabled while
  sending
- directory: search first, filters collapsed until needed
- language switch (हिंदी / English / ગુજરાતી) updates nav, cards and step labels
