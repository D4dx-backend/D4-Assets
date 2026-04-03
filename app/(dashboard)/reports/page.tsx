"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { BarChart3, Download, AlertTriangle, ArrowLeftRight, History, Search, X, Pencil, CheckCircle } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import SearchInput from "@/components/SearchInput";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import Pagination from "@/components/Pagination";
import Modal from "@/components/Modal";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { exportToCSV, exportToExcel } from "@/lib/exportUtils";

type ReportType = "movement" | "damage" | "activity";

interface Movement {
  _id: string;
  asset: { name: string; category: string };
  event: { name: string; location: string };
  allocatedPerson: { name: string };
  outBy: { name: string };
  status: string;
  outDate: string;
  inDate?: string;
  condition: string;
  returnBy?: string;
  verifiedBy?: string;
}

interface DamageReport {
  _id: string;
  asset: { name: string; category: string };
  event: { name: string };
  type: string;
  reason: string;
  reportedBy: { name: string };
  isResolved: boolean;
  resolvedAt?: string;
  resolvedBy?: { name: string };
  notes?: string;
  createdAt: string;
}

const damageEditSchema = z.object({
  type: z.enum(["damage", "defect", "missing"]),
  reason: z.string().min(1, "Reason is required"),
  notes: z.string().optional(),
  isResolved: z.boolean(),
});
type DamageEditForm = z.infer<typeof damageEditSchema>;

