"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Plus, ArrowLeftRight, ArrowUpRight, ArrowDownLeft, AlertCircle, Download } from "lucide-react";
import { exportToCSV, exportToExcel, exportToPDF } from "@/lib/exportUtils";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import Badge from "@/components/Badge";
import { format } from "date-fns";

interface Asset { _id: string; name: string; category: string }
interface Event { _id: string; name: string; location: string }
interface Person { _id: string; name: string }

interface Movement {
  _id: string;
  asset: Asset;
  event: Event;
  allocatedPerson: Person;
  status: "OUT" | "IN";
  outDate: string;
  inDate?: string;
  condition: string;
  returnBy?: string;
  verifiedBy?: string;
  damageReason?: string;
}

const outSchema = z.object({
  asset: z.string().min(1, "Asset required"),
  event: z.string().min(1, "Event required"),
  allocatedPerson: z.string().min(1, "Person required"),
  outDate: z.string().min(1, "Date required"),
  remarks: z.string().optional(),
});

const inSchema = z.object({
  returnBy: z.string().min(1, "Return by is required"),
  verifiedBy: z.string().min(1, "Verified by is required"),
  condition: z.enum(["good", "damaged", "defective", "missing"]),
  damageReason: z.string().optional(),
  remarks: z.string().optional(),
});

type OutForm = z.infer<typeof outSchema>;
type InForm = z.infer<typeof inSchema>;

