"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  async function login() {
    setMsg(null);
    setSaving(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw new Error(error.message);

      setMsg("✅ Login successful.");
      router.push("/dashboard");
      router.refresh();
    } catch (e: any) {
      setMsg("❌ Login failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function forgotPassword() {
    setMsg(null);

    if (!email.trim()) {
      setMsg("❌ Enter your email first, then click Reset Password.");
      return;
    }

    setSendingReset(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw new Error(error.message);

      setMsg("✅ Password reset link has been sent to your email.");
    } catch (e: any) {
      setMsg("❌ Reset failed: " + (e?.message || "Unknown error"));
    } finally {
      setSendingReset(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-md py-16">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Login</h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in to continue to ReqGen.
          </p>

          {msg && (
            <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">
              {msg}
            </div>
          )}

          <div className="mt-4">
            <label className="text-sm font-semibold text-slate-800">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              placeholder="you@example.com"
            />
          </div>

          <div className="mt-4">
            <label className="text-sm font-semibold text-slate-800">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              placeholder="Enter password"
            />
          </div>

          <button
            onClick={login}
            disabled={saving}
            className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Signing in..." : "Login"}
          </button>

          <button
            onClick={forgotPassword}
            disabled={sendingReset}
            className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
          >
            {sendingReset ? "Sending reset link..." : "Forgot Password?"}
          </button>

          <div className="mt-4 text-center text-sm text-slate-600">
            Don’t have an account?{" "}
            <Link href="/signup" className="font-semibold text-blue-700 hover:underline">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}