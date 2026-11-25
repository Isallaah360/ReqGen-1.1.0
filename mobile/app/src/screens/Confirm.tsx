import { useCallback, useEffect, useRef, useState } from "react";
import { Fingerprint, KeyRound, Mail, Smartphone } from "lucide-react";
import { fn, onCodeAsk, plainError, store } from "../lib/core";
import { buzz, finger, pin } from "../lib/native";
import { ensureDevice, proveDevice } from "../lib/device";
import { Note, Sheet } from "../ui";
import { PinPad } from "./Unlock";

/**
 * App 4.0.0: every send, decision, signature and payment is confirmed on the phone itself:
 * the fingerprint, or the app PIN. The 6-digit SMS and e-mail code is only the back-up, when this
 * phone is not set up (or its set-up was switched off).
 */
type Ask = { what: string; purpose: "action" | "sign_in"; resolve: (ok: boolean) => void };

export default function ConfirmHost() {
  const [ask, setAsk] = useState<(Ask & { id: number }) | null>(null);
  useEffect(() => { let n = 0; onCodeAsk((a) => setAsk({ ...a, id: ++n })); }, []);
  if (!ask) return null;
  const done = (ok: boolean) => { ask.resolve(ok); setAsk(null); };
  return <ConfirmSheet key={ask.id} what={ask.what} purpose={ask.purpose} onDone={done} />;
}

type Mode = "start" | "finger" | "pin" | "code";

function ConfirmSheet({ what, purpose, onDone }: { what: string; purpose: "action" | "sign_in"; onDone: (ok: boolean) => void }) {
  const [mode, setMode] = useState<Mode>("start");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasFinger, setHasFinger] = useState(false);

  const prove = useCallback(async () => {
    setBusy(true); setMsg(null);
    let r = await proveDevice();
    if (r === "off" && (await ensureDevice())) r = await proveDevice();
    setBusy(false);
    if (r === "ok") { buzz.ok(); onDone(true); return; }
    if (r === "off") { setMsg("This phone needs to be set up again. Use the code this time."); setMode("code"); return; }
    setMsg("It could not be confirmed. Try again, or use the code."); buzz.bad();
  }, [onDone]);

  const tryFinger = useCallback(async () => {
    try { await finger.check(`Confirm: ${what}`); await prove(); }
    catch { setMode("pin"); }
  }, [prove, what]);

  // first choice: fingerprint if it is on; else the PIN; the code when this phone is not set up at all
  useEffect(() => {
    void (async () => {
      if (purpose === "sign_in") { setMode("code"); return; }
      const ready = (await ensureDevice()) && (await pin.isSet());
      if (!ready) { setMode("code"); return; }
      const f = (await finger.on()) && (await finger.ready());
      setHasFinger(f);
      if (f) { setMode("finger"); void tryFinger(); } else setMode("pin");
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (mode === "code") return <CodeSheet what={what} purpose={purpose} note={msg} onDone={onDone} />;
  return (
    <Sheet open onClose={() => { if (!busy) onDone(false); }} title={mode === "pin" ? "Enter your app PIN" : "Confirm with your fingerprint"}>
      <p className="mu" style={{ fontSize: 14 }}>To {what}.</p>
      {mode === "pin" ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <PinPad error={msg} onFinger={hasFinger ? () => void tryFinger() : undefined} onFull={async (p) => {
            if (!(await pin.matches(p))) {
              const tries = (await store.get<number>("rg:pinTries", 0)) + 1;
              await store.set("rg:pinTries", tries);
              setMsg(tries >= 5 ? "Too many wrong PINs. Use the code instead." : `That PIN is not right. ${5 - tries} ${5 - tries === 1 ? "try" : "tries"} left.`);
              if (tries >= 5) setMode("code");
              return false;
            }
            await store.set("rg:pinTries", 0);
            await prove();
            return true;
          }} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "8px 0" }}>
          <button type="button" className="fp-btn" aria-label="Use fingerprint" disabled={busy} onClick={() => void tryFinger()}><Fingerprint size={44} /></button>
          <p className="mu" style={{ fontSize: 14 }}>{busy ? "Confirming…" : "Touch the sensor."}</p>
          {msg ? <Note tone="er">{msg}</Note> : null}
          <button type="button" className="btn bs block" disabled={busy} onClick={() => { setMsg(null); setMode("pin"); }}><KeyRound size={18} />Use the app PIN</button>
        </div>
      )}
      <div className="row" style={{ justifyContent: "space-between" }}>
        <button type="button" className="link" disabled={busy} onClick={() => setMode("code")}>Use an SMS code instead</button>
        <button type="button" className="link" disabled={busy} onClick={() => onDone(false)}>Cancel</button>
      </div>
    </Sheet>
  );
}

