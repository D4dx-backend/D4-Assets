"use client";

import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";
import PageHeader from "@/components/PageHeader";
import { Delete, KeyRound, User } from "lucide-react";

const nameSchema = z.object({
  name: z.string().min(1, "Name required"),
});
type NameForm = z.infer<typeof nameSchema>;

const DIGITS = ["1","2","3","4","5","6","7","8","9","","0","X"];

function MpinInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (/^[0-9]$/.test(e.key)) {
      if (value.length < 6) onChange(value + e.key);
    } else if (e.key === "Backspace" || e.key === "Delete") {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div ref={ref} tabIndex={0} onKeyDown={handleKeyDown} className="space-y-2 outline-none">
      <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{label}</p>
      {/* dots */}
      <div className="flex justify-center gap-3 py-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
              i < value.length ? "bg-blue-700 border-blue-700 scale-110" : "border-gray-300 dark:border-slate-600"
            }`}
          />
        ))}
      </div>
      {/* keypad */}
      <div className="grid grid-cols-3 gap-2">
        {DIGITS.map((d, i) => {
          if (d === "") return <div key={i} />;
          return (
            <button
              key={i}
              type="button"
              onClick={() => {
                if (d === "X") { onChange(value.slice(0, -1)); return; }
                if (value.length < 6) onChange(value + d);
              }}
              className={`h-12 rounded-xl text-base font-semibold transition-all active:scale-95 ${
                d === "X"
                  ? "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 flex items-center justify-center"
                  : "bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white hover:bg-blue-50 dark:hover:bg-slate-600 hover:text-blue-700 border border-gray-200 dark:border-slate-600"
              }`}
            >
              {d === "X" ? <Delete className="w-4 h-4 mx-auto" /> : d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { data: session, update } = useSession();

  // Name form
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<NameForm>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: session?.user?.name ?? "" },
  });

  async function saveName(data: NameForm) {
    const res = await fetch(`/api/users/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: data.name }),
    });
    const result = await res.json() as { success: boolean; error?: string };
    if (result.success) {
      await update({ name: data.name });
      toast.success("Name updated");
    } else {
      toast.error(result.error ?? "Error");
    }
  }

  // MPIN change state
  const [currentMpin, setCurrentMpin] = useState("");
  const [newMpin, setNewMpin]         = useState("");
  const [confirmMpin, setConfirmMpin] = useState("");
  const [mpinStep, setMpinStep]       = useState<"current" | "new" | "confirm">("current");
  const [changingMpin, setChangingMpin] = useState(false);

  function resetMpinFlow() {
    setCurrentMpin(""); setNewMpin(""); setConfirmMpin(""); setMpinStep("current");
  }

  async function submitMpinChange() {
    if (newMpin !== confirmMpin) {
      toast.error("New MPINs do not match");
      setNewMpin(""); setConfirmMpin(""); setMpinStep("new");
      return;
    }
    setChangingMpin(true);
    const res = await fetch("/api/auth/change-mpin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentMpin, newMpin }),
    });
    const result = await res.json() as { success: boolean; error?: string };
    setChangingMpin(false);
    if (result.success) {
      toast.success("MPIN changed successfully!");
      resetMpinFlow();
    } else {
      toast.error(result.error ?? "Failed to change MPIN");
      resetMpinFlow();
    }
  }

  // Auto-advance steps
  function handleCurrentMpin(v: string) {
    setCurrentMpin(v);
    if (v.length === 6) setTimeout(() => setMpinStep("new"), 200);
  }
  function handleNewMpin(v: string) {
    setNewMpin(v);
    if (v.length === 6) setTimeout(() => setMpinStep("confirm"), 200);
  }
  function handleConfirmMpin(v: string) {
    setConfirmMpin(v);
    if (v.length === 6) setTimeout(() => submitMpinChange(), 200);
  }

  return (
    <div className="space-y-5 max-w-md">
      <PageHeader title="Settings" description="Manage your account" />

      {/* Profile card */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-5">
        {/* Avatar */}
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100 dark:border-slate-700">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-blue-700 dark:text-blue-300 font-bold text-lg">
              {session?.user?.name?.[0]?.toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white truncate">{session?.user?.name}</p>
            <p className="text-sm text-gray-500 dark:text-slate-400 truncate">{session?.user?.email}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-0.5 capitalize">{session?.user?.role}</p>
          </div>
        </div>

        {/* Name */}
        <form onSubmit={handleSubmit(saveName)} className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-gray-500 dark:text-slate-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Display Name</span>
          </div>
          <div className="flex gap-2">
            <input {...register("name")} className="input flex-1" />
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-700 text-white text-sm font-medium rounded-xl disabled:opacity-60 hover:bg-blue-800 flex-shrink-0"
            >
              {isSubmitting ? "…" : "Save"}
            </button>
          </div>
          {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
        </form>
      </div>

      {/* MPIN change card */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">Change MPIN</span>
        </div>

        {session?.user?.id === "env-admin" ? (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            This account&apos;s MPIN is managed via environment variables.
            Update <code className="font-mono font-semibold">ADMIN_MPIN</code> in your <code className="font-mono font-semibold">.env</code> file to change it.
          </div>
        ) : (
          <>
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {(["current", "new", "confirm"] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                mpinStep === s ? "bg-blue-700 text-white" :
                (["current","new","confirm"].indexOf(mpinStep) > i ? "bg-green-500 text-white" : "bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500")
              }`}>
                {["current","new","confirm"].indexOf(mpinStep) > i ? "✓" : i + 1}
              </div>
              <span className={`text-xs ${
                mpinStep === s ? "text-blue-700 dark:text-blue-400 font-medium" : "text-gray-400 dark:text-slate-500"
              }`}>
                {s === "current" ? "Current" : s === "new" ? "New" : "Confirm"}
              </span>
              {i < 2 && <div className="w-4 h-px bg-gray-200 dark:bg-slate-600" />}
            </div>
          ))}
        </div>

        {mpinStep === "current" && (
          <MpinInput label="Enter your current MPIN" value={currentMpin} onChange={handleCurrentMpin} />
        )}
        {mpinStep === "new" && (
          <MpinInput label="Enter your new MPIN (4–6 digits)" value={newMpin} onChange={handleNewMpin} />
        )}
        {mpinStep === "confirm" && (
          <MpinInput label="Confirm your new MPIN" value={confirmMpin} onChange={handleConfirmMpin} />
        )}

        {changingMpin && (
          <p className="text-center text-blue-600 text-sm mt-3 animate-pulse">Saving…</p>
        )}

        <button
          type="button"
          onClick={resetMpinFlow}
          className="mt-3 text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 w-full text-center"
        >
          Reset
        </button>
          </>
        )}
      </div>
    </div>
  );
}