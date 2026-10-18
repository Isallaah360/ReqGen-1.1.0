"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabaseClient";
import { startMfaWindow } from "@/lib/mfaTrust";
import { fingerprintAvailable, registerFingerprint } from "@/lib/v4/deviceSignIn";
import PublicAuthShell from "../../components/PublicAuthShell";
import Icon from "../../components/v4/Icon";
import OtpBoxes from "../../components/v4/OtpBoxes";
import { Chip, Notice } from "../../components/v4/ui";

type EnrollData = { id: string; type: string; totp: { qr_code: string; secret: string; uri: string } };

function nextPath() {
  try {
    const n = new URLSearchParams(window.location.search).get("next") || "";
    if (n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/mfa")) return n;
  } catch { /* ignore */ }
  return "/dashboard";
}

/** First sign-in only (v4): connect the authenticator app, then add a fingerprint. */
export default function MfaSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "red" | "green" | "blue"; text: string } | null>(null);
  const [factorId, setFactorId] = useState("");
  const [uri, setUri] = useState("");
  const [secret, setSecret] = useState("");
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [connected, setConnected] = useState(false);
  const [fpOk, setFpOk] = useState(false);
  const [fpDone, setFpDone] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.push("/login"); return; }
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) { setMsg({ tone: "red", text: `Could not check 2FA: ${error.message}` }); setLoading(false); return; }
      if (data.totp.some((f) => f.status === "verified")) {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal?.currentLevel !== "aal2") { router.push("/mfa"); return; }
        setConnected(true);
      }
      setFpOk(await fingerprintAvailable());
      setLoading(false);
    })();
  }, [router]);

  // Start enrolment straight away so the QR code is ready.
  useEffect(() => {
    if (loading || connected || started.current) return;
    started.current = true;
    (async () => {
      setBusy(true);
      try {
        // Remove unfinished earlier attempts so the app never shows two ReqGen entries.
        const list = await supabase.auth.mfa.listFactors();
        for (const f of (list.data?.all || []).filter((x) => x.factor_type === "totp" && x.status !== "verified")) {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
        const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `ReqGen ${new Date().toISOString().slice(0, 10)}` });
        if (error) throw new Error(error.message);
        const e = data as EnrollData;
        setFactorId(e.id);
        setUri(e.totp.uri);
        setSecret(e.totp.secret);
        setQr(await QRCode.toDataURL(e.totp.uri, { errorCorrectionLevel: "M", margin: 4, width: 360, color: { dark: "#000000", light: "#ffffff" } }));
      } catch (err) {
        setMsg({ tone: "red", text: err instanceof Error ? err.message : "Could not start 2FA set-up." });
      } finally {
        setBusy(false);
      }
    })();
  }, [loading, connected]);

  async function verify(override?: string) {
    const clean = String(override || code).replace(/\D/g, "").slice(0, 6);
    if (!factorId || clean.length !== 6 || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const { data: ch, error: ce } = await supabase.auth.mfa.challenge({ factorId });
      if (ce) throw new Error(ce.message);
      const { error: ve } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code: clean });
      if (ve) throw new Error(/invalid/i.test(ve.message) ? "That code is not correct. Check the time on your phone and try the newest code." : ve.message);
      await startMfaWindow();
      setConnected(true);
      setMsg({ tone: "green", text: "Authenticator connected. Your account is protected." });
    } catch (err) {
      setCode("");
      setMsg({ tone: "red", text: err instanceof Error ? err.message : "The code could not be checked." });
    } finally {
      setBusy(false);
    }
  }

  async function addFingerprint() {
    setBusy(true);
    setMsg(null);
    try {
      await registerFingerprint();
      setFpDone(true);
      setMsg({ tone: "green", text: "Fingerprint added. Next time, sign in with one touch." });
    } catch (err) {
      setMsg({ tone: "red", text: err instanceof Error ? err.message : "The fingerprint could not be added." });
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading) return <PublicAuthShell title="Secure your account" subtitle="Preparing…" showHomeLink={false}><p className="v4-muted">Loading…</p></PublicAuthShell>;

  const grouped = secret.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();

  return (
    <PublicAuthShell title="Secure your account" subtitle="First sign-in only. It takes about two minutes." wide showHomeLink={false}>
      <section className="v4-card v4-card-pad" style={{ boxShadow: "none" }}>
        <div className="v4-section-title"><span className="v4-no">1</span><h2 className="v4-h2">Connect your authenticator app {connected ? <Chip tone="green">Done</Chip> : <Chip tone="red">Required</Chip>}</h2></div>
        {connected ? (
          <p style={{ margin: 0, color: "var(--v4-ink-2)" }}>Your authenticator app is connected. ReqGen asks for its code once every 12 hours.</p>
        ) : (
          <>
            <div className="v4-qr-box">
              <div style={{ background: "#fff", borderRadius: 12, padding: 6, border: "1px solid var(--v4-line)", width: 180, height: 180, display: "grid", placeItems: "center" }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- generated QR data URL */}
                {qr ? <img src={qr} alt="QR code to add ReqGen to your authenticator app" width={168} height={168} /> : <span className="v4-muted" style={{ fontSize: 13 }}>{busy ? "Preparing…" : "Not ready"}</span>}
              </div>
              <ol className="v4-numbered">
                <li>Install <b>Google Authenticator</b> or <b>Microsoft Authenticator</b> on your phone.</li>
                <li>In the app tap <b>+</b>, then <b>Scan a QR code</b>, and point the camera at this code.</li>
                <li>Type the 6-digit code the app shows for <b>ReqGen</b>.</li>
              </ol>
            </div>
            {uri ? <p className="v4-help" style={{ margin: "14px 0 6px", fontSize: 12.5, color: "var(--v4-muted)" }}>Can’t scan? Type this key into the app instead, or on this phone <a href={uri}>open it in the authenticator app</a>:</p> : null}
            {grouped ? <span className="v4-code-line">{grouped}</span> : null}
            <p className="v4-flabel" style={{ margin: "16px 0 8px", fontWeight: 700 }}>Code from the app <span className="v4-req">*</span></p>
            <OtpBoxes value={code} onChange={setCode} onComplete={(c) => setTimeout(() => void verify(c), 120)} disabled={busy || !factorId} align="start" />
          </>
        )}
      </section>
      <section className="v4-card v4-card-pad" style={{ boxShadow: "none", opacity: connected ? 1 : 0.6 }}>
        <div className="v4-section-title"><span className="v4-no">2</span><h2 className="v4-h2">Add your fingerprint {fpDone ? <Chip tone="green">Done</Chip> : <Chip tone="blue">Recommended</Chip>}</h2></div>
        <p style={{ margin: "0 0 14px", color: "var(--v4-ink-2)" }}>Next time, sign in with one touch instead of typing a code. Your fingerprint never leaves this device.</p>
        {fpOk ? (
          <button className="v4-btn v4-btn-secondary v4-btn-block" type="button" disabled={!connected || busy || fpDone} onClick={() => void addFingerprint()}><Icon name="fingerprint" />{fpDone ? "Fingerprint added" : "Set up fingerprint on this device"}</button>
        ) : (
          <Notice tone="blue">This device has no fingerprint sensor ReqGen can use. You can add one later from a phone or laptop that has it.</Notice>
        )}
        <p className="v4-help" style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--v4-muted)" }}>You can also do this later in <b>My Account › Security &amp; Devices</b>.</p>
      </section>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <button className="v4-btn v4-btn-primary v4-btn-lg v4-btn-block" type="button" disabled={!connected || busy} onClick={() => { router.push(nextPath()); router.refresh(); }}>Finish and open ReqGen</button>
      <div className="v4-auth-row" style={{ justifyContent: "center" }}><button type="button" className="v4-link-btn v4-quiet" onClick={() => void signOut()}>Sign out</button></div>
    </PublicAuthShell>
  );
}