// ---- the back-up: a 6-digit code by SMS and e-mail (ReqGen's own database program sends it) ----------------
type Sent = { sms: boolean; email: boolean; phone: string | null; emailTo: string | null; resendIn: number };
function CodeSheet({ what, purpose, note, onDone }: { what: string; purpose: "action" | "sign_in"; note: string | null; onDone: (ok: boolean) => void }) {
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<Sent | null>(null);
  const [busy, setBusy] = useState<"" | "sending" | "checking">("sending");
  const [msg, setMsg] = useState<string | null>(null);
  const [bad, setBad] = useState(false);
  const [wait, setWait] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const send = useCallback(async () => {
    setBusy("sending"); setMsg(null);
    try {
      const j = await fn<Sent>("reqgen-code", { step: "send", purpose });
      setSent(j); setWait(j.resendIn || 45);
      window.setTimeout(() => input.current?.focus(), 60);
    } catch (e) { setMsg(plainError(e)); }
    finally { setBusy(""); }
  }, [purpose]);
  useEffect(() => { void send(); }, [send]);
  useEffect(() => { if (wait <= 0) return; const t = window.setTimeout(() => setWait((w) => w - 1), 1000); return () => window.clearTimeout(t); }, [wait]);

  async function check(v: string) {
    if (v.length !== 6 || busy) return;
    setBusy("checking"); setMsg(null);
    try { await fn("reqgen-code", { step: "verify", purpose, code: v }); buzz.ok(); onDone(true); }
    catch (e) { buzz.bad(); setMsg(plainError(e)); setBad(true); window.setTimeout(() => setBad(false), 400); setCode(""); setBusy(""); window.setTimeout(() => input.current?.focus(), 60); }
  }
  const where = sent ? [sent.sms && sent.phone ? `by SMS to ${sent.phone}` : "", sent.email && sent.emailTo ? `by e-mail to ${sent.emailTo}` : ""].filter(Boolean).join(" and ") : "";
  return (
    <Sheet open onClose={() => { if (busy !== "checking") onDone(false); }} title="Enter the 6-digit code">
      {note ? <Note tone="wa">{note}</Note> : null}
      <p className="mu" style={{ fontSize: 14 }}>
        {busy === "sending" ? "Sending your code by SMS and e-mail…" : sent ? `To ${what}: we sent it ${where}. Either code works.` : `To ${what}, ReqGen sends a code to your phone and e-mail.`}
      </p>
      <label className={`otp${bad ? " bad" : ""}`} aria-label="6-digit code">
        {Array.from({ length: 6 }).map((_, i) => <i key={i} className={i === code.length ? "on" : ""}>{code[i] || ""}</i>)}
        <input ref={input} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} disabled={busy === "checking"}
          onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setCode(v); if (v.length === 6) void check(v); }} />
      </label>
      {msg ? <Note tone="er">{msg}</Note> : null}
      <div className="row" style={{ fontSize: 13.5 }}>
        <span className="mu">{busy === "checking" ? "Checking…" : wait > 0 ? `Resend in 0:${String(wait).padStart(2, "0")}` : "Did not get it?"}</span>
        <button type="button" className="link" disabled={wait > 0 || busy !== ""} style={{ opacity: wait > 0 ? 0.45 : 1 }} onClick={() => { setCode(""); void send(); }}>Send again</button>
      </div>
      {sent ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className={`chip ${sent.sms ? "c-ok" : "c-mu"}`}><Smartphone size={14} />{sent.sms ? "SMS sent" : "No phone number"}</span>
          <span className={`chip ${sent.email ? "c-ok" : "c-mu"}`}><Mail size={14} />{sent.email ? "E-mail sent" : "No e-mail"}</span>
        </div>
      ) : null}
      <button type="button" className="btn bs block" disabled={busy === "checking"} onClick={() => onDone(false)}>Cancel</button>
    </Sheet>
  );
}
