"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { ArrowLeftRight, ArrowDownLeft, AlertCircle, Download, FileSpreadsheet, FileText } from "lucide-react";
import { exportToCSV, exportToExcel, exportToPDF } from "@/lib/exportUtils";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
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

const inSchema = z.object({
  returnBy: z.string().min(1, "Return by is required"),
  verifiedBy: z.string().min(1, "Verified by is required"),
  condition: z.enum(["good", "damaged", "defective", "missing"]),
  damageReason: z.string().optional(),
  remarks: z.string().optional(),
});

type InForm = z.infer<typeof inSchema>;

export default function MovementsPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"" | "OUT" | "IN">("")
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 10 });
  const [showInModal, setShowInModal] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);

  const inForm = useForm<InForm>({ resolver: zodResolver(inSchema), defaultValues: { condition: "good" } });

  const watchCondition = inForm.watch("condition");

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

  async function onInSubmit(data: InForm) {
    if (!selectedMovement) return;
    const res = await fetch(`/api/movements/${selectedMovement._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json() as { success: boolean; error?: string };
    if (result.success) {
      toast.success("Asset returned");
      setShowInModal(false);
      setSelectedMovement(null);
      inForm.reset();
      fetchAll();
    } else {
      toast.error(result.error ?? "Error");
    }
  }

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

  function openReturn(m: Movement) {
    setSelectedMovement(m);
    inForm.reset({ condition: "good" });
    setShowInModal(true);
  }

  return (
    <div>
      <PageHeader
        title="Movement Register"
        description="Global movement log — issue assets from the event page"
        action={
          <div className="flex gap-1">
            <button onClick={() => exportToCSV(movements.map(m => ({ Asset: m.asset?.name ?? "", Event: m.event?.name ?? "", Person: m.allocatedPerson?.name ?? "", Status: m.status, "Out Date": m.outDate?.slice(0,10) ?? "", "In Date": m.inDate?.slice(0,10) ?? "", Condition: m.condition ?? "" })), "movements")} title="CSV" className="p-2 text-gray-500 dark:text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg border border-gray-200 dark:border-slate-600"><Download className="w-4 h-4" /></button>
            <button onClick={() => exportToExcel(movements.map(m => ({ Asset: m.asset?.name ?? "", Event: m.event?.name ?? "", Person: m.allocatedPerson?.name ?? "", Status: m.status, "Out Date": m.outDate?.slice(0,10) ?? "", "In Date": m.inDate?.slice(0,10) ?? "", Condition: m.condition ?? "" })), "movements")} title="Excel" className="p-2 text-gray-500 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg border border-gray-200 dark:border-slate-600 text-xs font-bold">XLS</button>
            <button onClick={() => exportToPDF(movements.map(m => ({ Asset: m.asset?.name ?? "", Event: m.event?.name ?? "", Person: m.allocatedPerson?.name ?? "", Status: m.status, "Out Date": m.outDate?.slice(0,10) ?? "", Condition: m.condition ?? "" })), "Movement Register", "movements")} title="PDF" className="p-2 text-gray-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg border border-gray-200 dark:border-slate-600 text-xs font-bold">PDF</button>
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
                  {m.status === "OUT" && (
                    <button
                      onClick={() => openReturn(m)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded-lg hover:bg-green-100 ml-1"
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5" /> Return
                    </button>
                  )}
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

      {/* Check In Modal */}
      {showInModal && selectedMovement && (
        <Modal title="Return Asset" onClose={() => { setShowInModal(false); setSelectedMovement(null); }}>
          <div className="mb-4 p-3 bg-gray-50 dark:bg-slate-700 rounded-xl text-sm">
            <p className="font-medium dark:text-white">{selectedMovement.asset?.name}</p>
            <p className="text-gray-500 dark:text-slate-400 text-xs">{selectedMovement.event?.name} · {selectedMovement.allocatedPerson?.name}</p>
          </div>
          <form onSubmit={inForm.handleSubmit(onInSubmit)} className="space-y-4">
            <Field label="Return By" error={inForm.formState.errors.returnBy?.message}>
              <input {...inForm.register("returnBy")} className="input" placeholder="Name of person returning" />
            </Field>
            <Field label="Verified By" error={inForm.formState.errors.verifiedBy?.message}>
              <input {...inForm.register("verifiedBy")} className="input" placeholder="Name of verifier" />
            </Field>
            <Field label="Condition" error={inForm.formState.errors.condition?.message}>
              <select {...inForm.register("condition")} className="select">
                <option value="good">Good</option>
                <option value="damaged">Damaged</option>
                <option value="defective">Defective</option>
                <option value="missing">Missing</option>
              </select>
            </Field>
            {watchCondition !== "good" && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <p className="text-xs font-medium text-red-700">This will create a damage/defect report</p>
                </div>
                <Field label="Reason / Description" error={inForm.formState.errors.damageReason?.message}>
                  <textarea {...inForm.register("damageReason")} className="input resize-none" rows={3} placeholder="Describe the issue…" />
                </Field>
              </div>
            )}
            <Field label="Remarks">
              <textarea {...inForm.register("remarks")} className="input resize-none" rows={2} placeholder="Optional notes…" />
            </Field>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setShowInModal(false); setSelectedMovement(null); }} className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700">Cancel</button>
              <button type="submit" disabled={inForm.formState.isSubmitting} className="flex-1 py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl disabled:opacity-60 flex items-center justify-center gap-2">
                <ArrowDownLeft className="w-4 h-4" />
                {inForm.formState.isSubmitting ? "Saving…" : "Confirm Return"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
