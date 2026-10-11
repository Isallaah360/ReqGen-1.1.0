"use client";

import Link from "next/link";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import PublicAuthShell from "../components/PublicAuthShell";
import Icon from "../components/v4/Icon";
import { Notice } from "../components/v4/ui";

function resetRedirectUrl() {
  const app = process.env.NEXT_PUBLIC_APP_URL || (typeof window === "undefined" ? "" : window.location.origin);
  return `${app.replace(/\/$/, "")}/reset-password`;
}

function Content() {
  const params = useSearchParams();
  const [email, setEmail] = useState(() => (params.get("email") || "").trim().toLowerCase());
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const valid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), [email]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const clean = email.trim().toLowerCase();
    if (!valid) return setErr("Enter the email address you use to sign in to ReqGen.");
    setSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(clean, { redirectTo: resetRedirectUrl() });
    setSending(false);
    if (error) return setErr(error.message);
    setSent(true);
  }

  return (
    <PublicAuthShell title="Reset your password" subtitle="Two short steps. The link in the email works for 1 hour." showHomeLink={false}>
      <div className="v4-segmented" role="tablist" style={{ alignSelf: "center" }}>
        <button type="button" role="tab" aria-selected="true">1 · Get the link</button>
        <button type="button" role="tab" aria-selected="false" disabled>2 · New password</button>
      </div>
      <form className="v4-auth-form" onSubmit={(e) => void submit(e)} noValidate>
        <label className="v4-field"><span className="v4-flabel">Email address <span className="v4-req">*</span></span>
          <span className="v4-control"><Icon name="mail" /><input className="v4-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@iet.org.ng" /></span>
          <span className="v4-help">The email you use to sign in to ReqGen.</span>
        </label>
        {err ? <Notice tone="red">{err}</Notice> : null}
        {sent ? <Notice tone="green">If that email has a ReqGen account, a reset link is on its way. Check your inbox and spam folder.</Notice> : null}
        <button className="v4-btn v4-btn-primary v4-btn-lg v4-btn-block" type="submit" disabled={sending || !valid}><Icon name="send" />{sending ? "Sending…" : sent ? "Send the link again" : "Send reset link"}</button>
        <Notice tone="amber">Saving a new password signs you out on <b>every device</b>. You then sign in again with the new password.</Notice>
        <Link href="/login" style={{ textAlign: "center", fontSize: 13.5, color: "var(--v4-ink-2)" }}><Icon name="left" size="sm" /> Back to Login</Link>
      </form>
    </PublicAuthShell>
  );
}

export default function ForgotPasswordPage() {
  return <Suspense fallback={<PublicAuthShell title="Reset your password" subtitle="Preparing…"><p className="auth-loading">Loading…</p></PublicAuthShell>}><Content /></Suspense>;
}
