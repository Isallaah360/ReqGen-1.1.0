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

    if (!email.includes("@")) {
      setMsg("Please enter a valid email.");
      return;
    }

    if (password.length < 6) {
      setMsg("Password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw new Error(error.message);

      // Redirect to dashboard after successful login
      router.push("/dashboard");

    } catch (e: any) {
      setMsg("❌ Login failed: " + (e?.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  }

  return (
  <div className="mx-auto max-w-md">
    <h1 className="text-3xl font-bold tracking-tight">ReqGen — Login</h1>
    <p className="mt-2 text-sm text-gray-600">
      Sign in to continue.
    </p>

    <form
      onSubmit={handleLogin}
      className="mt-6 space-y-4 rounded-2xl border bg-white p-6 shadow-sm"
    >
      <div>
        <label className="text-sm font-medium">Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-black/20"
          placeholder="name@domain.com"
        />
      </div>

      <div>
        <label className="text-sm font-medium">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-black/20"
          placeholder="Your password"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-black py-2.5 font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {loading ? "Logging in..." : "Login"}
      </button>

      {msg && (
        <div className="rounded-xl bg-gray-100 px-3 py-2 text-sm">
          {msg}
        </div>
      )}
    </form>
  </div>
);
}