export default function MovementsPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"" | "OUT" | "IN">("");
  const [showOutModal, setShowOutModal] = useState(false);
  const [showInModal, setShowInModal] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);

  const outForm = useForm<OutForm>({ resolver: zodResolver(outSchema), defaultValues: { outDate: new Date().toISOString().slice(0, 10) } });
  const inForm = useForm<InForm>({ resolver: zodResolver(inSchema), defaultValues: { condition: "good" } });

  const watchCondition = inForm.watch("condition");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const params = filterStatus ? `?status=${filterStatus}` : "";
    const [mRes, aRes, eRes, pRes] = await Promise.all([
      fetch(`/api/movements${params}`),
      fetch("/api/assets"),
      fetch("/api/events"),
      fetch("/api/persons"),
    ]);
    const [mData, aData, eData, pData] = await Promise.all([mRes.json(), aRes.json(), eRes.json(), pRes.json()]) as [
      { success: boolean; data: Movement[] },
      { success: boolean; data: Asset[] },
      { success: boolean; data: Event[] },
      { success: boolean; data: Person[] },
    ];
    if (mData.success) setMovements(mData.data);
    if (aData.success) setAssets(aData.data);
    if (eData.success) setEvents(eData.data);
    if (pData.success) setPersons(pData.data);
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function onOutSubmit(data: OutForm) {
    const res = await fetch("/api/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json() as { success: boolean; error?: string };
    if (result.success) { toast.success("Asset checked out"); setShowOutModal(false); outForm.reset(); fetchAll(); }
    else toast.error(result.error ?? "Error");
  }

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

  function openReturn(m: Movement) {
    setSelectedMovement(m);
    inForm.reset({ condition: "good" });
    setShowInModal(true);
  }

  return (
    <div>
      <PageHeader
        title="Movement Register"
        description="Track asset check-out and check-in"
        action={
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <button onClick={() => exportToCSV(movements.map(m => ({ Asset: m.asset?.name ?? "", Event: m.event?.name ?? "", Person: m.allocatedPerson?.name ?? "", Status: m.status, "Out Date": m.outDate?.slice(0,10) ?? "", "In Date": m.inDate?.slice(0,10) ?? "", Condition: m.condition ?? "" })), "movements")} title="CSV" className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg border border-gray-200"><Download className="w-4 h-4" /></button>
              <button onClick={() => exportToExcel(movements.map(m => ({ Asset: m.asset?.name ?? "", Event: m.event?.name ?? "", Person: m.allocatedPerson?.name ?? "", Status: m.status, "Out Date": m.outDate?.slice(0,10) ?? "", "In Date": m.inDate?.slice(0,10) ?? "", Condition: m.condition ?? "" })), "movements")} title="Excel" className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-gray-200 text-xs font-bold">XLS</button>
              <button onClick={() => exportToPDF(movements.map(m => ({ Asset: m.asset?.name ?? "", Event: m.event?.name ?? "", Person: m.allocatedPerson?.name ?? "", Status: m.status, "Out Date": m.outDate?.slice(0,10) ?? "", Condition: m.condition ?? "" })), "Movement Register", "movements")} title="PDF" className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-gray-200 text-xs font-bold">PDF</button>
            </div>
            <button
              onClick={() => { outForm.reset({ outDate: new Date().toISOString().slice(0, 10) }); setShowOutModal(true); }}
              className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-800"
            >
              <Plus className="w-4 h-4" /> Check Out
            </button>
          </div>
        }
      />

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(["", "OUT", "IN"] as const).map((s) => (
          <button
            key={s || "all"}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterStatus === s ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-600"}`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-white rounded-xl h-24 animate-pulse border border-gray-100" />)}</div>
      ) : movements.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} title="No movements" description="Check out an asset to get started" />
      ) : (
        <div className="space-y-3">
          {movements.map((m) => (
            <div key={m._id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-gray-900 text-sm">{m.asset?.name}</h3>
                    <Badge variant={m.status === "OUT" ? "orange" : "green"}>{m.status}</Badge>
                    {m.condition !== "good" && (
                      <Badge variant="red">{m.condition}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">📅 {m.event?.name} · {m.event?.location}</p>
                  <p className="text-xs text-gray-500">👤 {m.allocatedPerson?.name}</p>
                  <p className="text-xs text-gray-500">
                    OUT: {format(new Date(m.outDate), "dd MMM yyyy HH:mm")}
                    {m.inDate && ` · IN: ${format(new Date(m.inDate), "dd MMM yyyy HH:mm")}`}
                  </p>
                </div>
                {m.status === "OUT" && (
                  <button
                    onClick={() => openReturn(m)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded-lg hover:bg-green-100"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" /> Return
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Check Out Modal */}
      {showOutModal && (
        <Modal title="Check Out Asset" onClose={() => setShowOutModal(false)}>
          <form onSubmit={outForm.handleSubmit(onOutSubmit)} className="space-y-4">
            <Field label="Asset" error={outForm.formState.errors.asset?.message}>
              <select {...outForm.register("asset")} className="select">
                <option value="">Select asset…</option>
                {assets.map(a => <option key={a._id} value={a._id}>{a.name} ({a.category})</option>)}
              </select>
            </Field>
            <Field label="Event" error={outForm.formState.errors.event?.message}>
              <select {...outForm.register("event")} className="select">
                <option value="">Select event…</option>
                {events.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
              </select>
            </Field>
            <Field label="Allocated Person" error={outForm.formState.errors.allocatedPerson?.message}>
              <select {...outForm.register("allocatedPerson")} className="select">
                <option value="">Select person…</option>
                {persons.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Out Date" error={outForm.formState.errors.outDate?.message}>
              <input type="date" {...outForm.register("outDate")} className="input" />
            </Field>
            <Field label="Remarks">
              <textarea {...outForm.register("remarks")} className="input resize-none" rows={2} placeholder="Optional notes…" />
            </Field>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowOutModal(false)} className="flex-1 py-2.5 border border-gray-200 text-sm font-medium rounded-xl">Cancel</button>
              <button type="submit" disabled={outForm.formState.isSubmitting} className="flex-1 py-2.5 bg-blue-700 text-white text-sm font-medium rounded-xl disabled:opacity-60 flex items-center justify-center gap-2">
                <ArrowUpRight className="w-4 h-4" />
                {outForm.formState.isSubmitting ? "Saving…" : "Check Out"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Check In Modal */}
      {showInModal && selectedMovement && (
        <Modal title="Return Asset" onClose={() => { setShowInModal(false); setSelectedMovement(null); }}>
          <div className="mb-4 p-3 bg-gray-50 rounded-xl text-sm">
            <p className="font-medium">{selectedMovement.asset?.name}</p>
            <p className="text-gray-500 text-xs">{selectedMovement.event?.name} · {selectedMovement.allocatedPerson?.name}</p>
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
              <button type="button" onClick={() => { setShowInModal(false); setSelectedMovement(null); }} className="flex-1 py-2.5 border border-gray-200 text-sm font-medium rounded-xl">Cancel</button>
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
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
