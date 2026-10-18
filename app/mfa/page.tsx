"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { checkMfaWindow, startMfaWindow } from "@/lib/mfaTrust";
import { alertDialog } from "@/lib/dialog";
import { fingerprintAvailable, fingerprintStepUp } from "@/lib/v4/deviceSignIn";
import PublicAuthShell from "../components/PublicAuthShell";
import Icon from "../components/v4/Icon";
import OtpBoxes from "../components/v4/OtpBoxes";
import { Notice } from "../components/v4/ui";

function nextPath() {
  try {
    const n = new URLSearchParams(window.location.search).get("next") || "";
    if (n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/mfa")) return n;
  } catch { /* ignore */ }
  return "/dashboard";
}

type TotpFactor = { id: string; friendly_name?: string | null; status: string };

/** Second step of sign-in (v4): fingerprint, or the 6-digit authenticator code. */
export default function MfaVerifyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [factor, setFactor] = useState<TotpFactor | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [fp, setFp] = useState(false);
  const [until, setUntil] = useState("");
  const auto = useRef(false);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.push("/login"); return; }
      setEmail(auth.user.email || "");
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") { router.push(nextPath()); router.refresh(); return; }
      const win = await checkMfaWindow();
      if (win?.trusted) { router.push(nextPath()); router.refresh(); return; }
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) { setMsg(error.message); setLoading(false); return; }
      const verified = data.totp.filter((f) => f.status === "verified");
      if (!verified.length) { router.push("/mfa/setup"); router.refresh(); return; }
      setFactor(verified[0] as TotpFactor);
      const mine = await supabase.from("reqgen_webauthn_credentials").select("id", { count: "exact", head: true }).eq("user_id", auth.user.id);
      setFp(!mine.error && (mine.count || 0) > 0 && (await fingerprintAvailable()));
      setUntil(new Date(Date.now() + 12 * 3600_000).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase());
      setLoading(false);
    })();
  }, [router]);

  async function verify(override?: string) {
    if (auto.current || busy) return;
    if (!factor) return setMsg("No authenticator is connected to this account.");
    const clean = String(override || code).replace(/\D/g, "").slice(0, 6);
    if (!/^\d{6}$/.test(clean)) return setMsg("Enter the 6-digit code from your authenticator app.");
    auto.current = true;
    setBusy(true);
    setMsg(null);
    try {
      const { data: challenge, error: ce } = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (ce) throw new Error(ce.message);
      const { error: ve } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code: clean });
      if (ve) throw new Error(/invalid/i.test(ve.message) ? "That code is not correct or has expired. Wait for a new code and try again." : ve.message);
      await startMfaWindow();
      router.push(nextPath());
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "The code could not be checked.");
      setCode("");
    } finally {
      setBusy(false);
      setTimeout(() => { auto.current = false; }, 800);
    }
  }

  async function withFingerprint() {
    setBusy(true);
    setMsg(null);
    try {
      await fingerprintStepUp();
      await checkMfaWindow();
      router.push(nextPath());
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "The fingerprint check did not work.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut({ scope: "local" });
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return <PublicAuthShell title="Confirm it’s you" subtitle="Preparing the second step…" showHomeLink={false}><p className="v4-muted">Loading…</p></PublicAuthShell>;
  }

  return (
    <PublicAuthShell
      title="Confirm it’s you"
      subtitle={<>Signed in as <b>{email}</b> · <button type="button" className="v4-link-btn" onClick={() => void signOut()}>Not you?</button></>}
      steps={{ total: 2, current: 2 }}
      showHomeLink={false}
    >
      {fp ? (
        <>
          <button className="v4-fingerprint-btn" type="button" onClick={() => void withFingerprint()} disabled={busy}>
            <span className="v4-fp"><Icon name="fingerprint" size="lg" /></span>
            <span><strong>Use fingerprint</strong><span>Touch the sensor on this laptop or phone. Fastest and most secure.</span></span>
          </button>
          <div className="v4-or">OR ENTER YOUR 6-DIGIT CODE</div>
        </>
      ) : null}
      <div className="v4-field">
        <span className="v4-flabel" style={{ textAlign: "center" }}>Code from your authenticator app</span>
        <OtpBoxes value={code} onChange={setCode} onComplete={(c) => setTimeout(() => void verify(c), 120)} disabled={busy} autoFocus={!fp} />
        <span className="v4-help" style={{ textAlign: "center" }}>{busy ? "Checking…" : "ReqGen checks the code as soon as the sixth digit is in."}</span>
      </div>
      {msg ? <Notice tone="red">{msg}</Notice> : null}
      <Notice tone="blue">One check keeps you signed in on <b>this device for 12 hours</b> (until <b>{until}</b>). After that ReqGen signs you out and asks again.</Notice>
      <button className="v4-btn v4-btn-primary v4-btn-lg v4-btn-block" type="button" onClick={() => void verify()} disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Verify and continue"}</button>
      <div className="v4-auth-row" style={{ justifyContent: "center", gap: 18 }}>
        <button type="button" className="v4-link-btn" onClick={() => void alertDialog({ title: "Lost your phone?", message: "Ask the Super Admin to reset your 2FA. After the reset, sign in with your password and connect your authenticator app again.", confirmLabel: "OK" })}>Lost your phone?</button>
        <button type="button" className="v4-link-btn v4-quiet" onClick={() => void signOut()}>Sign out</button>
      </div>
    </PublicAuthShell>
  );
}