interface ActivityLog {
  _id: string;
  userName: string;
  action: string;
  module: string;
  details?: string;
  createdAt: string;
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("movement");
  const [data, setData] = useState<Movement[] | DamageReport[] | ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [assetName, setAssetName] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 10 });
  const [editingReport, setEditingReport] = useState<DamageReport | null>(null);

  const editForm = useForm<DamageEditForm>({
    resolver: zodResolver(damageEditSchema),
    defaultValues: { type: "damage", reason: "", notes: "", isResolved: false },
  });

  function openEditModal(report: DamageReport) {
    editForm.reset({
      type: report.type as "damage" | "defect" | "missing",
      reason: report.reason,
      notes: report.notes ?? "",
      isResolved: report.isResolved,
    });
    setEditingReport(report);
  }

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ type: reportType, page: String(page), limit: "10" });
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (assetName.trim()) params.set("assetName", assetName.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (search.trim()) params.set("search", search.trim());
    const res = await fetch(`/api/reports?${params.toString()}`);
    const result = await res.json() as { success: boolean; data: unknown[]; pagination: { total: number; totalPages: number; limit: number } };
    if (result.success) {
      setData(result.data as Movement[] | DamageReport[] | ActivityLog[]);
      setPagination(result.pagination);
    }
    setLoading(false);
  }, [reportType, fromDate, toDate, assetName, statusFilter, search, page]);

  async function onEditSubmit(formData: DamageEditForm) {
    if (!editingReport) return;
    const res = await fetch(`/api/reports/${editingReport._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    const result = await res.json() as { success: boolean; error?: string };
    if (result.success) {
      toast.success("Report updated");
      setEditingReport(null);
      fetchReport();
    } else {
      toast.error(result.error ?? "Failed to update report");
    }
  }

  async function quickResolve(report: DamageReport) {
    const res = await fetch(`/api/reports/${report._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isResolved: !report.isResolved }),
    });
    const result = await res.json() as { success: boolean; error?: string };
    if (result.success) {
      toast.success(report.isResolved ? "Marked as open" : "Marked as resolved");
      fetchReport();
    } else {
      toast.error(result.error ?? "Failed");
    }
  }

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [reportType, fromDate, toDate, assetName, statusFilter, search]);

  function clearFilters() {
    setFromDate("");
    setToDate("");
    setAssetName("");
    setStatusFilter("");
    setSearch("");
    setPage(1);
  }

  const hasActiveFilters = fromDate || toDate || assetName || statusFilter || search;

  function getExportRows() {
    if (reportType === "movement") {
      return (data as Movement[]).map(m => ({
        Asset: m.asset?.name ?? "",
        Category: m.asset?.category ?? "",
        Event: m.event?.name ?? "",
        Location: m.event?.location ?? "",
        Person: m.allocatedPerson?.name ?? "",
        "Out By": m.outBy?.name ?? "",
        "Out Date": m.outDate ? format(new Date(m.outDate), "dd/MM/yyyy") : "",
        "In Date": m.inDate ? format(new Date(m.inDate), "dd/MM/yyyy") : "",
        Status: m.status,
        Condition: m.condition ?? "",
      }));
    }
    if (reportType === "damage") {
      return (data as DamageReport[]).map(d => ({
        Asset: d.asset?.name ?? "",
        Event: d.event?.name ?? "",
        Type: d.type,
        Reason: d.reason,
        "Reported By": d.reportedBy?.name ?? "",
        Status: d.isResolved ? "Resolved" : "Open",
        Date: format(new Date(d.createdAt), "dd/MM/yyyy"),
      }));
    }
    return (data as ActivityLog[]).map(l => ({
      User: l.userName,
      Action: l.action,
      Module: l.module,
      Details: l.details ?? "",
      "Date/Time": format(new Date(l.createdAt), "dd/MM/yyyy HH:mm"),
    }));
  }

  function exportPDF() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Asset Management — " + reportType.charAt(0).toUpperCase() + reportType.slice(1) + " Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`, 14, 28);
    const filterParts: string[] = [];
    if (fromDate) filterParts.push(`From: ${fromDate}`);
    if (toDate) filterParts.push(`To: ${toDate}`);
    if (assetName) filterParts.push(`Asset: ${assetName}`);
    if (statusFilter) filterParts.push(`Status: ${statusFilter}`);
    if (search) filterParts.push(`Search: ${search}`);
    if (filterParts.length) doc.text("Filters: " + filterParts.join(" | "), 14, 35);

    const startY = filterParts.length ? 42 : 35;

    if (reportType === "movement") {
      const rows = (data as Movement[]).map((m) => [
        m.asset?.name ?? "",
        m.asset?.category ?? "",
        m.event?.name ?? "",
        m.event?.location ?? "",
        m.allocatedPerson?.name ?? "",
        m.outDate ? format(new Date(m.outDate), "dd/MM/yy") : "",
        m.inDate ? format(new Date(m.inDate), "dd/MM/yy") : "–",
        m.status,
        m.condition,
      ]);
      autoTable(doc, {
        startY,
        head: [["Asset", "Category", "Event", "Location", "Person", "Out", "In", "Status", "Condition"]],
        body: rows,
        styles: { fontSize: 7 },
      });
    } else if (reportType === "damage") {
      const rows = (data as DamageReport[]).map((d) => [
        d.asset?.name ?? "",
        d.event?.name ?? "",
        d.type,
        d.reason,
        d.reportedBy?.name ?? "",
        d.isResolved ? "Resolved" : "Open",
        format(new Date(d.createdAt), "dd/MM/yyyy"),
      ]);
      autoTable(doc, {
        startY,
        head: [["Asset", "Event", "Type", "Reason", "Reported By", "Status", "Date"]],
        body: rows,
        styles: { fontSize: 8 },
      });
    } else {
      const rows = (data as ActivityLog[]).map((l) => [
        l.userName,
        l.action,
        l.module,
        l.details ?? "",
        format(new Date(l.createdAt), "dd/MM/yyyy HH:mm"),
      ]);
      autoTable(doc, {
        startY,
        head: [["User", "Action", "Module", "Details", "Date/Time"]],
        body: rows,
        styles: { fontSize: 8 },
      });
    }

    doc.save(`${reportType}-report-${format(new Date(), "yyyyMMdd")}.pdf`);
  }

  const tabs: { key: ReportType; label: string; icon: React.ElementType }[] = [
    { key: "movement", label: "Movement", icon: ArrowLeftRight },
    { key: "damage", label: "Damage/Defect", icon: AlertTriangle },
    { key: "activity", label: "Activity Log", icon: History },
  ];

  return (
    <div>
      <PageHeader
        title="Reports"
        description="View and export reports"
        action={
          <div className="flex gap-1">
            <button
              onClick={() => exportToCSV(getExportRows(), `${reportType}-report`)}
              title="Export CSV"
              className="p-2 text-gray-500 dark:text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg border border-gray-200 dark:border-slate-600"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => exportToExcel(getExportRows(), `${reportType}-report`)}
              title="Export Excel"
              className="p-2 text-gray-500 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg border border-gray-200 dark:border-slate-600 text-xs font-bold"
            >
              XLS
            </button>
            <button
              onClick={exportPDF}
              className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-900"
            >
              <Download className="w-4 h-4" /> PDF
            </button>
          </div>
        }
      />

      {/* Report type tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => { setReportType(tab.key); clearFilters(); setPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                reportType === tab.key ? "bg-blue-700 text-white" : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 mb-4 space-y-3">
        {/* Search */}
        <SearchInput
          value={search}
          onChange={setSearch}
          suggestions={(() => {
            if (reportType === "movement") {
              const d = data as Movement[];
              return [
                ...new Set([
                  ...d.map((m) => m.asset?.name),
                  ...d.map((m) => m.event?.name),
                  ...d.map((m) => m.allocatedPerson?.name),
                ].filter(Boolean)),
              ] as string[];
            }
            if (reportType === "damage") {
              const d = data as DamageReport[];
              return [
                ...new Set([
                  ...d.map((m) => m.asset?.name),
                  ...d.map((m) => m.event?.name),
                ].filter(Boolean)),
              ] as string[];
            }
            return [];
          })()}
          placeholder={reportType === "movement" ? "Search asset, event, person…" : "Search…"}
          className="w-full"
        />

        {/* Row 2: date + item + status */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">From</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input w-full" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">To</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input w-full" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Asset / Item</label>
            <input
              type="text"
              placeholder="Asset name…"
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              className="input w-full"
            />
          </div>
          {reportType === "movement" && (
            <div>
              <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input w-full">
                <option value="">All</option>
                <option value="OUT">OUT</option>
                <option value="IN">IN</option>
              </select>
            </div>
          )}
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-gray-500 dark:text-slate-400">{pagination.total} result{pagination.total !== 1 ? "s" : ""}</p>
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
              <X className="w-3 h-3" /> Clear filters
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="bg-white dark:bg-slate-800 rounded-xl h-16 animate-pulse border border-gray-100 dark:border-slate-700" />)}</div>
      ) : data.length === 0 ? (
        <EmptyState icon={BarChart3} title="No data" description="No records found for the selected filters" />
      ) : reportType === "movement" ? (
        <MovementReport data={data as Movement[]} />
      ) : reportType === "damage" ? (
        <DamageReport data={data as DamageReport[]} onEdit={openEditModal} onResolve={quickResolve} />
      ) : (
        <ActivityReport data={data as ActivityLog[]} />
      )}

      <Pagination
        page={page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        limit={pagination.limit}
        onPageChange={setPage}
      />

      {/* ── Edit Damage Report Modal ── */}
      {!!editingReport && (
      <Modal
        onClose={() => setEditingReport(null)}
        title="Edit Damage Report"
      >
        {editingReport && (
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              <span className="font-medium text-gray-900 dark:text-white">{editingReport.asset?.name}</span>
              {" · "}{editingReport.event?.name}
            </p>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Type</label>
              <select {...editForm.register("type")} className="input w-full">
                <option value="damage">Damage</option>
                <option value="defect">Defect</option>
                <option value="missing">Missing</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Reason</label>
              <textarea
                {...editForm.register("reason")}
                rows={3}
                className="input w-full"
                placeholder="Describe the damage / defect…"
              />
              {editForm.formState.errors.reason && (
                <p className="text-xs text-red-500 mt-1">{editForm.formState.errors.reason.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Notes (optional)</label>
              <textarea
                {...editForm.register("notes")}
                rows={2}
                className="input w-full"
                placeholder="Internal notes…"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...editForm.register("isResolved")}
                className="w-4 h-4 rounded accent-green-600"
              />
              <span className="text-sm text-gray-700 dark:text-slate-300">Mark as Resolved</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingReport(null)}
                className="px-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editForm.formState.isSubmitting}
                className="px-4 py-2 text-sm rounded-xl bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {editForm.formState.isSubmitting ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        )}
      </Modal>
      )}
    </div>
  );
}

/* ── Movement Report ── */
function MovementReport({ data }: { data: Movement[] }) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-700/60 text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Asset</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Event</th>
              <th className="px-4 py-3 text-left">Location</th>
              <th className="px-4 py-3 text-left">Person</th>
              <th className="px-4 py-3 text-left">Out Date</th>
              <th className="px-4 py-3 text-left">In Date</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Condition</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {data.map((m) => (
              <tr key={m._id} className="bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{m.asset?.name}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-slate-400 capitalize">{m.asset?.category}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{m.event?.name}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{m.event?.location}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{m.allocatedPerson?.name}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-slate-400 whitespace-nowrap">
                  {m.outDate ? format(new Date(m.outDate), "dd MMM yyyy") : "–"}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-slate-400 whitespace-nowrap">
                  {m.inDate ? format(new Date(m.inDate), "dd MMM yyyy") : "–"}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={m.status === "OUT" ? "orange" : "green"}>{m.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  {m.condition && m.condition !== "good"
                    ? <Badge variant="red">{m.condition}</Badge>
                    : <span className="text-xs text-gray-400 dark:text-slate-500 capitalize">{m.condition}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {data.map((m) => (
          <div key={m._id} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-sm text-gray-900 dark:text-white">{m.asset?.name}</span>
              <Badge variant={m.status === "OUT" ? "orange" : "green"}>{m.status}</Badge>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400">{m.event?.name} · {m.event?.location}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">Person: {m.allocatedPerson?.name}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Out: {m.outDate ? format(new Date(m.outDate), "dd MMM yyyy") : "–"}
              {m.inDate && ` · In: ${format(new Date(m.inDate), "dd MMM yyyy")}`}
            </p>
            {m.condition && m.condition !== "good" && <Badge variant="red">{m.condition}</Badge>}
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Damage Report ── */
function DamageReport({
  data,
  onEdit,
  onResolve,
}: {
  data: DamageReport[];
  onEdit: (r: DamageReport) => void;
  onResolve: (r: DamageReport) => void;
}) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-700/60 text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Asset</th>
              <th className="px-4 py-3 text-left">Event</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Reason</th>
              <th className="px-4 py-3 text-left">Reported By</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {data.map((d) => (
              <tr key={d._id} className="bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{d.asset?.name}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{d.event?.name}</td>
                <td className="px-4 py-3 capitalize text-red-600 dark:text-red-400 font-medium">{d.type}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-slate-400 max-w-xs truncate">{d.reason}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{d.reportedBy?.name}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-slate-400 whitespace-nowrap">
                  {format(new Date(d.createdAt), "dd MMM yyyy")}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={d.isResolved ? "green" : "red"}>{d.isResolved ? "Resolved" : "Open"}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEdit(d)}
                      title="Edit report"
                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onResolve(d)}
                      title={d.isResolved ? "Re-open" : "Mark resolved"}
                      className={`p-1 rounded ${d.isResolved ? "text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20" : "text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"}`}
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {data.map((d) => (
          <div key={d._id} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-red-100 dark:border-red-900/40">
            <div className="flex items-start justify-between mb-1">
              <div>
                <span className="font-medium text-sm text-gray-900 dark:text-white">{d.asset?.name}</span>
                <p className="text-xs text-gray-500 dark:text-slate-400">{d.event?.name}</p>
                <p className="text-xs font-medium text-red-700 dark:text-red-400 mt-1 capitalize">{d.type}: {d.reason}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                  Reported by {d.reportedBy?.name} · {format(new Date(d.createdAt), "dd MMM yyyy")}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant={d.isResolved ? "green" : "red"}>{d.isResolved ? "Resolved" : "Open"}</Badge>
                <div className="flex gap-1 mt-1">
                  <button onClick={() => onEdit(d)} className="p-1 text-gray-400 hover:text-blue-600 rounded">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => onResolve(d)} className={`p-1 rounded ${d.isResolved ? "text-gray-400 hover:text-orange-500" : "text-gray-400 hover:text-green-600"}`}>
                    <CheckCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Activity Report ── */
function ActivityReport({ data }: { data: ActivityLog[] }) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-700/60 text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Action</th>
              <th className="px-4 py-3 text-left">Module</th>
              <th className="px-4 py-3 text-left">Details</th>
              <th className="px-4 py-3 text-left">Date / Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {data.map((log) => (
              <tr key={log._id} className="bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{log.userName}</td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 px-2 py-0.5 rounded">{log.action}</span>
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{log.module}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-slate-400 max-w-xs truncate">{log.details}</td>
                <td className="px-4 py-3 text-gray-400 dark:text-slate-500 whitespace-nowrap">
                  {format(new Date(log.createdAt), "dd MMM yyyy HH:mm")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {data.map((log) => (
          <div key={log._id} className="bg-white dark:bg-slate-800 rounded-xl px-4 py-3 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 px-2 py-0.5 rounded">{log.action}</span>
                <span className="text-xs text-gray-500 dark:text-slate-400">{log.module}</span>
              </div>
              <p className="text-xs text-gray-700 dark:text-slate-300 mt-0.5">{log.userName} — {log.details}</p>
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 flex-shrink-0">{format(new Date(log.createdAt), "dd MMM HH:mm")}</p>
          </div>
        ))}
      </div>
    </>
  );
}


