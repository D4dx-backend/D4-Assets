import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Asset from "@/lib/models/Asset";
import Event from "@/lib/models/Event";
import Movement from "@/lib/models/Movement";
import DamageReport from "@/lib/models/DamageReport";
import "@/lib/models/Person";
import { Package, CalendarDays, ArrowLeftRight, AlertTriangle } from "lucide-react";

async function getStats() {
  await connectDB();
  const [totalAssets, totalEvents, outMovements, openDamages] = await Promise.all([
    Asset.countDocuments({ isActive: true }),
    Event.countDocuments({ isActive: true }),
    Movement.countDocuments({ status: "OUT" }),
    DamageReport.countDocuments({ isResolved: false }),
  ]);
  return { totalAssets, totalEvents, outMovements, openDamages };
}

async function getRecentMovements() {
  await connectDB();
  return Movement.find({})
    .populate("asset", "name")
    .populate("event", "name")
    .populate("allocatedPerson", "name")
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();
}

export default async function DashboardPage() {
  const session = await auth();
  const [stats, recentMovements] = await Promise.all([getStats(), getRecentMovements()]);

  const cards = [
    { label: "Total Assets", value: stats.totalAssets, icon: Package, color: "bg-blue-500" },
    { label: "Active Events", value: stats.totalEvents, icon: CalendarDays, color: "bg-green-500" },
    { label: "Assets Out", value: stats.outMovements, icon: ArrowLeftRight, color: "bg-orange-500" },
    { label: "Open Issues", value: stats.openDamages, icon: AlertTriangle, color: "bg-red-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">Welcome back, {session?.user?.name}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className={`w-10 h-10 ${card.color} rounded-lg flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Recent Movements */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-sm text-gray-900">Recent Movements</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {recentMovements.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">No movements yet</p>
          )}
          {recentMovements.map((m) => {
            const asset = m.asset as unknown as { name: string };
            const event = m.event as unknown as { name: string };
            const person = m.allocatedPerson as unknown as { name: string };
            return (
              <div key={m._id?.toString()} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{asset?.name}</p>
                  <p className="text-xs text-gray-500">
                    {event?.name} · {person?.name}
                  </p>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    m.status === "OUT"
                      ? "bg-orange-100 text-orange-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {m.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
