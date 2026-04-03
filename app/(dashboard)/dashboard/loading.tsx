export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Title */}
      <div className="space-y-2">
        <div className="h-6 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
        <div className="h-4 w-48 bg-gray-200 dark:bg-slate-700 rounded" />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700"
          >
            <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-lg mb-3" />
            <div className="h-8 w-12 bg-gray-200 dark:bg-slate-700 rounded mb-1" />
            <div className="h-3 w-20 bg-gray-200 dark:bg-slate-700 rounded" />
          </div>
        ))}
      </div>

      {/* Recent Movements */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
          <div className="h-4 w-36 bg-gray-200 dark:bg-slate-700 rounded" />
        </div>
        <div className="divide-y divide-gray-50 dark:divide-slate-700">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="px-4 py-3 flex items-center justify-between"
              style={{ opacity: 1 - i * 0.12 }}
            >
              <div className="space-y-1.5">
                <div className="h-4 w-36 bg-gray-200 dark:bg-slate-700 rounded" />
                <div className="h-3 w-24 bg-gray-200 dark:bg-slate-700 rounded" />
              </div>
              <div className="h-5 w-12 bg-gray-200 dark:bg-slate-700 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
