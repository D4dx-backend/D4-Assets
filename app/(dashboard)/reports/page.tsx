"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChart3, Download, AlertTriangle, ArrowLeftRight, History } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
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
  createdAt: string;
}

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

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ type: reportType });
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    const res = await fetch(`/api/reports?${params.toString()}`);
    const result = await res.json() as { success: boolean; data: unknown[] };
    if (result.success) setData(result.data as Movement[] | DamageReport[] | ActivityLog[]);
    setLoading(false);
  }, [reportType, fromDate, toDate]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  function getExportRows() {
    if (reportType === "movement") {
      return (data as Movement[]).map(m => ({
        Asset: m.asset?.name ?? "",
        Event: m.event?.name ?? "",
        Person: m.allocatedPerson?.name ?? "",
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

    if (reportType === "movement") {
      const rows = (data as Movement[]).map((m) => [
        m.asset?.name ?? "",
        m.event?.name ?? "",
        m.allocatedPerson?.name ?? "",
        format(new Date(m.outDate), "dd/MM/yyyy"),
        m.inDate ? format(new Date(m.inDate), "dd/MM/yyyy") : "–",
        m.status,
        m.condition,
      ]);
      autoTable(doc, {
        startY: 35,
        head: [["Asset", "Event", "Person", "Out Date", "In Date", "Status", "Condition"]],
        body: rows,
        styles: { fontSize: 8 },
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
        startY: 35,
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
        startY: 35,
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
                title="CSV"
                className="p-2 text-gray-500 dark:text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg border border-gray-200 dark:border-slate-600"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => exportToExcel(getExportRows(), `${reportType}-report`)}
                title="Excel"
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

      {/* Report tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setReportType(tab.key)}
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

      {/* Date filter */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input" />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input" />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="bg-white dark:bg-slate-800 rounded-xl h-16 animate-pulse border border-gray-100 dark:border-slate-700" />)}</div>
      ) : data.length === 0 ? (
        <EmptyState icon={BarChart3} title="No data" description="No records found for the selected period" />
      ) : reportType === "movement" ? (
        <MovementTable data={data as Movement[]} />
      ) : reportType === "damage" ? (
        <DamageTable data={data as DamageReport[]} />
      ) : (
        <ActivityTable data={data as ActivityLog[]} />
      )}
    </div>
  );
}

function MovementTable({ data }: { data: Movement[] }) {
  return (
    <div className="space-y-3">
      {data.map((m) => (
        <div key={m._id} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-sm text-gray-900 dark:text-white">{m.asset?.name}</span>
            <Badge variant={m.status === "OUT" ? "orange" : "green"}>{m.status}</Badge>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400">{m.event?.name} · {m.event?.location}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">Person: {m.allocatedPerson?.name}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Out: {format(new Date(m.outDate), "dd MMM yyyy")}
            {m.inDate && ` · In: ${format(new Date(m.inDate), "dd MMM yyyy")}`}
          </p>
          {m.condition !== "good" && <Badge variant="red">{m.condition}</Badge>}
        </div>
      ))}
    </div>
  );
}

function DamageTable({ data }: { data: DamageReport[] }) {
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d._id} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-red-100 dark:border-red-900/40">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-sm text-gray-900 dark:text-white">{d.asset?.name}</span>
            <Badge variant={d.isResolved ? "green" : "red"}>{d.isResolved ? "Resolved" : "Open"}</Badge>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400">{d.event?.name}</p>
          <p className="text-xs font-medium text-red-700 dark:text-red-400 mt-1 capitalize">{d.type}: {d.reason}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Reported by {d.reportedBy?.name} · {format(new Date(d.createdAt), "dd MMM yyyy")}</p>
        </div>
      ))}
    </div>
  );
}

function ActivityTable({ data }: { data: ActivityLog[] }) {
  return (
    <div className="space-y-2">
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
  );
}
