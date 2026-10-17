import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * Admin: Live Temple Notices.
 *
 * The UI is only a convenience — write access is enforced by the RLS policies
 * in supabase/migrations (is_trust_admin()). An account that is not listed in
 * trust_admins will get a permission error from Postgres even if it reaches
 * this screen.
 */

const CATEGORIES = [
  "general", "darshan_timings", "aarti_puja",
  "festival", "closure", "event", "visitor_instruction",
];
const PRIORITIES = ["normal", "important", "urgent"];
const STATUSES = ["draft", "published", "archived"];

const BLANK = {
  title: "",
  body: "",
  category: "general",
  priority: "normal",
  status: "draft",
  is_published: false,
  published_at: "",
  event_start: "",
  event_end: "",
  expires_at: "",
  link_url: "",
  image_url: "",
};

const inputCls = "w-full border rounded-lg px-3 py-2 text-sm";
const labelCls = "block text-xs font-semibold text-gray-600 mb-1";

/** Convert a datetime-local value to ISO, or null. */
const toIso = (v) => (v ? new Date(v).toISOString() : null);
/** Convert ISO -> value usable by <input type="datetime-local">. */
const toLocal = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function TabNotices() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [audit, setAudit] = useState([]);
  const [auditFor, setAuditFor] = useState(null);

  // Uses .then() rather than await-in-effect: the state updates happen in a
  // promise callback, so the effect body never sets state synchronously.
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

  const set = (k) => (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((p) => ({ ...p, [k]: val }));
  };

  const startEdit = (n) => {
    setEditingId(n.id);
    setForm({
      title: n.title || "",
      body: n.body || "",
      category: n.category || "general",
      priority: n.priority || "normal",
      status: n.status || "draft",
      is_published: !!n.is_published,
      published_at: toLocal(n.published_at),
      event_start: n.event_start || "",
      event_end: n.event_end || "",
      expires_at: toLocal(n.expires_at),
      link_url: n.link_url || "",
      image_url: n.image_url || "",
    });
    setMsg(null);
    setError(null);
    setShowPreview(false);
  };

  const clearForm = () => {
    setEditingId(null);
    setForm(BLANK);
    setShowPreview(false);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMsg(null);

    if (!form.title.trim() || !form.body.trim()) {
      setError("Title and details are required.");
      setSaving(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      category: form.category,
      priority: form.priority,
      status: form.status,
      is_published: form.is_published,
      published_at: toIso(form.published_at),
      event_start: form.event_start || null,
      event_end: form.event_end || null,
      expires_at: toIso(form.expires_at),
      link_url: form.link_url.trim() || null,
      image_url: form.image_url.trim() || null,
      updated_by: user?.id ?? null,
    };

    let err;
    if (editingId) {
      ({ error: err } = await supabase.from("notices").update(payload).eq("id", editingId));
    } else {
      payload.created_by = user?.id ?? null;
      ({ error: err } = await supabase.from("notices").insert([payload]));
    }

    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setMsg(editingId ? "Notice updated." : "Notice created.");
    clearForm();
    fetchList();
  };

  const togglePublish = async (n) => {
    const next = !n.is_published;
    const { error: err } = await supabase
      .from("notices")
      .update({
        is_published: next,
        status: next ? "published" : "draft",
        published_at: next ? n.published_at || new Date().toISOString() : n.published_at,
      })
      .eq("id", n.id);
    if (err) setError(err.message);
    else fetchList();
  };

  const archive = async (n) => {
    const { error: err } = await supabase
      .from("notices")
      .update({ status: n.status === "archived" ? "draft" : "archived", is_published: false })
      .eq("id", n.id);
    if (err) setError(err.message);
    else fetchList();
  };

  const remove = async (n) => {
    if (!window.confirm(`Delete notice "${n.title}"? This cannot be undone.`)) return;
    const { error: err } = await supabase.from("notices").delete().eq("id", n.id);
    if (err) setError(err.message);
    else fetchList();
  };

  const viewAudit = async (id) => {
    setAuditFor(id);
    const { data, error: err } = await supabase
      .from("notice_audit")
      .select("*")
      .eq("notice_id", id)
      .order("created_at", { ascending: false });
    setAudit(err ? [] : data || []);
  };

  const isLive = (n) =>
    n.status === "published" &&
    n.is_published &&
    (!n.published_at || new Date(n.published_at) <= new Date()) &&
    (!n.expires_at || new Date(n.expires_at) > new Date());

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------- create / edit */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-5">
        <h2 className="font-bold text-lg mb-4">
          {editingId ? "✏️ Edit Notice" : "➕ New Notice"}
        </h2>

        <form onSubmit={save} className="space-y-4">
          <div>
            <label className={labelCls}>Title</label>
            <input className={inputCls} value={form.title} onChange={set("title")} required />
          </div>

          <div>
            <label className={labelCls}>Details</label>
            <textarea
              className={inputCls}
              rows={4}
              value={form.body}
              onChange={set("body")}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <select className={inputCls} value={form.category} onChange={set("category")}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select className={inputCls} value={form.priority} onChange={set("priority")}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={form.status} onChange={set("status")}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Publish at (blank = immediately)</label>
              <input
                type="datetime-local"
                className={inputCls}
                value={form.published_at}
                onChange={set("published_at")}
              />
            </div>
            <div>
              <label className={labelCls}>Expiry (blank = never)</label>
              <input
                type="datetime-local"
                className={inputCls}
                value={form.expires_at}
                onChange={set("expires_at")}
              />
            </div>
            <div>
              <label className={labelCls}>Event start (optional)</label>
              <input type="date" className={inputCls} value={form.event_start} onChange={set("event_start")} />
            </div>
            <div>
              <label className={labelCls}>Event end (optional)</label>
              <input type="date" className={inputCls} value={form.event_end} onChange={set("event_end")} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Link URL (optional)</label>
              <input className={inputCls} value={form.link_url} onChange={set("link_url")} placeholder="https://" />
            </div>
            <div>
              <label className={labelCls}>Image URL (optional)</label>
              <input className={inputCls} value={form.image_url} onChange={set("image_url")} placeholder="https://" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={form.is_published} onChange={set("is_published")} />
            Published (visible to the public once within its schedule)
          </label>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-5 py-2 rounded-lg text-sm disabled:opacity-60"
            >
              {saving ? "Saving…" : editingId ? "Update Notice" : "Create Notice"}
            </button>
            <button
              type="button"
              onClick={() => setShowPreview((s) => !s)}
              className="bg-white border border-orange-300 text-orange-700 font-semibold px-4 py-2 rounded-lg text-sm"
            >
              {showPreview ? "Hide Preview" : "Preview"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={clearForm}
                className="bg-gray-100 text-gray-700 font-semibold px-4 py-2 rounded-lg text-sm"
              >
                Cancel Edit
              </button>
            )}
          </div>

          {error && <p className="text-red-600 text-sm font-semibold">{error}</p>}
          {msg && <p className="text-green-700 text-sm font-semibold">{msg}</p>}
        </form>

        {/* ------------------------------------------------------ preview */}
        {showPreview && (
          <div className="mt-5 border-t pt-5">
            <p className="text-xs font-bold text-gray-500 mb-2">PREVIEW — how this will appear</p>
            <div
              className="rounded-2xl p-4"
              style={{
                backgroundColor:
                  form.priority === "urgent" ? "#FFF5F5" : form.priority === "important" ? "#FFFBF2" : "#FFFFFF",
                border:
                  form.priority === "urgent"
                    ? "2px solid #B91C1C"
                    : form.priority === "important"
                    ? "2px solid var(--saffron)"
                    : "1px solid rgba(212,175,55,0.5)",
              }}
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor:
                      form.priority === "urgent" ? "#B91C1C" : form.priority === "important" ? "var(--saffron)" : "var(--maroon)",
                    color: form.priority === "normal" ? "var(--gold)" : "#FFFFFF",
                  }}
                >
                  {form.priority}
                </span>
                <span className="text-xs text-gray-500">{form.category}</span>
              </div>
              <h3 className="font-bold text-base mb-1.5" style={{ color: "var(--maroon)" }}>
                {form.title || "(no title)"}
              </h3>
              <p className="text-sm whitespace-pre-line" style={{ color: "#4A3728" }}>
                {form.body || "(no details)"}
              </p>
              {form.image_url && (
                <img src={form.image_url} alt="" className="mt-3 w-full rounded-xl" style={{ maxHeight: "200px", objectFit: "cover" }} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------ list */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-5">
        <h2 className="font-bold text-lg mb-4">📢 Notices ({list.length})</h2>

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-gray-500">No notices yet.</p>
        ) : (
          <ul className="space-y-3">
            {list.map((n) => (
              <li key={n.id} className="border rounded-xl p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-sm" style={{ color: "var(--maroon)" }}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {n.category} • {n.priority} • {n.status}
                      {isLive(n) && <span className="ml-2 font-bold text-green-700">LIVE</span>}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {n.published_at ? `published ${toLocal(n.published_at)}` : "not published"}
                      {n.expires_at ? ` • expires ${toLocal(n.expires_at)}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => startEdit(n)}
                      className="text-xs bg-blue-50 text-blue-700 font-semibold px-2.5 py-1 rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => togglePublish(n)}
                      className="text-xs bg-green-50 text-green-700 font-semibold px-2.5 py-1 rounded"
                    >
                      {n.is_published ? "Unpublish" : "Publish"}
                    </button>
                    <button
                      onClick={() => archive(n)}
                      className="text-xs bg-amber-50 text-amber-700 font-semibold px-2.5 py-1 rounded"
                    >
                      {n.status === "archived" ? "Unarchive" : "Archive"}
                    </button>
                    <button
                      onClick={() => viewAudit(n.id)}
                      className="text-xs bg-gray-100 text-gray-700 font-semibold px-2.5 py-1 rounded"
                    >
                      Audit
                    </button>
                    <button
                      onClick={() => remove(n)}
                      className="text-xs bg-red-50 text-red-700 font-semibold px-2.5 py-1 rounded"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-2 whitespace-pre-line line-clamp-3">{n.body}</p>
              </li>
            ))}
          </ul>
        )}

        {/* --------------------------------------------------------- audit */}
        {auditFor && (
          <div className="mt-5 border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold text-sm">Audit trail</p>
              <button
                onClick={() => setAuditFor(null)}
                className="text-xs text-gray-500 font-semibold"
              >
                Close
              </button>
            </div>
            {audit.length === 0 ? (
              <p className="text-xs text-gray-500">No recorded changes.</p>
            ) : (
              <ul className="space-y-1.5">
                {audit.map((a) => (
                  <li key={a.id} className="text-xs text-gray-600">
                    <span className="font-bold">{a.action}</span> by {a.actor_email || a.actor || "—"} on{" "}
                    {new Date(a.created_at).toLocaleString()}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TabNotices;
