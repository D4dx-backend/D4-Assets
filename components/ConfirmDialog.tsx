"use client";
import { Trash2, X, PowerOff, Power } from "lucide-react";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: "danger" | "warning" | "success";
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  variant = "danger",
  onConfirm,
  onCancel,
  loading,
}: ConfirmDialogProps) {
  const isDanger  = variant === "danger";
  const isWarning = variant === "warning";
  const isSuccess = variant === "success";

  const Icon = isSuccess ? Power : isWarning ? PowerOff : Trash2;

  const colors = isDanger
    ? {
        ring:    "ring-red-500/30",
        iconBg:  "bg-red-500/20",
        iconFg:  "text-red-400",
        divider: "bg-red-500/20",
        badge:   "bg-red-500/10 text-red-400 ring-1 ring-red-500/20",
        btn:     "bg-red-600 hover:bg-red-500 shadow-red-600/40",
        subtitleText: "This cannot be undone",
      }
    : isWarning
    ? {
        ring:    "ring-amber-500/30",
        iconBg:  "bg-amber-500/20",
        iconFg:  "text-amber-400",
        divider: "bg-amber-500/20",
        badge:   "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
        btn:     "bg-amber-500 hover:bg-amber-400 shadow-amber-500/40",
        subtitleText: "Access will be revoked",
      }
    : {
        ring:    "ring-green-500/30",
        iconBg:  "bg-green-500/20",
        iconFg:  "text-green-400",
        divider: "bg-green-500/20",
        badge:   "bg-green-500/10 text-green-400 ring-1 ring-green-500/20",
        btn:     "bg-green-600 hover:bg-green-500 shadow-green-600/40",
        subtitleText: "Access will be restored",
      };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md px-4"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        className={`w-full max-w-sm bg-[#0f1117] rounded-2xl ring-1 ${colors.ring} shadow-2xl overflow-hidden`}
      >
        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Icon + Title row */}
          <div className="flex items-start gap-4">
            <div className={`shrink-0 w-12 h-12 rounded-xl ${colors.iconBg} flex items-center justify-center`}>
              <Icon className={`w-6 h-6 ${colors.iconFg}`} />
            </div>
            <div className="flex-1 pt-0.5">
              <h3 className="text-white font-semibold text-[15px] leading-snug">{title}</h3>
              <p className={`mt-1 text-[11px] font-medium px-2 py-0.5 rounded-full inline-block ${colors.badge}`}>
                {colors.subtitleText}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Divider */}
          <div className={`h-px ${colors.divider}`} />

          {/* Message */}
          <p className="text-sm text-slate-400 leading-relaxed">{message}</p>

          {/* Buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium transition-colors border border-white/5"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 py-2.5 rounded-xl ${colors.btn} text-white text-sm font-semibold shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2`}
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Icon className="w-4 h-4" />
                  {confirmLabel}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

