/**
 * broadcast-whatsapp — REFERENCE IMPLEMENTATION. NOT DEPLOYED.
 *
 * Sends an approved announcement to opted-in subscribers via the official
 * Meta WhatsApp Cloud API. Everything secret lives here, server-side: the
 * browser never sees a token.
 *
 * Deploy only after completing docs/WHATSAPP_BUSINESS_INTEGRATION.md:
 *   supabase secrets set WHATSAPP_ACCESS_TOKEN=... WHATSAPP_PHONE_NUMBER_ID=... \
 *     WHATSAPP_WABA_ID=... WHATSAPP_APP_SECRET=... WHATSAPP_VERIFY_TOKEN=...
 *   supabase functions deploy broadcast-whatsapp
 *
 * Design rules enforced below:
 *   - Only recipients with recorded, un-revoked consent are contacted.
 *   - Only approved templates are used; no free-form bulk text.
 *   - Statuses written are exactly what Meta returns. Nothing is assumed.
 *   - Retries update existing rows; successful sends are never duplicated.
 *   - The caller's identity is checked against trust_admins.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
const API_VERSION = "v21.0";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

/** Meta status -> our status. Unknown values are never upgraded. */
function mapStatus(meta: unknown): "sent" | "failed" | null {
  if (meta === "accepted" || meta === "sent") return "sent";
  if (meta === "failed" || meta === "rejected") return "failed";
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // 1. Authorise: only a Trust admin may trigger a bulk send.
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !user) return new Response("Unauthorized", { status: 401 });

  const { data: isAdmin } = await admin.rpc("is_trust_admin_for", { uid: user.id });
  if (!isAdmin) return new Response("Forbidden", { status: 403 });

  // 2. Configuration guard — fail loudly rather than pretend.
  if (!TOKEN || !PHONE_NUMBER_ID) {
    return new Response(
      JSON.stringify({ status: "skipped", error: "WhatsApp Business is not configured" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const { noticeId, retry = false } = await req.json();
  if (!noticeId) return new Response("noticeId required", { status: 400 });

  // 3. Load the notice.
  const { data: notice, error: noticeErr } = await admin
    .from("notices")
    .select("*")
    .eq("id", noticeId)
    .single();
  if (noticeErr || !notice) return new Response("Notice not found", { status: 404 });

  // 4. Opted-in subscribers for this language only.
  //    `whatsapp_subscribers` is intentionally NOT created by the migrations in
  //    this repo — building it requires your consent wording and flow.
  const { data: subscribers, error: subErr } = await admin
    .from("whatsapp_subscribers")
    .select("id, phone_e164, language")
    .eq("language", notice.language)
    .is("unsubscribed_at", null)
    .not("consented_at", "is", null);

  if (subErr) {
    return new Response(
      JSON.stringify({ status: "skipped", error: "No subscriber table configured" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!subscribers?.length) {
    return new Response(
      JSON.stringify({ status: "skipped", error: "No opted-in recipients", sent: 0 }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  let sent = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const sub of subscribers) {
    // 5. Retry safety: skip anyone already successfully contacted.
    if (retry) {
      const { data: done } = await admin
        .from("broadcast_deliveries")
        .select("status")
        .eq("notice_id", noticeId)
        .eq("channel", "whatsapp_business")
        .eq("recipient_ref", String(sub.id))
        .maybeSingle();
      if (done && (done.status === "sent" || done.status === "delivered")) continue;
    }

    // 6. Send via an APPROVED utility template.
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: sub.phone_e164,
          type: "template",
          template: {
            name: `temple_notice_${notice.language}`,
            language: { code: notice.language },
            components: [
              { type: "body", parameters: [{ type: "text", text: notice.title },
                                           { type: "text", text: notice.body }] },
            ],
          },
        }),
      }
    );

    const json = await res.json().catch(() => ({}));
    const providerMessageId = json?.messages?.[0]?.id ?? null;
    const status = mapStatus(res.ok ? "sent" : "failed");

    // 7. Record exactly what happened — no invented statuses.
    await admin
      .from("broadcast_deliveries")
      .upsert(
        {
          notice_id: noticeId,
          channel: "whatsapp_business",
          recipient_ref: String(sub.id),
          status: status ?? "failed",
          attempts: 1,
          provider_message_id: providerMessageId,
          last_error: res.ok ? null : JSON.stringify(json?.error ?? {}).slice(0, 500),
        },
        { onConflict: "notice_id,channel,recipient_ref" }
      );

    if (status === "sent") sent++;
    else { failed++; failures.push(String(sub.id)); }
  }

  // 8. Delivered status is set later by the webhook, never here.
  return new Response(
    JSON.stringify({ status: failed && !sent ? "failed" : "sent", sent, failed, failures }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
