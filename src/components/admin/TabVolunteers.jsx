import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * Admin: Seva / Volunteer applications.
 *
 * Read and update access is restricted to trust_admins by RLS. Contact details
 * are shown here for the sole purpose of replying to applicants — they are
 * never rendered anywhere on the public site.
 */

const STATUSES = ["pending", "contacted", "approved", "declined"];

const ACTIVITY_LABELS = {
  temple_seva: "Temple seva",
  festival_event: "Festival / event",
  construction: "Construction / development",
  visitor_assistance: "Visitor assistance",
  community_service: "Community service",
  other: "Other",
};

const STATUS_STYLE = {
  pending: { bg: "#FFFBEB", fg: "#92400E" },
  contacted: { bg: "#EFF6FF", fg: "#1D4ED8" },
  approved: { bg: "#F0FDF4", fg: "#15803D" },
  declined: { bg: "#FEF2F2", fg: "#B91C1C" },
};

const inputCls = "w-full border rounded-lg px-3 py-2 text-sm";
const labelCls = "block text-xs font-semibold text-gray-600 mb-1";

function TabVolunteers() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterActivity, setFilterActivity] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [savingId, setSavingId] = useState(null);
  const [notes, setNotes] = useState({});
  const [statuses, setStatuses] = useState({});

  // Uses .then() rather than await-in-effect: the state updates happen in a
  // promise callback, so the effect body never sets state synchronously.
  const fetchRows = useCallback(
    () =>
      supabase
        .from("volunteer_applications")
        .select("*")
        .order("created_at", { ascending: false })
        .then(({ data, error: err }) => {
    if (err) {
      setError(err.message);
      setRows([]);
    } else {
      setRows(data || []);
      // seed local edit state
      const n = {};
      const s = {};
      (data || []).forEach((r) => {
        n[r.id] = r.admin_note || "";
        s[r.id] = r.status || "pending";
      });
      setNotes(n);
      setStatuses(s);
    }
    setLoading(false);
        }),
    []
  );

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const saveRow = async (r) => {
    setSavingId(r.id);
    const { error: err } = await supabase
      .from("volunteer_applications")
      .update({ status: statuses[r.id], admin_note: notes[r.id] || null })
      .eq("id", r.id);
    setSavingId(null);
    if (err) setError(err.message);
    else fetchRows();
  };

  const removeRow = async (r) => {
    if (!window.confirm(`Delete application from "${r.full_name}"? This cannot be undone.`)) return;
    const { error: err } = await supabase
      .from("volunteer_applications")
      .delete()
      .eq("id", r.id);
    if (err) setError(err.message);
    else fetchRows();
  };

  const filtered = rows.filter((r) => {
    if (filterActivity !== "all" && r.activity !== filterActivity) return false;
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    return true;
  });

  const contact = (r) =>
    r.contact_method === "mobile" ? r.mobile : r.email;

  return (
    <div className="space-y-5">
      {/* filters */}
      <div className="bg-white rounded-xl shadow p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className={labelCls}>Activity</label>
          <select
            className={inputCls}
            value={filterActivity}
            onChange={(e) => setFilterActivity(e.target.value)}
          >
            <option value="all">All</option>
            {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select
            className={inputCls}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button
          onClick={fetchRows}
          className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-lg text-sm"
        >
          Refresh
        </button>
        <p className="text-xs text-gray-500 ml-auto">
          Showing {filtered.length} of {rows.length}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 text-sm font-semibold rounded-xl p-3">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-6 text-center">
          <p className="text-sm text-gray-500">No applications match this filter.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => (
            <li key={r.id} className="bg-white rounded-xl shadow p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-sm" style={{ color: "var(--maroon)" }}>
                    {r.full_name}
                  </p>
                  <p className="text-xs text-gray-600">
                    {ACTIVITY_LABELS[r.activity] || r.activity}
                    {r.city ? ` • ${r.city}` : ""}
                  </p>
                  <p className="text-xs text-gray-600">
                    📞 <span className="font-semibold">{contact(r) || "—"}</span>
                    <span className="text-gray-400"> ({r.contact_method})</span>
                  </p>
                  {r.availability_date && (
                    <p className="text-xs text-gray-500">Available: {r.availability_date}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    Submitted {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>

                <span
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor: (STATUS_STYLE[r.status] || STATUS_STYLE.pending).bg,
                    color: (STATUS_STYLE[r.status] || STATUS_STYLE.pending).fg,
                  }}
                >
                  {r.status}
                </span>
              </div>

              {r.message && (
                <p className="text-sm text-gray-700 mt-2 whitespace-pre-line">{r.message}</p>
              )}

              {/* admin controls */}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 items-end border-t pt-3">
                <div>
                  <label className={labelCls}>Status</label>
                  <select
                    className={inputCls}
                    value={statuses[r.id] || "pending"}
                    onChange={(e) =>
                      setStatuses((p) => ({ ...p, [r.id]: e.target.value }))
                    }
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Internal note</label>
                  <input
                    className={inputCls}
                    value={notes[r.id] || ""}
                    placeholder="Not visible to applicant"
                    onChange={(e) => setNotes((p) => ({ ...p, [r.id]: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => saveRow(r)}
                    disabled={savingId === r.id}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-60"
                  >
                    {savingId === r.id ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => removeRow(r)}
                    className="bg-red-50 text-red-700 font-semibold px-3 py-2 rounded-lg text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-gray-500">
        Applicant details are shown here only so the Trust can reply. They are never
        published on the public site, and applicants are not added to any WhatsApp
        group or mailing list.
      </p>
    </div>
  );
}

export default TabVolunteers;
