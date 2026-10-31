# Mobile-first UX structure

This document describes the phone-first public site for the Khemaj Mata Temple
and Solanki Parivaar. It is a presentation change only — the Supabase project,
environment variables, Parivaar registration/directory, Family IDs, admin access,
donation flow and trust data are untouched.

## 1. Exactly five navigation tabs

| # | Hindi label | Short bottom-tab label | Route | Icon |
|---|---|---|---|---|
| 1 | मुख्य पृष्ठ | मुख्य | `/` | 🏠 |
| 2 | मंदिर एवं विरासत | विरासत | `/temple` | 🛕 |
| 3 | दर्शन एवं आरती | दर्शन | `/darshan` | 🔔 |
| 4 | सोलंकी परिवार | परिवार | `/parivaar` | 👨‍👩‍👧‍👦 |
| 5 | ट्रस्ट एवं सेवा | सेवा | `/donation` | 🙏 |

- `src/data/navigation.js` is the single source of truth. `BOTTOM_TABS` is derived
  from `SECTIONS`, so the header, the fixed mobile bar and the footer can never
  list different destinations.
- There is **no hamburger drawer and no "More" sheet**: all five destinations are
  one tap away. Short labels keep the bar readable at 360 px; the full Hindi name
  is exposed through `aria-label` and on desktop (`2xl` breakpoint).
- Active state: the current tab is gold with maroon text and `aria-current="page"`.
- Sub-pages (`/history`, `/facilities`, `/gallery`, `/trust`, `/contact`) are
  reached from their section page and from the footer. They are not extra tabs.

## 2. Removed from the public site

| Removed | Details |
|---|---|
| Yatra / यात्रा योजना (`/visit`, `/planner`) | Pages, travel-season/hotel/travel-tip sections, weather widget and travel route data deleted |
| Tyohar / त्योहार calendar (`/calendar`) plus festival blocks on Home, Temple and Darshan | Deleted; the festival data file is gone |
| Public reviews / श्रद्धालुओं के अनुभव | `Testimonials` component removed from the site |
| Visitor gallery upload | Upload button, storage upload and DB insert removed from `/gallery`; the gallery is display-only (trust photograph + approved rows + existing photos). Admin gallery management is unchanged |
| Duplicate darshan timings | Timings + aarti now render **only** on `/darshan`. Removed from Home, Temple, Footer and the Ticker; those places link to the Darshan page instead |

Removed routes now fall through to the SPA's normal behaviour (no page). No
database tables, rows, storage buckets, API routes or admin screens were deleted.

## 3. Homepage

Order: hero (temple name, location, one photograph, one Darshan CTA) → four quick
actions (दर्शन समय, सोलंकी परिवार, दान करें, WhatsApp) → important notices
(only when published) → short introduction with a link to the heritage page.

Nothing else: no statistics band, no duplicate donation block, no volunteer form,
no reviews, no photo strip, no festival grid. Volunteering stays on the Trust &
Seva page (`/donation`), where it already existed.

## 4. Darshan & Aarti

`/darshan` shows the darshan timings and the aarti schedule and nothing else. All
values come from the existing translation data (`t.darshan.*`, `t.temple.aartis`),
so the trust can update the schedule in one place — no new timings were invented.

## 5. Parivaar / Trust & Seva (unchanged behaviour)

- `/parivaar` keeps the three landing actions (Register / Find / Map), the 4-step
  registration wizard (Family details → Members → Ancestral village → Address &
  review), the directory search and the community map. The last step repeats every
  earlier answer in a review card whose "बदलें" (Change) buttons jump back to the
  owning step; nothing is submitted until the final step, and the submit call,
  validator and Family-ID workflow are unchanged. Picking a village on the map
  opens the wizard directly on the village step.
- `/donation` keeps bank details, payment QR, UPI IDs, seva amounts, the volunteer
  form, WhatsApp contact; `/trust` and `/contact` are unchanged.
- Floating Donate/WhatsApp pills are desktop-only, so they can never cover a
  phone's bottom navigation, form fields or submit buttons.

## 6. Verification

```bash
npm run lint
npm run test:parivaar
npm run test:parivaar:sql
npm run build
```

Structural checks (React render in jsdom, no layout engine): five fixed tabs with
the required labels, active tab follows the section on child routes, the wizard's
Back/Next preserves values, the review card repeats the entered data, and the
Darshan timings render on `/darshan` only.

**These are not pixel measurements.** No real browser is available in this
environment, so the 360 / 390 / 430 px checklist below still has to be walked
once by hand on a phone or in DevTools device mode:

- five tabs visible with readable Hindi labels, no horizontal scrolling
- active tab clearly highlighted; page changes close any transient UI
- Home has exactly four quick actions and no long card grids
- Darshan timings appear on `/darshan` only
- Parivaar wizard Back/Next preserves values; review card and directory work
- donation, trust, contact and WhatsApp links still open
- floating Donate/WhatsApp pills appear on desktop only
- language switch (हिंदी / English / ગુજરાતી) updates nav and cards
