"use client";

import { Suspense, useMemo, useState } from "react";
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
    <main className="relative min-h-screen overflow-hidden bg-white px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.08),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.06),transparent_30%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-lg items-center py-10 text-slate-600">
        Loading secure login...
      </div>
    </main>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const timeoutReason = searchParams.get("reason") === "session-timeout";
  const passwordResetSuccess = searchParams.get("password_reset") === "success";
  const passwordChangedSuccess = searchParams.get("password_changed") === "success";

  const initialMessage = useMemo(() => {
    if (timeoutReason) {
      return "For security reasons, your session timed out. Please login again.";
    }

    if (passwordResetSuccess) {
      return "✅ Password reset successful. Please login with your new password.";
    }

    if (passwordChangedSuccess) {
      return "✅ Password changed successfully. Please login again with your new password.";
    }

    return null;
  }, [timeoutReason, passwordResetSuccess, passwordChangedSuccess]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [msg, setMsg] = useState<string | null>(initialMessage);
  const [saving, setSaving] = useState(false);

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

    const cleanEmail = email.trim().toLowerCase();

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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setMsg("❌ Login failed: " + message);
    } finally {
      setSaving(false);
    }
  }

  function goForgotPassword() {
    const cleanEmail = email.trim().toLowerCase();

    if (cleanEmail) {
      router.push(`/forgot-password?email=${encodeURIComponent(cleanEmail)}`);
      return;
    }

    router.push("/forgot-password");
  }

  return (
    <main className="gov-public-page gov-login-page">
      <section className="gov-login-card">
        <div className="gov-login-logo-wrap">
          <img src="/iet-logo.png" alt="Islamic Education Trust logo" />
        </div>
        <h1>Welcome Back!</h1>
        <p className="gov-login-subtitle">Sign in to your ReqGen account to continue</p>

        <div className="gov-login-tabs" aria-label="Account access">
          <span className="is-active">Login</span>
          <Link href="/signup">Create Account</Link>
        </div>

        {msg && <div className="gov-login-message">{msg}</div>}

        <div className="gov-login-field">
          <label htmlFor="login-email">Email Address</label>
          <input id="login-email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") login(); }} type="email" placeholder="Enter your email address" autoComplete="email" />
        </div>

        <div className="gov-login-field">
          <label htmlFor="login-password">Password</label>
          <input id="login-password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") login(); }} type="password" placeholder="Enter your password" autoComplete="current-password" />
        </div>

        <div className="gov-login-options">
          <label><input type="checkbox" /> Remember me</label>
          <button type="button" onClick={goForgotPassword}>Forgot Password?</button>
        </div>

        <button type="button" onClick={login} disabled={saving} className="gov-login-submit">{saving ? "Signing in..." : "Login"}</button>

        <div className="gov-login-trust">Secure <span>•</span> Reliable <span>•</span> Accountable</div>

        <footer className="gov-login-footer">
          <div><span>Powered by</span><img src="/be-logo.png" alt="Barderian Enterprises" /><strong>Barderian Enterprises</strong></div>
          <p><a href="https://barderians.com.ng" target="_blank" rel="noreferrer">barderians.com.ng</a><span>•</span><a href="mailto:info@barderians.com.ng">info@barderians.com.ng</a></p>
          <small>© 2026 Islamic Education Trust. All rights reserved.</small>
        </footer>
      </section>
    </main>
  );
}
