# Admin console — verified access notes

Everything below was read from this repository. Nothing here is a credential, and
no account or password is stored in the code.

## 1. What `/admin/login` is for

`/admin/login` is the Temple Trust's private console for the small amount of
content that is not edited in code:

- contact messages submitted from the Contact page,
- donation records shown on the Donation page,
- announcements and broadcast notices,
- the public photo gallery,
- the two UPI IDs printed on the Donation page,
- volunteer / seva applications,
- the Solanki Parivaar directory (search, corrections, exports).

It is **not** a public feature: the route renders no public navbar, ticker,
footer, bottom navigation or floating buttons.

## 2. How login works (actual implementation)

| Layer | File | Behaviour |
|---|---|---|
| Login form | `src/pages/Admin.jsx` (`AdminLogin`) | Email + password → `supabase.auth.signInWithPassword({ email, password })` |
| Route guard | `src/components/ProtectedRoute.jsx` | `supabase.auth.getSession()`; while resolving it shows a spinner, with no session it redirects to `/admin/login` |
| Session state | `src/pages/Admin.jsx` (`Admin`) | Same session check; renders `AdminLogin` when there is no session and `AdminDashboard` when there is |
| Auth provider | Supabase Auth (email + password) | Configured through `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in `src/lib/supabase.js` |

So authentication is **Supabase Auth**, not a hard-coded username/password.

## 3. What the dashboard can actually do

Tabs are defined in `TABS` inside `src/pages/Admin.jsx`; each renders one
component:

| Tab | Component | Table / action |
|---|---|---|
| 📩 संदेश | `TabMessages` | Lists `contact_messages` (read-only) |
| 💰 दान | `TabDonations` | Lists `donations` + total (read-only) |
| 📢 घोषणाएं | `TabAnnouncements` | Insert / list / delete `announcements` |
| 💬 WhatsApp चैनल | `TabWhatsApp` | Old per-topic link editor for `whatsapp_groups`; the public site no longer reads this table — it shows the single official channel from `src/config/constants.js` |
| 🖼️ गैलरी | `TabGallery` | Insert (`image_url`, `title`) / list / delete `gallery_images` — this is how the trust approves photos for the public gallery |
| ⚙️ सामग्री | `TabContent` | Edit `upi_id_1`, `upi_id_2` in `site_content` |
| 📻 प्रसारण केंद्र | `BroadcastCenter` | Full notice workflow: drafts, schedule, publish, archive, expiry, media upload to the `notice-media` bucket, delivery log, WhatsApp share |
| 🙋 सेवा आवेदन | `TabVolunteers` | Read / update volunteer applications, contact details |
| 👨‍👩‍👧‍👦 परिवार निर्देशिका | `TabParivaar` | Search, inspect, correct and export Parivaar registrations |

Logout is `supabase.auth.signOut()`.

## 4. Where authorised admins are stored

Two independent things must both be true:

1. **An account** in `auth.users` (Supabase Auth) — this is what the login form
   authenticates against.
2. **A row in `public.trust_admins`** — the allowlist used by Postgres RLS
   (`public.is_trust_admin()`, defined in
   `supabase/migrations/20261018120000_temple_notices_and_volunteers.sql`).

Policies that use it (all in `supabase/migrations/`):

- `notices`, `notice_audit`, `notice_media`, `broadcast_deliveries`
  (`20261018120000_…`, `20261019090000_…`)
- `volunteer_applications` (read/update/delete)
- `site_content` (`site_content_admin_all`, `20261101090000_…`)

`trust_admins` has no insert/update/delete policy on purpose: rows are managed
with SQL or a service-role key, never from the browser.

## 5. Creating or resetting an authorised admin (no secrets in the repo)

1. **Supabase Dashboard → Authentication → Users** — add the person's email
   (invite, or create with a password the person sets themselves), or use
   "Reset password" for an existing account. Never paste the password into this
   repository, a commit, a screenshot, or a chat.
2. Copy that user's UUID and, in the **SQL editor**, run:

   ```sql
   insert into public.trust_admins (user_id, email, note)
   select id, email, 'Temple office'
   from auth.users
   where email = '<the admin email>'
   on conflict (user_id) do update set is_active = true;
   ```

3. To revoke access: `update public.trust_admins set is_active = false where email = '<email>';`
   (or delete the row, and disable the user in Authentication → Users).

Do not create accounts from the browser app: the site has no sign-up UI, and
`trust_admins` deliberately cannot be written with the anon key.

## 6. Known gaps (verified, not fixed here)

- **The UI gate is session-only.** `ProtectedRoute` and `Admin` check that a
  session exists, not that the user is a trust admin. If public sign-ups are
  enabled in Supabase, any self-registered user could open the dashboard shell;
  the data itself is still protected only by RLS. Recommended: disable public
  sign-ups (Authentication → Providers → Email → "Allow new users to sign up"
  off), and/or gate the console on the `is_trust_admin()` RPC.
- **Legacy tables have no policies in this repo.** `contact_messages`,
  `donations`, `announcements`, `gallery_images` and `whatsapp_groups` are
  created outside these migrations, so their RLS could not be verified from the
  code. Check them in Supabase → Table editor → RLS; each should grant access
  only to `authenticated` users that pass `is_trust_admin()`.
- The "WhatsApp चैनल" admin tab edits `whatsapp_groups`, which the public site no
  longer renders. The official channel is a code constant, so the tab is
  informational only at the moment.
