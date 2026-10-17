# Official WhatsApp Business integration — what is and is not built

Read this before enabling any automated sending.

## Current state

| Capability | Status |
|---|---|
| Website publication | ✅ Working (needs the migration in `supabase/migrations`) |
| WhatsApp **share** link | ✅ Working — no credentials required |
| Official WhatsApp Business **automated** sending | ⚠️ **Wired but disabled.** No credentials exist, nothing is sent, nothing is claimed as sent. |

The admin UI shows the WhatsApp Business channel as **“not configured”** until
`VITE_WHATSAPP_BUSINESS_ENABLED=true` is set. When disabled, choosing that
channel records a `skipped` delivery row — it never records a send.

## Why it is disabled by default

Automated WhatsApp sending is not a code problem, it is a **compliance and
account** problem. It cannot work until all of the following exist, and faking
any part of it would break Meta’s rules and risk the Trust’s number.

---

## 1. Meta Business configuration required

1. **Meta Business Manager account** — `business.facebook.com`. The Trust needs
   one, owned by a named person, not a personal ad account.
2. **Business verification** — Meta must verify the organisation (legal name,
   address, phone, and usually a document such as a trust deed or registration
   certificate). Unverified businesses are capped at a handful of test
   recipients.
3. **WhatsApp Business Account (WABA)** created inside that Business Manager.
4. **A dedicated phone number** registered to the WABA. It must not already be
   in use on personal WhatsApp or another WABA. This is separate from the
   existing WhatsApp **group invite link**, which stays as it is.
5. **Display name approval** — Meta reviews the name shown to recipients.

## 2. Credentials (server-side only — never in the browser)

These belong in the **Edge Function’s** environment (Supabase Dashboard →
Project Settings → Edge Functions → Secrets). They must never be committed or
placed in `VITE_*` variables, because `VITE_*` values are compiled into the
public JavaScript bundle.

| Secret | Purpose |
|---|---|
| `WHATSAPP_ACCESS_TOKEN` | System-user token with `whatsapp_business_messaging` |
| `WHATSAPP_PHONE_NUMBER_ID` | Numeric ID of the registered sending number |
| `WHATSAPP_WABA_ID` | WhatsApp Business Account ID |
| `WHATSAPP_APP_SECRET` | Verifies inbound webhook signatures |
| `WHATSAPP_VERIFY_TOKEN` | You choose this; used for webhook handshake |

Create a **system user** in Business Manager with the minimum permissions and
generate a permanent token. Do not use a personal user token — it expires.

## 3. Message templates and approval

Outside a 24-hour customer-service window you may only send **approved
templates**. Free-form text is rejected.

- Create templates in WhatsApp Manager.
- Category: `UTILITY` is appropriate for darshan timings, closures and notices.
  `MARKETING` has stricter rules and opt-in; avoid it for temple notices.
- Templates are **language-specific** — you need one per language
  (`hi`, `en`, `gu`).
- Each template gets an ID and must show **Approved** before use.
- Variables (e.g. `{{1}}` for the notice title) are filled at send time.

Meta reviews templates, usually within a day, and may reject vague ones.

## 4. Recipient consent — mandatory

You may only message people who have **opted in** to receive WhatsApp notices
from the Trust. Before enabling:

- Collect explicit consent (a checkbox on the volunteer form or a dedicated
  “receive temple updates on WhatsApp” opt-in), recorded with a timestamp.
- Store consent in a table (suggested: `whatsapp_subscribers` with
  `phone_e164`, `language`, `consented_at`, `consent_source`, `unsubscribed_at`).
- Honour STOP immediately, and provide an unsubscribe route in every message.
- **Never** import the existing WhatsApp **group** membership as a broadcast
  list. Being in a group is not consent to receive direct broadcasts.

If you want, I can add `whatsapp_subscribers` plus a consent checkbox in a
follow-up — I have deliberately not built it yet, because the wording and
placement of a consent notice should be your decision.

## 5. Hosting: Supabase Edge Function

Sending happens in `supabase/functions/broadcast-whatsapp/`:

- Reads the notice, selects opted-in subscribers for the notice’s language.
- Calls Meta’s Cloud API `/v21.0/<PHONE_NUMBER_ID>/messages`.
- Writes one `broadcast_deliveries` row per recipient with the status the API
  returns.
- Returns a summary. The client records **only** what the function reports.

Deploy with:
```bash
supabase secrets set WHATSAPP_ACCESS_TOKEN=... WHATSAPP_PHONE_NUMBER_ID=... \
  WHATSAPP_WABA_ID=... WHATSAPP_APP_SECRET=... WHATSAPP_VERIFY_TOKEN=...
supabase functions deploy broadcast-whatsapp
```

Then set `VITE_WHATSAPP_BUSINESS_ENABLED=true` in Vercel.

## 6. Delivery status webhook — how truth is established

Meta posts `sent` → `delivered` → `read` (and `failed`) callbacks. A second
webhook (e.g. `supabase/functions/whatsapp-webhook`) should:

1. Verify the `X-Hub-Signature-256` header with `WHATSAPP_APP_SECRET`.
2. Update `broadcast_deliveries` by `provider_message_id`.
3. Only ever write statuses Meta actually reported.

**Until that webhook is live, the only statuses that can honestly appear are
`sent` (provider accepted) and `failed`. `delivered` must wait for the
callback.** The code in this repo already refuses to invent a status.

## 7. What this project will *not* do

- No unofficial WhatsApp automation, headless browsers or personal-account bots.
- No scraping of group membership or contact lists.
- No messaging anyone without recorded opt-in.
- No marking a message as sent or delivered because a link was opened.
- No credentials in client-side code.

## 8. Retry semantics

`broadcast_deliveries` has a unique index on
`(notice_id, channel, recipient_ref)`. A retry **updates** the existing failed
row and increments `attempts`; it cannot create a duplicate send. Rows already
at `sent` or `delivered` are never re-sent.

---

## Summary — to go live

1. Verify the Trust in Meta Business Manager; create a WABA and register a
   dedicated number.
2. Create and get approval for `UTILITY` templates in hi / en / gu.
3. Build the consent opt-in and `whatsapp_subscribers`.
4. Put the five secrets in Supabase Edge Function secrets.
5. Deploy `broadcast-whatsapp` and the status webhook.
6. Set `VITE_WHATSAPP_BUSINESS_ENABLED=true` in Vercel.
7. Send a test to a single opted-in number before any wider send.
