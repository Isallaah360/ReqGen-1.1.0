"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes("@")) return setMsg("Please enter a valid email.");
    if (password.length < 6) return setMsg("Password must be at least 6 characters.");

    try {
      setLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) throw new Error(error.message);

      router.push("/dashboard");
    } catch (e: any) {
      setMsg("❌ Login failed: " + (e?.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-md py-10">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            ReqGen <span className="text-slate-400">Login</span>
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Login with your staff account to continue.
          </p>

          {msg && (
            <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">
              {msg}
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-800">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@domain.com"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Logging in..." : "Login"}
            </button>

            <div className="text-center text-sm text-slate-600">
              New staff?{" "}
              <a className="font-semibold text-blue-700 hover:underline" href="/signup">
                Create account
              </a>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}