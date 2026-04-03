"use client";

import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Package,
  Search,
  SendHorizonal,
  X,
} from "lucide-react";
import Badge from "@/components/Badge";
import SearchInput from "@/components/SearchInput";
import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  productCode?: string;
  allowOutside: boolean;
}

interface Movement {
  _id: string;
  asset: { _id: string; name: string };
  event: { _id: string; name: string };
  status: "OUT" | "IN";
  outDate: string;
  outBy?: { _id: string; name: string };
  inDate?: string;
  returnBy?: string;
  verifiedBy?: string;
  condition?: "good" | "damaged" | "defective" | "missing";
  remarks?: string;
  allocatedPerson?: { _id: string; name: string };
}

type ReturnCondition = "good" | "damaged" | "defective" | "missing";

interface AssetRow {
  asset: Asset;
  movement: Movement | null;
  // Return inline state
  inlineOpen: boolean;
  noteOpen: boolean;
  returnCondition: ReturnCondition;
  returnRemarks: string;
  returnBy: string;
  returnVerifiedBy: string;
  saving: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const statusVariants: Record<string, "blue" | "green" | "gray"> = {
  upcoming: "blue",
  active: "green",
  completed: "gray",
};

const conditionLabel: Record<ReturnCondition, string> = {
  good: "Good",
  damaged: "Damaged",
  defective: "Defective",
  missing: "Missing",
};

const conditionBadge: Record<ReturnCondition, string> = {
  good: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  damaged: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  defective: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  missing: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [rows, setRows] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Batch OUT local state
  const [pendingOutIds, setPendingOutIds] = useState<Set<string>>(new Set());
  const [submittingOut, setSubmittingOut] = useState(false);
  // OUT confirm step
  type OutAssetCondition = { condition: ReturnCondition; damageReason: string; remarks: string };
  const [showOutConfirm, setShowOutConfirm] = useState(false);
  const [outAssetConditions, setOutAssetConditions] = useState<Record<string, OutAssetCondition>>({});

  // Search
  const [search, setSearch] = useState("");

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [evRes, aRes, mRes] = await Promise.all([
      fetch(`/api/events/${id}`),
      fetch("/api/assets?limit=500"),
      fetch(`/api/movements?event=${id}`),
    ]);
    const [evData, aData, mData] = await Promise.all([
      evRes.json() as Promise<{ success: boolean; data: EventDetail }>,
      aRes.json() as Promise<{ success: boolean; data: Asset[] }>,
      mRes.json() as Promise<{ success: boolean; data: Movement[] }>,
    ]);

    if (evData.success) setEvent(evData.data);

    if (aData.success && mData.success) {
      const movMap = new Map<string, Movement>();
      for (const m of mData.data) movMap.set(m.asset._id, m);
      setRows(
        aData.data.map((asset) => ({
          asset,
          movement: movMap.get(asset._id) ?? null,
          inlineOpen: false,
          noteOpen: false,
          returnCondition: "good",
          returnRemarks: "",
          returnBy: "",
          returnVerifiedBy: "",
          saving: false,
        }))
      );
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Row helper ────────────────────────────────────────────────────────────

  const setRow = useCallback((assetId: string, patch: Partial<AssetRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.asset._id === assetId ? { ...r, ...patch } : r))
    );
  }, []);

  // ── Batch OUT ─────────────────────────────────────────────────────────────

  const togglePendingOut = useCallback((assetId: string) => {
    setPendingOutIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }, []);

  async function submitOutWithConditions() {
    if (pendingOutIds.size === 0) return;
    setSubmittingOut(true);
    const results = await Promise.all(
      [...pendingOutIds].map((assetId) => {
        const condData = outAssetConditions[assetId] ?? { condition: "good" as ReturnCondition, damageReason: "", remarks: "" };
        return fetch("/api/movements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asset: assetId,
            event: id,
            allocatedPerson: event?.responsiblePerson?._id,
            condition: condData.condition,
            damageReason: condData.damageReason || undefined,
            remarks: condData.remarks || undefined,
          }),
        }).then((r) => r.json() as Promise<{ success: boolean; error?: string }>);
      })
    );
    setSubmittingOut(false);
    const failed = results.filter((r) => !r.success).length;
    if (failed > 0) toast.error(`${failed} asset(s) could not be issued`);
    else toast.success(`${pendingOutIds.size} asset(s) issued`);
    setPendingOutIds(new Set());
    setShowOutConfirm(false);
    setOutAssetConditions({});
    fetchAll();
  }

  // ── Return (IN) ───────────────────────────────────────────────────────────

  const returnAsset = useCallback(async (row: AssetRow) => {
    if (!row.movement) return;
    setRow(row.asset._id, { saving: true });
    const res = await fetch(`/api/movements/${row.movement._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        condition: row.returnCondition,
        remarks: row.returnRemarks || undefined,
        returnBy: row.returnBy || undefined,
        verifiedBy: row.returnVerifiedBy || undefined,
      }),
    });
    const data = await res.json() as { success: boolean; error?: string };
    if (data.success) {
      toast.success("Asset returned");
      fetchAll();
    } else {
      toast.error(data.error ?? "Return failed");
      setRow(row.asset._id, { saving: false });
    }
  }, [setRow, fetchAll]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.asset.name.toLowerCase().includes(q) ||
        r.asset.category.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, AssetRow[]>();
    for (const row of filtered) {
      const cat = row.asset.category || "Uncategorized";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(row);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 bg-white dark:bg-slate-800 rounded-xl animate-pulse border border-gray-100 dark:border-slate-700" />
        ))}
      </div>
    );
  }

  if (!event) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-slate-400">
        Event not found.{" "}
        <Link href="/events" className="text-blue-600 underline">Back to Events</Link>
      </div>
    );
  }

  const availableCount = rows.filter((r) => r.movement === null).length;
  const issuedCount = rows.filter((r) => r.movement?.status === "OUT").length;
  const returnedCount = rows.filter((r) => r.movement?.status === "IN").length;

  return (
    <div>
      {/* ── Back + title ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5">
        <Link
          href="/events"
          className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-slate-400" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">{event.name}</h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 truncate">📍 {event.location}</p>
        </div>
        <Badge variant={statusVariants[event.status] ?? "gray"}>{event.status}</Badge>
      </div>

      {/* ── Event info card ──────────────────────────────────────────────── */}
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

      {/* ── Stats bar ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mb-4 text-xs text-gray-500 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-slate-600 inline-block" />
          {availableCount} available
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
          {issuedCount} issued
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          {returnedCount} returned
        </span>
      </div>

      {/* ── Search + Submit batch OUT ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          suggestions={rows.map((r) => r.asset.name)}
          placeholder="Search assets or category…"
          className="flex-1"
          inputClassName="py-2"
        />
        {pendingOutIds.size > 0 && (
          <button
            onClick={() => { setOutAssetConditions({}); setShowOutConfirm(true); }}
            className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors"
          >
            <SendHorizonal className="w-4 h-4" />
            {`Issue ${pendingOutIds.size} item${pendingOutIds.size > 1 ? "s" : ""}`}
          </button>
        )}
      </div>

      {/* ── OUT confirm modal ────────────────────────────────────────────── */}
      {showOutConfirm && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-700">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Issue {pendingOutIds.size} item{pendingOutIds.size !== 1 ? "s" : ""}
              </h2>
              <button
                onClick={() => setShowOutConfirm(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-gray-600 dark:text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-700/50">
              {[...pendingOutIds].map((assetId) => {
                const assetName = rows.find((r) => r.asset._id === assetId)?.asset.name ?? assetId;
                const cond = outAssetConditions[assetId] ?? { condition: "good" as ReturnCondition, damageReason: "", remarks: "" };
                return (
                  <div key={assetId} className="px-4 py-3 space-y-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{assetName}</p>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Condition at checkout</label>
                        <select
                          value={cond.condition}
                          onChange={(e) =>
                            setOutAssetConditions((prev) => ({
                              ...prev,
                              [assetId]: { ...cond, condition: e.target.value as ReturnCondition },
                            }))
                          }
                          className="select text-sm"
                        >
                          <option value="good">Good</option>
                          <option value="damaged">Damaged</option>
                          <option value="defective">Defective</option>
                          <option value="missing">Missing</option>
                        </select>
                      </div>
                      {cond.condition !== "good" && (
                        <div className="flex-1">
                          <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Reason</label>
                          <input
                            value={cond.damageReason}
                            onChange={(e) =>
                              setOutAssetConditions((prev) => ({
                                ...prev,
                                [assetId]: { ...cond, damageReason: e.target.value },
                              }))
                            }
                            placeholder="Describe issue…"
                            className="input text-sm"
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Remark (optional)</label>
                      <input
                        value={cond.remarks}
                        onChange={(e) =>
                          setOutAssetConditions((prev) => ({
                            ...prev,
                            [assetId]: { ...cond, remarks: e.target.value },
                          }))
                        }
                        placeholder="Pre-existing damage or notes…"
                        className="input text-sm w-full"
                      />
                    </div>
                    {cond.condition !== "good" && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>A damage report will be created on issue.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-2">
              <button
                onClick={() => setShowOutConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitOutWithConditions}
                disabled={submittingOut}
                className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-60 transition-colors"
              >
                <SendHorizonal className="w-4 h-4" />
                {submittingOut ? "Issuing…" : "Confirm & Issue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Category-grouped table ────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <div className="py-12 text-center text-gray-400 dark:text-slate-500 text-sm">
          <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No assets found
        </div>
      ) : grouped.length === 0 ? (
        <div className="py-8 text-center text-gray-400 dark:text-slate-500 text-sm">No results for "{search}"</div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([category, catRows]) => (
            <div key={category} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
              {/* Category header */}
              <div className="px-4 py-2 bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">{category}</span>
                <span className="text-xs text-gray-400 dark:text-slate-500">{catRows.length} item{catRows.length !== 1 ? "s" : ""}</span>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] bg-gray-50/50 dark:bg-slate-700/20 border-b border-gray-100 dark:border-slate-700/50">
                <div className="px-4 py-2 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Item</div>
                <div className="px-3 py-2 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide text-center w-14">OUT</div>
                <div className="px-3 py-2 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide text-center w-14">IN</div>
                <div className="px-3 py-2 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide text-center w-28">Condition</div>
                <div className="px-4 py-2 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide w-32">Remarks</div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {catRows.map((row) => (
                  <MemoAssetTableRow
                    key={row.asset._id}
                    row={row}
                    isPendingOut={pendingOutIds.has(row.asset._id)}
                    setRow={setRow}
                    togglePendingOut={togglePendingOut}
                    returnAsset={returnAsset}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AssetTableRow ────────────────────────────────────────────────────────────

interface AssetTableRowProps {
  row: AssetRow;
  isPendingOut: boolean;
  setRow: (assetId: string, patch: Partial<AssetRow>) => void;
  togglePendingOut: (assetId: string) => void;
  returnAsset: (row: AssetRow) => void;
}

function AssetTableRow({
  row,
  isPendingOut,
  setRow,
  togglePendingOut,
  returnAsset,
}: AssetTableRowProps) {
  const { asset, movement, inlineOpen, noteOpen, returnCondition, returnRemarks, returnBy, returnVerifiedBy, saving } = row;

  const isAvailable = movement === null;
  const isOut = movement?.status === "OUT";
  const isIn = movement?.status === "IN";
  const cond = movement?.condition as ReturnCondition | undefined;

  const handleTogglePendingOut = useCallback(() => togglePendingOut(asset._id), [togglePendingOut, asset._id]);
  const handleToggleInline = useCallback(() => setRow(asset._id, { inlineOpen: !inlineOpen, noteOpen: false, returnCondition: "good", returnRemarks: "" }), [setRow, asset._id, inlineOpen]);
  const handleToggleNote = useCallback(() => setRow(asset._id, { noteOpen: !noteOpen }), [setRow, asset._id, noteOpen]);
  const handleConditionChange = useCallback((c: ReturnCondition) => setRow(asset._id, { returnCondition: c }), [setRow, asset._id]);
  const handleRemarksChange = useCallback((r: string) => setRow(asset._id, { returnRemarks: r }), [setRow, asset._id]);
  const handleReturnByChange = useCallback((v: string) => setRow(asset._id, { returnBy: v }), [setRow, asset._id]);
  const handleReturnVerifiedByChange = useCallback((v: string) => setRow(asset._id, { returnVerifiedBy: v }), [setRow, asset._id]);
  const handleReturn = useCallback(() => returnAsset(row), [returnAsset, row]);

  return (
    <div>
      {/* Main row */}
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center hover:bg-gray-50/50 dark:hover:bg-slate-700/20 transition-colors">
        {/* Item name */}
        <div className="px-4 py-3 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{asset.name}</p>
          {asset.productCode && (
            <p className="text-xs text-gray-400 dark:text-slate-500 font-mono">#{asset.productCode}</p>
          )}
          {!asset.allowOutside && (
            <p className="text-xs text-amber-600 dark:text-amber-400">Not allowed outside</p>
          )}
          {isOut && movement?.outBy?.name && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Issued by: {movement.outBy.name}</p>
          )}
          {isIn && (
            <div className="mt-0.5 space-y-0.5">
              {movement?.outBy?.name && (
                <p className="text-xs text-blue-500/70 dark:text-blue-400/60">Issued by: {movement.outBy.name}</p>
              )}
              {movement?.returnBy && (
                <p className="text-xs text-green-600 dark:text-green-400">Ret. by: {movement.returnBy}</p>
              )}
              {movement?.verifiedBy && (
                <p className="text-xs text-teal-600 dark:text-teal-400">Ver. by: {movement.verifiedBy}</p>
              )}
            </div>
          )}
        </div>

        {/* OUT column */}
        <div className="px-3 py-3 w-14 flex justify-center">
          {isAvailable ? (
            asset.allowOutside ? (
              <button
                onClick={handleTogglePendingOut}
                title={isPendingOut ? "Remove from issue list" : "Add to issue list"}
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${
                  isPendingOut
                    ? "border-orange-400 bg-orange-50 dark:bg-orange-900/20"
                    : "border-gray-300 dark:border-slate-500 hover:border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/10"
                }`}
              >
                {isPendingOut ? (
                  <CheckCircle2 className="w-4 h-4 text-orange-500" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
                )}
              </button>
            ) : (
              <span title="Not allowed outside" className="w-7 h-7 rounded-full border-2 border-gray-200 dark:border-slate-600 flex items-center justify-center opacity-40 cursor-not-allowed">
                <Circle className="w-3.5 h-3.5 text-gray-300 dark:text-slate-600" />
              </span>
            )
          ) : (
            <CheckCircle2 className="w-6 h-6 text-orange-500" />
          )}
        </div>

        {/* IN column */}
        <div className="px-3 py-3 w-14 flex justify-center">
          {isIn ? (
            <CheckCircle2 className="w-6 h-6 text-green-500" />
          ) : isOut ? (
            <button
              onClick={handleToggleInline}
              title="Mark as returned"
              className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${
                inlineOpen
                  ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                  : "border-gray-300 dark:border-slate-500 hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/10"
              }`}
            >
              {inlineOpen
                ? <ChevronUp className="w-3.5 h-3.5 text-green-600" />
                : <Circle className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />}
            </button>
          ) : (
            <span className="text-gray-200 dark:text-slate-700 text-xs select-none">—</span>
          )}
        </div>

        {/* Condition column */}
        <div className="px-3 py-3 w-28 flex justify-center">
          {isIn && cond ? (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${conditionBadge[cond]}`}>
              {conditionLabel[cond]}
            </span>
          ) : isOut ? (
            <span className="text-xs text-gray-400 dark:text-slate-500">Pending</span>
          ) : (
            <span className="text-gray-200 dark:text-slate-700 text-xs select-none">—</span>
          )}
        </div>

        {/* Remarks column */}
        <div className="px-4 py-3 w-32">
          {movement?.remarks ? (
            <p className="text-xs text-gray-500 dark:text-slate-400 truncate" title={movement.remarks}>
              {movement.remarks}
            </p>
          ) : (
            <span className="text-gray-200 dark:text-slate-700 text-xs select-none">—</span>
          )}
        </div>
      </div>

      {/* Inline return panel */}
      {inlineOpen && isOut && (
        <div className="mx-4 mb-3 rounded-xl border border-green-200 dark:border-green-800/40 bg-green-50 dark:bg-green-900/10 overflow-hidden">
          {/* Quick return row */}
          <div className="flex items-center justify-between px-4 py-3 gap-3">
            <p className="text-xs text-gray-600 dark:text-slate-300 font-medium truncate">
              Return <span className="font-bold text-gray-900 dark:text-white">{asset.name}</span>
            </p>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleToggleNote}
                className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 flex items-center gap-1 transition-colors"
              >
                {noteOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {noteOpen ? "Hide note" : "Add note"}
              </button>
              <button
                onClick={handleReturn}
                disabled={saving}
                className="flex items-center gap-1.5 bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-green-800 disabled:opacity-60 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {saving ? "Returning…" : "Confirm Return"}
              </button>
            </div>
          </div>

          {/* Expandable note section */}
          {noteOpen && (
            <div className="px-4 pb-3 border-t border-green-200 dark:border-green-800/40 pt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Returned By</label>
                  <input
                    value={returnBy}
                    onChange={(e) => handleReturnByChange(e.target.value)}
                    placeholder="Person who returned…"
                    className="input text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Verified By</label>
                  <input
                    value={returnVerifiedBy}
                    onChange={(e) => handleReturnVerifiedByChange(e.target.value)}
                    placeholder="Person who verified…"
                    className="input text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Condition</label>
                  <select
                    value={returnCondition}
                    onChange={(e) => handleConditionChange(e.target.value as ReturnCondition)}
                    className="select text-sm"
                  >
                    <option value="good">Good — No issues</option>
                    <option value="damaged">Damaged</option>
                    <option value="defective">Defective / Malfunctioning</option>
                    <option value="missing">Missing / Lost</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Remarks (optional)</label>
                  <input
                    value={returnRemarks}
                    onChange={(e) => handleRemarksChange(e.target.value)}
                    placeholder="Notes…"
                    className="input text-sm"
                  />
                </div>
              </div>
              {returnCondition !== "good" && (
                <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-lg text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>A damage report will be automatically created.</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const MemoAssetTableRow = memo(AssetTableRow);
