# Khema Mata Website

A React + Vite website for the Khemaj Mata Temple, featuring a contact form, donation section, and an admin panel backed by Supabase.

## Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/Vebvsolanki35/khema_mata_website.git
cd khema_mata_website
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in your Supabase project credentials:

```bash
cp .env.example .env
```

#### Required environment variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous/public API key |

### 3. Create Supabase tables

Run the following SQL in your Supabase SQL Editor:

```sql
-- Contact messages table
create table contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  message text,
  created_at timestamptz default now()
);

-- Donations table
create table donations (
  id uuid primary key default gen_random_uuid(),
  donor_name text not null,
  amount numeric not null,
  created_at timestamptz default now()
);
```

Enable Row Level Security and add appropriate policies as needed.

### 4. Run development server

```bash
npm run dev
```

### 5. Build for production

```bash
npm run build
```

## Configuration: contact links and media

| File | What it controls |
|---|---|
| `src/config/constants.js` | WhatsApp **group invitation** URL and the optional direct-chat number |
| `src/config/donation.js` | Bank account details, UPI IDs, payment QR verification state |
| `src/config/media.js` | Paths to images supplied by the trust (QR codes, temple photo) |
| `src/data/trustCommittee.js` | Trust committee roster and what is published |
| `src/data/translations.js` | All Hindi / English / Gujarati strings |

### WhatsApp group

`WHATSAPP_GROUP_INVITE` in `src/config/constants.js` is the single source for the
group invitation. Every "join the group" button renders through
`src/components/WhatsAppButton.jsx`, so it always opens in a new tab with
`rel="noopener noreferrer"`.

To re-enable direct 1-to-1 WhatsApp messages, put a real number in
`WHATSAPP_DIRECT_NUMBER` (digits + country code, e.g. `919876543210`). While it
is empty, direct-message buttons fall back to the group invitation.

### Adding trust photographs

1. Drop the file in `public/assets/`.
2. Set the matching key in `src/config/media.js` to `/assets/<filename>`.
3. It renders automatically — no component changes needed.

See `public/assets/README.md` for details.

### Publishing a committee member

Set `published: true` on the member in `src/data/trustCommittee.js`. Only
published members appear on the site, so unverified profiles are never shown.


## Admin Panel

Visit `/admin` in your browser. You will be redirected to `/admin/login` if not authenticated. Use Supabase Auth credentials (email + password) to log in.

The dashboard shows:
- All contact form submissions
- All donations with a running total

## Supabase Storage Setup

Run this SQL in Supabase SQL Editor to enable gallery uploads:

```sql
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'gallery');
CREATE POLICY "Public Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'gallery');
```



1. Push your code to GitHub.
2. Import the repository on [vercel.com](https://vercel.com).
3. Add your environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in the Vercel project settings.
4. Deploy — Vercel will use `vercel.json` for SPA routing rewrites automatically.

