"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { passwordStrength } from "@/lib/v4/passwordStrength";
import PublicAuthShell from "../components/PublicAuthShell";
import Icon from "../components/v4/Icon";
import { Notice } from "../components/v4/ui";
import { useCelebrate } from "@/app/components/v4/Motion";

/**
 * Reset password, step 2 (mock-up 06): the link from the email opens this page. If the account
 * has 2FA, the code is asked first. Saving signs the person out on every device.
 */
function Content() {
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = useState<"checking" | "ready" | "bad" | "confirm">("checking");
  const [badWhy, setBadWhy] = useState("This reset link is not valid any more (it works once, for 1 hour). Ask for a new one.");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [mfaOk, setMfaOk] = useState(false);
  const [code, setCode] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  useCelebrate(msg);

  /**
   * v4.7.0: the link from the e-mail can arrive in four ways, and each now works:
   *  1. #access_token=…&refresh_token=… (the usual link): the session is set from it directly, even
   *     when the page was opened inside the app without a full reload;
   *  2. ?code=… (newer sign-in links): exchanged for a session;
   *  3. ?token_hash=…&type=recovery (link-scanner-safe template): checked only when the person presses
   *     Continue, so a mail scanner opening the link first cannot use it up;
   *  4. #error=…: the reason is shown in plain words (used already, or expired).
   */
  const finish = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) { setState("bad"); return; }
    // the one-time key is no longer needed in the address bar or the history
    try { window.history.replaceState(null, "", "/reset-password"); } catch { /* ignore */ }
    const [factors, aal] = await Promise.all([supabase.auth.mfa.listFactors(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
    setFactorId((factors.data?.totp || []).find((f) => f.status === "verified")?.id || null);
    setMfaOk(!aal.error && aal.data.currentLevel === "aal2");
    setState("ready");
  }, []);

  useEffect(() => {
    const hash = new URLSearchParams(typeof window === "undefined" ? "" : window.location.hash.replace(/^#/, ""));
    const linkCode = params.get("code");
    const tokenHash = params.get("token_hash");
    const err = hash.get("error_description") || params.get("error_description");
    queueMicrotask(async () => {
      if (err) {
        const code = hash.get("error_code") || params.get("error_code") || "";
        setBadWhy(/expired|otp_expired/i.test(`${code} ${err}`)
          ? "This reset link has expired or was already used (each link works once, for 1 hour). Some e-mail programs open links to check them, which uses them up. Ask for a new link and open it straight away."
          : `This reset link did not work: ${err}. Ask for a new one.`);
        setState("bad"); return;
      }
      if (tokenHash) { setState("confirm"); return; }
      const access = hash.get("access_token"), refresh = hash.get("refresh_token");
      if (access && refresh) {
        const { error } = await supabase.auth.setSession({ access_token: access, refresh_token: refresh });
        if (error) { setState("bad"); return; }
      } else if (linkCode) {
        const { error } = await supabase.auth.exchangeCodeForSession(linkCode);
        if (error) {
          setBadWhy("This reset link must be opened on the same phone or computer where you asked for it, and works once, for 1 hour. Ask for a new link.");
          setState("bad"); return;
        }
      }
      await finish();
    });
  }, [params, finish]);

  async function confirmLink() {
    const tokenHash = params.get("token_hash");
    if (!tokenHash) return;
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    setBusy(false);
    if (error) { setBadWhy("This reset link has expired or was already used. Ask for a new one."); setState("bad"); return; }
    await finish();
  }

  const s = passwordStrength(next);
  const locked = !!factorId && !mfaOk;
  const canSave = state === "ready" && !locked && s.ok && next === again && !busy;

  async function checkCode() {
    setMsg(null);
    const clean = code.replace(/\D/g, "");
    if (!factorId || clean.length !== 6) { setMsg({ tone: "red", text: "Type the 6-number code from your authenticator app." }); return; }
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: clean });
    setBusy(false);
    if (error) { setMsg({ tone: "red", text: `The code is not correct: ${error.message}` }); return; }
    setMfaOk(true); setCode("");
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.updateUser({ password: next, data: { password_changed_at: new Date().toISOString(), temporary_password: false } });
    setBusy(false);
    if (error) { setMsg({ tone: "red", text: error.message }); return; }
    setMsg({ tone: "green", text: "Your new password is saved. Sign in again with it." });
    await supabase.auth.signOut();
    window.setTimeout(() => { router.push("/login?password_reset=success"); router.refresh(); }, 1200);
  }

  return (
    <PublicAuthShell title="Reset your password" subtitle="Choose a new password for ReqGen." showHomeLink={false}>
      <div className="v4-segmented" role="tablist" style={{ alignSelf: "center" }}>
        <button type="button" role="tab" aria-selected="false" disabled>1, Get the link</button>
        <button type="button" role="tab" aria-selected="true">2, New password</button>
      </div>
      {state === "checking" ? <p className="v4-muted" style={{ textAlign: "center" }}>Checking the link…</p> : state === "confirm" ? (
        <div className="v4-auth-form">
          <p className="v4-muted" style={{ textAlign: "center", margin: 0 }}>Press Continue to choose your new password.</p>
          <button className="v4-btn v4-btn-primary v4-btn-lg v4-btn-block" type="button" disabled={busy} onClick={() => void confirmLink()}><Icon name="key" />{busy ? "Checking…" : "Continue"}</button>
        </div>
      ) : state === "bad" ? (
        <div className="v4-auth-form">
          <Notice tone="red">{badWhy}</Notice>
          <Link className="v4-btn v4-btn-primary v4-btn-lg v4-btn-block" href="/forgot-password"><Icon name="send" />Send a new link</Link>
        </div>
      ) : (
        <form className="v4-auth-form" onSubmit={(e) => void save(e)} noValidate>
          {factorId ? (mfaOk ? <Notice tone="green">2FA confirmed.</Notice> : (
            <label className="v4-field"><span className="v4-flabel">6-number code from your authenticator app <span className="v4-req">*</span></span>
              <span style={{ display: "flex", gap: 8 }}>
                <input className="v4-input" inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} />
                <button className="v4-btn v4-btn-secondary" type="button" disabled={busy} onClick={() => void checkCode()}>Confirm</button>
              </span>
            </label>
          )) : null}
          <label className="v4-field"><span className="v4-flabel">New password <span className="v4-req">*</span></span>
            <span className="v4-control"><Icon name="lock" /><input className="v4-input" type={show ? "text" : "password"} autoComplete="new-password" value={next} disabled={locked} onChange={(e) => setNext(e.target.value)} /></span>
            <span className="v4-help" style={{ color: s.tone }}>{s.text}</span>
          </label>
          <label className="v4-field"><span className="v4-flabel">Type it again <span className="v4-req">*</span></span>
            <span className="v4-control"><Icon name="lock" /><input className="v4-input" type={show ? "text" : "password"} autoComplete="new-password" value={again} disabled={locked} onChange={(e) => setAgain(e.target.value)} /></span>
            {again && again !== next ? <span className="v4-help" style={{ color: "var(--v4-red)" }}>The two passwords are different.</span> : null}
          </label>
          <label className="v4-check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show the passwords</label>
          {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
          <button className="v4-btn v4-btn-primary v4-btn-lg v4-btn-block" type="submit" disabled={!canSave}><Icon name="key" />{busy ? "Saving…" : "Save new password"}</button>
          <Notice tone="amber">Saving a new password signs you out on <b>every device</b>.</Notice>
          <Link href="/login" style={{ textAlign: "center", fontSize: 13.5, color: "var(--v4-ink-2)" }}><Icon name="left" size="sm" /> Back to Login</Link>
        </form>
      )}
    </PublicAuthShell>
  );
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<PublicAuthShell title="Reset your password" subtitle="Preparing…"><p className="v4-muted">Loading…</p></PublicAuthShell>}><Content /></Suspense>;
}
