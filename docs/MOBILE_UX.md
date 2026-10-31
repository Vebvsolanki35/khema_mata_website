# Mobile-first UX structure

This document describes the phone-first public site for the Khemaj Mata Temple
and Solanki Parivaar. It is a presentation change only — the Supabase project,
environment variables, Parivaar registration/directory, Family IDs, admin access,
donation flow and trust data are untouched.

## 1. Four navigation tabs (one per destination)

| # | Hindi label | Bottom-tab label | Route | Icon | Sub-pages |
|---|---|---|---|---|---|
| 1 | मुख्य पृष्ठ | होम | `/` | 🏠 | — (darshan + aarti timings are here) |
| 2 | मंदिर एवं विरासत | मंदिर | `/temple` | 🛕 | `/history`, `/gallery` |
| 3 | सोलंकी परिवार | परिवार | `/parivaar` | 👨‍👩‍👧‍👦 | — |
| 4 | ट्रस्ट एवं सेवा | सेवा | `/donation` | 🙏 | `/trust`, `/contact` |

- `src/data/navigation.js` is the single source of truth; `BOTTOM_TABS` is derived
  from `SECTIONS`, so the header, the fixed mobile bar and the footer cannot drift.
- The separate **दर्शन एवं आरती page was removed** — its route, its tab and its
  component are gone. The timings themselves were **not** removed: they are
  published once on the home page (`#darshan-timings`).
- The temple's "Helpful services" card grid was removed together with its
  `/facilities` page — heading, icons, descriptions and layout space are all gone.
- Active state: the current tab is gold with maroon text and `aria-current="page"`.
- There is no hamburger drawer and no "More" sheet: exactly one mobile navigation.

## 2. Removed from the public site

| Removed | Details |
|---|---|
| Yatra / यात्रा योजना (`/visit`, `/planner`) | Pages, travel/hotel/tip sections, weather widget and travel route data deleted |
| Tyohar / त्योहार calendar (`/calendar`) plus every festival block | Deleted; the festival data file is gone |
| Public reviews / श्रद्धालुओं के अनुभव | `Testimonials` component removed |
| Visitor gallery upload | Upload button, storage upload and DB insert removed; the gallery is display-only |
| Gallery stock photos | The twelve Unsplash images of Amber Fort, Hawa Mahal, Chittorgarh etc. were **deleted, not replaced** |
| "Helpful services" cards | Free Darshan, Prasad, Dharmashala, Parking, Toilets, History Book, Online Donation, First Aid, WhatsApp Service, Navratri Festival — all removed with the section |
| Darshan & Aarti page (`/darshan`) | Page, route and tab removed; timings moved to the home page |
| WhatsApp group promotion | Group link, group QR image and "join our group" wording replaced by the official **Channel** |

No database tables, rows, storage buckets, API routes or admin screens were
deleted. The `whatsapp_groups` table is simply no longer read by the public site.

## 3. Homepage

Order on a phone:

1. hero — temple name, location, one photograph, one "दर्शन एवं आरती समय" CTA that
   scrolls to the timings
2. **darshan times + aarti schedule** — two compact cards side by side on tablet/
   desktop, stacked on mobile
3. three quick actions — सोलंकी परिवार · दान करें · WhatsApp चैनल
4. important notices (only when the trust has published any)
5. a short introduction with a link to the heritage page

Nothing else: no statistics band, no facility cards, no festival grid, no reviews.

## 4. Timings (single source)

Values come from the existing translation data only — `t.darshan.morning/evening/
navratri`, `t.temple.aartis` and `t.darshanPage.*`. Nothing was invented:

- Morning darshan 5:00 AM – 12:00 PM
- Evening darshan 4:00 PM – 9:00 PM
- Navratri: sunrise – 11:00 PM
- Mangala 5:00 AM · Shringar 5:30 AM · Bhog 12:00 PM · Sandhya 7:00 PM · Shayan 9:00 PM

The trust edits these in `src/data/translations.js` (three languages).

## 5. Gallery

`/gallery` (and the inline copy on `/temple`) renders **only**:

1. `MEDIA.templeEntrance` — the original temple photograph supplied by the trust, and
2. rows in `gallery_images`, added/approved through **Admin → 🖼️ गैलरी**.

If neither exists the section shows a plain empty state ("मंदिर की फोटो शीघ्र जोड़ी
जाएंगी"). No stock or AI imagery is used anywhere.

## 6. WhatsApp

The old group (`chat.whatsapp.com/...`) is retired. `WHATSAPP_CHANNEL_URL` in
`src/config/constants.js` is the only WhatsApp destination, used by the header,
footer, floating pill, home, contact, trust and donation pages, and by
`src/components/WhatsAppChannelSection.jsx`, which renders the trust's invitation
message and a "Follow Channel" button.

## 7. Responsive behaviour

- Mobile (< 640 px): single column, fixed bottom tabs, 44 px+ tap targets, form
  inputs forced to 16 px so iOS does not zoom.
- Tablet (≥ 640 px): two-column action/timing grids.
- Desktop (≥ 1024 px): centred `max-w-*` content columns (3xl–6xl), the four-tab
  header, and the floating Donate/WhatsApp pills.
- `html, body { overflow-x: hidden; max-width: 100vw }` plus `env(safe-area-inset-bottom)`
  padding reserves room for the bottom bar so nothing overlaps the last control.

## 8. Verification

```bash
npm run lint
npm run test:parivaar
npm run test:parivaar:sql
npm run build
```

**No real browser exists in this environment**, so the 360 / 390 / 430 px pass is
a manual checklist, not a claimed measurement:

- four tabs visible with readable Hindi labels, no horizontal scrolling
- active tab highlighted; Home timings readable without zooming
- gallery shows only the trust photograph (or the empty state)
- every WhatsApp button opens the official channel
  `https://whatsapp.com/channel/0029VbDXHj74NVihUYAHIc1U`
- `/darshan` and `/facilities` no longer exist; unknown routes fall through
- language switch (हिंदी / English / ગુજરાતી) updates nav, timings and cards
