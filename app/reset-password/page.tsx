"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function updatePassword() {
    setMsg(null);

    if (!password || password.length < 6) {
      setMsg("❌ Password must be at least 6 characters.");
      return;
    }

    if (password !== confirm) {
      setMsg("❌ Passwords do not match.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(error.message);

      setMsg("✅ Password updated successfully. Redirecting to login...");
      setTimeout(() => {
        router.push("/login");
      }, 1200);
    } catch (e: any) {
      setMsg("❌ Failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-md py-16">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Reset Password
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Enter your new password below.
          </p>

          {msg && (
            <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">
              {msg}
            </div>
          )}

          <div className="mt-4">
            <label className="text-sm font-semibold text-slate-800">New Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </div>

          <div className="mt-4">
            <label className="text-sm font-semibold text-slate-800">Confirm Password</label>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              type="password"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </div>

          <button
            onClick={updatePassword}
            disabled={saving}
            className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Updating..." : "Update Password"}
          </button>
        </div>
      </div>
    </main>
  );
}