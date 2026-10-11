"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { checkMfaWindow } from "@/lib/mfaTrust";
import { fingerprintAvailable, fingerprintSignIn, forgetTrustedDevice, passcodeSignIn, readTrustedDevice, type TrustedDevice } from "@/lib/v4/deviceSignIn";
import PublicAuthShell from "../components/PublicAuthShell";
import Icon from "../components/v4/Icon";
import PasscodePad from "../components/v4/PasscodePad";
import { Notice } from "../components/v4/ui";

const REMEMBER_KEY = "reqgen:remember-email";

export default function LoginPage() {
  return (
    <Suspense fallback={<PublicAuthShell title="Welcome Back!" subtitle="Sign in to your ReqGen account to continue"><p className="auth-loading">Loading secure sign-in…</p></PublicAuthShell>}>
      <LoginContent />
    </Suspense>
  );
}

function safeNext(raw: string | null) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/login") ? raw : "/dashboard";
}

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const reason = params.get("reason");
  const initialMessage = useMemo(() => {
    if (reason === "2fa-expired") return { tone: "amber" as const, text: "Your 12-hour 2FA session has ended. Sign in again to continue." };
    if (reason === "signed-out") return { tone: "amber" as const, text: "You were signed out because this account's password, authenticator or passcode was changed. Please sign in again." };
    if (reason === "session-timeout") return { tone: "amber" as const, text: "For your security you were signed out after 15 minutes without activity." };
    if (params.get("password_reset") === "success") return { tone: "green" as const, text: "Password reset. Sign in with your new password." };
    if (params.get("password_changed") === "success") return { tone: "green" as const, text: "Password changed. Sign in again with your new password." };
    return null;
  }, [reason, params]);

  const [device, setDevice] = useState<TrustedDevice | null>(null);
  const [mode, setMode] = useState<"password" | "passcode">("password");
  const [canFingerprint, setCanFingerprint] = useState(false);
  const [email, setEmail] = useState("");
  const [remember, setRemember] = useState(true);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "red" | "amber" | "green" | "blue"; text: string } | null>(initialMessage);

  useEffect(() => {
    queueMicrotask(() => {
      const d = readTrustedDevice();
      setDevice(d);
      if (d && params.get("password") !== "1") setMode("passcode");
      try {
        const saved = window.localStorage.getItem(REMEMBER_KEY);
        if (saved) setEmail(saved);
        else if (d?.email) setEmail(d.email);
      } catch { /* storage blocked */ }
    });
    void fingerprintAvailable().then(setCanFingerprint);
  }, [params]);

  async function afterSignIn() {
    const { data: factors, error } = await supabase.auth.mfa.listFactors();
    if (error) throw new Error(error.message);
    if (!factors.totp.some((f) => f.status === "verified")) { router.push(`/mfa/setup?next=${encodeURIComponent(next)}`); return; }
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      const win = await checkMfaWindow();
      if (!win?.trusted) { router.push(`/mfa?next=${encodeURIComponent(next)}`); return; }
    }
    router.push(next);
    router.refresh();
  }

  async function withPassword(e?: React.FormEvent) {
    e?.preventDefault();
    setMsg(null);
    const clean = email.trim().toLowerCase();
    if (!clean) return setMsg({ tone: "red", text: "Enter your email address." });
    if (!password) return setMsg({ tone: "red", text: "Enter your password." });
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: clean, password });
      if (error) throw new Error(/invalid/i.test(error.message) ? "The email or password is not correct." : error.message);
      try { if (remember) window.localStorage.setItem(REMEMBER_KEY, clean); else window.localStorage.removeItem(REMEMBER_KEY); } catch { /* ignore */ }
      setMsg({ tone: "blue", text: "Password accepted. Checking your second step…" });
      await afterSignIn();
    } catch (err) {
      setMsg({ tone: "red", text: err instanceof Error ? err.message : "Sign-in failed." });
    } finally {
      setBusy(false);
    }
  }

  async function withPasscode(code: string) {
    setBusy(true);
    setMsg(null);
    try {
      await passcodeSignIn(code);
      await afterSignIn();
    } catch (err) {
      setPin("");
      const e = err as Error & { forget?: boolean };
      setMsg({ tone: "red", text: e.message });
      if (e.forget) { setDevice(null); setMode("password"); }
    } finally {
      setBusy(false);
    }
  }

  async function withFingerprint() {
    setBusy(true);
    setMsg(null);
    try {
      await fingerprintSignIn();
      await afterSignIn();
    } catch (err) {
      setMsg({ tone: "red", text: err instanceof Error ? err.message : "The fingerprint check did not work." });
    } finally {
      setBusy(false);
    }
  }

  if (mode === "passcode" && device) {
    const initials = device.name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "RG";
    return (
      <PublicAuthShell title="Welcome back" subtitle="This device is trusted. Enter your passcode." showHomeLink={false}>
        <div className="v4-who-card">
          <span className="v4-avatar">{initials}</span>
          <span style={{ flex: 1, minWidth: 0 }}><strong>{device.name}</strong><span>{device.positions || device.email}</span></span>
          <button type="button" className="v4-link-btn" style={{ fontSize: 13 }} onClick={() => { setMode("password"); setMsg(null); }}>Not you?</button>
        </div>
        {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
        <PasscodePad value={pin} onChange={setPin} onComplete={(c) => void withPasscode(c)} disabled={busy} fingerprint={canFingerprint ? () => void withFingerprint() : undefined} />
        <Notice tone="blue">This passcode works only on this device. One check keeps you signed in for 12 hours.</Notice>
        <div className="v4-auth-row" style={{ justifyContent: "center", gap: 18 }}>
          <button type="button" className="v4-link-btn" onClick={() => { setMode("password"); setMsg(null); }}>Use password instead</button>
          <button type="button" className="v4-link-btn v4-quiet" onClick={() => { forgetTrustedDevice(); setDevice(null); setMode("password"); setMsg({ tone: "blue", text: "Sign in with your password and 2FA, then set a new passcode in My Account › Security & Devices." }); }}>Forgot passcode?</button>
        </div>
      </PublicAuthShell>
    );
  }

  return (
    <PublicAuthShell title="Welcome Back!" subtitle="Sign in to your ReqGen account to continue" steps={{ total: 2, current: 1 }}>
      <nav className="v4-tabs-auth" aria-label="Account" style={{ marginBottom: 0 }}>
        <Link href="/login" aria-current="page">Login</Link>
        <Link href="/signup">Create Account</Link>
      </nav>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <form className="v4-auth-form" onSubmit={(e) => void withPassword(e)} noValidate>
        <label className="v4-field"><span className="v4-flabel">Email address</span>
          <span className="v4-control"><Icon name="mail" /><input className="v4-input" type="email" autoComplete="username" placeholder="name@iet.org.ng" value={email} onChange={(e) => setEmail(e.target.value)} /></span>
        </label>
        <label className="v4-field"><span className="v4-flabel">Password</span>
          <span className="v4-control"><Icon name="lock" /><input className="v4-input" data-rg-reveal="own" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ paddingRight: 52 }} />
            <span className="v4-trail"><button className="v4-icon-btn" type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} style={{ border: 0, width: 40, height: 40 }}><Icon name={show ? "eyeoff" : "eye"} /></button></span>
          </span>
        </label>
        <div className="v4-auth-row">
          <label className="v4-check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Keep my email on this device</label>
          <Link href={email.trim() ? `/forgot-password?email=${encodeURIComponent(email.trim().toLowerCase())}` : "/forgot-password"}>Forgot password?</Link>
        </div>
        <button className="v4-btn v4-btn-primary v4-btn-lg v4-btn-block" type="submit" disabled={busy}>{busy ? "Signing in…" : "Continue"}</button>
        {canFingerprint ? (
          <>
            <div className="v4-or">OR</div>
            <button className="v4-btn v4-btn-secondary v4-btn-lg v4-btn-block" type="button" onClick={() => void withFingerprint()} disabled={busy}><Icon name="fingerprint" />Sign in with fingerprint</button>
          </>
        ) : null}
        {device ? <button type="button" className="v4-link-btn" style={{ textAlign: "center" }} onClick={() => { setMode("passcode"); setMsg(null); }}>Use my passcode on this device</button> : null}
      </form>
    </PublicAuthShell>
  );
}
