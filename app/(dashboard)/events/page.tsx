"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, CalendarDays, UserPlus, ArrowRight, Download } from "lucide-react";
import Link from "next/link";
import { exportToCSV, exportToExcel, exportToPDF } from "@/lib/exportUtils";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import Badge from "@/components/Badge";
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
}

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
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [events, setEvents] = useState<Event[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [addingPerson, setAddingPerson] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EventForm>({ resolver: zodResolver(schema) });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [evRes, pRes] = await Promise.all([
      fetch("/api/events"),
      fetch("/api/persons"),
    ]);
    const [evData, pData] = await Promise.all([evRes.json(), pRes.json()]) as [
      { success: boolean; data: Event[] },
      { success: boolean; data: Person[] }
    ];
    if (evData.success) setEvents(evData.data);
    if (pData.success) setPersons(pData.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const today = format(new Date(), "yyyy-MM-dd");

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
    const result = await res.json() as { success: boolean; error?: string };
    if (result.success) {
      toast.success(editing ? "Event updated" : "Event created");
      setShowModal(false);
      fetchAll();
    } else {
      toast.error(result.error ?? "Something went wrong");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this event?")) return;
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
    const data = await res.json() as { success: boolean };
    if (data.success) {
      toast.success("Event deleted");
      fetchAll();
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
              <button onClick={() => exportToCSV(events.map(e => ({ Name: e.name, Location: e.location, From: e.fromDate?.slice(0,10) ?? "", To: e.toDate?.slice(0,10) ?? "", Status: e.status, Person: e.responsiblePerson?.name ?? "" })), "events")} title="CSV" className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg border border-gray-200"><Download className="w-4 h-4" /></button>
              <button onClick={() => exportToExcel(events.map(e => ({ Name: e.name, Location: e.location, From: e.fromDate?.slice(0,10) ?? "", To: e.toDate?.slice(0,10) ?? "", Status: e.status, Person: e.responsiblePerson?.name ?? "" })), "events")} title="Excel" className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-gray-200 text-xs font-bold">XLS</button>
              <button onClick={() => exportToPDF(events.map(e => ({ Name: e.name, Location: e.location, From: e.fromDate?.slice(0,10) ?? "", To: e.toDate?.slice(0,10) ?? "", Status: e.status, Person: e.responsiblePerson?.name ?? "" })), "Events List", "events")} title="PDF" className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-gray-200 text-xs font-bold">PDF</button>
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
      ) : events.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No events yet" description="Create your first event or program" />
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
                  <Link
                    href={`/events/${ev._id}`}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1.5 font-medium"
                  >
                    Manage Assets <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(ev)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                    <Pencil className="w-4 h-4" />
                  </button>
                  {isAdmin && (
                    <button onClick={() => handleDelete(ev._id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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
