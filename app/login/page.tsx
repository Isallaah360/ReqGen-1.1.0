"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { BrandLockup, FeatureIcon, PublicPageShell } from "../components/ui/PublicPageShell";

export default function LoginPage() {
  return <Suspense fallback={<LoginLoading />}><LoginPageContent /></Suspense>;
}

function LoginLoading() {
  return <PublicPageShell><div className="flex min-h-screen items-center justify-center text-sm font-bold text-white">Loading secure login...</div></PublicPageShell>;
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const timeoutReason = searchParams.get("reason") === "session-timeout";
  const passwordResetSuccess = searchParams.get("password_reset") === "success";
  const passwordChangedSuccess = searchParams.get("password_changed") === "success";
  const initialMessage = useMemo(() => {
    if (timeoutReason) return "For security reasons, your session timed out. Please login again.";
    if (passwordResetSuccess) return "Password reset successful. Please login with your new password.";
    if (passwordChangedSuccess) return "Password changed successfully. Please login again with your new password.";
    return null;
  }, [timeoutReason, passwordResetSuccess, passwordChangedSuccess]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState<string | null>(initialMessage);
  const [saving, setSaving] = useState(false);

  async function decideNextSecurityStep() {
    const { data: factorsData, error: factorsErr } = await supabase.auth.mfa.listFactors();
    if (factorsErr) throw new Error(factorsErr.message);
    const verifiedTotpFactors = factorsData.totp.filter((factor) => factor.status === "verified");
    if (verifiedTotpFactors.length === 0) { router.push("/mfa/setup"); router.refresh(); return; }
    const { data: aalData, error: aalErr } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalErr) throw new Error(aalErr.message);
    if (aalData.nextLevel === "aal2" && aalData.currentLevel !== "aal2") { router.push("/mfa"); router.refresh(); return; }
    router.push("/dashboard"); router.refresh();
  }

  async function login() {
    setMsg(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return setMsg("Enter your email address.");
    if (!password) return setMsg("Enter your password.");
    setSaving(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) throw new Error(error.message);
      setMsg("Password accepted. Checking two-factor security...");
      await decideNextSecurityStep();
    } catch (e: unknown) {
      setMsg("Login failed: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally { setSaving(false); }
  }

  function goForgotPassword() {
    const cleanEmail = email.trim().toLowerCase();
    router.push(cleanEmail ? `/forgot-password?email=${encodeURIComponent(cleanEmail)}` : "/forgot-password");
  }

  return (
    <PublicPageShell>
      <div className="mx-auto grid min-h-screen max-w-7xl items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[.92fr_1.08fr] lg:px-8">
        <section className="reqgen-rise hidden rounded-[2.25rem] border border-white/10 bg-white/5 p-8 text-white backdrop-blur-xl lg:block">
          <BrandLockup />
          <div className="mt-14 max-w-lg">
            <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Secure Institutional Access</div>
            <h1 className="mt-6 text-5xl font-black tracking-tight">Welcome back to ReqGen.</h1>
            <p className="mt-5 text-base font-medium leading-8 text-slate-300">Access requests, approvals, finance workflows and institutional records through one protected account.</p>
          </div>
          <div className="mt-12 grid gap-3">
            {[['shield','MFA-protected access'],['workflow','Role-based workflow'],['records','Accountable digital records']].map(([icon,text]) => (
              <div key={text} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200"><FeatureIcon name={icon as 'shield'|'workflow'|'records'} /></span>{text}
              </div>
            ))}
          </div>
        </section>

        <section className="reqgen-rise-delay mx-auto w-full max-w-xl rounded-[2.25rem] border border-white/15 bg-white p-5 shadow-2xl shadow-black/30 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">ReqGen 1.1.0</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Login securely</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-600">Enter your account credentials to continue.</p>
            </div>
            <div className="h-16 w-16 rounded-2xl border border-slate-200 bg-slate-50 p-2"><img src="/iet-logo.png" alt="IET logo" className="h-full w-full object-contain" /></div>
          </div>

          {msg && <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-bold ${msg.toLowerCase().includes('failed') || msg.toLowerCase().includes('enter') ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-blue-200 bg-blue-50 text-blue-800'}`}>{msg}</div>}

          <div className="mt-6 space-y-4">
            <label className="block text-sm font-bold text-slate-800">Email address
              <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-white px-4 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                <span className="text-slate-400"><FeatureIcon name="mail" /></span>
                <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && login()} type="email" className="w-full border-0 bg-transparent px-3 py-3.5 text-base text-slate-950 outline-none" placeholder="you@example.com" autoComplete="email" />
              </div>
            </label>

            <label className="block text-sm font-bold text-slate-800">Password
              <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-white px-4 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                <span className="text-slate-400"><FeatureIcon name="lock" /></span>
                <input value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && login()} type={showPassword ? 'text' : 'password'} className="w-full border-0 bg-transparent px-3 py-3.5 text-base text-slate-950 outline-none" placeholder="Enter password" autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label={showPassword ? 'Hide password' : 'Show password'}><FeatureIcon name="eye" /></button>
              </div>
            </label>
          </div>

          <div className="mt-3 text-right"><button type="button" onClick={goForgotPassword} className="text-sm font-black text-blue-700 hover:underline">Forgot password?</button></div>
          <button type="button" onClick={login} disabled={saving} className="mt-5 w-full rounded-2xl bg-blue-600 px-4 py-4 text-base font-black text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Signing in securely...' : 'Login Securely'}</button>

          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-900"><b>Security notice:</b> Never share your password, reset link or authenticator code.</div>
          <div className="mt-5 flex flex-col items-center gap-3 text-sm font-semibold text-slate-600 sm:flex-row sm:justify-between">
            <span>New to ReqGen? <Link href="/signup" className="font-black text-blue-700 hover:underline">Create account</Link></span>
            <Link href="/" className="font-black text-slate-600 hover:text-slate-950">Back home</Link>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
