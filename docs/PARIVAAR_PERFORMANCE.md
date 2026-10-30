# Parivaar database performance & real-time synchronisation

`/parivaar` writes a family registration into the database and then shows it to
every other visitor. This document records the audit, the changes, and the
**measured** before/after results.

Nothing here changes the website design, the privacy model, the hosting plan, or
the database. No registration is deleted, rewritten, or re-created.

---

## 1. Audit — what the architecture actually is

| Layer | Reality in this project |
|---|---|
| Front end | React 19 + Vite SPA (not Next.js: there is no `next.config`, no `unstable_cache`, no `revalidatePath`) |
| Server | One Vercel Node function, `/api/parivaar` |
| Database | Supabase **PostgreSQL**, reached over HTTPS through PostgREST / the Supabase JS client. There is **no `pg` driver and no `DATABASE_URL`** in this project, so there are no raw connections to pool or leak — Supabase pools them server-side. The service-role key stays server-side only. |
| Replica | `node:sqlite` file in the function's `/tmp`, rebuilt per container from the database |
| Durable records | `site_content` rows (encrypted JSON per registration) + the authoritative `parivaar_registrations` table behind `submit_parivaar_registration` |
| Reference data | Official LGD hierarchy (36 states, 763 districts, 14,144 tehsils/blocks, 153,070 villages), bundled at build time |

### The real bottlenecks found

1. **Every registration rewrote the whole dataset.** The old store kept every
   registration in one encrypted JSON document, so a write meant read → decrypt →
   re-encrypt → upload, and it did that twice (`site_content` + Supabase
   Storage). Cost grew with the number of families and two concurrent writers
   could overwrite each other (last-writer-wins).
2. **Every registration pulled the whole dataset first**
   (`ensurePostgresHydrated(db, { force: true })`), so a write waited for a full
   download.
3. **Every cold start re-imported 167k reference rows** from CSV: 4.5–4.7 s
   measured, before the first request could be answered.
4. **Instances could disagree.** Hydration was cached on a fixed 4 s timer, so a
   warm container served data up to 4 s old and a cold one could answer `0`.
5. **No refresh on the client.** The page fetched once on mount; a second device
   saw a new family only after a manual reload.
6. **A failed API call rendered as an empty directory** (`0 families`).
7. **A failed database write was reported as success** — the old code inserted
   into the local replica, failed to persist, and still returned `201`.

---

## 2. What changed

### Write path (`server/parivaarRegistration.mjs`, `server/parivaarStore.mjs`)

1. Server-side validation first, with `{ dryRun: true }` — no writes on rejection.
2. Idempotency key per submission: a retried request resolves to the **same**
   family (unique index on `idempotency_key`).
3. PostgreSQL `submit_parivaar_registration` is the authoritative write: it
   allocates the Family ID inside the transaction (never `COUNT(*)`, never in the
   browser).
4. Only the **saved** row is mirrored into the replica and returned; the
   confirmation screen never reconstructs form values.
5. Persistence is **one small row** per registration (`parivaar_reg_v1:<id>`),
   not the whole dataset.
6. **If persistence cannot be confirmed, the local commit is rolled back** and
   the API answers `503 PERSISTENCE_FAILED`. No phantom family, no false success.

### Change propagation (`server/parivaarPostgresSync.mjs`)

* A tiny revision row (`parivaar_rev_v1`) is published **after** each commit.
  Other instances compare it (1.5 s micro-cache, single-flight) and only then
  re-sync — steady state transfers no dataset at all.
* A reconciler compares the database's own aggregate with the local replica once
  per full sync and pulls missing public families, so a committed family cannot
  stay invisible.
* Deletes use tombstones; the legacy document is read for migration and never
  modified.

### Read path (`server/parivaarApiHandler.mjs`)

* Registration-dependent responses (counts, directory, map, family listing) are
  `Cache-Control: no-store` — stale counts are impossible.
* Immutable LGD endpoints (`states`, `districts`, `subdistricts`, `villages`) are
  cached in-process and at the CDN (`s-maxage=86400, stale-while-revalidate`).
  They never change when a family registers and are never polled by the browser.
* New `action=revision` (~120 B) for cheap change detection; `map-aggregates`
  accepts a `revision` and answers `{unchanged:true}` when nothing changed.
* Database trouble is reported as `degraded: true` + `data_warning`, never as
  zeros.

### Client (`src/hooks/useParivaarData.js`, `LocationDirectory.jsx`, `Parivaar.jsx`)

* Refresh every 7 s **only while the tab is visible**, plus immediately on
  `visibilitychange`, `focus` and `online`.
* Requests are de-duplicated, responses ordered by a monotonic sequence number
  (a slow old response cannot overwrite newer state), filters are preserved, and
  a matching revision short-circuits re-rendering.
* Failures keep the last verified numbers and show a retry banner instead of an
  empty directory.
* Registration posts one request with an idempotency key.

### Cold start (`scripts/build-lgd-sqlite.mjs`, `server/parivaarDatabase.mjs`)

* `npm run build` emits `data/lgd/lgd_locations.sqlite.gz` — reference data only,
  never registrations — and a cold container restores it instead of importing
  CSVs. If the artifact is missing the CSV import is used, so nothing breaks.
* The CSV import itself was also optimised (bulk load, indexes rebuilt once).

### Indexes

