"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, Search, Package, FileText, Download } from "lucide-react";
import { exportToCSV, exportToExcel, exportToPDF } from "@/lib/exportUtils";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import Badge from "@/components/Badge";
import { format } from "date-fns";
import { useSession } from "next-auth/react";

interface Asset {
  _id: string;
  name: string;
  category: string;
  dateOfPurchase: string;
  warrantyDetails: string;
  warrantyExpiryDate?: string;
  billUrl?: string;
}

interface Category {
  _id: string;
  name: string;
}

const assetSchema = z.object({
  name: z.string().min(1, "Asset name is required"),
  category: z.string().min(1, "Category is required"),
  dateOfPurchase: z.string().min(1, "Date of purchase is required"),
  warrantyDetails: z.string().optional(),
  warrantyExpiryDate: z.string().optional(),
});

type AssetForm = z.infer<typeof assetSchema>;

export default function AssetsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [billFile, setBillFile] = useState<File | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AssetForm>({ resolver: zodResolver(assetSchema) });

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    const params = search ? `?search=${encodeURIComponent(search)}` : "";
    const res = await fetch(`/api/assets${params}`);
    const data = await res.json() as { success: boolean; data: Asset[] };
    if (data.success) setAssets(data.data);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => { fetchAssets(); }, 300);
    return () => clearTimeout(timer);
  }, [fetchAssets]);

  const fetchCategories = useCallback(async () => {
    const res = await fetch("/api/categories");
    const d = await res.json() as { success: boolean; data: Category[] };
    if (d.success) setCategories(d.data);
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  function openCreate() {
    setEditingAsset(null);
    reset({});
    setBillFile(null);
    fetchCategories();
    setShowModal(true);
  }

  function openEdit(asset: Asset) {
    setEditingAsset(asset);
    reset({
      name: asset.name,
      category: asset.category,
      dateOfPurchase: asset.dateOfPurchase?.slice(0, 10),
      warrantyDetails: asset.warrantyDetails,
      warrantyExpiryDate: asset.warrantyExpiryDate?.slice(0, 10) ?? "",
    });
    setShowModal(true);
  }

  async function onSubmit(data: AssetForm) {
    let billUrl: string | undefined;
    let billPublicId: string | undefined;

    if (billFile) {
      const fd = new FormData();
      fd.append("file", billFile);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      const uploadData = await uploadRes.json() as { success: boolean; data: { url: string; publicId: string } };
      if (!uploadData.success) {
        toast.error("File upload failed");
        return;
      }
      billUrl = uploadData.data.url;
      billPublicId = uploadData.data.publicId;
    }

    const url = editingAsset ? `/api/assets/${editingAsset._id}` : "/api/assets";
    const method = editingAsset ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, billUrl, billPublicId }),
    });
    const result = await res.json() as { success: boolean; error?: string };

    if (result.success) {
      toast.success(editingAsset ? "Asset updated" : "Asset created");
      setShowModal(false);
      fetchAssets();
    } else {
      toast.error(result.error ?? "Something went wrong");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this asset?")) return;
    const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
    const data = await res.json() as { success: boolean };
    if (data.success) {
      toast.success("Asset deleted");
      fetchAssets();
    }
  }

  return (
    <div>
      <PageHeader
        title="Asset Register"
        description="Manage all organizational assets"
        action={
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <button onClick={() => exportToCSV(assets.map(a => ({ Name: a.name, Category: a.category, Purchased: a.dateOfPurchase?.slice(0,10) ?? "", Warranty: a.warrantyDetails ?? "", "Warranty Expiry": a.warrantyExpiryDate?.slice(0,10) ?? "" })), "assets")} title="CSV" className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg border border-gray-200"><Download className="w-4 h-4" /></button>
              <button onClick={() => exportToExcel(assets.map(a => ({ Name: a.name, Category: a.category, Purchased: a.dateOfPurchase?.slice(0,10) ?? "", Warranty: a.warrantyDetails ?? "", "Warranty Expiry": a.warrantyExpiryDate?.slice(0,10) ?? "" })), "assets")} title="Excel" className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-gray-200 text-xs font-bold">XLS</button>
              <button onClick={() => exportToPDF(assets.map(a => ({ Name: a.name, Category: a.category, Purchased: a.dateOfPurchase?.slice(0,10) ?? "", Warranty: a.warrantyDetails ?? "" })), "Asset Register", "assets")} title="PDF" className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-gray-200 text-xs font-bold">PDF</button>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-800 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Asset
            </button>
          </div>
        }
      />

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search assets…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Asset list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl h-20 animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No assets yet"
          description="Start by adding your first asset"
          action={
            <button onClick={openCreate} className="bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
              Add Asset
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {assets.map((asset) => {
            const warrantyExpired =
              asset.warrantyExpiryDate && new Date(asset.warrantyExpiryDate) < new Date();
            return (
              <div
                key={asset._id}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-gray-900 text-sm">{asset.name}</h3>
                      <Badge variant="blue">{asset.category}</Badge>
                      {warrantyExpired && <Badge variant="red">Warranty Expired</Badge>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Purchased: {format(new Date(asset.dateOfPurchase), "dd MMM yyyy")}
                    </p>
                    {asset.warrantyDetails && (
                      <p className="text-xs text-gray-500 mt-0.5">{asset.warrantyDetails}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {asset.billUrl && (
                      <a
                        href={asset.billUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <FileText className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => openEdit(asset)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(asset._id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Asset Modal */}
      {showModal && (
        <Modal
          title={editingAsset ? "Edit Asset" : "Add Asset"}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Field label="Asset Name" error={errors.name?.message}>
              <input {...register("name")} className="input" placeholder="e.g. Projector" />
            </Field>

            <Field label="Category" error={errors.category?.message}>
              <select {...register("category")} className="select">
                <option value="">Select category…</option>
                {categories.map(c => (
                  <option key={c._id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Date of Purchase" error={errors.dateOfPurchase?.message}>
              <input type="date" {...register("dateOfPurchase")} className="input" />
            </Field>

            <Field label="Warranty Details">
              <input {...register("warrantyDetails")} className="input" placeholder="e.g. 1 year manufacturer" />
            </Field>

            <Field label="Warranty Expiry Date">
              <input type="date" {...register("warrantyExpiryDate")} className="input" />
            </Field>

            <Field label="Bill / Invoice (PDF or Image)">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setBillFile(e.target.files?.[0] ?? null)}
                className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700"
              />
            </Field>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-blue-700 text-white text-sm font-medium rounded-xl hover:bg-blue-800 disabled:opacity-60"
              >
                {isSubmitting ? "Saving…" : editingAsset ? "Update" : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
