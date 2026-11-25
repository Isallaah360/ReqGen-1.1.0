import { useState } from "react";
import { Eye, EyeOff, MailCheck } from "lucide-react";
import { db, plainError, signingOut } from "../lib/core";
import { Body, Head, Note, toast, useNav } from "../ui";

/**
 * App 4.0.0: forgot password, inside the app.
 *   1. your staff e-mail: ReqGen e-mails a code;
 *   2. the code from the e-mail;
 *   3. the code from your authenticator app (every ReqGen account has 2FA);
 *   4. the new password, twice.
 */
type Step = "email" | "code" | "totp" | "password" | "done";
export default function Forgot({ startEmail = "" }: { startEmail?: string }) {
  const { pop } = useNav();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(startEmail);
  const [code, setCode] = useState("");
  const [totp, setTotp] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function send() {
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) { setMsg("Type your staff e-mail."); return; }
    setBusy(true); setMsg(null);
    const { error } = await (await db()).auth.resetPasswordForEmail(clean);
    setBusy(false);
    if (error && !/rate|seconds/i.test(error.message)) { setMsg(plainError(error)); return; }
    setStep("code");
  }

  async function checkCode() {
    if (!/^\d{6,10}$/.test(code)) { setMsg("Type the code from the e-mail."); return; }
    setBusy(true); setMsg(null);
    const c = await db();
    const { error } = await c.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: "recovery" });
    if (error) { setBusy(false); setMsg("That code is not right or has expired. Send a new one."); return; }
    const f = await c.auth.mfa.listFactors();
    const totpFactor = (f.data?.totp || []).find((x) => x.status === "verified");
    setBusy(false);
    if (totpFactor) { setFactorId(totpFactor.id); setStep("totp"); } else setStep("password");
  }

  async function checkTotp(v: string) {
    if (!factorId || v.length !== 6) return;
    setBusy(true); setMsg(null);
    const { error } = await (await db()).auth.mfa.challengeAndVerify({ factorId, code: v });
    setBusy(false);
    if (error) { setTotp(""); setMsg("That code is not right. Type the newest code from your authenticator app."); return; }
    setStep("password");
  }

  async function save() {
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) { setMsg("Use at least 8 characters, with letters and numbers."); return; }
    if (pw !== pw2) { setMsg("The two passwords are not the same."); return; }
    setBusy(true); setMsg(null);
    const c = await db();
    const { error } = await c.auth.updateUser({ password: pw });
    if (error) { setBusy(false); setMsg(plainError(error)); return; }
    signingOut(true);
    await c.auth.signOut({ scope: "local" }).catch(() => null);
    window.setTimeout(() => signingOut(false), 4000);
    setBusy(false); setPw(""); setPw2(""); setStep("done");
    toast("Password changed.");
  }

  return (
    <>
      <Head title="Forgot password" />
      <Body>
        {step === "email" ? (
          <form style={{ display: "flex", flexDirection: "column", gap: 12 }} onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <p className="mu">Type your staff e-mail. ReqGen e-mails you a code.</p>
            <label><span className="lbl">E-mail</span><input className="inp" type="email" inputMode="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@iet.org.ng" /></label>
            {msg ? <Note tone="er">{msg}</Note> : null}
            <button type="submit" className="btn bp block" disabled={busy}>{busy ? "Sending…" : "Send the code"}</button>
          </form>
        ) : step === "code" ? (
          <form style={{ display: "flex", flexDirection: "column", gap: 12 }} onSubmit={(e) => { e.preventDefault(); void checkCode(); }}>
            <Note tone="ok" icon={<MailCheck size={16} />}>If {email.trim()} is a ReqGen account, a code is on its way. Check the inbox and spam.</Note>
            <label><span className="lbl">Code from the e-mail</span><input className="inp" inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></label>
            {msg ? <Note tone="er">{msg}</Note> : null}
            <button type="submit" className="btn bp block" disabled={busy}>{busy ? "Checking…" : "Continue"}</button>
            <button type="button" className="link" style={{ justifyContent: "center" }} disabled={busy} onClick={() => { setCode(""); void send(); }}>Send a new code</button>
          </form>
        ) : step === "totp" ? (
          <>
            <p className="mu">Now the code from your authenticator app.</p>
            <label className={`otp${msg ? " bad" : ""}`} aria-label="6-digit code from your authenticator app">
              {Array.from({ length: 6 }).map((_, i) => <i key={i} className={i === totp.length ? "on" : ""}>{totp[i] || ""}</i>)}
              <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={totp} disabled={busy} autoFocus
                onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setTotp(v); if (v.length === 6) void checkTotp(v); }} />
            </label>
            {msg ? <Note tone="er">{msg}</Note> : null}
          </>
        ) : step === "password" ? (
          <form style={{ display: "flex", flexDirection: "column", gap: 12 }} onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <p className="mu">Choose a new password: at least 8 characters, with letters and numbers.</p>
            <label><span className="lbl">New password</span>
              <span className="inp-wrap" style={{ display: "block" }}>
                <input className="inp" type={show ? "text" : "password"} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
                <button type="button" className="eye" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((v) => !v)}>{show ? <EyeOff size={20} /> : <Eye size={20} />}</button>
              </span>
            </label>
            <label><span className="lbl">Type it again</span><input className="inp" type={show ? "text" : "password"} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
            {msg ? <Note tone="er">{msg}</Note> : null}
            <button type="submit" className="btn bp block" disabled={busy}>{busy ? "Saving…" : "Save the new password"}</button>
          </form>
        ) : (
          <>
            <Note tone="ok">Your password is changed. Sign in with the new password.</Note>
            <button type="button" className="btn bp block" onClick={pop}>Back to sign in</button>
          </>
        )}
      </Body>
    </>
  );
}
