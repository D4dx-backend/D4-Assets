import { Suspense } from "react";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { unstable_cache } from "next/cache";
import Asset from "@/lib/models/Asset";
import Event from "@/lib/models/Event";
import Movement from "@/lib/models/Movement";
import DamageReport from "@/lib/models/DamageReport";
import "@/lib/models/Person";
import { Package, CalendarDays, ArrowLeftRight, AlertTriangle } from "lucide-react";

// Cache results for 60 s — counts rarely change within a minute
const getStats = unstable_cache(
  async () => {
    await connectDB();
    const [totalAssets, totalEvents, outMovements, openDamages] = await Promise.all([
      Asset.countDocuments({ isActive: true }),
      Event.countDocuments({ isActive: true }),
      Movement.countDocuments({ status: "OUT" }),
      DamageReport.countDocuments({ isResolved: false }),
    ]);
    return { totalAssets, totalEvents, outMovements, openDamages };
  },
  ["dashboard-stats"],
  { revalidate: 60 },
);

// Recent movements cache for 30 s
const getRecentMovements = unstable_cache(
  async () => {
    await connectDB();
    return Movement.find({})
      .populate("asset", "name")
      .populate("event", "name")
      .populate("allocatedPerson", "name")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
  },
  ["dashboard-recent-movements"],
  { revalidate: 30 },
);

// ---------- Streamed sub-components ----------

async function StatsGrid() {
  const stats = await getStats();
  const cards = [
    { label: "Total Assets", value: stats.totalAssets, icon: Package, color: "bg-blue-500" },
    { label: "Active Events", value: stats.totalEvents, icon: CalendarDays, color: "bg-green-500" },
    { label: "Assets Out", value: stats.outMovements, icon: ArrowLeftRight, color: "bg-orange-500" },
    { label: "Open Issues", value: stats.openDamages, icon: AlertTriangle, color: "bg-red-500" },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
            <div className={`w-10 h-10 ${card.color} rounded-lg flex items-center justify-center mb-3`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{card.label}</p>
          </div>
        );
      })}
    </div>
  );
}

async function RecentMovementsList() {
  const recentMovements = await getRecentMovements();
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
        <h2 className="font-semibold text-sm text-gray-900 dark:text-white">Recent Movements</h2>
      </div>
      <div className="divide-y divide-gray-50 dark:divide-slate-700">
        {recentMovements.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">No movements yet</p>
        )}
        {recentMovements.map((m) => {
          const asset = m.asset as unknown as { name: string };
          const event = m.event as unknown as { name: string };
          const person = m.allocatedPerson as unknown as { name: string };
          return (
            <div key={m._id?.toString()} className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{asset?.name}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {event?.name} · {person?.name}
                </p>
              </div>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  m.status === "OUT"
                    ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
                    : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                }`}
              >
                {m.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Fallback skeletons ----------

function StatsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
          <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-lg mb-3" />
          <div className="h-8 w-12 bg-gray-200 dark:bg-slate-700 rounded mb-1" />
          <div className="h-3 w-20 bg-gray-200 dark:bg-slate-700 rounded" />
        </div>
      ))}
    </div>
  );
}

function RecentMovementsSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 animate-pulse">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
        <div className="h-4 w-36 bg-gray-200 dark:bg-slate-700 rounded" />
      </div>
      <div className="divide-y divide-gray-50 dark:divide-slate-700">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex items-center justify-between" style={{ opacity: 1 - i * 0.12 }}>
            <div className="space-y-1.5">
              <div className="h-4 w-36 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-24 bg-gray-200 dark:bg-slate-700 rounded" />
            </div>
            <div className="h-5 w-12 bg-gray-200 dark:bg-slate-700 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Page ----------

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">Welcome back, {session?.user?.name}</p>
      </div>

      {/* Stats stream in independently */}
      <Suspense fallback={<StatsGridSkeleton />}>
        <StatsGrid />
      </Suspense>

      {/* Recent movements stream in independently */}
      <Suspense fallback={<RecentMovementsSkeleton />}>
        <RecentMovementsList />
      </Suspense>
    </div>
  );
}
