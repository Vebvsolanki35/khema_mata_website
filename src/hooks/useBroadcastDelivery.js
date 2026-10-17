import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Records and reads broadcast channel status.
 *
 * STRICT RULE: a row is only ever written with 'sent' or 'delivered' when the
 * outcome is genuinely confirmed.
 *   - website          -> 'delivered' is legitimate: the notice row exists and
 *                         the public feed serves it, which is verifiable.
 *   - whatsapp_share   -> only ever 'link_opened'. Opening a link prefills a
 *                         message; the admin still has to send it in WhatsApp.
 *                         We do not know whether they did, so we must not claim
 *                         it was sent.
 *   - whatsapp_business-> only 'sent'/'delivered' from a confirmed provider
 *                         response or webhook. The client never sets these.
 *
 * Retries update the existing row and bump `attempts`; the unique index on
 * (notice_id, channel, recipient_ref) makes duplicating a successful send
 * impossible.
 */

const CHANNELS = ["website", "whatsapp_share", "whatsapp_business"];

/** Statuses that are safe to retry. Successful ones are never re-sent. */
const RETRYABLE = ["pending", "failed", "skipped"];

export function canRetry(row) {
  return RETRYABLE.includes(row?.status);
}

export function useBroadcastDelivery() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  /** Insert-or-update one (notice, channel) row. */
  const record = useCallback(async (noticeId, channel, status, extra = {}) => {
    if (!CHANNELS.includes(channel)) throw new Error(`unknown channel ${channel}`);
    setSaving(true);
    setError(null);

    const { data: existing } = await supabase
      .from("broadcast_deliveries")
      .select("id, attempts")
      .eq("notice_id", noticeId)
      .eq("channel", channel)
      .eq("recipient_ref", "public")
      .maybeSingle();

    let err;
    if (existing?.id) {
      ({ error: err } = await supabase
        .from("broadcast_deliveries")
        .update({ status, attempts: (existing.attempts || 0) + 1, ...extra })
        .eq("id", existing.id));
    } else {
      ({ error: err } = await supabase.from("broadcast_deliveries").insert([{
        notice_id: noticeId,
        channel,
        recipient_ref: "public",
        status,
        attempts: 1,
        ...extra,
      }]));
    }

    setSaving(false);
    if (err) {
      setError(err.message);
      return { ok: false, error: err };
    }
    return { ok: true };
  }, []);

  /** Website publication is directly verifiable, so it may be marked delivered. */
  const markWebsiteDelivered = useCallback(
    (noticeId) => record(noticeId, "website", "delivered"),
    [record]
  );

  /**
   * An administrator opened the WhatsApp share link. This is NOT a send:
   * WhatsApp opens with the text prefilled and the admin still chooses the
   * chat and presses send. We record only what we know.
   */
  const markWhatsAppLinkOpened = useCallback(
    (noticeId) => record(noticeId, "whatsapp_share", "link_opened"),
    [record]
  );

  const markSkipped = useCallback(
    (noticeId, channel) => record(noticeId, channel, "skipped"),
    [record]
  );

  const markFailed = useCallback(
    (noticeId, channel, message) =>
      record(noticeId, channel, "failed", { last_error: message || null }),
    [record]
  );

  return {
    record,
    markWebsiteDelivered,
    markWhatsAppLinkOpened,
    markSkipped,
    markFailed,
    saving,
    error,
  };
}

/** Delivery rows for one notice (admin history panel). */
export function useNoticeDeliveries(noticeId) {
  const [rows, setRows] = useState([]);

  const load = useCallback(() => {
    if (!noticeId) return Promise.resolve();
    return supabase
      .from("broadcast_deliveries")
      .select("*")
      .eq("notice_id", noticeId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error) setRows(data || []);
      });
  }, [noticeId]);

  // Every state update lives in the .then() callback, so the effect body never
  // sets state synchronously.
  useEffect(() => {
    if (!noticeId) return;
    supabase
      .from("broadcast_deliveries")
      .select("*")
      .eq("notice_id", noticeId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error) setRows(data || []);
      });
  }, [noticeId]);

  return { rows, reload: load };
}

export default useBroadcastDelivery;
