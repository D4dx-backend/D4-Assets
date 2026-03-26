"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, Users, Shield, Download } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import Badge from "@/components/Badge";
import { useSession } from "next-auth/react";
import { exportToCSV, exportToExcel, exportToPDF } from "@/lib/exportUtils";

interface Permissions {
  assets: boolean;
  events: boolean;
  movements: boolean;
  persons: boolean;
  reports: boolean;
  categories: boolean;
  users: boolean;
}

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  permissions: Permissions;
}

const MODULES: { key: keyof Permissions; label: string }[] = [
  { key: "assets", label: "Assets" },
  { key: "events", label: "Events" },
  { key: "movements", label: "Movements" },
  { key: "persons", label: "Persons" },
  { key: "reports", label: "Reports" },
  { key: "categories", label: "Categories" },
  { key: "users", label: "User Management" },
];

const ROLE_DEFAULTS: Record<string, Permissions> = {
  admin:    { assets: true,  events: true,  movements: true,  persons: true,  reports: true,  categories: true,  users: true  },
  manager:  { assets: true,  events: true,  movements: true,  persons: true,  reports: true,  categories: true,  users: false },
  operator: { assets: true,  events: true,  movements: true,  persons: true,  reports: false, categories: false, users: false },
  viewer:   { assets: true,  events: true,  movements: false, persons: false, reports: true,  categories: false, users: false },
};

const schema = z.object({
  name: z.string().min(1, "Name required"),
  email: z.string().email("Invalid email"),
  mpin: z.string().regex(/^\d{4,6}$/, "Must be 4-6 digits").optional().or(z.literal("")),
  role: z.enum(["admin", "manager", "operator", "viewer"]),
  isActive: z.boolean(),
  permissions: z.object({
    assets: z.boolean(),
    events: z.boolean(),
    movements: z.boolean(),
    persons: z.boolean(),
    reports: z.boolean(),
    categories: z.boolean(),
    users: z.boolean(),
  }),
});

type UserForm = z.infer<typeof schema>;

const roleVariant: Record<string, "blue" | "green" | "gray" | "red"> = {
  admin: "blue",
  manager: "green",
  operator: "gray",
  viewer: "gray",
};

export default function UsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<UserForm>({
    resolver: zodResolver(schema),
  });

  const watchedRole = watch("role");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/users");
    const data = await res.json() as { success: boolean; data: User[] };
    if (data.success) setUsers(data.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    if (watchedRole) {
      const defaults = ROLE_DEFAULTS[watchedRole];
      if (defaults) {
        (Object.keys(defaults) as (keyof Permissions)[]).forEach(k => {
          setValue(`permissions.${k}`, defaults[k]);
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedRole]);

  if (session?.user?.role !== "admin") {
    return <p className="text-center text-gray-500 mt-20">Access denied — Admin only</p>;
  }

  function openCreate() {
    setEditing(null);
    reset({ role: "operator", isActive: true, permissions: ROLE_DEFAULTS.operator });
    setShowModal(true);
  }

  function openEdit(u: User) {
    setEditing(u);
    reset({
      name: u.name,
      email: u.email,
      role: u.role as "admin" | "manager" | "operator" | "viewer",
      isActive: u.isActive,
      permissions: u.permissions ?? ROLE_DEFAULTS[u.role] ?? ROLE_DEFAULTS.operator,
    });
    setShowModal(true);
  }

  async function onSubmit(data: UserForm) {
    const payload = { ...data } as Record<string, unknown>;
    if (!payload.mpin) delete payload.mpin;
    const url = editing ? `/api/users/${editing._id}` : "/api/users";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await res.json() as { success: boolean; error?: string };
    if (result.success) { toast.success(editing ? "User updated" : "User created"); setShowModal(false); fetchUsers(); }
    else toast.error(result.error ?? "Error");
  }

  async function handleDelete(id: string) {
    if (!confirm("Deactivate this user?")) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    const data = await res.json() as { success: boolean };
    if (data.success) { toast.success("User deactivated"); fetchUsers(); }
  }

  function getExportRows() {
    return users.map(u => ({
      Name: u.name,
      Email: u.email,
      Role: u.role,
      Status: u.isActive ? "Active" : "Inactive",
      Assets: u.permissions?.assets ? "Yes" : "No",
      Events: u.permissions?.events ? "Yes" : "No",
      Movements: u.permissions?.movements ? "Yes" : "No",
      Persons: u.permissions?.persons ? "Yes" : "No",
      Reports: u.permissions?.reports ? "Yes" : "No",
      Categories: u.permissions?.categories ? "Yes" : "No",
      "User Mgmt": u.permissions?.users ? "Yes" : "No",
    }));
  }

  return (
    <div>
      <PageHeader
        title="User Management"
        description="Manage users, roles and module access"
        action={
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <button onClick={() => exportToCSV(getExportRows(), "users")} title="CSV"
                className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg border border-gray-200">
                <Download className="w-4 h-4" />
              </button>
              <button onClick={() => exportToExcel(getExportRows(), "users")} title="Excel"
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-gray-200 text-xs font-bold">XLS</button>
              <button onClick={() => exportToPDF(getExportRows(), "User List", "users")} title="PDF"
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-gray-200 text-xs font-bold">PDF</button>
            </div>
            <button onClick={openCreate} className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-800">
              <Plus className="w-4 h-4" /> Add User
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-white rounded-xl h-20 animate-pulse border border-gray-100" />)}</div>
      ) : users.length === 0 ? (
        <EmptyState icon={Users} title="No users" description="Add users to the system" />
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u._id} className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900">{u.name}</p>
                    <Badge variant={roleVariant[u.role] ?? "gray"}>{u.role}</Badge>
                    {!u.isActive && <Badge variant="red">Inactive</Badge>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{u.email}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {MODULES.map(m => u.permissions?.[m.key] && (
                      <span key={m.key} className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md">{m.label}</span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(u)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                  {u._id !== session?.user?.id && (
                    <button onClick={() => handleDelete(u._id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? "Edit User" : "Add User"} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Field label="Full Name" error={errors.name?.message}><input {...register("name")} className="input" placeholder="John Doe" /></Field>
            <Field label="Email" error={errors.email?.message}><input {...register("email")} type="email" className="input" /></Field>
            <Field label={editing ? "New MPIN (blank = keep)" : "MPIN (4-6 digits)"} error={errors.mpin?.message}>
              <input {...register("mpin")} type="password" inputMode="numeric" className="input tracking-widest text-lg" placeholder="••••" maxLength={6} />
            </Field>
            <Field label="Role">
              <select {...register("role")} className="select">
                <option value="admin">Admin — Full access</option>
                <option value="manager">Manager — No user mgmt</option>
                <option value="operator">Operator — Operations only</option>
                <option value="viewer">Viewer — Read only</option>
              </select>
              <p className="mt-1 text-xs text-gray-400">Permissions auto-fill. Customize below.</p>
            </Field>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">Module Access</span>
              </div>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 bg-gray-50 rounded-xl p-3 border border-gray-200">
                {MODULES.map(m => (
                  <label key={m.key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" {...register(`permissions.${m.key}`)} className="rounded text-blue-600" />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("isActive")} className="rounded" /> Active (can log in)
            </label>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 bg-blue-700 text-white text-sm font-medium rounded-xl disabled:opacity-60">
                {isSubmitting ? "Saving..." : editing ? "Update" : "Create"}
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