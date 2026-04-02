"use client";

import { useRef, useState, useEffect } from "react";
import { Search, X, ArrowUpRight } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions?: string[];
  placeholder?: string;
  loading?: boolean;
  className?: string;
  inputClassName?: string;
  showClear?: boolean;
  autoFocus?: boolean;
}

/** Bold-highlights the matched portion; rest is normal weight. */
function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text}</span>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  // rebuild regex for .test() – split resets lastIndex each call
  const testRe = new RegExp(`^${escaped}$`, "i");
  return (
    <span>
      {parts.map((part, i) =>
        testRe.test(part) ? (
          <span key={i} className="text-blue-500 dark:text-blue-400 font-semibold">
            {part}
          </span>
        ) : (
          <span key={i} className="text-gray-800 dark:text-slate-200">
            {part}
          </span>
        )
      )}
    </span>
  );
}

export default function SearchInput({
  value,
  onChange,
  suggestions = [],
  placeholder = "Search…",
  loading = false,
  className = "",
  inputClassName = "",
  showClear = false,
  autoFocus = false,
}: SearchInputProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered =
    value.trim().length > 0
      ? [
          ...new Set(
            suggestions.filter(
              (s) =>
                s.toLowerCase().includes(value.toLowerCase()) &&
                s.toLowerCase() !== value.toLowerCase()
            )
          ),
        ].slice(0, 7)
      : [];

  useEffect(() => {
    setActiveIndex(-1);
    setOpen(filtered.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      onChange(filtered[activeIndex]);
      setOpen(false);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input */}
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500 pointer-events-none z-10" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => filtered.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        className={`w-full pl-9 ${showClear ? "pr-9" : "pr-4"} py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow ${inputClassName}`}
      />

      {/* Spinner */}
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Clear button */}
      {showClear && value && !loading && (
        <button
          onClick={() => { onChange(""); setOpen(false); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 transition-colors z-10"
        >
          <X className="w-3 h-3 text-gray-500 dark:text-slate-300" />
        </button>
      )}

      {/* Dropdown */}
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-2 rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl shadow-black/10 dark:shadow-black/40 overflow-hidden">
          {/* Header label */}
          <div className="px-4 pt-3 pb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-500">
              Suggestions
            </span>
            <span className="text-[10px] text-gray-300 dark:text-slate-600">
              ↑↓ navigate · ↵ select
            </span>
          </div>

          <ul className="max-h-56 overflow-y-auto pb-2">
            {filtered.map((s, i) => {
              const isActive = i === activeIndex;
              return (
                <li
                  key={s}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(s);
                    setOpen(false);
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`mx-2 mb-0.5 flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-100 group ${
                    isActive
                      ? "bg-blue-50 dark:bg-blue-950/60"
                      : "hover:bg-gray-50 dark:hover:bg-slate-800/70"
                  }`}
                >
                  {/* Icon pill */}
                  <span
                    className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                      isActive
                        ? "bg-blue-100 dark:bg-blue-900/50"
                        : "bg-gray-100 dark:bg-slate-800 group-hover:bg-gray-200 dark:group-hover:bg-slate-700"
                    }`}
                  >
                    <Search
                      className={`w-3.5 h-3.5 transition-colors ${
                        isActive
                          ? "text-blue-500 dark:text-blue-400"
                          : "text-gray-400 dark:text-slate-500"
                      }`}
                    />
                  </span>

                  {/* Text */}
                  <span className="flex-1 text-sm truncate">
                    <Highlighted text={s} query={value} />
                  </span>

                  {/* Arrow — visible on active/hover */}
                  <ArrowUpRight
                    className={`w-3.5 h-3.5 flex-shrink-0 transition-opacity ${
                      isActive ? "opacity-100 text-blue-400" : "opacity-0 group-hover:opacity-40 text-gray-400"
                    }`}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
