# Parivaar registration RPC — outage analysis and repair

**Incident:** every Parivaar registration submitted through the site failed with

```
Could not find the function public.submit_parivaar_registration(
  p_consent_given, p_current_address, p_district_code, p_full_name,
  p_phone_number, p_state_code, p_subdistrict_code, p_thikana,
  p_thikana_same_as_village, p_village_code) in the schema cache
```

Reading and statistics kept working (1 family / 3 members), so only the write
path was broken.

---

## 1. How a registration is written

```
src/components/parivaar/ (form)
  └── src/hooks/useParivaarData.js:653        POST /api/parivaar?action=register
        └── server/parivaarApiHandler.mjs     routes the action
              └── server/parivaarRegistration.mjs
                    ├── validate + normalise      (phone, member count, LGD village)
                    ├── idempotency replay        (SQLite replica)
                    └── supabase.rpc("submit_parivaar_registration", params)
                          └── PostgREST  POST /rest/v1/rpc/submit_parivaar_registration
                                └── public.submit_parivaar_registration(...)  (SECURITY DEFINER)
```

The browser never calls Supabase for registration, and the Family ID is never
generated in the client: `public.submit_parivaar_registration` allocates it from
`public.village_family_id_counters` with a single atomic
`insert … on conflict … set last_seq = last_seq + 1`.

## 2. Why it failed

`PGRST202` is raised by **PostgREST**, not by PostgreSQL. PostgREST resolves an
RPC from a cached catalogue of the functions in the exposed schema that its
connection role is permitted to `EXECUTE`. It builds the SQL call from the
argument names it cached. If any of those three things is out of date, the answer
is the same: *“could not find the function … in the schema cache”*.

Three candidate causes, all indistinguishable from the error text alone:

1. **The function was never created** in the live project — the migrations in
   `supabase/migrations/` are applied by hand (there is no `supabase/config.toml`
   and no linked CLI), so `20261026100000` and/or `20261030100000` may never
   have been run there.
2. **A stale definition is still in place** — e.g. an older signature that does
   not accept `p_thikana_same_as_village` / `p_consent_given` by name, or a
   renamed parameter. PostgreSQL rejects such a call with `42883`, and PostgREST
   may report it as "not found".
3. **The function exists but the API cannot see it** — missing `EXECUTE` for
   `anon`/`authenticated`, or a stale schema cache after the last migration.

The server already retries once with the 10-argument legacy parameter set
(`buildLegacyRpcParams`). Both attempts failed, which rules out "the modern
arguments are the only problem" and points at the function being absent,
differently shaped, or invisible.

What is **not** the cause, verified in a real PostgreSQL engine (see §5): the
10-named-argument call against the 17-argument function. The last seven
parameters have defaults, so PostgreSQL resolves it happily. The deployed
database therefore does not match the migrations in this repository.

## 3. The repair

`supabase/migrations/20261101090000_ensure_parivaar_rpc_available.sql` — apply it
in the Supabase SQL editor (Dashboard → SQL Editor → paste → Run).

It is **additive and idempotent**:

| Step | What it does |
| --- | --- |
| 0 | Creates the shared `trust_admins` table and `is_trust_admin()` helper if missing |
| 1 | `create table if not exists` for the LGD reference tables and `parivaar_registrations`, `village_family_id_counters`, `registration_audit_log`, `missing_location_reports`, `location_import_history` |
| 2 | `add column if not exists` for `family_id`, `father_name`, `member_count`, `public_visibility` |
| 3 | Drops **only** stale overloads of `submit_parivaar_registration` whose argument list differs from the canonical one (no data is involved; a correct database hits zero rows here) |
| 4 | Re-creates the five canonical RPCs — 17-argument registration, summary, public directory, missing-location report, map aggregates |
| 5 | Re-creates the RLS policies (`drop policy if exists` → `create policy`) |
| 6 | Re-publishes `EXECUTE` to `anon` and `authenticated` |
| 7 | `notify pgrst, 'reload schema'` — makes the function visible without a restart |
| 8 | Self-check: raises an exception (rolling everything back) unless the canonical 17-argument function exists and both API roles can execute it |

Guarantees, explicitly:

* no table is dropped, truncated or recreated;
* no row is deleted or rewritten — existing registrations, their Family IDs and
  the per-village counters are untouched (asserted by the test suite);
* no environment variable, key or hosting setting changes;
* safe to run twice, and safe to run on a healthy database.

### Why no second 10-argument SQL function

Adding a 10-argument overload next to the 17-argument one makes a named-argument
call ambiguous (`42725 function … is not unique`), because PostgreSQL cannot
decide which candidate the defaults should fill. The legacy shape stays where it
belongs: in the server's fallback call (`buildLegacyRpcParams`).

## 4. Deploying and verifying

1. Run the migration in the Supabase SQL editor. Expect
   `submit_parivaar_registration is available to the API (…)` in the notices.
2. Re-check the API:

   ```
   GET /api/parivaar?action=rpc-health
   → 200 { "ok": true, "function_available": true, "probe_code": "INVALID_NAME" }
   → 503 { "ok": false, "function_available": false, "code": "PGRST202" }   (still broken)
   ```

   The probe sends an empty name and empty location, so the RPC stops at its
   first validation branch: nothing is written, no personal data is sent or
   returned.

3. Submit **one** real test registration through the UI (a clearly-labelled
   record, e.g. `TEST_VERIFICATION_…`), confirm the Family ID, then confirm the
   totals move by exactly one family and the expected number of members:

   ```
   GET /api/parivaar?action=summary
   GET /api/parivaar?action=consistency
   GET /api/parivaar?action=public-families&state_code=8&district_code=94&subdistrict_code=6033&village_code=94494
   ```

4. Delete the test record through the admin screen when done (the counter is
   intentionally *not* rewound: Family IDs are never reused).

## 5. Test coverage added

`npm run test:parivaar:sql` executes the migration file itself against a real
PostgreSQL 18 engine (PGlite/WebAssembly, in-memory, discarded on exit) and
asserts 11 properties, including:

* the schema builds from nothing and the migration is idempotent;
* the 17-argument call **and** the 10-argument call from the production error
  both resolve and allocate `94494-001` / `94494-002`;
* duplicate submissions are rejected without burning a Family ID;
* Family IDs stay sequential and unique across ten registrations;
* the public directory RPCs never expose phone numbers or addresses;
* re-applying the migration to a populated database preserves every row **and**
  continues the counter from where it was (no reset, no reuse);
* a stale, differently-shaped function is replaced rather than duplicated.

`npm run test:parivaar` additionally asserts that the repair migration exists,
grants `EXECUTE`, reloads the schema cache, and contains no `drop table`,
`truncate` or `delete from public.parivaar_registrations`.

## 6. Prevention

* Apply migrations to the live project as part of release, not afterwards: the
  repository is the source of truth and production must be checked against it.
* `?action=rpc-health` is the cheap post-deploy smoke test for the write path —
  it can run from a browser, a cron job or a monitor without creating data.
* Every new migration that touches an RPC must end with
  `notify pgrst, 'reload schema'`, otherwise the API keeps using the old
  catalogue until the instance restarts.