SQLite: composite `(status, village_code)`, `(status, district_code)`,
`(status, subdistrict_code)`, `(status, state_code)`, `family_id` unique +
`lower(family_id)` search, `lower(full_name)`, `lower(father_name)`, and a unique
`idempotency_key`.
PostgreSQL: the same set is proposed as an additive, idempotent migration in
`supabase/migrations/20261030120000_parivaar_query_indexes.sql` (no columns, no
data changes).

---

## 3. Measurements

Harness: `npm run bench` (`scripts/bench-parivaar.mjs`). It loads the **real**
`handleParivaarApiRequest`, seeds an in-process mock of the Supabase endpoints the
code calls (PostgREST `site_content`, Storage object, `submit_parivaar_registration`,
`get_parivaar_summary_stats`, `get_public_parivaar_families`), injects a fixed
network latency per database request, and records HTTP status, latency, and the
number of database requests. "Before" is `main` at `c8f0640` running the exact
same harness; "after" is this branch.

2,000 seeded registrations · 40 ms simulated database latency · 8 iterations:

| Metric | Before | After |
|---|---|---|
| Cold start — official location data ready | 4,613.8 ms | **219.2 ms** |
| Cold start — first summary response | 203.5 ms | 467.8 ms (7 DB requests vs 2) |
| `summary` p50 / p95 | 4.1 / 4.6 ms | 3.9 / 3.9 ms |
| `directory` p50 | 7.0 ms | 7.3 ms |
| `map-aggregates` p50 | 57.2 ms | **30.7 ms** |
| `public-families` p50 | 7.2 ms | 7.7 ms |
| LGD `villages` page p50 | 1.4 ms | **0.1 ms** |
| Idle poll (browser, every 7 s) | 8.6 ms, **0 DB requests** (never checks) | 49.3 ms, 1 DB request (checks) |
| Registration p50 / p95 | 656.3 / 826.2 ms | **135.6 / 142.1 ms** |
| 5 concurrent registrations (wall) | 2,233.9 ms | **164.0 ms** |
| Database requests per registration | 6 | **3** |
| Database bytes per registration | 6,669,809 B (6.7 MB) | **2,974 B** |
| Retry of the same submission | `409 DUPLICATE_REGISTRATION` | **`201`, same Family ID** |
| New family visible on the second device | 4,907 ms | **745 ms** |
| Registration while the database is down | **`201` (reported success)** | **`503 PERSISTENCE_FAILED`** |

At 200 registrations the same harness reports registration p50 308.2 → 135.6 ms
and cold start 4,166.8 → 184.9 ms. At 2,000 registrations the old write path
moved 6.7 MB of database traffic per registration while the new one moves 3 KB,
so the gap widens as the directory grows.

**Reading the numbers honestly**

* The registration figure excludes the real PostgreSQL RPC latency (the mock adds
  40 ms). Production adds one RPC round trip (~40–120 ms), so the end-to-end
  budget stays far below the 1 s target, but the exact production number cannot
  be measured while the Supabase project is unreachable — see §5.
* Reads are deliberately *one* database request more expensive per poll than
  before, because before they were allowed to be 4 s stale — that is exactly the
  bug that made a new family invisible. The 7 s poll costs ~50 ms of server time
  and never re-fetches the 153k location records.
* The first summary after a cold start is slower (468 ms) because it now hydrates
  per-record rows and reconciles against the database aggregate instead of
  replaying one blob. Total cold-start-to-first-answer is still ~2.7× faster
  because the 4.5 s reference-data import is gone.

---

## 4. Multi-device behaviour

Verified by the harness with a **separate process** (its own SQLite replica and
its own module state):

1. Device A registers a family → `201` with the database-issued Family ID.
2. Device B polls every 500 ms like a visible browser tab.
3. B served the new family after 745 ms, and its overview total updated on the
   same request. With the shipped 7 s poll the worst case for an already-open tab
   is ~7.7 s; `focus`/`visibilitychange` refresh immediately.
4. Existing records are untouched: after every suite the production Chhapawda
   family `94494-001` (3 members) is the only record and Overview = Map =
   Directory = 1 family / 3 members.

---

## 5. Operational note (production)

While verifying the deployment, `https://khemaj-mata.vercel.app/api/parivaar?action=consistency`
reported `last_sync_error: "TypeError: fetch failed"` and the revision endpoint
reported `degraded: true`. DNS resolution for the configured Supabase host
`lgacbzfdhapmclcdsycr.supabase.co` returns **NXDOMAIN** (while `supabase.co`
itself resolves normally), i.e. the Supabase project behind the production
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` no longer exists (deleted, paused
to the point of removing DNS, or transferred).

Consequences, all verified:

* Reads keep serving the last verified data (the built-in baseline family
  `94494-001` / 3 members) with a `degraded` flag and a visible warning banner —
  never `0 registrations`.
* Registrations are refused with `503 PERSISTENCE_FAILED` and the local row is
  rolled back, so no phantom family appears anywhere.
* No data was deleted or migrated by this work. Restoring the project (or
  pointing the two environment variables at a healthy project) requires the
  owner's approval; the schema is fully described by `supabase/migrations/`.

---

## 6. Verification commands

```bash
npm run test:parivaar    # 11 suites, incl. durability + degraded-mode checks
npm run lint
npm run build            # also (re)builds the prebuilt LGD database
npm run bench -- --registrations=2000 --latency=40 --iterations=8
```
