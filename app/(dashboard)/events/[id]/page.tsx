"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  Package,
} from "lucide-react";
import Badge from "@/components/Badge";
import Modal from "@/components/Modal";
import { format } from "date-fns";

interface EventDetail {
  _id: string;
  name: string;
  location: string;
  fromDate: string;
  toDate: string;
  status: "upcoming" | "active" | "completed";
  responsiblePerson?: { _id: string; name: string };
}

interface Asset {
  _id: string;
  name: string;
  category: string;
}

interface Movement {
  _id: string;
  asset: { _id: string; name: string };
  event: { _id: string; name: string };
  status: "OUT" | "IN";
  outDate: string;
  inDate?: string;
  condition?: string;
  allocatedPerson?: { _id: string; name: string };
}

const statusVariants: Record<string, "blue" | "green" | "gray"> = {
  upcoming: "blue",
  active: "green",
  completed: "gray",
};

function getOpenMovement(assetId: string, movements: Movement[]): Movement | null {
  return (
    movements.find((m) => m.asset._id === assetId && m.status === "OUT") ?? null
  );
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [issuing, setIssuing] = useState(false);

  // Return modal state
  const [returnMovement, setReturnMovement] = useState<Movement | null>(null);
  const [returnCondition, setReturnCondition] = useState<"good" | "damaged" | "defective" | "missing">("good");
  const [returnNotes, setReturnNotes] = useState("");
  const [returning, setReturning] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [evRes, aRes, mRes] = await Promise.all([
      fetch(`/api/events/${id}`),
      fetch("/api/assets"),
      fetch(`/api/movements?event=${id}`),
    ]);
    const [evData, aData, mData] = await Promise.all([
      evRes.json() as Promise<{ success: boolean; data: EventDetail }>,
      aRes.json() as Promise<{ success: boolean; data: Asset[] }>,
      mRes.json() as Promise<{ success: boolean; data: Movement[] }>,
    ]);
    if (evData.success) setEvent(evData.data);
    if (aData.success) setAssets(aData.data);
    if (mData.success) setMovements(mData.data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function toggleSelect(assetId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }

  function toggleAll(available: Asset[]) {
    if (selectedIds.size === available.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(available.map((a) => a._id)));
    }
  }

  async function issueSelected() {
    if (selectedIds.size === 0) return;
    setIssuing(true);

    const personId = event?.responsiblePerson?._id;
    const results = await Promise.all(
      [...selectedIds].map((assetId) =>
        fetch("/api/movements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asset: assetId,
            event: id,
            allocatedPerson: personId,
          }),
        }).then((r) => r.json() as Promise<{ success: boolean; error?: string }>)
      )
    );

    setIssuing(false);
    const failed = results.filter((r) => !r.success);
    if (failed.length > 0) {
      toast.error(`${failed.length} asset(s) could not be issued`);
    } else {
      toast.success(`${selectedIds.size} asset(s) issued`);
    }
    setSelectedIds(new Set());
    fetchAll();
  }

  async function handleReturn() {
    if (!returnMovement) return;
    setReturning(true);

    const res = await fetch(`/api/movements/${returnMovement._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        condition: returnCondition,
        remarks: returnNotes,
      }),
    });
    const data = await res.json() as { success: boolean; error?: string };
    setReturning(false);

    if (data.success) {
      toast.success("Asset returned successfully");
      setReturnMovement(null);
      setReturnCondition("good");
      setReturnNotes("");
      fetchAll();
    } else {
      toast.error(data.error ?? "Return failed");
    }
  }

  function openReturn(movement: Movement) {
    setReturnMovement(movement);
    setReturnCondition("good");
    setReturnNotes("");
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-white dark:bg-slate-800 rounded-xl animate-pulse border border-gray-100 dark:border-slate-700" />
        ))}
      </div>
    );
  }

  if (!event) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-slate-400">
        Event not found.{" "}
        <Link href="/events" className="text-blue-600 underline">
          Back to Events
        </Link>
      </div>
    );
  }

  const availableAssets = assets.filter((a) => getOpenMovement(a._id, movements) === null);
  const issuedAssets = assets.filter((a) => getOpenMovement(a._id, movements) !== null);
  const allAvailableSelected = availableAssets.length > 0 && selectedIds.size === availableAssets.length;

  return (
    <div>
      {/* Back + title */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/events" className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-slate-400" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">{event.name}</h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 truncate">📍 {event.location}</p>
        </div>
        <Badge variant={statusVariants[event.status] ?? "gray"}>{event.status}</Badge>
      </div>

      {/* Event info card */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 mb-5">
        <div className="grid grid-cols-2 gap-y-3 text-sm">
          <div>
            <p className="text-xs text-gray-400 dark:text-slate-500 font-medium uppercase tracking-wide">From</p>
            <p className="text-gray-900 dark:text-white font-medium">{format(new Date(event.fromDate), "dd MMM yyyy")}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 dark:text-slate-500 font-medium uppercase tracking-wide">To</p>
            <p className="text-gray-900 dark:text-white font-medium">{format(new Date(event.toDate), "dd MMM yyyy")}</p>
          </div>
          {event.responsiblePerson && (
            <div className="col-span-2">
              <p className="text-xs text-gray-400 dark:text-slate-500 font-medium uppercase tracking-wide">Responsible</p>
              <p className="text-gray-900 dark:text-white font-medium">{event.responsiblePerson.name}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Issued assets ─────────────────────────────────── */}
      {issuedAssets.length > 0 && (
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Currently Issued ({issuedAssets.length})
          </h2>
          <div className="space-y-2">
            {issuedAssets.map((asset) => {
              const mv = getOpenMovement(asset._id, movements)!;
              return (
                <div
                  key={asset._id}
                  className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/40 rounded-xl p-3 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900 dark:text-white">{asset.name}</span>
                      <span className="text-xs text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                        {asset.category}
                      </span>
                    </div>
                    <p className="text-xs text-orange-600 mt-0.5">
                      Issued {format(new Date(mv.outDate), "dd MMM yyyy")}
                    </p>
                  </div>
                  <button
                    onClick={() => openReturn(mv)}
                    className="flex items-center gap-1.5 text-xs bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1.5 rounded-lg font-medium transition-colors flex-shrink-0"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    Return
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Available assets ───────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
            Available Assets ({availableAssets.length})
          </h2>
          <div className="flex items-center gap-2">
            {availableAssets.length > 0 && (
              <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allAvailableSelected}
                  onChange={() => toggleAll(availableAssets)}
                  className="w-3.5 h-3.5 rounded text-blue-600"
                />
                Select all
              </label>
            )}
            {selectedIds.size > 0 && (
              <button
                onClick={issueSelected}
                disabled={issuing}
                className="flex items-center gap-1.5 bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-60 transition-colors"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                {issuing
                  ? "Issuing…"
                  : `Issue ${selectedIds.size} Asset${selectedIds.size > 1 ? "s" : ""}`}
              </button>
            )}
          </div>
        </div>

        {availableAssets.length === 0 ? (
          <div className="text-center py-10 text-gray-400 dark:text-slate-500 text-sm">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
            All assets are currently issued
          </div>
        ) : (
          <div className="space-y-2">
            {availableAssets.map((asset) => {
              const isSelected = selectedIds.has(asset._id);
              return (
                <div
                  key={asset._id}
                  onClick={() => toggleSelect(asset._id)}
                  className={`bg-white dark:bg-slate-800 border rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all select-none ${
                    isSelected
                      ? "border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500"
                      : "border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(asset._id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded text-blue-600 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm text-gray-900 dark:text-white">{asset.name}</span>
                    <span className="text-xs text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded ml-2">
                      {asset.category}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-slate-500 flex-shrink-0">Available</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Return modal ────────────────────────────────────── */}
      {returnMovement && (
        <Modal title="Return Asset" onClose={() => setReturnMovement(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-700 dark:text-slate-300">
              Returning <strong>{returnMovement.asset.name}</strong>
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Condition</label>
              <select
                value={returnCondition}
                onChange={(e) =>
                  setReturnCondition(
                    e.target.value as "good" | "damaged" | "defective" | "missing"
                  )
                }
                className="select"
              >
                <option value="good">Good — No issues</option>
                <option value="damaged">Damaged</option>
                <option value="defective">Defective / Malfunctioning</option>
                <option value="missing">Missing / Lost</option>
              </select>
            </div>

            {returnCondition !== "good" && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>A damage report will be automatically created for this asset.</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Notes</label>
              <textarea
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                rows={3}
                className="input resize-none"
                placeholder="Describe any damage or remarks…"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setReturnMovement(null)}
                className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReturn}
                disabled={returning}
                className="flex-1 py-2.5 bg-green-700 text-white text-sm font-medium rounded-xl hover:bg-green-800 disabled:opacity-60"
              >
                {returning ? "Returning…" : "Confirm Return"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
