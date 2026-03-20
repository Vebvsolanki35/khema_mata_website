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

## Admin Panel

Visit `/admin` in your browser. You will be redirected to `/admin/login` if not authenticated. Use Supabase Auth credentials (email + password) to log in.

The dashboard shows:
- All contact form submissions
- All donations with a running total

## Deploy to Vercel

1. Push your code to GitHub.
2. Import the repository on [vercel.com](https://vercel.com).
3. Add your environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in the Vercel project settings.
4. Deploy — Vercel will use `vercel.json` for SPA routing rewrites automatically.

