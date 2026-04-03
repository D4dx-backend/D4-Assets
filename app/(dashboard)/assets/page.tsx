"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, Search, Package, FileText, Download, AlertTriangle, CheckCircle } from "lucide-react";
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

interface Asset {
  _id: string;
  name: string;
  productCode?: string;
  category: string;
  dateOfPurchase?: string;
  noWarranty: boolean;
  warrantyDetails: string;
  warrantyExpiryDate?: string;
  billUrl?: string;
  allowOutside: boolean;
}

interface Category {
  _id: string;
  name: string;
}

const assetSchema = z.object({
  name: z.string().min(1, "Asset name is required"),
  productCode: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  dateOfPurchase: z.string().optional(),
  noWarranty: z.boolean().optional(),
  warrantyDetails: z.string().optional(),
  warrantyExpiryDate: z.string().optional(),
  allowOutside: z.boolean().optional(),
}).superRefine((val, ctx) => {
  if (!val.noWarranty && !val.dateOfPurchase) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Date of purchase is required",
      path: ["dateOfPurchase"],
    });
  }
});

type AssetForm = z.infer<typeof assetSchema>;

interface AssetDamageReport {
  _id: string;
  asset: { name: string; category: string };
  event: { name: string };
  type: string;
  reason: string;
  reportedBy: { name: string };
  isResolved: boolean;
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

export default function AssetsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 10 });
  const [showModal, setShowModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [billFile, setBillFile] = useState<File | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Damage reports
  const [damageAsset, setDamageAsset] = useState<Asset | null>(null);
  const [assetReports, setAssetReports] = useState<AssetDamageReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [editingReport, setEditingReport] = useState<AssetDamageReport | null>(null);

  const damageEditForm = useForm<DamageEditForm>({
    resolver: zodResolver(damageEditSchema),
    defaultValues: { type: "damage", reason: "", notes: "", isResolved: false },
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AssetForm>({ resolver: zodResolver(assetSchema) });

  const noWarranty = watch("noWarranty");

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams(
      search
        ? { page: "1", limit: "200", search }
        : { page: String(page), limit: "10" }
    );
    const res = await fetch(`/api/assets?${params.toString()}`);
    const data = await res.json() as { success: boolean; data: Asset[]; pagination: { total: number; totalPages: number; limit: number } };
    if (data.success) {
      setAssets(data.data);
      setPagination(data.pagination);
    }
    setLoading(false);
  }, [search, page]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  // Debounce only applies when searching (typing); pagination fires immediately.
  useEffect(() => {
    if (!search) {
      fetchAssets();
      return;
    }
    const timer = setTimeout(() => { fetchAssets(); }, 500);
    return () => clearTimeout(timer);
  }, [fetchAssets, search]);

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
      productCode: asset.productCode ?? "",
      category: asset.category,
      dateOfPurchase: asset.dateOfPurchase?.slice(0, 10) ?? "",
      noWarranty: asset.noWarranty ?? false,
      warrantyDetails: asset.warrantyDetails,
      warrantyExpiryDate: asset.warrantyExpiryDate?.slice(0, 10) ?? "",
      allowOutside: asset.allowOutside ?? false,
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

  async function handleDelete(asset: Asset) {
    setDeleteConfirm({ id: asset._id, name: asset.name });
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    const res = await fetch(`/api/assets/${deleteConfirm.id}`, { method: "DELETE" });
    const data = await res.json() as { success: boolean; error?: string };
    setDeleting(false);
    setDeleteConfirm(null);
    if (data.success) {
      toast.success("Asset deleted");
      fetchAssets();
    } else {
      toast.error(data.error ?? "Failed to delete");
    }
  }

  async function openDamageReports(asset: Asset) {
    setDamageAsset(asset);
    setAssetReports([]);
    setLoadingReports(true);
    const res = await fetch(`/api/reports?type=damage&assetId=${asset._id}&limit=50`);
    const d = await res.json() as { success: boolean; data: AssetDamageReport[] };
    if (d.success) setAssetReports(d.data);
    setLoadingReports(false);
  }

  function openReportEdit(report: AssetDamageReport) {
    damageEditForm.reset({
      type: report.type as "damage" | "defect" | "missing",
      reason: report.reason,
      notes: report.notes ?? "",
      isResolved: report.isResolved,
    });
    setEditingReport(report);
  }

  async function onReportEditSubmit(formData: DamageEditForm) {
    if (!editingReport) return;
    const res = await fetch(`/api/reports/${editingReport._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    const result = await res.json() as { success: boolean; data?: AssetDamageReport; error?: string };
    if (result.success) {
      toast.success("Report updated");
      setEditingReport(null);
      if (damageAsset) openDamageReports(damageAsset);
    } else {
      toast.error(result.error ?? "Failed");
    }
  }

  async function quickResolveReport(report: AssetDamageReport) {
    const res = await fetch(`/api/reports/${report._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isResolved: !report.isResolved }),
    });
    const result = await res.json() as { success: boolean; error?: string };
    if (result.success) {
      toast.success(report.isResolved ? "Marked as open" : "Marked as resolved");
      if (damageAsset) openDamageReports(damageAsset);
    } else {
      toast.error(result.error ?? "Failed");
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
              <button onClick={() => exportToCSV(assets.map(a => ({ Name: a.name, Category: a.category, Purchased: a.dateOfPurchase?.slice(0,10) ?? "", Warranty: a.warrantyDetails ?? "", "Warranty Expiry": a.warrantyExpiryDate?.slice(0,10) ?? "" })), "assets")} title="CSV" className="p-2 text-gray-500 dark:text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg border border-gray-200 dark:border-slate-600"><Download className="w-4 h-4" /></button>
              <button onClick={() => exportToExcel(assets.map(a => ({ Name: a.name, Category: a.category, Purchased: a.dateOfPurchase?.slice(0,10) ?? "", Warranty: a.warrantyDetails ?? "", "Warranty Expiry": a.warrantyExpiryDate?.slice(0,10) ?? "" })), "assets")} title="Excel" className="p-2 text-gray-500 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg border border-gray-200 dark:border-slate-600 text-xs font-bold">XLS</button>
              <button onClick={() => exportToPDF(assets.map(a => ({ Name: a.name, Category: a.category, Purchased: a.dateOfPurchase?.slice(0,10) ?? "", Warranty: a.warrantyDetails ?? "" })), "Asset Register", "assets")} title="PDF" className="p-2 text-gray-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg border border-gray-200 dark:border-slate-600 text-xs font-bold">PDF</button>
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
      <SearchInput
        value={search}
        onChange={(v) => setSearch(v)}
        suggestions={assets.map((a) => a.name)}
        placeholder="Search assets…"
        className="mb-4"
      />

      {/* Asset list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl h-20 animate-pulse border border-gray-100 dark:border-slate-700" />
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
              !asset.noWarranty && asset.warrantyExpiryDate && new Date(asset.warrantyExpiryDate) < new Date();
            const warrantyExpiringSoon =
              !asset.noWarranty &&
              asset.warrantyExpiryDate &&
              !warrantyExpired &&
              new Date(asset.warrantyExpiryDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            return (
              <div
                key={asset._id}
                className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-gray-900 dark:text-white text-sm">{asset.name}</h3>
                      <Badge variant="blue">{asset.category}</Badge>
                      {asset.allowOutside
                        ? <Badge variant="green">Outside OK</Badge>
                        : <Badge variant="gray">Inside Only</Badge>}
                      {asset.noWarranty && <Badge variant="gray">No Warranty</Badge>}
                      {warrantyExpired && <Badge variant="red">Warranty Expired</Badge>}
                      {warrantyExpiringSoon && <Badge variant="yellow">Expiring Soon</Badge>}
                    </div>
                    {asset.productCode && (
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 font-mono">#{asset.productCode}</p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                      Purchased: {asset.dateOfPurchase ? format(new Date(asset.dateOfPurchase), "dd MMM yyyy") : "Unknown"}
                    </p>
                    {!asset.noWarranty && asset.warrantyDetails && (
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{asset.warrantyDetails}</p>
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
                      onClick={() => openDamageReports(asset)}
                      title="View damage reports"
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    >
                      <AlertTriangle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEdit(asset)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(asset)}
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

      {!search && (
        <Pagination
          page={page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          onPageChange={setPage}
        />
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

            <Field label="Product Code" error={errors.productCode?.message}>
              <input {...register("productCode")} className="input" placeholder="e.g. SN-2024-001" />
            </Field>

            <Field label="Category" error={errors.category?.message}>
              <select {...register("category")} className="select">
                <option value="">Select category…</option>
                {categories.map(c => (
                  <option key={c._id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </Field>

            <Field label={`Date of Purchase${noWarranty ? " (optional)" : ""}`} error={errors.dateOfPurchase?.message}>
              <input type="date" {...register("dateOfPurchase")} className="input" />
            </Field>

            {/* No Warranty toggle */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div className="relative">
                <input
                  type="checkbox"
                  {...register("noWarranty")}
                  onChange={(e) => {
                    setValue("noWarranty", e.target.checked);
                    if (e.target.checked) {
                      setValue("warrantyDetails", "");
                      setValue("warrantyExpiryDate", "");
                      setValue("dateOfPurchase", "");
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-gray-200 dark:bg-slate-600 rounded-full peer-checked:bg-blue-600 transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300">No Warranty Item</span>
            </label>

            {!noWarranty && (
              <>
                <Field label="Warranty Details">
                  <input {...register("warrantyDetails")} className="input" placeholder="e.g. 1 year manufacturer" />
                </Field>

                <Field label="Warranty Expiry Date">
                  <input type="date" {...register("warrantyExpiryDate")} className="input" />
                </Field>
              </>
            )}

            <Field label="Bill / Invoice (PDF or Image)">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setBillFile(e.target.files?.[0] ?? null)}
                className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700"
              />
            </Field>

            {/* Allow Outside toggle */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div className="relative">
                <input
                  type="checkbox"
                  {...register("allowOutside")}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-gray-200 dark:bg-slate-600 rounded-full peer-checked:bg-green-600 transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Allow Outside</span>
            </label>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700"
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

      {deleteConfirm && (
        <ConfirmDialog
          title="Delete Asset"
          message={`Are you sure you want to delete "${deleteConfirm.name}"? This action cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
          loading={deleting}
        />
      )}

      {/* ── Damage Reports Modal ── */}
      {!!damageAsset && !editingReport && (
      <Modal
        onClose={() => setDamageAsset(null)}
        title={`Damage Reports — ${damageAsset?.name ?? ""}`}
      >
        {loadingReports ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-100 dark:bg-slate-700 rounded-xl animate-pulse" />)}
          </div>
        ) : assetReports.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-6">No damage reports for this asset.</p>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {assetReports.map((r) => (
              <div key={r._id} className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3 border border-gray-200 dark:border-slate-600">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-red-600 dark:text-red-400 capitalize">{r.type}</span>
                      <Badge variant={r.isResolved ? "green" : "red"}>{r.isResolved ? "Resolved" : "Open"}</Badge>
                    </div>
                    <p className="text-xs text-gray-700 dark:text-slate-300 mt-1">{r.reason}</p>
                    {r.notes && <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 italic">{r.notes}</p>}
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                      {r.event?.name} · {r.reportedBy?.name} · {format(new Date(r.createdAt), "dd MMM yyyy")}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => openReportEdit(r)}
                      title="Edit"
                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => quickResolveReport(r)}
                      title={r.isResolved ? "Re-open" : "Mark resolved"}
                      className={`p-1 rounded ${r.isResolved ? "text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20" : "text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"}`}
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
      )}

      {/* ── Edit Damage Report Modal (from asset view) ── */}
      {!!editingReport && (
      <Modal
        onClose={() => setEditingReport(null)}
        title="Edit Damage Report"
      >
        {editingReport && (
          <form onSubmit={damageEditForm.handleSubmit(onReportEditSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Type</label>
              <select {...damageEditForm.register("type")} className="input w-full">
                <option value="damage">Damage</option>
                <option value="defect">Defect</option>
                <option value="missing">Missing</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Reason</label>
              <textarea
                {...damageEditForm.register("reason")}
                rows={3}
                className="input w-full"
                placeholder="Describe the damage / defect…"
              />
              {damageEditForm.formState.errors.reason && (
                <p className="text-xs text-red-500 mt-1">{damageEditForm.formState.errors.reason.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Notes (optional)</label>
              <textarea
                {...damageEditForm.register("notes")}
                rows={2}
                className="input w-full"
                placeholder="Internal notes…"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...damageEditForm.register("isResolved")}
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
                Back
              </button>
              <button
                type="submit"
                disabled={damageEditForm.formState.isSubmitting}
                className="px-4 py-2 text-sm rounded-xl bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {damageEditForm.formState.isSubmitting ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        )}
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
      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
