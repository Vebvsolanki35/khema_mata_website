import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  buildShareText,
  whatsAppShareUrl,
  previewText,
  needsReadMore,
} from "../../lib/broadcastShare";
import { useBroadcastDelivery, useNoticeDeliveries } from "../../hooks/useBroadcastDelivery";

/**
 * 📻 Broadcast Center (प्रसारण केंद्र)
 *
 * Reuses the existing `notices` table, `trust_admins` allowlist and RLS
 * policies — this is not a second announcement system. Write access is denied
 * by Postgres to any account not listed in trust_admins, regardless of this UI.
 */

const CATEGORIES = [
  { id: "general", label: "General Notice" },
  { id: "darshan_timings", label: "Darshan Timings" },
  { id: "aarti_puja", label: "Aarti / Puja" },
  { id: "festival", label: "Festival" },
  { id: "closure", label: "Temple Closure" },
  { id: "event", label: "Religious Event" },
  { id: "seva", label: "Seva" },
  { id: "emergency", label: "Emergency" },
  { id: "visitor_instruction", label: "Visitor Instruction" },
];

const PRIORITIES = ["normal", "important", "urgent"];
const LANGUAGES = [
  { id: "hi", label: "हिंदी (Hindi)" },
  { id: "en", label: "English" },
  { id: "gu", label: "ગુજરાતી (Gujarati)" },
];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Official WhatsApp Business sending is opt-in and server-side only. */
const BUSINESS_ENABLED = import.meta.env.VITE_WHATSAPP_BUSINESS_ENABLED === "true";

const BLANK = {
  title: "",
  body: "",
  language: "hi",
  category: "general",
  priority: "normal",
  image_url: "",
  link_url: "",
  expires_at: "",
  event_start: "",
  event_end: "",
};

const inputCls = "w-full border rounded-lg px-3 py-2 text-sm";
const labelCls = "block text-xs font-semibold text-gray-600 mb-1";

const toIso = (v) => (v ? new Date(v).toISOString() : null);
const toLocal = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const STATUS_BADGE = {
  draft: { bg: "#F3F4F6", fg: "#374151" },
  published: { bg: "#F0FDF4", fg: "#15803D" },
  archived: { bg: "#FEF3C7", fg: "#92400E" },
};

const DELIVERY_BADGE = {
  delivered: { bg: "#F0FDF4", fg: "#15803D" },
  sent: { bg: "#EFF6FF", fg: "#1D4ED8" },
  link_opened: { bg: "#FFFBEB", fg: "#92400E" },
  pending: { bg: "#F3F4F6", fg: "#374151" },
  failed: { bg: "#FEF2F2", fg: "#B91C1C" },
  skipped: { bg: "#F3F4F6", fg: "#6B7280" },
};

function Badge({ value, map, suffix = "" }) {
  const s = map[value] || map.pending || { bg: "#F3F4F6", fg: "#374151" };
  return (
    <span
      className="text-[11px] font-bold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {value}
      {suffix}
    </span>
  );
}

