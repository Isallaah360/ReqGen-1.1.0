"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/app/components/v4/Icon";
import { supabase } from "@/lib/supabaseClient";
import { CODE_EVENT, type CodeAsk } from "@/lib/codeConfirm";

/**
 * ReqGen v4.7.0: "Enter the 6-digit code". Sends the code by SMS and e-mail
 * as soon as it opens, checks it when the sixth number is typed, and offers
 * Resend after the wait. Centred K2 box; Escape or Cancel closes it.
 */
type Sent = { sms: boolean; email: boolean; phone: string | null; emailTo: string | null; resendIn: number };

async function call(path: string, body: unknown) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in again.");
  const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string } & Partial<Sent>;
  if (!r.ok || !j.ok) throw new Error(j.error || "Something went wrong. Try again.");
  return j;
}

export default function CodeHost() {
  const [ask, setAsk] = useState<CodeAsk | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { queueMicrotask(() => setMounted(true)); }, []);
  useEffect(() => {
    const on = (e: Event) => setAsk((e as CustomEvent<CodeAsk>).detail);
    window.addEventListener(CODE_EVENT, on);
    return () => window.removeEventListener(CODE_EVENT, on);
  }, []);
  if (!mounted || !ask) return null;
  return createPortal(<CodeBox key={ask.id} ask={ask} onDone={(ok) => { ask.resolve(ok); setAsk(null); }} />, document.body);
}

function CodeBox({ ask, onDone }: { ask: CodeAsk; onDone: (ok: boolean) => void }) {
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<Sent | null>(null);
  const [busy, setBusy] = useState<"" | "sending" | "checking">("sending");
  const [msg, setMsg] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const send = useCallback(async () => {
    setBusy("sending"); setMsg(null);
    try {
      const j = (await call("/api/otp/send", { purpose: ask.purpose })) as unknown as Sent;
      setSent(j); setWait(j.resendIn || 45);
      window.setTimeout(() => input.current?.focus(), 30);
    } catch (e) { setMsg(e instanceof Error ? e.message : "The code could not be sent."); }
    finally { setBusy(""); }
  }, [ask.purpose]);

  useEffect(() => { queueMicrotask(() => { void send(); }); }, [send]);
  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && busy !== "checking") { e.preventDefault(); onDone(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onDone]);

  async function check(value: string) {
    if (value.length !== 6 || busy) return;
    setBusy("checking"); setMsg(null);
    try { await call("/api/otp/verify", { purpose: ask.purpose, code: value }); onDone(true); }
    catch (e) { setMsg(e instanceof Error ? e.message : "That code is not right."); setCode(""); setBusy(""); window.setTimeout(() => input.current?.focus(), 30); }
  }

  const where = sent ? [sent.sms && sent.phone ? `by SMS to ${sent.phone}` : "", sent.email && sent.emailTo ? `by e-mail to ${sent.emailTo}` : ""].filter(Boolean).join(" and ") : "";
  return (
    <div className="rg-modal-backdrop rg-attention-backdrop rg-dialog-backdrop" role="presentation">
      <section className="rg-attention rg-dialog k-code" role="dialog" aria-modal="true" aria-labelledby="k-code-title">
        <span className="rg-attention-icon rg-dialog-icon" aria-hidden="true"><Icon name="shield" /></span>
        <h2 id="k-code-title">Enter the 6-digit code</h2>
        <p>{busy === "sending" && !sent ? "Sending your code…" : sent ? `To ${ask.what}, type the code we sent ${where}. Either one works.` : `To ${ask.what}, ReqGen needs to send you a code.`}</p>
        <label className="k-code-boxes" aria-label="6-digit code">
          <input ref={input} value={code} inputMode="numeric" autoComplete="one-time-code" maxLength={6} disabled={!sent || busy === "checking"}
            onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setCode(v); if (v.length === 6) void check(v); }} aria-describedby={msg ? "k-code-msg" : undefined} />
          {Array.from({ length: 6 }, (_, i) => <i key={i} className={i === code.length && sent ? "on" : undefined} aria-hidden="true">{code[i] || ""}</i>)}
        </label>
        {sent ? <div className="k-code-chips">{sent.sms ? <span className="v4-chip v4-chip-green"><Icon name="smartphone" size="sm" />SMS sent</span> : null}{sent.email ? <span className="v4-chip v4-chip-green"><Icon name="mail" size="sm" />E-mail sent</span> : null}</div> : null}
        {msg ? <p id="k-code-msg" role="alert" className="k-code-msg">{msg}</p> : null}
        {busy === "checking" ? <p className="v4-muted" style={{ margin: 0 }}>Checking…</p> : null}
        <div className="rg-attention-actions rg-dialog-actions">
          <button type="button" className="rg-btn rg-btn-secondary" onClick={() => onDone(false)} disabled={busy === "checking"}>Cancel</button>
          <button type="button" className="rg-btn rg-btn-primary" onClick={() => void send()} disabled={wait > 0 || busy !== ""}>{wait > 0 ? `Resend in 0:${String(wait).padStart(2, "0")}` : "Resend code"}</button>
        </div>
      </section>
    </div>
  );
}
