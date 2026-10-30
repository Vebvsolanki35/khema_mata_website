# Parivaar Database Performance & Real-Time Synchronisation

This document records the database architecture audit, the bottlenecks that were
found, what was changed, and the **measured** before/after results for the
`/parivaar` route of the Khema Mata temple website.

Everything here is additive: no existing registration was modified or deleted,
no table was dropped or recreated, no environment variable was changed, and the
website design and privacy rules are untouched.

---

## 1. The database architecture (as audited, before any change)

| Layer | Reality on this project |
|---|---|
| Hosting | Vercel (Vite static build + one Node serverless function at `/api/parivaar`) |
| Front end | React 19 + Vite SPA (not Next.js — there is no `next.config`, `revalidatePath` or `unstable_cache` in this codebase) |
| Database | Supabase PostgreSQL, reached **only** through PostgREST (`@supabase/supabase-js`, HTTPS). There is no `pg` socket client, no `DATABASE_URL`, and no Neon project. Connection pooling is provided by Supabase (PgBouncer) in front of PostgREST, so there is no per-query TCP connection to open or leak. |
| Server-side cache | A SQLite replica (`node:sqlite`) inside `/tmp` of each serverless instance |
| Persistence of community data | An encrypted JSON document in `public.site_content` (`parivaar_pg_store_v1`) **plus** a duplicate copy in Supabase Storage (`gallery/_system/parivaar_pg_store_v1.json`) |
| Authoritative registration write | `public.submit_parivaar_registration(...)` RPC (transactional, allocates `family_id` from `village_family_id_counters`) |
| Public read RPCs | `get_parivaar_summary_stats()`, `get_public_parivaar_families(...)`, `get_parivaar_map_aggregates(...)` |
| Caching headers | Every API response was `Cache-Control: no-store` |

### What was actually slow

1. **Every registration rewrote the entire dataset — twice.**
   `syncDatabaseStateToPostgres()` read *all* registrations, encrypted each
   personal field, serialised one JSON document, and uploaded it to
   `site_content` **and** Supabase Storage. At 2,000 families that is
   **~3.4 MB of database traffic per registration** (measured), growing linearly
   forever, with two writes that can clobber a concurrent registration
   (last-writer-wins).
2. **Every registration first forced a full hydration**
   (`ensurePostgresHydrated(db, { force: true })`): a download + decrypt of the
   whole dataset *before* the insert.
3. **Every cold start re-imported the LGD reference data.** `getParivaarDb()`
   parsed ~5 MB of CSV and inserted 167,113 rows into SQLite on each new
   container — **4,700 ms measured**, before the first request could be served.
4. **All serverless instances could diverge.** Hydration was cached for a fixed
   4 s TTL, so a warm instance served data up to 4 s old while a cold instance
   could return `0` (the previously fixed "family saved but not displayed" bug).
5. **No client refresh at all.** The page fetched once on mount; another device
   with the page open never saw a new registration until a manual reload.
6. **An API failure was rendered as an empty directory** (`setRows([])`,
   `setTotalCount(0)`, `setStats(EMPTY_STATS)`).
7. **`map-aggregates` computed everything twice** (snapshot + a full
   consistency re-check in the same request).

---

## 2. What changed

### Write path (`server/parivaarRegistration.mjs`, `server/parivaarStore.mjs`)

1. Server-side validation runs first, with **no writes** (`{ dryRun: true }`).
2. An idempotency key (unique per submission attempt) makes a retry resolve to
   the same family; a unique index enforces it.
3. PostgreSQL `submit_parivaar_registration` is the authoritative write. It
   allocates the Family ID inside the transaction (never `COUNT(*)`, never in the
   browser) and returns the saved row.
4. Only the **saved** row is mirrored into the replica and returned to the client
   — the confirmation screen no longer reconstructs submitted form values.
5. Persistence of that family is now **one small row**
   (`site_content.key = 'parivaar_reg_v1:<id>'`) instead of the whole dataset.
6. If the database cannot confirm the write, the API returns an error
   (`PERSISTENCE_FAILED`, HTTP 503) instead of a success screen.

### Change propagation (`server/parivaarPostgresSync.mjs`)

* A single tiny `parivaar_rev_v1` row is written **after** each committed
  record. Instances compare it (micro-cached 2 s, single-flight) and only then
  re-sync, so steady-state reads transfer no dataset at all.
* A self-healing reconciler compares the database's own aggregate
  (`get_parivaar_summary_stats`) with the local replica once per full sync and
  pulls any missing public family, so a committed family can never stay invisible.
* Deletes use tombstones (`parivaar_del_v1:<id>`); the legacy document is still
  read once to migrate existing production records, and is never modified.

### Read path (`server/parivaarApiHandler.mjs`)

* `Cache-Control: no-store` for every registration-dependent response (counts,
  directory, map, family listings) — stale counts are impossible.
* Immutable official LGD endpoints (`states`, `districts`, `subdistricts`,
  `villages`) are cached in-process and at the CDN
  (`public, max-age=300, s-maxage=86400, stale-while-revalidate=86400`). They
  never change when a family registers, and are never polled by the browser.
* `map-aggregates` builds overview + map + family data from **one** replica read
  and a matching `revision` parameter short-circuits the whole payload.
* New `action=revision` endpoint: ~120 bytes, for cheap change detection.
* Database problems are reported as `degraded: true` + `data_warning`, never as
  zeros.

### Client (`src/hooks/useParivaarData.js`, `LocationDirectory.jsx`, `Parivaar.jsx`)

* Refresh every 7 s **only while the tab is visible**, immediately on
  `visibilitychange`, `focus`, and `online`.
