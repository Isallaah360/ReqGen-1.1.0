"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginLoading() {
  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-md py-16 text-slate-600">
        Loading secure login...
      </div>
    </main>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const timeoutReason = searchParams.get("reason") === "session-timeout";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [msg, setMsg] = useState<string | null>(
    timeoutReason ? "For security reasons, your session timed out. Please login again." : null
  );

  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  async function decideNextSecurityStep() {
    const { data: factorsData, error: factorsErr } = await supabase.auth.mfa.listFactors();

    if (factorsErr) {
      throw new Error(factorsErr.message);
    }

    const verifiedTotpFactors = factorsData.totp.filter((factor) => factor.status === "verified");

    if (verifiedTotpFactors.length === 0) {
      router.push("/mfa/setup");
      router.refresh();
      return;
    }

    const { data: aalData, error: aalErr } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalErr) {
      throw new Error(aalErr.message);
    }

    if (aalData.nextLevel === "aal2" && aalData.currentLevel !== "aal2") {
      router.push("/mfa");
      router.refresh();
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function login() {
    setMsg(null);

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setMsg("❌ Enter your email address.");
      return;
    }

    if (!password) {
      setMsg("❌ Enter your password.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) throw new Error(error.message);

      setMsg("✅ Password accepted. Checking 2FA security...");
      await decideNextSecurityStep();
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
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="rounded-2xl bg-blue-50 px-4 py-3">
            <div className="text-xs font-black uppercase tracking-wide text-blue-700">
              ReqGen 1.1.0 Secure Access
            </div>

            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
              Login
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Sign in with your email and password. If 2FA is enabled or required, you will be
              asked for your authenticator code before accessing the system.
            </p>
          </div>

          {msg && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
              {msg}
            </div>
          )}

          <div className="mt-5">
            <label className="text-sm font-bold text-slate-800">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") login();
              }}
              type="email"
              className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-blue-500"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div className="mt-4">
            <label className="text-sm font-bold text-slate-800">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") login();
              }}
              type="password"
              className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-blue-500"
              placeholder="Enter password"
              autoComplete="current-password"
            />
          </div>

          <button
            onClick={login}
            disabled={saving}
            className="mt-5 w-full rounded-2xl bg-blue-600 px-4 py-3 text-base font-bold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Signing in..." : "Login Securely"}
          </button>

          <button
            onClick={forgotPassword}
            disabled={sendingReset}
            className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
          >
            {sendingReset ? "Sending reset link..." : "Forgot Password?"}
          </button>

          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
            <b>Security notice:</b> Do not share your password or leave ReqGen open on a public
            computer. The system will automatically log out inactive users.
          </div>

          <div className="mt-4 text-center text-sm text-slate-600">
            Don’t have an account?{" "}
            <Link href="/signup" className="font-bold text-blue-700 hover:underline">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}