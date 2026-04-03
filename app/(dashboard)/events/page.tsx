"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, CalendarDays, UserPlus, ArrowRight, ArrowDownLeft, AlertCircle, Download, FileSpreadsheet, FileText, Search, X } from "lucide-react";
import Link from "next/link";
import { exportToCSV, exportToExcel, exportToPDF } from "@/lib/exportUtils";
import PageHeader from "@/components/PageHeader";
import SearchInput from "@/components/SearchInput";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import Badge from "@/components/Badge";
import Pagination from "@/components/Pagination";
import { format } from "date-fns";
import { useSession } from "next-auth/react";

interface Person { _id: string; name: string }
interface Event {
  _id: string;
  name: string;
  location: string;
  fromDate: string;
  toDate: string;
  status: "upcoming" | "active" | "completed";
  responsiblePerson: Person;
  outCount: number;
  inCount: number;
  totalAssets: number;
}

interface OutMovement {
  _id: string;
  asset: { _id: string; name: string; category: string };
  allocatedPerson?: { _id: string; name: string };
  outDate: string;
}

const inSchema = z.object({
  returnBy: z.string().min(1, "Return by is required"),
  verifiedBy: z.string().min(1, "Verified by is required"),
  condition: z.enum(["good", "damaged", "defective", "missing"]),
  damageReason: z.string().optional(),
  remarks: z.string().optional(),
});
type InForm = z.infer<typeof inSchema>;

const schema = z.object({
  name: z.string().min(1, "Event name is required"),
  location: z.string().min(1, "Location is required"),
  fromDate: z.string().min(1, "Start date is required"),
  toDate: z.string().min(1, "End date is required"),
  responsiblePerson: z.string().min(1, "Responsible person is required"),
  status: z.enum(["upcoming", "active", "completed"]),
});

type EventForm = z.infer<typeof schema>;

const statusVariants: Record<string, "blue" | "green" | "gray"> = {
  upcoming: "blue",
  active: "green",
  completed: "gray",
};