* Requests are de-duplicated, responses are ordered by a monotonic sequence
  number (a slow old response can never overwrite newer state), and the
  `revision` token stops needless re-renders.
* Failures keep the last verified numbers, show an explicit message + retry, and
  never clear the directory.
* Registration sends one request (the duplicate browser-side RPC call was
  removed) with an idempotency key.

### Indexes

SQLite (`server/parivaarDatabase.mjs`) and PostgreSQL
(`supabase/migrations/20261030120000_parivaar_query_indexes.sql`, additive):
`(status, village_code)`, `(status, district_code)`, `(status, subdistrict_code)`,
`(status, state_code)`, `(family_id asc, created_at desc)`, approved-village
covering index, and a unique idempotency index.

### Cold start (`server/parivaarDatabase.mjs`, `scripts/build-lgd-sqlite.mjs`)

* The LGD CSV import now bulk-loads without per-row index maintenance, journal
  flushing, or foreign-key probes, then rebuilds the indexes once:
  **4,737 ms → 1,569 ms**.
* `npm run build` additionally produces a gzipped, registration-free LGD
  database (`data/lgd/lgd_locations.sqlite.gz`, 11 MB) that a cold container
  restores instead of importing: **~160 ms restore**. If the artifact is missing
  the old CSV import is used, so nothing breaks.

---

## 3. Measured results

Harness: `scripts/bench-parivaar.mjs` (`npm run bench`). It starts the **real**
API handler in two separate processes (two "devices"/serverless instances), each
with its own SQLite replica, in front of an in-process mock of PostgREST/RPC/
Storage with **40 ms of simulated network latency per database request**.
Both the legacy single-document store and the new per-record rows are pre-seeded,
so the two architectures are compared like-for-like. The database is a
throw-away SQLite file in `.cache/bench`; production data is never touched.

2,000 registered families, 10 iterations, 40 ms simulated database latency:

| Metric | Before | After | Change |
|---|---|---|---|
| Cold start (LGD import + first hydration) | 6,964 ms | **819 ms** | **8.5× faster** |
| Registration API p50 | 764.5 ms | **141.4 ms** | **5.2× faster** |
| Registration API p95 | 919.7 ms | **195.5 ms** | **4.6× faster** |
| 5 concurrent registrations (wall clock) | 2,238.6 ms | **187.7 ms** | **13× faster** |
| Database requests per registration | 6 | **3.13** | −48% |
| Database bytes written per registration | 3,399,251 B (3.4 MB) | **2,601 B** | **~1,300× less** |
| Overview (`summary`) p50 / p95 | 6 / 207.1 ms | 50.8 / 55.6 ms | p95 **3.7× better**, now always fresh |
| Directory p50 / p95 | 37.6 / 49.3 ms | 68.1 / 76.7 ms | +1 revision round trip (see note) |
| Map + overview + families p50 / p95 | 71.9 / 120.4 ms | 84.1 / 121.5 ms | +1 revision round trip |
| Public family listing p50 / p95 | 5 / 6.8 ms | 50.2 / 54.1 ms | +1 revision round trip |
| New family visible on the second device (server-side) | 440 ms | 440 ms | same, **but the old page never re-polled** |
| Worst case for an already-open device (7 s poll) | never (no polling) | **≤ 7.4 s** | requirement met |

**Note on read latency.** Before, most reads answered from a replica that could
be up to 4 seconds stale — that is exactly what produced the "0 families" bug.
Reads now verify a 1-row revision token first, which costs one database round
trip (40 ms here) and guarantees every section reads the same committed data.
Every measured value stays far below the 500 ms p95 target.

Measured at 600 families as well (`--registrations=600`), with the same
conclusion: registration p50 289 ms → 135 ms, 173 KB → 1.8 KB written per
registration, cold start 4,599 ms → ~1,060 ms, cross-device visibility 143 ms
server-side / ≤ 7.1 s worst case with polling.

### Multi-device test (two separate processes, real HTTP)

1. Instance A registers a family → 201 with the database-issued Family ID.
2. Instance B (independent process, independent replica) polled every 200 ms.
3. B served the new family **380 ms** later via
   `action=public-families&q=<family_id>`; its overview total updated on the
   same request. With the shipped 7 s client poll the worst case is ≈ 7.4 s.
4. Existing registrations were unchanged: the suite re-verifies that the
   production Chhapawda family `94494-001` (3 members) is still the only record
   after every test, and that Overview = Map = Directory = 1 family / 3 members.

---

## 4. Verification

* `npm run test:parivaar` — 10 suites, including the new suite 10
  (dry-run validation, idempotent submissions, database-issued Family IDs,
  revision endpoint contract, degraded-mode safety, cache headers, indexes).
* `npm run lint`, `npm run build` — clean.
* Live production checks are run against `https://khemaj-mata.vercel.app/api/parivaar`
  after each deploy (`action=consistency`, `action=revision`, `action=directory`
  and `action=public-families` for village `94494`).

## 5. Deliberate limits

* No paid service was added. No realtime websocket service was introduced: the
  requirement's own ordering ("first reliable server-backed updates and automatic
  refresh") is implemented with revision polling, which needs no new vendor and
  no private data in notifications.
* `SUPABASE_SERVICE_ROLE_KEY` is **not** configured in production, so personal
  fields stay protected by the existing encrypted replica + RLS design; nothing
  in this change alters the privacy model.
* The PostgreSQL index migration is additive and must be applied once through the
  existing Supabase migration workflow. The application works without it (the
  indexes are a query-plan optimisation).
