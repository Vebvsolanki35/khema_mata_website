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

`PGRST202` is raised by **PostgREST**, not by PostgreSQL: PostgREST resolves an
RPC from a cached catalogue of the functions in the exposed schema that its
connection role may `EXECUTE`. It builds the call from the argument names it
cached, so a function that is missing, differently shaped, not granted, or not
in the cache all produce the same message.

### Confirmed cause (production, 2026-11-01)

The project's Supabase credentials were replaced by a new **Supabase
integration** (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`POSTGRES_URL`, … created 30 Oct). The app was pointed at a **fresh, empty
database** that never received the migrations in this repository. Two probes
prove it:

```
GET /api/parivaar?action=rpc-health
{"function_available":false,"code":"PGRST202","signature_mismatch":true}

GET /api/parivaar?action=consistency
"hydration": { "last_sync_source": "partial",
               "last_sync_error": "Could not find the table 'public.site_content' in the schema cache" }
```

So **no Parivaar table, no `site_content` table and no RPC** exists in the live
database. The 1 family / 3 members shown on the site come from the verified
Chhapawda record that ships in the server's own SQLite replica, not from
PostgreSQL — which is also why the numbers look healthy while registration is
impossible.

What it is **not**: the 10 named arguments in the error. Verified in a real
PostgreSQL 18 engine — the canonical 17-argument function defaults its last
seven parameters, so that exact call resolves and inserts.

### Consequence for Family IDs

Because the new database has no rows, its counter table starts empty and would
hand out `94494-001` again — the exact ID of the existing Chhapawda family. The
repair therefore reserves that ID (the counter starts at 1 for village 94494),
and the server refuses to publish a Family ID that already belongs to a
different household (`FAMILY_ID_CONFLICT`) instead of overwriting it.

## 3. The repair

`supabase/migrations/20261101090000_ensure_parivaar_rpc_available.sql` — apply it
in the Supabase SQL editor (Dashboard → SQL Editor → paste → Run).

It is **additive and idempotent**:

| Step | What it does |
| --- | --- |
| 0 | Creates the shared `trust_admins` table and `is_trust_admin()` helper if missing |
| 1 | `create table if not exists` for the LGD reference tables and `parivaar_registrations`, `village_family_id_counters`, `registration_audit_log`, `missing_location_reports`, `location_import_history` |
| 2 | `add column if not exists` for `family_id`, `father_name`, `member_count`, `public_visibility` |
| 2b | Creates `site_content` (the key/value store holding the published registration rows, the revision and the audit trail) and its RLS policies |
| 3 | Drops **only** stale overloads of `submit_parivaar_registration` whose argument list differs from the canonical one (no data is involved; a correct database hits zero rows here) |
| 3b | Reserves Family IDs already published outside this database: ensures the official LGD chain for village 94494 and seeds its counter at 1, so the next family becomes `94494-002` |
| 4 | Re-creates the five canonical RPCs — 17-argument registration, summary, public directory, missing-location report, map aggregates |
| 5 | Re-creates the RLS policies (`drop policy if exists` → `create policy`) |
| 6 | Re-publishes table privileges and `EXECUTE` to `anon` and `authenticated` |
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
asserts 13 properties, including:

* the schema builds from nothing and the migration is idempotent;
* the 17-argument call **and** the 10-argument call from the production error
  both resolve and allocate `94494-001` / `94494-002`;
* duplicate submissions are rejected without burning a Family ID;
* Family IDs stay sequential and unique across ten registrations;
* the public directory RPCs never expose phone numbers or addresses;
* re-applying the migration to a populated database preserves every row **and**
  continues the counter from where it was (no reset, no reuse);
* a stale, differently-shaped function is replaced rather than duplicated;
* `site_content` exists, its `updated_at` is maintained, and `anon` can read the
  public UPI settings but **not** the encrypted registration rows;
* the Family ID already published by the site (`94494-001`) is reserved.

`npm run test:parivaar` additionally asserts that the repair migration exists,
grants `EXECUTE`, reloads the schema cache, and contains no `drop table`,
`truncate` or `delete from public.parivaar_registrations`.

## 5b. Still missing from the new database (not part of this repair)

This repair is scoped to the Parivaar write path. The same empty database also
lacks tables that the rest of the admin dashboard uses and that were created by
hand in the previous project, not by any migration in this repository:

| Table | Used by |
| --- | --- |
| `gallery_images` | public gallery + admin gallery tab |
| `donations` | donation records |
| `announcements` | announcements tab |
| `contact_messages` | contact form inbox |
| `whatsapp_groups` | WhatsApp group links tab |

(`notices`, `volunteer_applications`, `broadcast_deliveries` and `notice_audit`
*are* covered by `supabase/migrations/20261018120000` and
`20261019090000`, which must also be applied to the new project; the `gallery`
and `notice-media` storage buckets must be re-created in the dashboard.)

Creating those five tables requires their original column definitions. That is
a separate, additive change and needs a decision from the site owner, so it is
deliberately **not** included here.

## 6. Prevention

* Apply migrations to the live project as part of release, not afterwards: the
  repository is the source of truth and production must be checked against it.
* `?action=rpc-health` is the cheap post-deploy smoke test for the write path —
  it can run from a browser, a cron job or a monitor without creating data.
* Every new migration that touches an RPC must end with
  `notify pgrst, 'reload schema'`, otherwise the API keeps using the old
  catalogue until the instance restarts.