/* --------------------------------------------------------------- history */
function DeliveryHistory({ noticeId }) {
  const { rows } = useNoticeDeliveries(noticeId);
  if (rows.length === 0)
    return <p className="text-xs text-gray-500 mt-2">No channel activity recorded.</p>;

  return (
    <ul className="mt-2 space-y-1">
      {rows.map((r) => (
        <li key={r.id} className="text-xs flex flex-wrap items-center gap-2">
          <span className="font-semibold w-36">{r.channel}</span>
          <Badge value={r.status} map={DELIVERY_BADGE} />
          <span className="text-gray-500">attempts: {r.attempts}</span>
          {r.last_error && <span className="text-red-600">{r.last_error}</span>}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ main */
function BroadcastCenter() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [editingId, setEditingId] = useState(null);

  // publish mode: now | schedule | draft
  const [mode, setMode] = useState("now");
  const [scheduledAt, setScheduledAt] = useState("");

  const [channels, setChannels] = useState({ website: true, whatsapp_share: false, whatsapp_business: false });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [showPreview, setShowPreview] = useState(true);
  const [confirming, setConfirming] = useState(null); // payload awaiting confirmation
  const [tab, setTab] = useState("published");
  const [uploading, setUploading] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState(null);

  const { markWebsiteDelivered, markWhatsAppLinkOpened, markSkipped, markFailed } =
    useBroadcastDelivery();

  const fetchList = useCallback(
    () =>
      supabase
        .from("notices")
        .select("*")
        .order("created_at", { ascending: false })
        .then(({ data, error: err }) => {
          if (err) setError(err.message);
          else setList(data || []);
          setLoading(false);
        }),
    []
  );

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  /* ------------------------------------------------------------ buckets */
  const isLive = (n) =>
    n.status === "published" &&
    n.is_published &&
    (!n.published_at || new Date(n.published_at) <= new Date()) &&
    (!n.expires_at || new Date(n.expires_at) > new Date());

  const drafts = list.filter((n) => n.status === "draft");
  const scheduled = list.filter(
    (n) =>
      n.status === "published" &&
      n.is_published &&
      n.published_at &&
      new Date(n.published_at) > new Date()
  );
  const published = list.filter((n) => n.status === "published" && isLive(n));
  const archived = list.filter((n) => n.status === "archived");
  const expired = list.filter(
    (n) => n.status === "published" && n.expires_at && new Date(n.expires_at) <= new Date()
  );

  const BUCKETS = [
    { id: "drafts", label: "Drafts", items: drafts },
    { id: "scheduled", label: "Scheduled", items: scheduled },
    { id: "published", label: "Published", items: published },
    { id: "archived", label: "Archived", items: archived },
    { id: "expired", label: "Expired", items: expired },
  ];

  /* -------------------------------------------------------------- form */
  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((p) => ({ ...p, [k]: v }));
  };

  const startEdit = (n) => {
    setEditingId(n.id);
    setForm({
      title: n.title || "",
      body: n.body || "",
      language: n.language || "hi",
      category: n.category || "general",
      priority: n.priority || "normal",
      image_url: n.image_url || "",
      link_url: n.link_url || "",
      expires_at: toLocal(n.expires_at),
      event_start: n.event_start || "",
      event_end: n.event_end || "",
    });
    setMode(
      n.status === "draft" ? "draft" : n.published_at && new Date(n.published_at) > new Date() ? "schedule" : "now"
    );
    setScheduledAt(toLocal(n.published_at));
    setError(null);
    setMsg(null);
  };

  const clearForm = () => {
    setEditingId(null);
    setForm(BLANK);
    setMode("now");
    setScheduledAt("");
    setChannels({ website: true, whatsapp_share: false, whatsapp_business: false });
  };

  /* ------------------------------------------------------------- upload */
  const uploadImage = async (file) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError("Image must be JPEG, PNG or WebP.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Image must be 5 MB or smaller.");
      return;
    }
    setUploading(true);
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${Date.now()}_${safe}`;
    const { error: upErr } = await supabase.storage.from("notice-media").upload(path, file);
    if (upErr) {
      setError(upErr.message);
    } else {
      const { data } = supabase.storage.from("notice-media").getPublicUrl(path);
      setForm((p) => ({ ...p, image_url: data.publicUrl }));
    }
    setUploading(false);
  };

  /* --------------------------------------------------------- publishing */
  const buildPayload = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const nowIso = new Date().toISOString();

    let status = "draft";
    let isPublished = false;
    let publishedAt = null;

    if (mode === "now") {
      status = "published";
      isPublished = true;
      publishedAt = nowIso;
    } else if (mode === "schedule") {
      // Publish flag is set now; `published_at` is the only gate. Postgres
      // compares it to now() on every public read, so the notice appears at
      // the right time with no browser or cron involved.
      status = "published";
      isPublished = true;
      publishedAt = toIso(scheduledAt);
    }

    return {
      title: form.title.trim(),
      body: form.body.trim(),
      language: form.language,
      category: form.category,
      priority: form.priority,
      status,
      is_published: isPublished,
      published_at: publishedAt,
      event_start: form.event_start || null,
      event_end: form.event_end || null,
      expires_at: toIso(form.expires_at),
      link_url: form.link_url.trim() || null,
      image_url: form.image_url.trim() || null,
      updated_by: user?.id ?? null,
      created_by: user?.id ?? null,
    };
  };

  const needsConfirmation = () =>
    form.priority === "urgent" ||
    form.category === "emergency" ||
    channels.whatsapp_business;

  /** Runs the confirmed save + channel fan-out. */
  const commit = async (payload) => {
    setSaving(true);
    setError(null);
    setMsg(null);

    let noticeId = editingId;
    let err;

    if (editingId) {
      // created_by must stay as originally recorded
      const update = { ...payload };
      delete update.created_by;
      ({ error: err } = await supabase.from("notices").update(update).eq("id", editingId));
    } else {
      const { data, error: insertErr } = await supabase
        .from("notices")
        .insert([payload])
        .select("id")
        .single();
      err = insertErr;
      noticeId = data?.id || null;
    }

    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (!noticeId) {
      setError("The notice was not saved — no confirmation came back from the database.");
      return;
    }

    // --- channel: website -------------------------------------------------
    if (channels.website) {
      if (payload.status === "published") {
        // Verifiable: the row is live and the public feed serves it.
        await markWebsiteDelivered(noticeId);
      } else {
        await markSkipped(noticeId, "website");
      }
    }

    // --- channel: WhatsApp share -----------------------------------------
    if (channels.whatsapp_share) {
      const text = buildShareText({ ...payload, id: noticeId });
      window.open(whatsAppShareUrl(text), "_blank", "noopener,noreferrer");
      // Opening the link prefills a message; the admin still has to send it.
      // Record exactly that — never "sent".
      await markWhatsAppLinkOpened(noticeId);
    }

    // --- channel: WhatsApp Business --------------------------------------
    if (channels.whatsapp_business) {
      if (!BUSINESS_ENABLED) {
        await markSkipped(noticeId, "whatsapp_business");
        setMsg("Saved. WhatsApp Business is not configured, so no bulk send was attempted.");
      } else {
        try {
          // Server-side only. Credentials live in the Edge Function, never here.
          const { data, error: fnErr } = await supabase.functions.invoke("broadcast-whatsapp", {
            body: { noticeId },
          });
          if (fnErr) throw fnErr;
          // Status comes from the provider response — never assumed.
          await markDeliveredFromProvider(noticeId, data);
        } catch (e) {
          await markFailed(noticeId, "whatsapp_business", e.message);
        }
      }
    }

    setMsg(
      mode === "schedule"
        ? "Scheduled. It will appear on the website automatically at the chosen time."
        : mode === "draft"
        ? "Saved as a draft. It is not visible to visitors."
        : "Published to the website."
    );
    clearForm();
    fetchList();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!form.title.trim() || !form.body.trim()) {
      setError("Title and message are required.");
      return;
    }
    if (mode === "schedule" && !scheduledAt) {
      setError("Choose the date and time to publish this announcement.");
      return;
    }
    if (mode === "schedule" && toIso(scheduledAt) <= new Date().toISOString()) {
      setError("The scheduled time must be in the future. Choose 'Publish now' otherwise.");
      return;
    }

    const payload = await buildPayload();
    if (needsConfirmation()) {
      setConfirming(payload); // explicit confirmation for urgent / bulk sends
      return;
    }
    await commit(payload);
  };

  /* ------------------------------------------------------- row actions */
  const unpublish = async (n) => {
    await supabase.from("notices").update({ is_published: false, status: "draft" }).eq("id", n.id);
    fetchList();
  };

  const expireNow = async (n) => {
    await supabase.from("notices").update({ expires_at: new Date().toISOString() }).eq("id", n.id);
    fetchList();
  };

  const archive = async (n) => {
    await supabase
      .from("notices")
      .update({ status: n.status === "archived" ? "draft" : "archived", is_published: false })
      .eq("id", n.id);
    fetchList();
  };

  const remove = async (n) => {
    if (!window.confirm(`Delete "${n.title}"? This cannot be undone.`)) return;
    await supabase.from("notices").delete().eq("id", n.id);
    fetchList();
  };

  const shareNow = async (n) => {
    const text = buildShareText(n);
    window.open(whatsAppShareUrl(text), "_blank", "noopener,noreferrer");
    await markWhatsAppLinkOpened(n.id);
    setMsg(`WhatsApp opened with the announcement ready to send. This is recorded as "link_opened" — not as sent.`);
  };

  const retry = async (n) => {
    if (!BUSINESS_ENABLED) {
      setMsg("WhatsApp Business is not configured.");
      return;
    }
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("broadcast-whatsapp", {
        body: { noticeId: n.id, retry: true },
      });
      if (fnErr) throw fnErr;
      await markDeliveredFromProvider(n.id, data);
    } catch (e) {
      await markFailed(n.id, "whatsapp_business", e.message);
    }
    fetchList();
  };

  return (
    <div className="space-y-6">
      {/* -------------------------------------------------------- counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Drafts", value: drafts.length, color: "#374151" },
          { label: "Scheduled", value: scheduled.length, color: "#1D4ED8" },
          { label: "Published", value: published.length, color: "#15803D" },
          { label: "Archived", value: archived.length, color: "#92400E" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl shadow p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
            <p className="text-xs text-gray-500">{c.label}</p>
          </div>
        ))}
      </div>

      {/* ------------------------------------------------------ composer */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-5">
        <h2 className="font-bold text-lg mb-4">
          {editingId ? "✏️ Edit Announcement" : "📻 Create New Announcement"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Language</label>
              <select className={inputCls} value={form.language} onChange={set("language")}>
                {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select className={inputCls} value={form.category} onChange={set("category")}>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select className={inputCls} value={form.priority} onChange={set("priority")}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Title</label>
            <input className={inputCls} value={form.title} onChange={set("title")} required />
          </div>

          <div>
            <label className={labelCls}>Message</label>
            <textarea className={inputCls} rows={5} value={form.body} onChange={set("body")} required />
            <p className="text-[11px] text-gray-400 mt-1">
              Write the message exactly as devotees should read it. Nothing is translated automatically.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Image / poster (optional)</label>
              <input
                type="file"
                accept={ALLOWED_IMAGE_TYPES.join(",")}
                className={inputCls}
                onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
                disabled={uploading}
              />
              <input
                className={`${inputCls} mt-2`}
                value={form.image_url}
                onChange={set("image_url")}
                placeholder="…or paste an image URL"
              />
              {uploading && <p className="text-xs text-gray-500 mt-1">Uploading…</p>}
            </div>
            <div>
              <label className={labelCls}>Verified external link (optional)</label>
              <input className={inputCls} value={form.link_url} onChange={set("link_url")} placeholder="https://" />
              <label className={`${labelCls} mt-2`}>Expiry (optional)</label>
              <input type="datetime-local" className={inputCls} value={form.expires_at} onChange={set("expires_at")} />
            </div>
          </div>

          {/* publish mode */}
          <div className="border rounded-lg p-3">
            <p className="text-xs font-bold text-gray-600 mb-2">Publish</p>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "now", label: "Publish now" },
                { id: "schedule", label: "Schedule" },
                { id: "draft", label: "Save as draft" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  aria-pressed={mode === m.id}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold border"
                  style={
                    mode === m.id
                      ? { backgroundColor: "#ea580c", color: "white", borderColor: "#ea580c" }
                      : { backgroundColor: "white", color: "#c2410c", borderColor: "#fed7aa" }
                  }
                >
                  {m.label}
                </button>
              ))}
            </div>
            {mode === "schedule" && (
              <input
                type="datetime-local"
                className={`${inputCls} mt-3`}
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            )}
            {mode === "schedule" && (
              <p className="text-[11px] text-gray-500 mt-1">
                It will appear automatically at that time — the website checks the schedule on every
                visit, so no dashboard needs to be open.
              </p>
            )}
          </div>

          {/* channels */}
          <div className="border rounded-lg p-3">
            <p className="text-xs font-bold text-gray-600 mb-2">Distribution channels</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={channels.website}
                onChange={(e) => setChannels((p) => ({ ...p, website: e.target.checked }))} />
              Website (Live Temple Notices)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={channels.whatsapp_share}
                onChange={(e) => setChannels((p) => ({ ...p, whatsapp_share: e.target.checked }))} />
              WhatsApp share (opens WhatsApp for you to choose a chat)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" disabled={!BUSINESS_ENABLED} checked={channels.whatsapp_business}
                onChange={(e) => setChannels((p) => ({ ...p, whatsapp_business: e.target.checked }))} />
              Official WhatsApp Business
              {!BUSINESS_ENABLED && (
                <span className="text-xs text-gray-500">
                  — not configured. See docs/WHATSAPP_BUSINESS_INTEGRATION.md
                </span>
              )}
            </label>
            {channels.whatsapp_share && (
              <p className="text-[11px] text-amber-700 mt-1">
                Opening WhatsApp only prefills the message. It is recorded as “link_opened”, never as sent.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button type="submit" disabled={saving}
              className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-5 py-2 rounded-lg text-sm disabled:opacity-60">
              {saving ? "Working…" : editingId ? "Save Changes" : mode === "schedule" ? "Schedule Announcement" : "Publish Announcement"}
            </button>
            <button type="button" onClick={() => setShowPreview((s) => !s)}
              className="bg-white border border-orange-300 text-orange-700 font-semibold px-4 py-2 rounded-lg text-sm">
              {showPreview ? "Hide Preview" : "Preview"}
            </button>
            {editingId && (
              <button type="button" onClick={clearForm}
                className="bg-gray-100 text-gray-700 font-semibold px-4 py-2 rounded-lg text-sm">
                Cancel
              </button>
            )}
          </div>

          {error && <p className="text-red-600 text-sm font-semibold">{error}</p>}
          {msg && <p className="text-green-700 text-sm font-semibold">{msg}</p>}
        </form>

        {/* ------------------------------------------------ preview */}
        {showPreview && (
          <div className="mt-5 border-t pt-5">
            <p className="text-xs font-bold text-gray-500 mb-2">
              PREVIEW — as devotees will see it ({LANGUAGES.find((l) => l.id === form.language)?.label})
            </p>
            <div
              className="rounded-2xl p-4"
              style={{
                backgroundColor:
                  form.priority === "urgent" ? "#FFF5F5" : form.priority === "important" ? "#FFFBF2" : "#FFFFFF",
                border:
                  form.priority === "urgent" ? "2px solid #B91C1C"
                    : form.priority === "important" ? "2px solid var(--saffron)"
                    : "1px solid rgba(212,175,55,0.5)",
              }}
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor: form.priority === "urgent" ? "#B91C1C" : form.priority === "important" ? "var(--saffron)" : "var(--maroon)",
                    color: form.priority === "normal" ? "var(--gold)" : "#FFFFFF",
                  }}>
                  {form.priority}
                </span>
                <span className="text-xs text-gray-500">{form.category}</span>
              </div>
              <h3 className="font-bold text-base mb-1.5" style={{ color: "var(--maroon)" }}>
                {form.title || "(no title)"}
              </h3>
              <p className="text-sm whitespace-pre-line" style={{ color: "#4A3728" }}>
                {needsReadMore(form.body) ? previewText(form.body) : form.body || "(no message)"}
              </p>
              {needsReadMore(form.body) && (
                <p className="mt-1.5 text-xs font-bold underline" style={{ color: "var(--maroon)" }}>
                  Read more
                </p>
              )}
              {form.image_url && (
                <img src={form.image_url} alt="" className="mt-3 w-full rounded-xl"
                  style={{ maxHeight: "200px", objectFit: "cover" }} />
              )}
              <div className="mt-3 pt-3 flex items-center justify-between"
                style={{ borderTop: "1px solid rgba(212,175,55,0.35)" }}>
                <span className="text-[11px] text-gray-500">Published: (on publish)</span>
                <span className="text-xs font-bold px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: "#188748", color: "#FFFFFF" }}>📤 Share</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------ confirmation dialog */}
      {confirming && (
        <div className="bg-amber-50 border-2 border-amber-500 rounded-xl p-4">
          <h3 className="font-bold text-amber-900 mb-2">⚠️ Confirm before continuing</h3>
          <p className="text-sm text-amber-900 mb-2">
            {form.priority === "urgent" || form.category === "emergency"
              ? "This announcement is marked Urgent / Emergency and will be shown prominently on the homepage."
              : ""}
            {channels.whatsapp_business
              ? " You are about to send this through the official WhatsApp Business channel to opted-in recipients."
              : ""}
          </p>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                const payload = confirming;
                setConfirming(null);
                await commit(payload);
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-2 rounded-lg text-sm"
            >
              Yes, continue
            </button>
            <button
              onClick={() => setConfirming(null)}
              className="bg-white border border-gray-300 text-gray-700 font-semibold px-4 py-2 rounded-lg text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------ lists */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-5">
        <div className="flex flex-wrap gap-2 mb-4">
          {BUCKETS.map((b) => (
            <button key={b.id} onClick={() => setTab(b.id)}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold border"
              style={tab === b.id
                ? { backgroundColor: "#ea580c", color: "white", borderColor: "#ea580c" }
                : { backgroundColor: "#fff7ed", color: "#c2410c", borderColor: "#fed7aa" }}>
              {b.label} ({b.items.length})
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (BUCKETS.find((b) => b.id === tab)?.items || []).length === 0 ? (
          <p className="text-sm text-gray-500">Nothing here.</p>
        ) : (
          <ul className="space-y-3">
            {(BUCKETS.find((b) => b.id === tab)?.items || []).map((n) => (
              <li key={n.id} className="border rounded-xl p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-sm" style={{ color: "var(--maroon)" }}>{n.title}</p>
                    <p className="text-xs text-gray-500">
                      {n.language} • {n.category} • {n.priority}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge value={n.status} map={STATUS_BADGE} />
                      {isLive(n) && <Badge value="live" map={{ live: { bg: "#F0FDF4", fg: "#15803D" } }} />}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {n.published_at ? `publish ${toLocal(n.published_at)}` : "not published"}
                      {n.expires_at ? ` • expires ${toLocal(n.expires_at)}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => startEdit(n)}
                      className="text-xs bg-blue-50 text-blue-700 font-semibold px-2.5 py-1 rounded">Edit</button>
                    {n.is_published && (
                      <button onClick={() => unpublish(n)}
                        className="text-xs bg-gray-100 text-gray-700 font-semibold px-2.5 py-1 rounded">Unpublish</button>
                    )}
                    {isLive(n) && (
                      <button onClick={() => expireNow(n)}
                        className="text-xs bg-amber-50 text-amber-700 font-semibold px-2.5 py-1 rounded">Expire now</button>
                    )}
                    <button onClick={() => archive(n)}
                      className="text-xs bg-yellow-50 text-yellow-700 font-semibold px-2.5 py-1 rounded">
                      {n.status === "archived" ? "Unarchive" : "Archive"}</button>
                    <button onClick={() => shareNow(n)}
                      className="text-xs bg-green-50 text-green-700 font-semibold px-2.5 py-1 rounded">WhatsApp</button>
                    <button onClick={() => setExpandedHistory(expandedHistory === n.id ? null : n.id)}
                      className="text-xs bg-gray-100 text-gray-700 font-semibold px-2.5 py-1 rounded">History</button>
                    <button onClick={() => remove(n)}
                      className="text-xs bg-red-50 text-red-700 font-semibold px-2.5 py-1 rounded">Delete</button>
                  </div>
                </div>

                <p className="text-xs text-gray-600 mt-2 whitespace-pre-line line-clamp-2">{n.body}</p>

                {expandedHistory === n.id && (
                  <div className="mt-3 border-t pt-3">
                    <p className="text-xs font-bold text-gray-600">Broadcast history</p>
                    <DeliveryHistory noticeId={n.id} />
                    {BUSINESS_ENABLED && (
                      <button onClick={() => retry(n)}
                        className="mt-2 text-xs bg-orange-50 text-orange-700 font-semibold px-2.5 py-1 rounded">
                        Retry WhatsApp Business
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Writes the status returned by the provider. Never upgrades a status on
 * assumption — if the response is unclear the row is left as it is.
 */
async function markDeliveredFromProvider(noticeId, data) {
  const status = data?.status;
  if (!["sent", "delivered", "failed"].includes(status)) return;
  await supabase
    .from("broadcast_deliveries")
    .update({ status, provider_message_id: data?.providerMessageId || null,
              last_error: data?.error || null })
    .eq("notice_id", noticeId)
    .eq("channel", "whatsapp_business")
    .eq("recipient_ref", "public");
}

export default BroadcastCenter;
