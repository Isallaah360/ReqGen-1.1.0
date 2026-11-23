import { useEffect, useState } from "react";
import { Eye, EyeOff, Fingerprint, ShieldCheck } from "lucide-react";
import { askCode, db, plainError, session, store, WEBSITE } from "../lib/core";
import { finger, pin } from "../lib/native";
import { Note, Body } from "../ui";
import { PinPad } from "./Unlock";

/**
 * First sign-in on a phone: e-mail and password, then the 6-digit code by SMS and e-mail,
 * then an app PIN and, if the phone has one, the fingerprint. Done once per phone.
 */
type Step = "password" | "code" | "pin" | "pin2" | "finger";
export default function SignIn({ onDone }: { onDone: () => Promise<void> }) {
  const [step, setStep] = useState<Step>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [first, setFirst] = useState("");
  const [canFinger, setCanFinger] = useState(false);

  // a session already here but not confirmed with the code: go to the code step
  useEffect(() => { void session().then((s) => { if (s) setStep("code"); }); void finger.ready().then(setCanFinger); }, []);
  useEffect(() => { if (step === "code") void confirmCode(); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

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

  async function confirmCode() {
    setMsg(null);
    const ok = await askCode("finish signing in", "sign_in");
    const s = await session();
    if (!s) { setStep("password"); return; }
    if (!ok) { setMsg("Signing in needs the code sent to your phone or e-mail."); return; }
    await store.set("rg:verified", s.user.id);
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
        <img className="logo" src="./iet-logo.png" alt="Islamic Education Trust logo" style={{ marginTop: 28 }} />
        <h1 className="title" style={{ textAlign: "center", fontSize: 26 }}>Sign in to ReqGen</h1>
        <p className="mu" style={{ textAlign: "center", fontSize: 14 }}>Use your staff e-mail. You do this once on this phone.</p>
        {step === "code" ? (
          <>
            {msg ? <Note tone="er">{msg}</Note> : <Note tone="in">Enter the 6-digit code sent by SMS and e-mail to finish signing in.</Note>}
            <button type="button" className="btn bp block" onClick={() => void confirmCode()}>Enter the code</button>
            <button type="button" className="btn bs block" onClick={() => void cancel()}>Use another account</button>
          </>
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
            <a className="link" style={{ justifyContent: "center" }} href={`${WEBSITE}/forgot-password`} target="_blank" rel="noreferrer">Forgot password?</a>
          </form>
        )}
        <p className="foot" style={{ marginTop: "auto" }}>Next: the code sent to your phone and e-mail, then you choose an app PIN.</p>
      </Body>
    </div>
  );
}
