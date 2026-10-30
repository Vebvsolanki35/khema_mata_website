import { useCallback, useEffect, useState } from "react";
import { supabase, safeSupabaseQuery } from "../../lib/supabase";

const STATUSES = ["approved", "pending", "rejected", "archived", "flagged", "deleted"];
const REPORT_STATUSES = ["pending", "reviewed", "imported", "rejected"];

const STATUS_STYLE = {
  approved: { bg: "#F0FDF4", fg: "#15803D" },
  pending: { bg: "#FFFBEB", fg: "#92400E" },
  rejected: { bg: "#FEF2F2", fg: "#B91C1C" },
  archived: { bg: "#F3F4F6", fg: "#374151" },
  flagged: { bg: "#FEF3C7", fg: "#92400E" },
  deleted: { bg: "#FEE2E2", fg: "#991B1B" },
};

function TabParivaar() {
  const [subView, setSubView] = useState("registrations"); // 'registrations' | 'audit_log' | 'missing_reports' | 'import_history' | 'data_quality'
  const [registrations, setRegistrations] = useState([]);
  const [totalRegistrations, setTotalRegistrations] = useState(0);
  const [totalMembers, setTotalMembers] = useState(0);
  const [auditLogs, setAuditLogs] = useState([]);
  const [reports, setReports] = useState([]);
  const [imports, setImports] = useState([]);
  const [dataQuality, setDataQuality] = useState(null);
  const [overrideInputs, setOverrideInputs] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);

  // Admin Filters & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("");
  const [filterSubdistrict, setFilterSubdistrict] = useState("");
  const [filterVillage, setFilterVillage] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterVisibility, setFilterVisibility] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Export options
  const [includePrivateInExport, setIncludePrivateInExport] = useState(true);

  // Edit record modal state
  const [editingRecord, setEditingRecord] = useState(null);
  const [editReason, setEditReason] = useState("");

  const buildFilterParams = useCallback(
    (includePagination = true) => {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (filterState.trim()) params.set("state_code", filterState.trim());
      if (filterDistrict.trim()) params.set("district_code", filterDistrict.trim());
      if (filterSubdistrict.trim()) {
        params.set("subdistrict_code", filterSubdistrict.trim());
      }
      if (filterVillage.trim()) params.set("village_code", filterVillage.trim());
      if (filterStatus && filterStatus !== "all") {
        params.set("status", filterStatus);
      }
      if (filterVisibility && filterVisibility !== "all") {
        params.set("public_visibility", filterVisibility);
      }
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (includePagination) {
        params.set("page", String(page));
        params.set("page_size", String(pageSize));
      }
      return params;
    },
    [
      searchQuery,
      filterState,
      filterDistrict,
      filterSubdistrict,
      filterVillage,
      filterStatus,
      filterVisibility,
      dateFrom,
      dateTo,
      page,
    ]
  );

  const loadData = useCallback(() => {
    setLoading(true);
    const params = buildFilterParams(true);
    params.set("action", "admin-data");

    fetch(`/api/parivaar?${params.toString()}`, {
      headers: { Accept: "application/json" },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data || data.ok === false) {
          throw new Error(data?.message || "Failed to load admin records");
        }
        setError(null);
        setRegistrations(data.registrations || []);
        setTotalRegistrations(
          Number(data.total_registrations ?? (data.registrations || []).length)
        );
        setTotalMembers(Number(data.total_members ?? 0));
        setAuditLogs(data.auditLogs || []);
        setReports(data.missingReports || []);
        setImports(data.importHistory || []);
        setDataQuality(data.dataQualityReport || null);
        const initialOverrides = {};
        for (const rec of data.dataQualityReport?.flagged_punctuation_records || []) {
          initialOverrides[rec.village_code] = rec.display_name_override || "";
        }
        setOverrideInputs(initialOverrides);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.message || "Failed to load admin records");
        setLoading(false);
      });
  }, [buildFilterParams]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExport = (format = "xlsx", scope = "filtered") => {
    const params =
      scope === "all" ? new URLSearchParams() : buildFilterParams(false);
    params.set("action", "admin-export");
    params.set("format", format);
    params.set("include_private", includePrivateInExport ? "1" : "0");
    window.open(`/api/parivaar?${params.toString()}`, "_blank", "noopener");
  };

  const updateRegistrationStatus = async (id, status) => {
    setSavingId(id);
    try {
      const res = await fetch("/api/parivaar?action=admin-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "registration",
          operation: "status",
          id,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Failed to update status");
      }
      await safeSupabaseQuery(
        supabase
          .from("parivaar_registrations")
          .update({ status })
          .eq("id", id)
      );
      loadData();
    } catch (err) {
      setError(err?.message || "Failed to update registration status");
    } finally {
      setSavingId(null);
    }
  };

  const saveEditedRecord = async (e) => {
    e.preventDefault();
    if (!editingRecord) return;
    setSavingId(editingRecord.id);
    try {
      const res = await fetch("/api/parivaar?action=admin-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "registration",
          operation: "edit",
          id: editingRecord.id,
          full_name: editingRecord.full_name,
          father_name: editingRecord.father_name || "",
          member_count: Number(editingRecord.member_count) || 1,
          phone_number: editingRecord.phone_number,
          current_address: editingRecord.current_address,
          state_code: editingRecord.state_code,
          district_code: editingRecord.district_code,
          subdistrict_code: editingRecord.subdistrict_code,
          village_code: editingRecord.village_code,
          thikana: editingRecord.thikana,
          public_visibility: editingRecord.public_visibility || "public",
          status: editingRecord.status || "approved",
          reason:
            editReason.trim() ||
            "Admin correction via Parivaar Directory Dashboard",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Failed to save record changes");
      }
      await safeSupabaseQuery(
        supabase
          .from("parivaar_registrations")
          .update({
            full_name: editingRecord.full_name,
            father_name: editingRecord.father_name || null,
            member_count: Number(editingRecord.member_count) || 1,
            phone_number: editingRecord.phone_number,
            current_address: editingRecord.current_address,
            state_code: editingRecord.state_code,
            district_code: editingRecord.district_code,
            subdistrict_code: editingRecord.subdistrict_code,
            village_code: editingRecord.village_code,
            thikana: editingRecord.thikana,
            public_visibility: editingRecord.public_visibility || "public",
            status: editingRecord.status || "approved",
          })
          .eq("id", editingRecord.id)
      );
      setEditingRecord(null);
      setEditReason("");
      loadData();
    } catch (err) {
      setError(err?.message || "Failed to save record changes");
    } finally {
      setSavingId(null);
    }
  };

  const deleteRegistration = async (row) => {
    if (
      !window.confirm(
        `Delete registration ${row.family_id || ""} for "${row.full_name}"? Note: Family ID ${row.family_id || ""} will never be reused.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch("/api/parivaar?action=admin-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "registration",
          operation: "delete",
          id: row.id,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Failed to delete registration");
      }
      await safeSupabaseQuery(
        supabase
          .from("parivaar_registrations")
          .delete()
          .eq("id", row.id)
      );
      loadData();
    } catch (err) {
      setError(err?.message || "Failed to delete registration");
    }
  };

  const updateReportStatus = async (id, status) => {
    setSavingId(id);
    try {
      const res = await fetch("/api/parivaar?action=admin-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "missing_report",
          operation: "status",
          id,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Failed to update report status");
      }
      await safeSupabaseQuery(
        supabase
          .from("missing_location_reports")
          .update({ status })
          .eq("id", id)
      );
      loadData();
    } catch (err) {
      setError(err?.message || "Failed to update report status");
    } finally {
      setSavingId(null);
    }
  };

  const saveDisplayOverride = async (villageCode) => {
    setSavingId(villageCode);
    try {
      const display_name_override = overrideInputs[villageCode] || "";
      const res = await fetch("/api/parivaar?action=admin-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "village_display_label",
          id: villageCode,
          display_name_override,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(
          data?.message || "Failed to save display label override"
        );
      }
      loadData();
    } catch (err) {
      setError(err?.message || "Failed to save display label override");
    } finally {
      setSavingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalRegistrations / pageSize));

  return (
    <div className="space-y-5">
      {/* Top Sub-Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl shadow p-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSubView("registrations")}
            className="px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold cursor-pointer"
            style={
              subView === "registrations"
                ? { backgroundColor: "var(--maroon)", color: "var(--gold)" }
                : { backgroundColor: "#FFF8F0", color: "var(--maroon)" }
            }
          >
            👨‍👩‍👧‍👦 पंजीकरण (Registrations: {totalRegistrations.toLocaleString()})
          </button>
          <button
            type="button"
            onClick={() => setSubView("audit_log")}
            className="px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold cursor-pointer"
            style={
              subView === "audit_log"
                ? { backgroundColor: "var(--maroon)", color: "var(--gold)" }
                : { backgroundColor: "#FFF8F0", color: "var(--maroon)" }
            }
          >
            📜 संशोधन इतिहास (Audit History: {auditLogs.length})
          </button>
          <button
            type="button"
            onClick={() => setSubView("missing_reports")}
            className="px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold cursor-pointer"
            style={
              subView === "missing_reports"
                ? { backgroundColor: "var(--maroon)", color: "var(--gold)" }
                : { backgroundColor: "#FFF8F0", color: "var(--maroon)" }
            }
          >
            📍 छूटे स्थान (Missing Villages: {reports.length})
          </button>
          <button
            type="button"
            onClick={() => setSubView("data_quality")}
            className="px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold cursor-pointer"
            style={
              subView === "data_quality"
                ? { backgroundColor: "var(--maroon)", color: "var(--gold)" }
                : { backgroundColor: "#FFF8F0", color: "var(--maroon)" }
            }
          >
            🔍 डेटा गुणवत्ता (LGD Data Quality)
          </button>
          <button
            type="button"
            onClick={() => setSubView("import_history")}
            className="px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold cursor-pointer"
            style={
              subView === "import_history"
                ? { backgroundColor: "var(--maroon)", color: "var(--gold)" }
                : { backgroundColor: "#FFF8F0", color: "var(--maroon)" }
            }
          >
            📦 LGD आयात (Import History: {imports.length})
          </button>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-1.5 rounded-lg text-xs sm:text-sm cursor-pointer"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 text-sm font-semibold rounded-xl p-3">
          {error}
        </div>
      )}

      {subView === "registrations" ? (
        <div className="space-y-4">
          {/* Admin Search, Filters & Excel/CSV Export Panel */}
          <div className="bg-white rounded-xl shadow border border-orange-100 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-orange-100 pb-3">
              <div>
                <h3
                  className="text-sm sm:text-base font-bold"
                  style={{ color: "var(--maroon)" }}
                >
                  📊 परिवार निर्देशिका प्रबंधन एवं Excel / CSV निर्यात (Admin Search, Filters &amp; Export)
                </h3>
                <p className="text-xs text-gray-600">
                  वर्तमान फ़िल्टर में मिलान संख्या (Matching Records):{" "}
                  <strong className="text-[#6B0F1A]">
                    {totalRegistrations.toLocaleString()} परिवार (Families)
                  </strong>{" "}
                  •{" "}
                  <strong className="text-[#15803D]">
                    {totalMembers.toLocaleString()} कुल सदस्य (Total Members)
                  </strong>
                </p>
              </div>

              {/* Excel (.xlsx 5-sheet) & CSV Export Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 mr-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includePrivateInExport}
                    onChange={(e) => setIncludePrivateInExport(e.target.checked)}
                    className="w-4 h-4 accent-red-900 rounded"
                  />
                  <span>Include Private Phone &amp; Address</span>
                </label>

                <button
                  type="button"
                  onClick={() => handleExport("xlsx", "filtered")}
                  data-testid="admin-export-xlsx-filtered"
                  className="px-3.5 py-2 rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                  style={{
                    backgroundColor: "#15803D",
                    color: "#FFFFFF",
                  }}
                >
                  📥 Export Filtered Excel (.xlsx • 5 Sheets)
                </button>
                <button
                  type="button"
                  onClick={() => handleExport("xlsx", "all")}
                  data-testid="admin-export-xlsx-all"
                  className="px-3.5 py-2 rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                  style={{
                    backgroundColor: "var(--maroon)",
                    color: "var(--gold)",
                  }}
                >
                  📥 Export All Excel (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => handleExport("csv", "filtered")}
                  data-testid="admin-export-csv-filtered"
                  className="px-3 py-2 rounded-lg text-xs font-bold border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-800 cursor-pointer"
                >
                  📄 Export CSV (.csv)
                </button>
              </div>
            </div>

            {/* Filter Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Search (Family ID / Head Name / Phone)
                </label>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="e.g. 94494-001 or राजेंद्र सिंह…"
                  className="w-full border rounded-lg px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  State LGD Code
                </label>
                <input
                  type="text"
                  value={filterState}
                  onChange={(e) => {
                    setFilterState(e.target.value);
                    setPage(1);
                  }}
                  placeholder="e.g. 8 (Rajasthan)"
                  className="w-full border rounded-lg px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  District LGD Code
                </label>
                <input
                  type="text"
                  value={filterDistrict}
                  onChange={(e) => {
                    setFilterDistrict(e.target.value);
                    setPage(1);
                  }}
                  placeholder="e.g. 94 (Bundi)"
                  className="w-full border rounded-lg px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Tehsil/Block LGD Code
                </label>
                <input
                  type="text"
                  value={filterSubdistrict}
                  onChange={(e) => {
                    setFilterSubdistrict(e.target.value);
                    setPage(1);
                  }}
                  placeholder="e.g. 6033 (Talera)"
                  className="w-full border rounded-lg px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Village LGD Code
                </label>
                <input
                  type="text"
                  value={filterVillage}
                  onChange={(e) => {
                    setFilterVillage(e.target.value);
                    setPage(1);
                  }}
                  placeholder="e.g. 94494 (Chhapawda)"
                  className="w-full border rounded-lg px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Record Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setPage(1);
                  }}
                  className="w-full border rounded-lg px-3 py-2 text-xs"
                >
                  <option value="all">All Statuses</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Public Visibility
                </label>
                <select
                  value={filterVisibility}
                  onChange={(e) => {
                    setFilterVisibility(e.target.value);
                    setPage(1);
                  }}
                  className="w-full border rounded-lg px-3 py-2 text-xs"
                >
                  <option value="all">All (Public + Private)</option>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setPage(1);
                    }}
                    className="w-full border rounded-lg px-2 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setPage(1);
                    }}
                    className="w-full border rounded-lg px-2 py-2 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Edit Record Modal */}
          {editingRecord && (
            <form
              onSubmit={saveEditedRecord}
              className="bg-amber-50/90 border-2 border-amber-500 rounded-xl p-4 space-y-3 shadow-md"
              data-testid="admin-edit-registration-form"
            >
              <div className="flex items-center justify-between border-b border-amber-300 pb-2">
                <div>
                  <h4
                    className="text-sm font-bold"
                    style={{ color: "var(--maroon)" }}
                  >
                    ✏️ रिकॉर्ड संपादन (Edit Registration) — Permanent Family ID:{" "}
                    <span className="font-mono px-2 py-0.5 rounded bg-white border">
                      {editingRecord.family_id}
                    </span>
                  </h4>
                  <p className="text-[11px] text-amber-900">
                    नियम: नाम, सदस्य संख्या या पैतृक गाँव संशोधित करने पर भी मूल स्थायी Family ID ({editingRecord.family_id}) कभी नहीं बदलती; सभी बदलाव ऑडिट लॉग में दर्ज होते हैं।
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="text-xs font-bold text-gray-700 px-2.5 py-1 rounded bg-white border cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-bold mb-1">
                    Family Head&apos;s Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editingRecord.full_name || ""}
                    onChange={(e) =>
                      setEditingRecord((prev) => ({
                        ...prev,
                        full_name: e.target.value,
                      }))
                    }
                    className="w-full border rounded px-2.5 py-1.5 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">
                    Father&apos;s Name (पिता का नाम)
                  </label>
                  <input
                    type="text"
                    value={editingRecord.father_name || ""}
                    placeholder="e.g. Gajendra Singh Solanki"
                    onChange={(e) =>
                      setEditingRecord((prev) => ({
                        ...prev,
                        father_name: e.target.value,
                      }))
                    }
                    className="w-full border rounded px-2.5 py-1.5 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">
                    Number of Family Members
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={250}
                    required
                    value={editingRecord.member_count || 1}
                    onChange={(e) =>
                      setEditingRecord((prev) => ({
                        ...prev,
                        member_count: e.target.value,
                      }))
                    }
                    className="w-full border rounded px-2.5 py-1.5 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">
                    Mobile Number (Private)
                  </label>
                  <input
                    type="text"
                    required
                    value={editingRecord.phone_number || ""}
                    onChange={(e) =>
                      setEditingRecord((prev) => ({
                        ...prev,
                        phone_number: e.target.value,
                      }))
                    }
                    className="w-full border rounded px-2.5 py-1.5 bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">State LGD Code</label>
                  <input
                    type="text"
                    required
                    value={editingRecord.state_code || ""}
                    onChange={(e) =>
                      setEditingRecord((prev) => ({
                        ...prev,
                        state_code: e.target.value,
                      }))
                    }
                    className="w-full border rounded px-2.5 py-1.5 bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">
                    District LGD Code
                  </label>
                  <input
                    type="text"
                    required
                    value={editingRecord.district_code || ""}
                    onChange={(e) =>
                      setEditingRecord((prev) => ({
                        ...prev,
                        district_code: e.target.value,
                      }))
                    }
                    className="w-full border rounded px-2.5 py-1.5 bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">
                    Tehsil/Block LGD Code
                  </label>
                  <input
                    type="text"
                    required
                    value={editingRecord.subdistrict_code || ""}
                    onChange={(e) =>
                      setEditingRecord((prev) => ({
                        ...prev,
                        subdistrict_code: e.target.value,
                      }))
                    }
                    className="w-full border rounded px-2.5 py-1.5 bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">
                    Village LGD Code
                  </label>
                  <input
                    type="text"
                    required
                    value={editingRecord.village_code || ""}
                    onChange={(e) =>
                      setEditingRecord((prev) => ({
                        ...prev,
                        village_code: e.target.value,
                      }))
                    }
                    className="w-full border rounded px-2.5 py-1.5 bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">
                    Public Visibility
                  </label>
                  <select
                    value={editingRecord.public_visibility || "public"}
                    onChange={(e) =>
                      setEditingRecord((prev) => ({
                        ...prev,
                        public_visibility: e.target.value,
                      }))
                    }
                    className="w-full border rounded px-2.5 py-1.5 bg-white"
                  >
                    <option value="public">Public (Standard Listing)</option>
                    <option value="private">
                      Private (Show Only Family ID &amp; Location)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">Status</label>
                  <select
                    value={editingRecord.status || "approved"}
                    onChange={(e) =>
                      setEditingRecord((prev) => ({
                        ...prev,
                        status: e.target.value,
                      }))
                    }
                    className="w-full border rounded px-2.5 py-1.5 bg-white"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold mb-1">
                    Current Address (Private)
                  </label>
                  <input
                    type="text"
                    required
                    value={editingRecord.current_address || ""}
                    onChange={(e) =>
                      setEditingRecord((prev) => ({
                        ...prev,
                        current_address: e.target.value,
                      }))
                    }
                    className="w-full border rounded px-2.5 py-1.5 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">
                    Audit Reason / Note
                  </label>
                  <input
                    type="text"
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="Reason for correction…"
                    className="w-full border rounded px-2.5 py-1.5 bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold border bg-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingId === editingRecord.id}
                  className="px-5 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                  style={{
                    backgroundColor: "var(--maroon)",
                    color: "var(--gold)",
                  }}
                >
                  {savingId === editingRecord.id
                    ? "Saving…"
                    : "Save Correction & Log Audit"}
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <p className="text-sm text-gray-500">Loading Parivaar records…</p>
          ) : registrations.length === 0 ? (
            <div className="bg-white rounded-xl shadow p-6 text-center text-sm text-gray-500">
              No Parivaar registrations found matching the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto bg-white rounded-xl shadow border border-orange-100">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-orange-50">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Family ID</th>
                    <th className="px-3 py-2.5 text-left">
                      Family Head&apos;s Name
                    </th>
                    <th className="px-3 py-2.5 text-center">Members</th>
                    <th className="px-3 py-2.5 text-left">
                      Ancestral Village / Hierarchy
                    </th>
                    <th className="px-3 py-2.5 text-left">Phone (Private)</th>
                    <th className="px-3 py-2.5 text-left">
                      Current Address (Private)
                    </th>
                    <th className="px-3 py-2.5 text-left">
                      Visibility / Status
                    </th>
                    <th className="px-3 py-2.5 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((r) => {
                    const st = STATUS_STYLE[r.status] || STATUS_STYLE.approved;
                    return (
                      <tr key={r.id} className="border-t border-gray-100">
                        <td className="px-3 py-2.5">
                          <span
                            className="inline-block font-mono font-extrabold px-2 py-0.5 rounded text-xs"
                            style={{
                              backgroundColor: "var(--maroon)",
                              color: "var(--gold)",
                            }}
                          >
                            {r.family_id || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div
                            className="font-bold leading-snug"
                            style={{ color: "var(--maroon)" }}
                          >
                            {r.full_name}
                          </div>
                          {r.father_name && String(r.father_name).trim() && (
                            <div className="text-xs text-gray-500 font-normal mt-0.5 leading-snug">
                              S/o {String(r.father_name).trim()}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold">
                          {r.member_count || 1}
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          <div className="font-bold text-gray-900">
                            {r.village_name || r.thikana || "—"}{" "}
                            {r.village_code ? `(#${r.village_code})` : ""}
                          </div>
                          <div className="text-gray-500">
                            {r.subdistrict_name || r.subdistrict_code} •{" "}
                            {r.district_name || r.district_code} •{" "}
                            {r.state_name || r.state_code}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-mono">
                          {r.phone_number}
                        </td>
                        <td
                          className="px-3 py-2.5 max-w-xs truncate"
                          title={r.current_address}
                        >
                          {r.current_address}
                        </td>
                        <td className="px-3 py-2.5 space-y-1">
                          <div>
                            <span
                              className="px-2 py-0.5 rounded-full text-xs font-bold"
                              style={{ backgroundColor: st.bg, color: st.fg }}
                            >
                              {r.status}
                            </span>
                          </div>
                          <div className="text-[11px] font-semibold text-gray-600">
                            {r.public_visibility === "private"
                              ? "🔒 Private"
                              : "🌐 Public"}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap space-x-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingRecord({ ...r })}
                            className="px-2 py-1 rounded text-xs font-bold border border-amber-500 text-amber-900 bg-amber-50 hover:bg-amber-100 cursor-pointer"
                          >
                            Edit
                          </button>
                          <select
                            disabled={savingId === r.id}
                            value={r.status}
                            onChange={(e) =>
                              updateRegistrationStatus(r.id, e.target.value)
                            }
                            className="border rounded px-2 py-1 text-xs"
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => deleteRegistration(r)}
                            className="text-red-600 hover:underline text-xs font-semibold cursor-pointer"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Admin Pagination */}
              {totalRegistrations > pageSize && (
                <div className="px-4 py-3 border-t bg-orange-50/40 flex items-center justify-between text-xs">
                  <span>
                    Page <strong>{page}</strong> of <strong>{totalPages}</strong>{" "}
                    ({totalRegistrations.toLocaleString()} total records)
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1 rounded border bg-white font-bold disabled:opacity-40 cursor-pointer"
                    >
                      ← Prev
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="px-3 py-1 rounded border bg-white font-bold disabled:opacity-40 cursor-pointer"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : subView === "audit_log" ? (
        <div className="overflow-x-auto bg-white rounded-xl shadow border border-orange-100">
          <table className="w-full text-xs">
            <thead className="bg-orange-50">
              <tr>
                <th className="px-3 py-2.5 text-left">Timestamp</th>
                <th className="px-3 py-2.5 text-left">Family ID</th>
                <th className="px-3 py-2.5 text-left">Action</th>
                <th className="px-3 py-2.5 text-left">Reason / Notes</th>
                <th className="px-3 py-2.5 text-left">Previous Snapshot</th>
                <th className="px-3 py-2.5 text-left">New Snapshot</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-gray-400"
                  >
                    No registration audit history recorded yet.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-mono font-bold">
                      {log.family_id}
                    </td>
                    <td className="px-3 py-2 font-bold text-[#6B0F1A]">
                      {log.action}
                    </td>
                    <td className="px-3 py-2">{log.reason || "—"}</td>
                    <td className="px-3 py-2 font-mono text-[11px] max-w-xs truncate">
                      {log.previous_values}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] max-w-xs truncate">
                      {log.new_values}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : subView === "missing_reports" ? (
        <div className="overflow-x-auto bg-white rounded-xl shadow border border-orange-100">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-orange-50">
              <tr>
                <th className="px-3 py-2.5 text-left">Reporter</th>
                <th className="px-3 py-2.5 text-left">Level</th>
                <th className="px-3 py-2.5 text-left">Proposed Location</th>
                <th className="px-3 py-2.5 text-left">Parent Context / PIN</th>
                <th className="px-3 py-2.5 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-gray-400"
                  >
                    No missing location reports submitted.
                  </td>
                </tr>
              ) : (
                reports.map((rep) => (
                  <tr key={rep.id} className="border-t border-gray-100">
                    <td className="px-3 py-2.5 font-semibold">
                      {rep.reporter_name}
                    </td>
                    <td className="px-3 py-2.5">{rep.missing_level}</td>
                    <td
                      className="px-3 py-2.5 font-bold"
                      style={{ color: "var(--maroon)" }}
                    >
                      {rep.proposed_name}
                    </td>
                    <td className="px-3 py-2.5">
                      {rep.parent_context || "—"}{" "}
                      {rep.pincode ? `(${rep.pincode})` : ""}
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        disabled={savingId === rep.id}
                        value={rep.status}
                        onChange={(e) =>
                          updateReportStatus(rep.id, e.target.value)
                        }
                        className="border rounded px-2 py-1 text-xs"
                      >
                        {REPORT_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : subView === "data_quality" ? (
        <div className="space-y-4">
          {dataQuality && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl shadow p-3 border border-orange-100">
                <p className="text-xs text-gray-500">
                  आधिकारिक गाँव (Official Villages)
                </p>
                <p
                  className="text-lg font-extrabold"
                  style={{ color: "var(--maroon)" }}
                >
                  {Number(dataQuality.total_villages || 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow p-3 border border-orange-100">
                <p className="text-xs text-gray-500">
                  सत्यापित निर्देशांक (Verified GIS Coords)
                </p>
                <p className="text-lg font-extrabold text-green-700">
                  {Number(
                    dataQuality.verified_coordinates_count || 0
                  ).toLocaleString()}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow p-3 border border-orange-100">
                <p className="text-xs text-gray-500">
                  केवल निर्देशिका (Directory-Only Coords)
                </p>
                <p className="text-lg font-extrabold text-amber-700">
                  {Number(
                    dataQuality.unverified_coordinates_count || 0
                  ).toLocaleString()}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow p-3 border border-orange-100">
                <p className="text-xs text-gray-500">
                  अनाथ रिकॉर्ड (Orphan Parent Records)
                </p>
                <p className="text-lg font-extrabold text-green-700">
                  {Number(
                    dataQuality.orphan_parent_records || 0
                  ).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow border border-orange-100 p-4 space-y-3">
            <div>
              <h3
                className="text-sm font-bold"
                style={{ color: "var(--maroon)" }}
              >
                1. विशेष विराम चिह्न / संक्षिप्त नाम वाले आधिकारिक स्थान (Official LGD Names with Punctuation / Abbreviations)
              </h3>
              <p className="text-xs text-gray-600 mt-0.5">
                आधिकारिक LGD नाम (`name_en`) और कोड (`village_code`) हमेशा सुरक्षित रहते हैं। यदि व्यवस्थापक कोई संशोधित प्रदर्शन नाम (`display_name_override`) सत्यापित करते हैं, तो वह मूल LGD नाम को बदले बिना अलग से सहेजा जाता है।
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-orange-50">
                  <tr>
                    <th className="px-3 py-2 text-left">LGD Code</th>
                    <th className="px-3 py-2 text-left">
                      Preserved Official Name (`name_en`)
                    </th>
                    <th className="px-3 py-2 text-left">
                      Hierarchy (State / District / Tehsil)
                    </th>
                    <th className="px-3 py-2 text-left">
                      Separate Display Label (`display_name_override`)
                    </th>
                    <th className="px-3 py-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(dataQuality?.flagged_punctuation_records || []).map(
                    (rec) => (
                      <tr
                        key={rec.village_code}
                        className="border-t border-gray-100"
                      >
                        <td className="px-3 py-2 font-mono font-bold">
                          {rec.village_code}
                        </td>
                        <td
                          className="px-3 py-2 font-bold"
                          style={{ color: "var(--maroon)" }}
                        >
                          {rec.name_en}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {rec.state_name} → {rec.district_name} →{" "}
                          {rec.subdistrict_name}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={overrideInputs[rec.village_code] ?? ""}
                            onChange={(e) =>
                              setOverrideInputs((prev) => ({
                                ...prev,
                                [rec.village_code]: e.target.value,
                              }))
                            }
                            placeholder="Optional verified display label…"
                            className="border rounded px-2 py-1 text-xs w-48"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            disabled={savingId === rec.village_code}
                            onClick={() =>
                              saveDisplayOverride(rec.village_code)
                            }
                            className="px-2.5 py-1 rounded text-xs font-bold cursor-pointer"
                            style={{
                              backgroundColor: "var(--maroon)",
                              color: "var(--gold)",
                            }}
                          >
                            Save Override
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow border border-orange-100">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-orange-50">
              <tr>
                <th className="px-3 py-2.5 text-left">Source</th>
                <th className="px-3 py-2.5 text-left">Status</th>
                <th className="px-3 py-2.5 text-right">Inserted</th>
                <th className="px-3 py-2.5 text-right">Updated</th>
                <th className="px-3 py-2.5 text-right">Skipped</th>
                <th className="px-3 py-2.5 text-right">Invalid</th>
                <th className="px-3 py-2.5 text-left">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {imports.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-gray-400"
                  >
                    No LGD import runs recorded yet.
                  </td>
                </tr>
              ) : (
                imports.map((imp) => (
                  <tr key={imp.id} className="border-t border-gray-100">
                    <td className="px-3 py-2.5 font-semibold">
                      {imp.dataset_source}
                    </td>
                    <td className="px-3 py-2.5">{imp.import_status}</td>
                    <td className="px-3 py-2.5 text-right">
                      {imp.inserted_count}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {imp.updated_count}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {imp.skipped_count}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {imp.invalid_count}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500">
                      {new Date(imp.import_timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-gray-500">
        🔒 Privacy Control: Phone numbers and residential addresses are visible
        only here to authorised Trust administrators and in authorised private
        exports. Public visitors never receive phone numbers or residential
        addresses.
      </p>
    </div>
  );
}

export default TabParivaar;
