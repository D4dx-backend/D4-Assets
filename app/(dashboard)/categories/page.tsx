"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import { useSession } from "next-auth/react";

interface Category { _id: string; name: string; description?: string }

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});
type CategoryForm = z.infer<typeof schema>;

export default function CategoriesPage() {
  const { data: session } = useSession();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<CategoryForm>({ resolver: zodResolver(schema) });

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/categories");
    const data = await res.json() as { success: boolean; data: Category[] };
    if (data.success) setCategories(data.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  if (session?.user?.role !== "admin") {
    return <p className="text-center text-gray-500 mt-20">Access denied — Admins only</p>;
  }

  function openCreate() { setEditing(null); reset({}); setShowModal(true); }
  function openEdit(c: Category) { setEditing(c); reset({ name: c.name, description: c.description ?? "" }); setShowModal(true); }

  async function onSubmit(data: CategoryForm) {
    const url = editing ? `/api/categories/${editing._id}` : "/api/categories";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const result = await res.json() as { success: boolean; error?: string };
    if (result.success) {
      toast.success(editing ? "Category updated" : "Category created");
      setShowModal(false);
      fetchCategories();
    } else {
      toast.error(result.error ?? "Error");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this category?")) return;
    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    const data = await res.json() as { success: boolean };
    if (data.success) { toast.success("Deleted"); fetchCategories(); }
  }

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Manage asset categories (master data)"
        action={
          <button onClick={openCreate} className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-800">
            <Plus className="w-4 h-4" /> Add Category
          </button>
        }
      />

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="bg-white dark:bg-slate-800 rounded-xl h-14 animate-pulse border border-gray-100 dark:border-slate-700" />)}</div>
      ) : categories.length === 0 ? (
        <EmptyState icon={Tag} title="No categories yet" description="Add asset categories here" />
      ) : (
        <div className="space-y-2">
          {categories.map((c) => (
            <div key={c._id} className="bg-white dark:bg-slate-800 rounded-xl px-4 py-3 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{c.name}</p>
                {c.description && <p className="text-xs text-gray-500 dark:text-slate-400">{c.description}</p>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(c)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(c._id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? "Edit Category" : "Add Category"} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Category Name</label>
              <input {...register("name")} className="input" placeholder="e.g. Electronics" />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Description (optional)</label>
              <input {...register("description")} className="input" placeholder="e.g. Electronic devices and accessories" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 dark:text-slate-300 text-sm font-medium rounded-xl">Cancel</button>
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
