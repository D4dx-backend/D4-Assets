"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeftRight, Download, FileSpreadsheet, FileText } from "lucide-react";
import { exportToCSV, exportToExcel, exportToPDF } from "@/lib/exportUtils";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import Badge from "@/components/Badge";
import Pagination from "@/components/Pagination";
import { format } from "date-fns";

interface MvAsset { _id: string; name: string; category: string }
interface MvEvent { _id: string; name: string; location: string }
interface MvPerson { _id: string; name: string }

interface Movement {
  _id: string;
  asset: MvAsset;
  event: MvEvent;
  allocatedPerson: MvPerson;
  status: "OUT" | "IN";
  outDate: string;
  inDate?: string;
  condition: string;
  returnBy?: string;
  verifiedBy?: string;
  damageReason?: string;
  remarks?: string;
}

export default function MovementsPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"" | "OUT" | "IN">("")
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 10 });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "10" });
    if (filterStatus) params.set("status", filterStatus);
    const mRes = await fetch(`/api/movements?${params.toString()}`);
    if (!mRes.ok) { setLoading(false); return; }
    const mData = await mRes.json() as { success: boolean; data: Movement[]; pagination: { total: number; totalPages: number; limit: number } };
    if (mData.success) {
      setMovements(mData.data);
      setPagination(mData.pagination);
    }
    setLoading(false);
  }, [filterStatus, page]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { setPage(1); }, [filterStatus]);

  function movementRow(m: Movement) {
    return {
      "Event": m.event?.name ?? "",
      "Event Location": m.event?.location ?? "",
      "Asset": m.asset?.name ?? "",
      "Category": m.asset?.category ?? "",
      "Issued To": m.allocatedPerson?.name ?? "",
      "Status": m.status === "OUT" ? "Issued (Not Returned)" : "Returned",
      "Issued On": m.outDate ? format(new Date(m.outDate), "dd MMM yyyy HH:mm") : "",
      "Returned On": m.inDate ? format(new Date(m.inDate), "dd MMM yyyy HH:mm") : "—",
      "Condition on Return": m.inDate ? (m.condition ?? "good") : "—",
      "Returned By": m.returnBy ?? "—",
      "Verified By": m.verifiedBy ?? "—",
      "Damage Reason": m.damageReason ?? "—",
      "Remarks": m.remarks ?? "—",
    };
  }

  return (
    <div>
      <PageHeader
        title="Movement Register"
        description="Global movement log — issue assets from the event page"
        action={
          <div className="flex gap-1">
            <button onClick={() => exportToCSV(movements.map(movementRow), "movements")} title="CSV" className="p-2 text-gray-500 dark:text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg border border-gray-200 dark:border-slate-600"><Download className="w-4 h-4" /></button>
            <button onClick={() => exportToExcel(movements.map(movementRow), "movements")} title="Excel" className="p-2 text-gray-500 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg border border-gray-200 dark:border-slate-600 text-xs font-bold">XLS</button>
            <button onClick={() => exportToPDF(movements.map(movementRow), "Movement Register", "movements")} title="PDF" className="p-2 text-gray-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg border border-gray-200 dark:border-slate-600 text-xs font-bold">PDF</button>
          </div>
        }
      />

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(["", "OUT", "IN"] as const).map((s) => (
          <button
            key={s || "all"}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterStatus === s ? "bg-blue-700 text-white" : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300"}`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-white dark:bg-slate-800 rounded-xl h-24 animate-pulse border border-gray-100 dark:border-slate-700" />)}</div>
      ) : movements.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} title="No movements" description="Check out an asset to get started" />
      ) : (
        <div className="space-y-3">
          {movements.map((m) => (
            <div key={m._id} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-gray-900 dark:text-white text-sm">{m.asset?.name}</h3>
                    <Badge variant={m.status === "OUT" ? "orange" : "green"}>{m.status}</Badge>
                    {m.condition !== "good" && (
                      <Badge variant="red">{m.condition}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">📅 {m.event?.name} · {m.event?.location}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">👤 {m.allocatedPerson?.name}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    OUT: {format(new Date(m.outDate), "dd MMM yyyy HH:mm")}
                    {m.inDate && ` · IN: ${format(new Date(m.inDate), "dd MMM yyyy HH:mm")}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => exportToExcel([movementRow(m)], `movement-${m._id}`)}
                    title="Download Excel"
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => exportToPDF([movementRow(m)], `${m.asset?.name ?? "Asset"} — Movement`, `movement-${m._id}`)}
                    title="Download PDF"
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        limit={pagination.limit}
        onPageChange={setPage}
      />

    </div>
  );
}
