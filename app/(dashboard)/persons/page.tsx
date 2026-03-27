"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, UserCircle, Download } from "lucide-react";
import { exportToCSV, exportToExcel, exportToPDF } from "@/lib/exportUtils";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import { useSession } from "next-auth/react";

interface Person { _id: string; name: string; phone?: string; email?: string; department?: string }

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  department: z.string().optional(),
});

type PersonForm = z.infer<typeof schema>;

export default function PersonsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PersonForm>({ resolver: zodResolver(schema) });

  const fetchPersons = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/persons");
    const data = await res.json() as { success: boolean; data: Person[] };
    if (data.success) setPersons(data.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPersons(); }, [fetchPersons]);

  function openCreate() { setEditing(null); reset({}); setShowModal(true); }
  function openEdit(p: Person) { setEditing(p); reset(p); setShowModal(true); }

  async function onSubmit(data: PersonForm) {
    const url = editing ? `/api/persons/${editing._id}` : "/api/persons";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const result = await res.json() as { success: boolean; error?: string };
    if (result.success) { toast.success(editing ? "Person updated" : "Person added"); setShowModal(false); fetchPersons(); }
    else toast.error(result.error ?? "Error");
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this person?")) return;
    const res = await fetch(`/api/persons/${id}`, { method: "DELETE" });
    const data = await res.json() as { success: boolean };
    if (data.success) { toast.success("Deleted"); fetchPersons(); }
  }

  return (
    <div>
      <PageHeader
        title="Responsible Persons"
        description="Manage master data for responsible persons"
        action={
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <button onClick={() => exportToCSV(persons.map(p => ({ Name: p.name, Phone: p.phone ?? "", Email: p.email ?? "", Department: p.department ?? "" })), "persons")} title="CSV" className="p-2 text-gray-500 dark:text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg border border-gray-200 dark:border-slate-600"><Download className="w-4 h-4" /></button>
              <button onClick={() => exportToExcel(persons.map(p => ({ Name: p.name, Phone: p.phone ?? "", Email: p.email ?? "", Department: p.department ?? "" })), "persons")} title="Excel" className="p-2 text-gray-500 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg border border-gray-200 dark:border-slate-600 text-xs font-bold">XLS</button>
              <button onClick={() => exportToPDF(persons.map(p => ({ Name: p.name, Phone: p.phone ?? "", Email: p.email ?? "", Department: p.department ?? "" })), "Persons List", "persons")} title="PDF" className="p-2 text-gray-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg border border-gray-200 dark:border-slate-600 text-xs font-bold">PDF</button>
            </div>
            <button onClick={openCreate} className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-800">
              <Plus className="w-4 h-4" /> Add Person
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-white dark:bg-slate-800 rounded-xl h-16 animate-pulse border border-gray-100 dark:border-slate-700" />)}</div>
      ) : persons.length === 0 ? (
        <EmptyState icon={UserCircle} title="No persons yet" description="Add responsible persons here" />
      ) : (
        <div className="space-y-2">
          {persons.map((p) => (
            <div key={p._id} className="bg-white dark:bg-slate-800 rounded-xl px-4 py-3 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{p.name}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">{[p.department, p.phone, p.email].filter(Boolean).join(" · ")}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(p)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                {isAdmin && <button onClick={() => handleDelete(p._id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? "Edit Person" : "Add Person"} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Field label="Full Name" error={errors.name?.message}><input {...register("name")} className="input" placeholder="John Doe" /></Field>
            <Field label="Department"><input {...register("department")} className="input" placeholder="e.g. IT" /></Field>
            <Field label="Phone"><input {...register("phone")} className="input" placeholder="+1 234 567 890" /></Field>
            <Field label="Email" error={errors.email?.message}><input {...register("email")} className="input" placeholder="john@example.com" /></Field>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 dark:text-slate-300 text-sm font-medium rounded-xl">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 bg-blue-700 text-white text-sm font-medium rounded-xl disabled:opacity-60">
                {isSubmitting ? "Saving…" : editing ? "Update" : "Add"}
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
