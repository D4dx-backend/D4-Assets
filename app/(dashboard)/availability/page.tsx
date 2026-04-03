"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, CheckCircle2, XCircle, MapPin, User, CalendarDays, Tag, ShieldCheck } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import Badge from "@/components/Badge";
import SearchInput from "@/components/SearchInput";
import { format } from "date-fns";

interface AvailabilityMovement {
  _id: string;
  eventName: string;
  eventLocation: string;
  eventFromDate: string | null;
  eventToDate: string | null;
  allocatedPerson: string;
  outDate: string;
  condition: string;
}

interface AvailabilityResult {
  _id: string;
  name: string;
  category: string;
  dateOfPurchase: string;
  warrantyDetails: string;
  warrantyExpiryDate: string | null;
  available: boolean;
  movement: AvailabilityMovement | null;
}

export default function AvailabilityPage() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<AvailabilityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [assetSuggestions, setAssetSuggestions] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/assets?limit=500")
      .then((r) => r.json())
      .then((d: { success: boolean; data: { name: string }[] }) => {
        if (d.success) setAssetSuggestions(d.data.map((a) => a.name));
      })
      .catch(() => {});
  }, []);

  const checkAvailability = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setResults([]);
    setLoading(true);
    const res = await fetch(`/api/assets/availability?search=${encodeURIComponent(query.trim())}`);
    const data = await res.json() as { success: boolean; data: AvailabilityResult[] };
    if (data.success) setResults(data.data);
    setSearched(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      checkAvailability(search);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, checkAvailability]);

  const available = results.filter((r) => r.available);
  const unavailable = results.filter((r) => !r.available);

  return (
    <div>
      <PageHeader
        title="Check Availability"
        description="Search an asset to see if it is currently available or issued out"
      />

      {/* Search box */}
      <SearchInput
        value={search}
        onChange={setSearch}
        suggestions={assetSuggestions}
        placeholder="Type asset name to check availability…"
        showClear
        className="mb-6"
        inputClassName="py-3 pl-10 shadow-sm bg-white dark:bg-slate-800"
        autoFocus
      />

      {/* Summary chips */}
      {searched && !loading && results.length > 0 && (
        <div className="flex gap-3 mb-5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 rounded-full text-xs font-medium text-green-700 dark:text-green-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {available.length} Available
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 rounded-full text-xs font-medium text-orange-700 dark:text-orange-400">
            <XCircle className="w-3.5 h-3.5" />
            {unavailable.length} Currently Issued
          </div>
        </div>
      )}

      {/* Page-level loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden animate-pulse">
              <div className="px-4 py-2 bg-gray-50 dark:bg-slate-700/50 h-8" />
              <div className="p-4 space-y-3">
                <div className="flex justify-between">
                  <div className="space-y-1.5">
                    <div className="h-4 w-36 bg-gray-200 dark:bg-slate-600 rounded" />
                    <div className="h-3 w-24 bg-gray-100 dark:bg-slate-700 rounded" />
                  </div>
                  <div className="h-6 w-16 bg-gray-200 dark:bg-slate-600 rounded-full" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-3 w-full bg-gray-100 dark:bg-slate-700 rounded" />
                  <div className="h-3 w-full bg-gray-100 dark:bg-slate-700 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && searched && results.length === 0 && (
        <EmptyState icon={Search} title="No assets found" description="Try a different search term" />
      )}

      {!loading && !searched && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-blue-500" />
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Start by searching an asset</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Enter the asset name above to check its current status</p>
        </div>
      )}

      <div className="space-y-3">
        {results.map((r) => (
          <div
            key={r._id}
            className={`bg-white dark:bg-slate-800 rounded-xl border shadow-sm overflow-hidden ${
              r.available
                ? "border-green-200 dark:border-green-800"
                : "border-orange-200 dark:border-orange-800"
            }`}
          >
            {/* Header strip */}
            <div
              className={`px-4 py-2 flex items-center gap-2 ${
                r.available
                  ? "bg-green-50 dark:bg-green-900/20"
                  : "bg-orange-50 dark:bg-orange-900/20"
              }`}
            >
              {r.available ? (
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
              )}
              <span
                className={`text-xs font-semibold ${
                  r.available
                    ? "text-green-700 dark:text-green-400"
                    : "text-orange-700 dark:text-orange-400"
                }`}
              >
                {r.available ? "AVAILABLE" : "CURRENTLY ISSUED / NOT AVAILABLE"}
              </span>
            </div>

            {/* Body */}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{r.name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Tag className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-slate-400">{r.category}</span>
                  </div>
                </div>
                <Badge variant={r.available ? "green" : "orange"}>
                  {r.available ? "In Store" : "OUT"}
                </Badge>
              </div>

              {/* Asset details row */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-slate-400 mb-3">
                <div className="flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" />
                  <span>Purchased: {format(new Date(r.dateOfPurchase), "dd MMM yyyy")}</span>
                </div>
                {r.warrantyDetails && (
                  <div className="flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span className="truncate">{r.warrantyDetails}</span>
                  </div>
                )}
                {r.warrantyExpiryDate && (
                  <div className="flex items-center gap-1 col-span-2">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Warranty expires: {format(new Date(r.warrantyExpiryDate), "dd MMM yyyy")}</span>
                  </div>
                )}
              </div>

              {/* OUT details */}
              {!r.available && r.movement && (
                <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-900/30 space-y-1.5">
                  <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 mb-2">Current Whereabouts</p>
                  <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-slate-300">
                    <CalendarDays className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                    <span className="font-medium">{r.movement.eventName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                    <span>{r.movement.eventLocation}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-400">
                    <User className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                    <span>Issued to: <span className="font-medium text-gray-800 dark:text-slate-200">{r.movement.allocatedPerson}</span></span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-500">
                    <CalendarDays className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span>Issued on: {format(new Date(r.movement.outDate), "dd MMM yyyy, hh:mm a")}</span>
                  </div>
                  {r.movement.eventFromDate && r.movement.eventToDate && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-500">
                      <CalendarDays className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span>
                        Event: {format(new Date(r.movement.eventFromDate), "dd MMM")} –{" "}
                        {format(new Date(r.movement.eventToDate), "dd MMM yyyy")}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
