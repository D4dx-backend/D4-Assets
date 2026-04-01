"use client";

import { useState, useRef, useEffect } from "react";
import { signIn } from "next-auth/react";
import toast from "react-hot-toast";
import Image from "next/image";
import { Delete, UserPlus, LogIn, Lock } from "lucide-react";

const DIGITS = ["1","2","3","4","5","6","7","8","9","","0","X"];

// Reusable MPIN keypad + dots
function MpinPad({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (/^[0-9]$/.test(e.key)) {
      if (value.length < 6) onChange(value + e.key);
    } else if (e.key === "Backspace" || e.key === "Delete") {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div ref={ref} tabIndex={0} onKeyDown={handleKeyDown} className="space-y-4 outline-none">
      <div className="flex justify-center gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
              i < value.length
                ? "bg-gradient-to-br from-violet-400 to-indigo-500 border-violet-400 scale-125 shadow-[0_0_8px_rgba(139,92,246,0.7)]"
                : "border-white/30 bg-white/5"
            }`}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {DIGITS.map((d, i) => {
          if (d === "") return <div key={i} />;
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (d === "X") { onChange(value.slice(0, -1)); return; }
                if (value.length < 6) onChange(value + d);
              }}
              className={`py-3.5 rounded-xl text-lg font-semibold transition-all duration-150 active:scale-90 disabled:opacity-40 ${
                d === "X"
                  ? "bg-white/10 text-white/60 hover:bg-white/20 border border-white/10"
                  : "bg-white/10 text-white hover:bg-white/20 border border-white/10 hover:border-violet-400/50 hover:shadow-[0_0_10px_rgba(139,92,246,0.3)]"
              }`}
            >
              {d === "X" ? <Delete className="w-5 h-5 mx-auto" /> : d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── SIGN IN ─────────────────────────────────────────────────────────────────
function SignInForm({ onSwitch }: { onSwitch: () => void }) {
  const [email, setEmail] = useState("");
  const [mpin, setMpin]   = useState("");
  const [step, setStep]   = useState<"email" | "mpin">("email");
  const [loading, setLoading] = useState(false);

  function handleDigit(v: string) {
    setMpin(v);
    if (v.length === 6) doSignIn(v);
  }

  async function doSignIn(pin: string) {
    setLoading(true);
    const res = await signIn("credentials", { email, mpin: pin, redirect: false });
    setLoading(false);
    if (res?.error) {
      toast.error("Invalid email or MPIN");
      setMpin("");
    } else {
      toast.success("Welcome back!");
      // Hard navigation ensures the new session cookie is sent to the server
      // before the dashboard layout's auth() check runs, preventing a redirect loop.
      window.location.href = "/dashboard";
    }
  }

  return (
    <div className="space-y-5">
      {step === "email" ? (
        <>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Email Address</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && email.includes("@")) setStep("mpin"); }}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/60 focus:border-violet-400 transition-all"
              placeholder="you@example.com"
            />
          </div>
          <button
            onClick={() => setStep("mpin")}
            disabled={!email.includes("@")}
            className="w-full py-3 bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-semibold rounded-xl text-sm hover:from-violet-600 hover:to-indigo-700 disabled:opacity-40 transition-all shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-[1.02] active:scale-[0.98]"
          >
            Continue
          </button>
        </>
      ) : (
        <>
          <div className="text-center bg-white/5 rounded-xl p-3 border border-white/10">
            <p className="text-xs text-white/50 uppercase tracking-wider mb-0.5">Signing in as</p>
            <p className="font-medium text-white text-sm truncate">{email}</p>
            <button onClick={() => { setStep("email"); setMpin(""); }} className="text-xs text-violet-400 hover:text-violet-300 hover:underline mt-0.5 transition-colors">
              Change
            </button>
          </div>
          <p className="text-center text-sm text-white/60">Enter your 6-digit MPIN</p>
          <MpinPad value={mpin} onChange={handleDigit} disabled={loading} />
          {loading && <p className="text-center text-sm text-violet-400 animate-pulse">Verifying…</p>}
        </>
      )}

      <div className="pt-3 border-t border-white/10 text-center">
        <p className="text-sm text-white/50">
          New here?{" "}
          <button onClick={onSwitch} className="text-violet-400 font-medium hover:text-violet-300 hover:underline transition-colors">
            Create an account
          </button>
        </p>
      </div>
    </div>
  );
}

// ─── SIGN UP ─────────────────────────────────────────────────────────────────
function SignUpForm({ onSwitch }: { onSwitch: () => void }) {
  const [name,        setName]        = useState("");
  const [email,       setEmail]       = useState("");
  const [mpin,        setMpin]        = useState("");
  const [confirmMpin, setConfirmMpin] = useState("");
  const [step,        setStep]        = useState<"info" | "mpin" | "confirm">("info");
  const [loading,     setLoading]     = useState(false);

  function handleNewMpin(v: string) {
    setMpin(v);
    if (v.length === 6) setTimeout(() => setStep("confirm"), 200);
  }

  function handleConfirmMpin(v: string) {
    setConfirmMpin(v);
    if (v.length === 6) setTimeout(() => doSignUp(v), 200);
  }

  async function doSignUp(confirmPin: string) {
    if (mpin !== confirmPin) {
      toast.error("MPINs do not match — try again");
      setMpin(""); setConfirmMpin(""); setStep("mpin");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), mpin }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      setLoading(false);
      if (data.success) {
        toast.success("Account created! You can now sign in.");
        onSwitch();
      } else {
        toast.error(data.error ?? "Sign-up failed");
        setMpin(""); setConfirmMpin(""); setStep("info");
      }
    } catch {
      setLoading(false);
      toast.error("Could not reach server. Please try again.");
      setMpin(""); setConfirmMpin(""); setStep("info");
    }
  }

  const canContinue = name.trim().length > 1 && email.includes("@");

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-3">
        {(["info","mpin","confirm"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
              step === s
                ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-[0_0_12px_rgba(139,92,246,0.6)]"
                : ["info","mpin","confirm"].indexOf(step) > i
                  ? "bg-gradient-to-br from-emerald-400 to-teal-500 text-white"
                  : "bg-white/10 text-white/30 border border-white/20"
            }`}>
              {["info","mpin","confirm"].indexOf(step) > i ? "✓" : i + 1}
            </div>
            {i < 2 && <div className="w-8 h-px bg-white/20" />}
          </div>
        ))}
      </div>

      {step === "info" && (
        <>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/60 focus:border-violet-400 transition-all"
                placeholder="John Doe"
                autoComplete="name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && canContinue) setStep("mpin"); }}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/60 focus:border-violet-400 transition-all"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
          </div>
          <button
            onClick={() => setStep("mpin")}
            disabled={!canContinue}
            className="w-full py-3 bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-semibold rounded-xl text-sm hover:from-violet-600 hover:to-indigo-700 disabled:opacity-40 transition-all shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-[1.02] active:scale-[0.98]"
          >
            Continue
          </button>
        </>
      )}

      {step === "mpin" && (
        <>
          <p className="text-center text-sm text-white/60">
            Create a <strong className="text-white">6-digit MPIN</strong> for <span className="text-violet-400">{email}</span>
          </p>
          <MpinPad value={mpin} onChange={handleNewMpin} />
        </>
      )}

      {step === "confirm" && (
        <>
          <p className="text-center text-sm text-white/60">Confirm your MPIN</p>
          <MpinPad value={confirmMpin} onChange={handleConfirmMpin} disabled={loading} />
          {loading && <p className="text-center text-sm text-violet-400 animate-pulse">Creating account…</p>}
        </>
      )}

      <div className="pt-3 border-t border-white/10 text-center">
        <p className="text-sm text-white/50">
          Already have an account?{" "}
          <button onClick={onSwitch} className="text-violet-400 font-medium hover:text-violet-300 hover:underline transition-colors">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden bg-[#0d0d1a]">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a0533] via-[#0d0d2b] to-[#020817]" />
      {/* Glowing orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-violet-700/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] left-[60%] w-[300px] h-[300px] rounded-full bg-purple-500/10 blur-[80px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo + title */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            {/* Glow ring around logo */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 blur-md opacity-70 scale-110" />
            <Image
              src="/icons/logo.jpeg"
              alt="D4DX logo"
              width={72}
              height={72}
              className="relative rounded-2xl shadow-2xl"
              priority
            />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Asset Manager</h1>
          <p className="text-sm text-white/50 mt-1">
            {mode === "signin" ? "Sign in to your account" : "Create a new account"}
          </p>
        </div>

        {/* Mode toggle tabs */}
        <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 mb-5 backdrop-blur-sm">
          <button
            onClick={() => setMode("signin")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              mode === "signin"
                ? "bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/30"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            <LogIn className="w-4 h-4" /> Sign In
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              mode === "signup"
                ? "bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/30"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            <UserPlus className="w-4 h-4" /> Sign Up
          </button>
        </div>

        {/* Glass card */}
        <div className="bg-white/8 backdrop-blur-xl border border-white/15 rounded-3xl shadow-2xl p-6"
          style={{ background: "rgba(255,255,255,0.06)" }}>
          {/* Lock icon header */}
          <div className="flex items-center justify-center mb-5">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/30 to-indigo-600/30 border border-violet-400/30 flex items-center justify-center">
              <Lock className="w-5 h-5 text-violet-300" />
            </div>
          </div>
          {mode === "signin"
            ? <SignInForm onSwitch={() => setMode("signup")} />
            : <SignUpForm onSwitch={() => setMode("signin")} />}
        </div>
      </div>
    </div>
  );
}