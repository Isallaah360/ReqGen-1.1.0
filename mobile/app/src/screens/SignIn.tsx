import { useEffect, useState } from "react";
import { Eye, EyeOff, Fingerprint, ShieldCheck } from "lucide-react";
import { db, plainError, session, store } from "../lib/core";
import Forgot from "./Forgot";
import Setup2fa from "./Setup2fa";
import { ensureDevice } from "../lib/device";
import { finger, pin } from "../lib/native";
import { Note, Body, useNav } from "../ui";
import { PinPad } from "./Unlock";

/**
 * First sign-in on a phone (2.0.1, the ReqGen standard, the same as the website): e-mail and password,
 * then the 6-digit code from the authenticator app (2FA), then an app PIN and, if the phone has one,
 * the fingerprint. Done once per phone. 4.0.0: sending, approving, signing and paying are then
 * confirmed with the fingerprint or the app PIN.
 */
type Step = "password" | "code" | "pin" | "pin2" | "finger";
export default function SignIn({ onDone }: { onDone: () => Promise<void> }) {
  const { push } = useNav();
  const [step, setStep] = useState<Step>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [first, setFirst] = useState("");
  const [canFinger, setCanFinger] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [totp, setTotp] = useState("");
  const [noFactor, setNoFactor] = useState(false);

  // a session already here but not confirmed with the authenticator: go to the code step
  useEffect(() => { void session().then((s) => { if (s) setStep("code"); }); void finger.ready().then(setCanFinger); }, []);
  useEffect(() => { if (step === "code") void prepareCode(); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  async function signIn() {
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) { setMsg("Type your staff e-mail."); return; }
    if (!password) { setMsg("Type your password."); return; }
    setBusy(true); setMsg(null);
    try {
      const { error } = await (await db()).auth.signInWithPassword({ email: clean, password });
      if (error) throw new Error(/invalid login/i.test(error.message) ? "That e-mail and password do not match." : error.message);
      setPassword("");
      setStep("code");
    } catch (e) { setMsg(plainError(e)); }
    finally { setBusy(false); }
  }

  async function prepareCode() {
    setMsg(null); setTotp("");
    const s = await db();
    const { data, error } = await s.auth.mfa.listFactors();
    if (error) { setMsg(plainError(error)); return; }
    const f = (data?.totp || []).find((x) => x.status === "verified");
    if (!f) { setNoFactor(true); setFactorId(null); return; }
    setNoFactor(false); setFactorId(f.id);
    const aal = await s.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!aal.error && aal.data.currentLevel === "aal2") await verified();
  }

  async function checkTotp(v: string) {
    if (!factorId || v.length !== 6) return;
    setBusy(true); setMsg(null);
    const { error } = await (await db()).auth.mfa.challengeAndVerify({ factorId, code: v });
    setBusy(false);
    if (error) { setMsg("That code is not right. Open your authenticator app and type the newest code."); setTotp(""); return; }
    await verified();
  }

  async function verified() {
    const s = await session();
    if (!s) { setStep("password"); return; }
    await store.set("rg:verified", s.user.id);
    void ensureDevice(); // this phone's key for confirming with the fingerprint or PIN
    setStep("pin");
  }

  async function cancel() {
    try { await (await db()).auth.signOut(); } catch { /* ignore */ }
    setStep("password"); setMsg(null);
  }

  if (step === "pin" || step === "pin2") {
    return (
      <div className="scr">
        <Body className="center">
          <ShieldCheck size={40} color="var(--or)" aria-hidden="true" />
          <p className="title">{step === "pin" ? "Choose an app PIN" : "Type the PIN again"}</p>
          <p className="mu">6 numbers. You use it to open ReqGen on this phone.</p>
          <PinPad key={step} error={msg} onFull={async (p) => {
            if (step === "pin") {
              if (/^(\d)\1{5}$/.test(p) || "0123456789".includes(p) || "9876543210".includes(p)) { setMsg("Too easy to guess. Choose another PIN."); return false; }
              setFirst(p); setMsg(null); setStep("pin2"); return true;
            }
            if (p !== first) { setMsg("The two PINs are not the same. Start again."); setStep("pin"); return false; }
            await pin.set(p); setMsg(null);
            if (canFinger) setStep("finger"); else await onDone();
            return true;
          }} />
        </Body>
      </div>
    );
  }

  if (step === "finger") {
    return (
      <div className="scr">
        <Body className="center">
          <Fingerprint size={56} color="var(--or)" aria-hidden="true" />
          <p className="title">Use your fingerprint?</p>
          <p className="mu" style={{ maxWidth: 320 }}>Open ReqGen with a touch instead of typing the PIN. You can turn it off in Me.</p>
          <button type="button" className="btn bp block" onClick={async () => {
            try { await finger.check("Turn on fingerprint"); await finger.set(true); } catch { /* not now */ }
            await onDone();
          }}>Turn on</button>
          <button type="button" className="btn bs block" onClick={() => void onDone()}>Not now</button>
        </Body>
      </div>
    );
  }

  return (
    <div className="scr">
      <Body>
        <img className="logo float-logo" src="./iet-logo.png" alt="Islamic Education Trust logo" style={{ marginTop: 24, width: 112, height: 112, borderRadius: "50%", boxShadow: "0 16px 40px rgba(0,0,0,.14)" }} />
        <p className="brand-word" style={{ textAlign: "center" }} aria-label="ReqGen">Req<span>Gen</span></p>
        <h1 className="title" style={{ textAlign: "center", fontSize: 20 }}>Welcome back</h1>
        <p className="mu" style={{ textAlign: "center", fontSize: 14 }}>Use your staff e-mail. You do this once on this phone.</p>
        {step === "code" ? (
          noFactor ? (
            <>
              <Note tone="wa">Your account has no authenticator app (2FA) yet. Every ReqGen account needs one. It takes a minute.</Note>
              <button type="button" className="btn bp block" onClick={() => push(<Setup2fa onDone={prepareCode} />)}>Set up 2FA now</button>
              <button type="button" className="btn bs block" onClick={() => void cancel()}>Back to sign in</button>
            </>
          ) : (
            <>
              <p className="h" style={{ textAlign: "center" }}>Code from your authenticator app</p>
              <label className={`otp${msg ? " bad" : ""}`} aria-label="6-digit code from your authenticator app">
                {Array.from({ length: 6 }).map((_, i) => <i key={i} className={i === totp.length ? "on" : ""}>{totp[i] || ""}</i>)}
                <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={totp} disabled={busy || !factorId} autoFocus
                  onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setTotp(v); if (v.length === 6) void checkTotp(v); }} />
              </label>
              <p className="foot">{busy ? "Checking…" : "ReqGen checks it as soon as the sixth number is in."}</p>
              {msg ? <Note tone="er">{msg}</Note> : null}
              <button type="button" className="btn bs block" onClick={() => void cancel()}>Use another account</button>
              <button type="button" className="link" style={{ justifyContent: "center" }} onClick={() => setMsg("Lost your phone? Ask the Super Admin to reset your 2FA. Then sign in with your password and set up your authenticator app again. The app shows you how.")}>Lost your phone?</button>
            </>
          )
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void signIn(); }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label><span className="lbl">E-mail</span>
              <input className="inp" type="email" inputMode="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@iet.org.ng" />
            </label>
            <label><span className="lbl">Password</span>
              <span className="inp-wrap" style={{ display: "block" }}>
                <input className="inp" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" className="eye" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((v) => !v)}>{show ? <EyeOff size={20} /> : <Eye size={20} />}</button>
              </span>
            </label>
            {msg ? <Note tone="er">{msg}</Note> : null}
            <button type="submit" className="btn bp block" disabled={busy}>{busy ? "Signing in…" : "Continue"}</button>
            <button type="button" className="link" style={{ justifyContent: "center" }} onClick={() => push(<Forgot startEmail={email} />)}>Forgot password?</button>
          </form>
        )}
        <p className="foot" style={{ marginTop: "auto" }}>Next: the code from your authenticator app (2FA), then you choose an app PIN.</p>
      </Body>
    </div>
  );
}