export default function EventsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [events, setEvents] = useState<Event[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 10 });
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [addingPerson, setAddingPerson] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "upcoming" | "active" | "completed">("all");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Return modal state
  const [showReturnPicker, setShowReturnPicker] = useState(false);
  const [returnEventMovements, setReturnEventMovements] = useState<OutMovement[]>([]);
  const [returnEventName, setReturnEventName] = useState("");
  const [loadingReturnList, setLoadingReturnList] = useState(false);
  const [showInModal, setShowInModal] = useState(false);
  const [selectedMovementForReturn, setSelectedMovementForReturn] = useState<OutMovement | null>(null);

  const inForm = useForm<InForm>({ resolver: zodResolver(inSchema), defaultValues: { condition: "good" } });
  const watchCondition = inForm.watch("condition");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EventForm>({ resolver: zodResolver(schema) });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "10" });
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (search) params.set("search", search);
    const [evRes, pRes] = await Promise.all([
      fetch(`/api/events?${params.toString()}`),
      fetch("/api/persons?all=true"),
    ]);
    const [evData, pData] = await Promise.all([evRes.json(), pRes.json()]) as [
      { success: boolean; data: Event[]; pagination: { total: number; totalPages: number; limit: number } },
      { success: boolean; data: Person[] }
    ];
    if (evData.success) {
      setEvents(evData.data);
      setPagination(evData.pagination);
    }
    if (pData.success) setPersons(pData.data);
    setLoading(false);
  }, [search, statusFilter, page]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const today = format(new Date(), "yyyy-MM-dd");

  // filtering is now server-side — no local events needed

  function openCreate() {
    setEditing(null);
    reset({ fromDate: today, toDate: today, status: "upcoming" });
    setShowAddPerson(false);
    setQuickName("");
    setQuickPhone("");
    setShowModal(true);
  }

  async function quickAddPerson() {
    if (!quickName.trim()) return;
    setAddingPerson(true);
    const res = await fetch("/api/persons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: quickName.trim(), phone: quickPhone.trim() }),
    });
    const data = await res.json() as { success: boolean; data?: { _id: string; name: string } };
    setAddingPerson(false);
    if (data.success && data.data) {
      setPersons(prev => [...prev, data.data!]);
      setValue("responsiblePerson", data.data._id);
      setShowAddPerson(false);
      setQuickName("");
      setQuickPhone("");
      toast.success(`"${data.data.name}" added and selected`);
    } else {
      toast.error("Could not add person");
    }
  }

  function openEdit(ev: Event) {
    setEditing(ev);
    setShowAddPerson(false);
    setQuickName("");
    setQuickPhone("");
    reset({
      name: ev.name,
      location: ev.location,
      fromDate: ev.fromDate?.slice(0, 10),
      toDate: ev.toDate?.slice(0, 10),
      responsiblePerson: ev.responsiblePerson?._id,
      status: ev.status,
    });
    setShowModal(true);
  }

  async function onSubmit(data: EventForm) {
    const url = editing ? `/api/events/${editing._id}` : "/api/events";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json() as { success: boolean; data?: { _id: string }; error?: string };
    if (result.success) {
      if (!editing && result.data?._id) {
        toast.success("Event created");
        router.push(`/events/${result.data._id}`);
      } else {
        toast.success("Event updated");
        setShowModal(false);
        fetchAll();
      }
    } else {
      toast.error(result.error ?? "Something went wrong");
    }
  }

  async function downloadEventReport(ev: Event, type: "excel" | "pdf") {
    const res = await fetch(`/api/movements?event=${ev._id}&limit=100`);
    const data = await res.json() as {
      success: boolean;
      data: Array<{
        asset: { name: string; category: string };
        allocatedPerson: { name: string };
        status: "OUT" | "IN";
        outDate: string;
        inDate?: string;
        condition?: string;
        returnBy?: string;
        verifiedBy?: string;
        damageReason?: string;
        remarks?: string;
      }>;
    };
    if (!data.success) { toast.error("Could not load movements"); return; }
    if (data.data.length === 0) { toast.error("No movements to export for this event"); return; }
    const rows = data.data.map((m) => ({
      "Event": ev.name,
      "Event Location": ev.location,
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
    }));
    const filename = `event-${ev.name.toLowerCase().replace(/\s+/g, "-")}`;
    if (type === "excel") exportToExcel(rows, filename);
    else exportToPDF(rows, `${ev.name} — Movement Report`, filename);
  }

  function askDelete(ev: Event) {
    if (ev.status === "completed") {
      toast.error("Cannot delete a completed event");
      return;
    }
    if (ev.outCount > 0) {
      toast.error("Cannot delete an event with assets still issued");
      return;
    }
    setDeleteConfirm({ id: ev._id, name: ev.name });
  }

  async function openReturnPicker(ev: Event) {
    setReturnEventName(ev.name);
    setLoadingReturnList(true);
    setShowReturnPicker(true);
    const res = await fetch(`/api/movements?event=${ev._id}&status=OUT&limit=100`);
    const data = await res.json() as { success: boolean; data: OutMovement[] };
    setReturnEventMovements(data.success ? data.data : []);
    setLoadingReturnList(false);
  }

  function pickMovementToReturn(m: OutMovement) {
    setSelectedMovementForReturn(m);
    inForm.reset({ condition: "good" });
    setShowReturnPicker(false);
    setShowInModal(true);
  }

  async function onInSubmit(data: InForm) {
    if (!selectedMovementForReturn) return;
    const res = await fetch(`/api/movements/${selectedMovementForReturn._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json() as { success: boolean; error?: string };
    if (result.success) {
      toast.success("Asset returned");
      setShowInModal(false);
      setSelectedMovementForReturn(null);
      inForm.reset();
      fetchAll();
    } else {
      toast.error(result.error ?? "Error");
    }
  }

  async function confirmDelete() {    if (!deleteConfirm) return;
    setDeleting(true);
    const res = await fetch(`/api/events/${deleteConfirm.id}`, { method: "DELETE" });
    const data = await res.json() as { success: boolean; error?: string };
    setDeleting(false);
    setDeleteConfirm(null);
    if (data.success) {
      toast.success("Event deleted");
      fetchAll();
    } else {
      toast.error(data.error ?? "Failed to delete");
    }
  }

  return (
    <div>
      <PageHeader
        title="Events / Programs"
        description="Create and manage events"
        action={
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <button onClick={() => exportToCSV(events.map(e => ({ Name: e.name, Location: e.location, From: e.fromDate?.slice(0,10) ?? "", To: e.toDate?.slice(0,10) ?? "", Status: e.status, "Assets Out": e.outCount, "Assets Returned": e.inCount, Person: e.responsiblePerson?.name ?? "" })), "events")} title="CSV" className="p-2 text-gray-500 dark:text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg border border-gray-200 dark:border-slate-600"><Download className="w-4 h-4" /></button>
              <button onClick={() => exportToExcel(events.map(e => ({ Name: e.name, Location: e.location, From: e.fromDate?.slice(0,10) ?? "", To: e.toDate?.slice(0,10) ?? "", Status: e.status, "Assets Out": e.outCount, "Assets Returned": e.inCount, Person: e.responsiblePerson?.name ?? "" })), "events")} title="Excel" className="p-2 text-gray-500 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg border border-gray-200 dark:border-slate-600 text-xs font-bold">XLS</button>
              <button onClick={() => exportToPDF(events.map(e => ({ Name: e.name, Location: e.location, From: e.fromDate?.slice(0,10) ?? "", To: e.toDate?.slice(0,10) ?? "", Status: e.status, "Assets Out": e.outCount, "Assets Returned": e.inCount, Person: e.responsiblePerson?.name ?? "" })), "Events List", "events")} title="PDF" className="p-2 text-gray-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg border border-gray-200 dark:border-slate-600 text-xs font-bold">PDF</button>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-800"
            >
              <Plus className="w-4 h-4" /> Add Event
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="bg-white dark:bg-slate-800 rounded-xl h-24 animate-pulse border border-gray-100 dark:border-slate-700" />)}
        </div>
      ) : (
        <>
          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <SearchInput
              value={search}
              onChange={setSearch}
              suggestions={events.map((e) => e.name)}
              placeholder="Search events by name or location…"
              showClear
              className="flex-1"
            />
            <div className="flex gap-1">
              {(["all", "upcoming", "active", "completed"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-2 text-xs font-medium rounded-xl border transition-colors capitalize ${
                    statusFilter === s
                      ? "bg-blue-700 text-white border-blue-700"
                      : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700"
                  }`}
                >
                  {s === "all" ? "All" : s}
                </button>
              ))}
            </div>
          </div>

          {events.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No events found" description={search || statusFilter !== "all" ? "Try adjusting your search or filter" : "Create your first event or program"} />
          ) : (
            <div className="space-y-3">
              {events.map((ev) => (
                <div key={ev._id} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-gray-900 dark:text-white text-sm">{ev.name}</h3>
                        <Badge variant={statusVariants[ev.status] ?? "gray"}>{ev.status}</Badge>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">📍 {ev.location}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                        {format(new Date(ev.fromDate), "dd MMM yyyy")} – {format(new Date(ev.toDate), "dd MMM yyyy")}
                      </p>
                      {ev.responsiblePerson && (
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">👤 {ev.responsiblePerson.name}</p>
                      )}
                      {/* Asset counts */}
                      {ev.totalAssets > 0 && (
                        <div className="flex items-center gap-3 mt-2">
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            ↑ {ev.outCount} Out
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            ↓ {ev.inCount} Returned
                          </span>
                          <span className="text-xs text-gray-400 dark:text-slate-500">{ev.totalAssets} total</span>
                          {ev.status === "completed" && ev.outCount === 0 && ev.totalAssets > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300">
                              ✓ All Returned
                            </span>
                          )}
                        </div>
                      )}
                      <Link
                        href={`/events/${ev._id}`}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1.5 font-medium"
                      >
                        Manage Assets <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                    <div className="flex items-center gap-1">
                      {ev.outCount > 0 && (
                        <button
                          onClick={() => openReturnPicker(ev)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded-lg hover:bg-green-100 mr-1"
                        >
                          <ArrowDownLeft className="w-3.5 h-3.5" /> Return
                        </button>
                      )}
                      <button
                        onClick={() => downloadEventReport(ev, "excel")}
                        title="Download Excel"
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => downloadEventReport(ev, "pdf")}
                        title="Download PDF with items"
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      <button onClick={() => openEdit(ev)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Pencil className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <button onClick={() => askDelete(ev)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Pagination
        page={page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        limit={pagination.limit}
        onPageChange={setPage}
      />

      {showModal && (
        <Modal title={editing ? "Edit Event" : "Add Event"} onClose={() => { setShowModal(false); setShowAddPerson(false); }}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Field label="Event Name" error={errors.name?.message}>
              <input {...register("name")} className="input" placeholder="e.g. Annual Conference" />
            </Field>
            <Field label="Location" error={errors.location?.message}>
              <input {...register("location")} className="input" placeholder="e.g. Main Hall" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From Date" error={errors.fromDate?.message}>
                <input type="date" {...register("fromDate")} className="input" />
              </Field>
              <Field label="To Date" error={errors.toDate?.message}>
                <input type="date" {...register("toDate")} className="input" />
              </Field>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Responsible Person</label>
                <button
                  type="button"
                  onClick={() => setShowAddPerson(prev => !prev)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {showAddPerson ? "Cancel" : "New Person"}
                </button>
              </div>
              <select {...register("responsiblePerson")} className="select">
                <option value="">Select person…</option>
                {persons.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              {errors.responsiblePerson && (
                <p className="mt-1 text-xs text-red-600">{errors.responsiblePerson.message}</p>
              )}
              {showAddPerson && (
                <div className="mt-2 p-3 bg-gray-50 dark:bg-slate-700 rounded-xl border border-gray-200 dark:border-slate-600 space-y-2">
                  <input
                    value={quickName}
                    onChange={e => setQuickName(e.target.value)}
                    placeholder="Full name *"
                    className="input text-sm"
                  />
                  <input
                    value={quickPhone}
                    onChange={e => setQuickPhone(e.target.value)}
                    placeholder="Phone (optional)"
                    className="input text-sm"
                  />
                  <button
                    type="button"
                    onClick={quickAddPerson}
                    disabled={addingPerson || !quickName.trim()}
                    className="w-full py-2 bg-blue-700 text-white text-sm font-medium rounded-xl disabled:opacity-60"
                  >
                    {addingPerson ? "Adding…" : "Add & Select"}
                  </button>
                </div>
              )}
            </div>
            <Field label="Status">
              <select {...register("status")} className="select">
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </Field>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 bg-blue-700 text-white text-sm font-medium rounded-xl disabled:opacity-60">
                {isSubmitting ? "Saving…" : editing ? "Update" : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteConfirm && (
        <ConfirmDialog
          title="Delete Event"
          message={`Are you sure you want to delete "${deleteConfirm.name}"? This action cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
          loading={deleting}
        />
      )}

      {/* Step 1 — Pick which OUT asset to return */}
      {showReturnPicker && (
        <Modal title={`Return Asset — ${returnEventName}`} onClose={() => setShowReturnPicker(false)}>
          {loadingReturnList ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 dark:bg-slate-700 rounded-xl animate-pulse" />)}
            </div>
          ) : returnEventMovements.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-6">No assets currently out for this event.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">Select an asset to return:</p>
              {returnEventMovements.map((m) => (
                <button
                  key={m._id}
                  onClick={() => pickMovementToReturn(m)}
                  className="w-full text-left p-3 bg-gray-50 dark:bg-slate-700 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20 border border-gray-200 dark:border-slate-600 hover:border-green-300 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{m.asset?.name}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    {m.asset?.category} · Issued to: {m.allocatedPerson?.name ?? "—"} · Out: {m.outDate ? format(new Date(m.outDate), "dd MMM yyyy HH:mm") : "—"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Step 2 — Return form */}
      {showInModal && selectedMovementForReturn && (
        <Modal title="Return Asset" onClose={() => { setShowInModal(false); setSelectedMovementForReturn(null); }}>
          <div className="mb-4 p-3 bg-gray-50 dark:bg-slate-700 rounded-xl text-sm">
            <p className="font-medium dark:text-white">{selectedMovementForReturn.asset?.name}</p>
            <p className="text-gray-500 dark:text-slate-400 text-xs">{returnEventName} · {selectedMovementForReturn.allocatedPerson?.name ?? "—"}</p>
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
              <button type="button" onClick={() => { setShowInModal(false); setShowReturnPicker(true); }} className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700">Back</button>
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
