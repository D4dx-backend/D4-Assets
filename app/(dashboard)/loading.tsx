export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-40 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-4 w-56 bg-gray-200 dark:bg-slate-700 rounded" />
        </div>
        <div className="h-9 w-28 bg-gray-200 dark:bg-slate-700 rounded-lg" />
      </div>

      {/* Search bar */}
      <div className="h-10 w-full bg-gray-200 dark:bg-slate-700 rounded-lg" />

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        {/* Header row */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-slate-700/50 flex gap-6 border-b border-gray-100 dark:border-slate-700">
          {[140, 100, 80, 80, 60].map((w, i) => (
            <div
              key={i}
              className="h-4 bg-gray-200 dark:bg-slate-600 rounded"
              style={{ width: w }}
            />
          ))}
        </div>
        {/* Body rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="px-4 py-3 border-t border-gray-100 dark:border-slate-700 flex items-center gap-6"
          >
            {[140, 100, 80, 80, 60].map((w, j) => (
              <div
                key={j}
                className="h-4 bg-gray-200 dark:bg-slate-700 rounded"
                style={{ width: w, opacity: 1 - i * 0.1 }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Pagination placeholder */}
      <div className="flex justify-center gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-8 bg-gray-200 dark:bg-slate-700 rounded" />
        ))}
      </div>
    </div>
  );
}
