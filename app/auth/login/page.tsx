"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Package, Delete, UserPlus, LogIn } from "lucide-react";

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
  return (
    <div className="space-y-3">
      <div className="flex justify-center gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all ${
              i < value.length
                ? "bg-blue-700 border-blue-700 scale-110"
                : "border-gray-300"
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
              className={`h-13 py-3 rounded-xl text-lg font-semibold transition-all active:scale-95 disabled:opacity-50 ${
                d === "X"
                  ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  : "bg-gray-50 text-gray-900 hover:bg-blue-50 hover:text-blue-700 border border-gray-200"
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
  const router = useRouter();
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
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="space-y-5">
      {step === "email" ? (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && email.includes("@")) setStep("mpin"); }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com"
            />
          </div>
          <button
            onClick={() => setStep("mpin")}
            disabled={!email.includes("@")}
            className="w-full py-2.5 bg-blue-700 text-white font-semibold rounded-xl text-sm hover:bg-blue-800 disabled:opacity-50 transition-colors"
          >
            Continue
          </button>
        </>
      ) : (
        <>
          <div className="text-center">
            <p className="text-sm text-gray-500">Signing in as</p>
            <p className="font-medium text-gray-900 text-sm truncate">{email}</p>
            <button onClick={() => { setStep("email"); setMpin(""); }} className="text-xs text-blue-600 hover:underline mt-0.5">
              Change
            </button>
          </div>
          <p className="text-center text-sm text-gray-500">Enter your 6-digit MPIN</p>
          <MpinPad value={mpin} onChange={handleDigit} disabled={loading} />
          {loading && <p className="text-center text-sm text-blue-600 animate-pulse">Verifying…</p>}
        </>
      )}

      <div className="pt-2 border-t border-gray-100 text-center">
        <p className="text-sm text-gray-500">
          New here?{" "}
          <button onClick={onSwitch} className="text-blue-600 font-medium hover:underline">
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
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step === s ? "bg-blue-700 text-white" :
              (["info","mpin","confirm"].indexOf(step) > i ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400")
            }`}>
              {["info","mpin","confirm"].indexOf(step) > i ? "✓" : i + 1}
            </div>
            {i < 2 && <div className="w-6 h-px bg-gray-200" />}
          </div>
        ))}
      </div>

      {step === "info" && (
        <>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="John Doe"
                autoComplete="name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && canContinue) setStep("mpin"); }}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
          </div>
          <button
            onClick={() => setStep("mpin")}
            disabled={!canContinue}
            className="w-full py-2.5 bg-blue-700 text-white font-semibold rounded-xl text-sm hover:bg-blue-800 disabled:opacity-50 transition-colors"
          >
            Continue
          </button>
        </>
      )}

      {step === "mpin" && (
        <>
          <p className="text-center text-sm text-gray-600">
            Create a <strong>6-digit MPIN</strong> for <span className="text-blue-700">{email}</span>
          </p>
          <MpinPad value={mpin} onChange={handleNewMpin} />
        </>
      )}

      {step === "confirm" && (
        <>
          <p className="text-center text-sm text-gray-600">Confirm your MPIN</p>
          <MpinPad value={confirmMpin} onChange={handleConfirmMpin} disabled={loading} />
          {loading && <p className="text-center text-sm text-blue-600 animate-pulse">Creating account…</p>}
        </>
      )}

      <div className="pt-2 border-t border-gray-100 text-center">
        <p className="text-sm text-gray-500">
          Already have an account?{" "}
          <button onClick={onSwitch} className="text-blue-600 font-medium hover:underline">
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-700 rounded-2xl flex items-center justify-center shadow-lg mb-3">
            <Package className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Asset Manager</h1>
          <p className="text-sm text-gray-500 mt-1">
            {mode === "signin" ? "Sign in to your account" : "Create a new account"}
          </p>
        </div>

        {/* Mode toggle tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
          <button
            onClick={() => setMode("signin")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === "signin" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <LogIn className="w-4 h-4" /> Sign In
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === "signup" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <UserPlus className="w-4 h-4" /> Sign Up
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          {mode === "signin"
            ? <SignInForm onSwitch={() => setMode("signup")} />
            : <SignUpForm onSwitch={() => setMode("signin")} />}
        </div>
      </div>
    </div>
  );
}