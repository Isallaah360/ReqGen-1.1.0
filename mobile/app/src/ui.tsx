import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, CloudOff, Mail, RefreshCw, Smartphone, CircleCheck, CircleAlert, Info } from "lucide-react";
import { onCodeAsk, site, plainError } from "./lib/core";
import { buzz, exitApp, onBack } from "./lib/native";
import { initials, clock } from "./lib/text";

// ---- the Android back button: the newest open sheet closes first, then the top screen ----------------
const backers: Array<{ id: number; fn: () => void }> = [];
let backId = 0;
export function useBack(active: boolean, fn: () => void) {
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; });
  useEffect(() => {
    if (!active) return;
    const id = ++backId;
    backers.push({ id, fn: () => ref.current() });
    return () => { const i = backers.findIndex((b) => b.id === id); if (i >= 0) backers.splice(i, 1); };
  }, [active]);
}
function hardwareBack() {
  const top = backers[backers.length - 1];
  if (top) top.fn(); else exitApp();
}

// ---- navigation: screens slide in from the right ------------------------------------------------------
type Entry = { id: number; node: ReactNode };
type Nav = { push: (node: ReactNode) => void; pop: () => void; popAll: () => void; replace: (node: ReactNode) => void; depth: number };
const NavCtx = createContext<Nav>({ push: () => undefined, pop: () => undefined, popAll: () => undefined, replace: () => undefined, depth: 0 });
export const useNav = () => useContext(NavCtx);
let entryId = 0;

export function Stack({ root }: { root: ReactNode }) {
  const [stack, setStack] = useState<Entry[]>([]);
  const nav: Nav = {
    push: useCallback((node: ReactNode) => { buzz.tap(); setStack((s) => [...s, { id: ++entryId, node }]); }, []),
    pop: useCallback(() => setStack((s) => s.slice(0, -1)), []),
    popAll: useCallback(() => setStack([]), []),
    replace: useCallback((node: ReactNode) => setStack((s) => [...s.slice(0, -1), { id: ++entryId, node }]), []),
    depth: stack.length,
  };
  useEffect(() => onBack(hardwareBack), []);
  useBack(stack.length > 0, nav.pop);
  return (
    <NavCtx.Provider value={nav}>
      <div className="stack">
        <div className={`scr${stack.length ? " under" : ""}`} aria-hidden={stack.length > 0 || undefined}>{root}</div>
        {stack.map((e, i) => (
          <div key={e.id} className={`scr in${i < stack.length - 1 ? " under" : ""}`} aria-hidden={i < stack.length - 1 || undefined}>
            <SwipeBack onBack={nav.pop}>{e.node}</SwipeBack>
          </div>
        ))}
      </div>
    </NavCtx.Provider>
  );
}

/** Swipe from the left edge to go back, like a native app. */
function SwipeBack({ children, onBack: back }: { children: ReactNode; onBack: () => void }) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const [dx, setDx] = useState(0);
  return (
    <div style={{ display: "contents" }}
      onTouchStart={(e) => { const t = e.touches[0]; start.current = t.clientX < 24 ? { x: t.clientX, y: t.clientY } : null; }}
      onTouchMove={(e) => { if (!start.current) return; const t = e.touches[0]; const d = t.clientX - start.current.x; if (Math.abs(t.clientY - start.current.y) > 40 && d < 30) { start.current = null; setDx(0); return; } setDx(Math.max(0, d)); }}
      onTouchEnd={() => { if (start.current && dx > 90) back(); start.current = null; setDx(0); }}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, transform: dx ? `translateX(${dx}px)` : undefined }}>{children}</div>
    </div>
  );
}

// ---- headers and body --------------------------------------------------------------------------------
export function Head({ title }: { title: string }) {
  const { pop } = useNav();
  return (
    <div className="ah">
      <button className="back" type="button" aria-label="Back" onClick={pop}><ChevronLeft size={22} strokeWidth={2.2} /></button>
      <span className="ttl">{title}</span>
    </div>
  );
}
export const Big = ({ children }: { children: ReactNode }) => <h1 className="big">{children}</h1>;

/** A scrolling body. Pull down from the top to refresh. */
export function Body({ children, onRefresh, bar, tabs, className = "" }: { children: ReactNode; onRefresh?: () => Promise<unknown>; bar?: boolean; tabs?: boolean; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const y0 = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  async function run() { if (!onRefresh) return; setBusy(true); buzz.tap(); try { await onRefresh(); } finally { setBusy(false); } }
  return (
    <>
      {onRefresh && (pull > 0 || busy) ? (
        <div className="ptr-spin" aria-hidden="true"><span style={{ ["--pull" as string]: `${busy ? 40 : Math.min(pull, 80) - 30}px` }}><RefreshCw size={18} className={busy ? "spin" : ""} style={{ transform: busy ? undefined : `rotate(${pull * 3}deg)` }} /></span></div>
      ) : null}
      <div ref={el} className={`body ${tabs ? "" : bar ? "withbar" : "nobar"} ${className}`}
        onTouchStart={(e) => { y0.current = onRefresh && el.current && el.current.scrollTop <= 0 ? e.touches[0].clientY : null; }}
        onTouchMove={(e) => { if (y0.current === null) return; const d = e.touches[0].clientY - y0.current; setPull(d > 0 ? d * 0.5 : 0); }}
        onTouchEnd={() => { if (pull > 70 && !busy) void run(); y0.current = null; setPull(0); }}>
        {children}
      </div>
    </>
  );
}

// ---- cells, chips and small parts --------------------------------------------------------------------
export function Avatar({ name, url, size = "" }: { name?: string | null; url?: string | null; size?: "" | "lg" | "xl" }) {
  return <span className={`av ${size}`} aria-hidden="true">{url ? <img src={url} alt="" /> : initials(name)}</span>;
}
export function Cell({ icon, iconTone, title, sub, right, onClick, wrap }: { icon: ReactNode; iconTone?: string; title: ReactNode; sub?: ReactNode; right?: ReactNode; onClick?: () => void; wrap?: boolean }) {
  const inner = (
    <>
      <span className={`av ${iconTone ? `ic-${iconTone}` : ""}`} aria-hidden="true">{icon}</span>
      <span className="t"><b>{title}</b>{sub ? <small className={wrap ? "wrap" : ""}>{sub}</small> : null}</span>
      {right}
      {onClick && !right ? <span className="chev"><ChevronRight size={18} /></span> : null}
    </>
  );
  return onClick ? <button type="button" className="cell" onClick={onClick}>{inner}</button> : <div className="cell">{inner}</div>;
}
export const Chip = ({ tone, children }: { tone: string; children: ReactNode }) => <span className={`chip c-${tone}`}>{children}</span>;
export const Chev = () => <span className="chev"><ChevronRight size={18} /></span>;
export function Note({ tone = "in", icon, children }: { tone?: string; icon?: ReactNode; children: ReactNode }) {
  return <div className={`note n-${tone}`} role={tone === "er" ? "alert" : undefined}>{icon || <Info size={16} />}<span>{children}</span></div>;
}
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" className="toggle" role="switch" aria-checked={on} aria-label={label} onClick={() => { buzz.tap(); onChange(!on); }}><i /></button>;
}
export function Seg<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: Array<{ k: T; label: string }> }) {
  return (
    <div className="seg" role="tablist">
      {items.map((i) => <button key={i.k} type="button" role="tab" aria-selected={value === i.k} onClick={() => { buzz.tap(); onChange(i.k); }}>{i.label}</button>)}
    </div>
  );
}
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grp" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="cell" key={i}><span className="av sk" /><span className="t"><span className="sk" style={{ display: "block", height: 14, width: "70%" }} /><span className="sk" style={{ display: "block", height: 11, width: "45%", marginTop: 8 }} /></span></div>
      ))}
    </div>
  );
}
export function Empty({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="empty"><span>{icon}</span><b>{title}</b><p className="mu">{text}</p></div>;
}
export function Updated({ at, offline }: { at: number | null; offline: boolean }) {
  if (offline) return <Note tone="wa" icon={<CloudOff size={16} />}>You are offline. Showing what was saved{at ? ` at ${clock(at)}` : ""}. Sending waits until the network returns.</Note>;
  return at ? <p className="ptr"><RefreshCw size={14} />Pull down to refresh. Updated {clock(at)}</p> : null;
}

// ---- sheets from the bottom --------------------------------------------------------------------------
export function Sheet({ open, onClose, title, children, label }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; label?: string }) {
  useBack(open, onClose);
  const y0 = useRef<number | null>(null);
  const [dy, setDy] = useState(0);
  if (!open) return null;
  return (
    <>
      <div className="dim" onClick={onClose} aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label || title} style={dy ? { transform: `translateY(${dy}px)` } : undefined}>
        <span className="grab" aria-hidden="true"
          onTouchStart={(e) => { y0.current = e.touches[0].clientY; }}
          onTouchMove={(e) => { if (y0.current !== null) setDy(Math.max(0, e.touches[0].clientY - y0.current)); }}
          onTouchEnd={() => { if (dy > 90) onClose(); y0.current = null; setDy(0); }} />
        {title ? <h3>{title}</h3> : null}
        {children}
      </div>
    </>
  );
}

// ---- toast -------------------------------------------------------------------------------------------
type T = { id: number; text: string; tone: "ok" | "er" | "in" };
let showToast: ((t: T) => void) | null = null;
let toastId = 0;
export function toast(text: string, tone: "ok" | "er" | "in" = "ok") {
  if (tone === "ok") buzz.ok(); else if (tone === "er") buzz.bad();
  showToast?.({ id: ++toastId, text, tone });
}
export function ToastHost() {
  const [t, setT] = useState<T | null>(null);
  useEffect(() => { showToast = setT; return () => { showToast = null; }; }, []);
  useEffect(() => { if (!t) return; const h = window.setTimeout(() => setT(null), t.tone === "er" ? 5200 : 3200); return () => window.clearTimeout(h); }, [t]);
  if (!t) return null;
  return (
    <div key={t.id} className={`toast t-${t.tone}`} role={t.tone === "er" ? "alert" : "status"} onClick={() => setT(null)}>
      {t.tone === "er" ? <CircleAlert size={20} /> : t.tone === "ok" ? <CircleCheck size={20} /> : <Info size={20} />}<span>{t.text}</span>
    </div>
  );
}

// ---- the 6-digit code (SMS and e-mail). Needed for every send and every decision. ------------------------
type Sent = { sms: boolean; email: boolean; phone: string | null; emailTo: string | null; resendIn: number };
type Ask = { what: string; purpose: "action" | "sign_in"; resolve: (ok: boolean) => void };
export function CodeHost() {
  const [ask, setAsk] = useState<(Ask & { id: number }) | null>(null);
  useEffect(() => { let n = 0; onCodeAsk((a) => setAsk({ ...a, id: ++n })); }, []);
  if (!ask) return null;
  return <CodeSheet key={ask.id} what={ask.what} purpose={ask.purpose} onDone={(ok) => { ask.resolve(ok); setAsk(null); }} />;
}

export function CodeSheet({ what, purpose, onDone }: { what: string; purpose: "action" | "sign_in"; onDone: (ok: boolean) => void }) {
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
      const j = await site<Sent>("/api/otp/send", { purpose });
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
    try { await site("/api/otp/verify", { purpose, code: v }); buzz.ok(); onDone(true); }
    catch (e) { buzz.bad(); setMsg(plainError(e)); setBad(true); window.setTimeout(() => setBad(false), 400); setCode(""); setBusy(""); window.setTimeout(() => input.current?.focus(), 60); }
  }
  const where = sent ? [sent.sms && sent.phone ? `by SMS to ${sent.phone} (from ReqGen)` : "", sent.email && sent.emailTo ? `by e-mail to ${sent.emailTo}` : ""].filter(Boolean).join(" and ") : "";
  return (
    <Sheet open onClose={() => { if (busy !== "checking") onDone(false); }} title="Enter the 6-digit code">
      <p className="mu" style={{ fontSize: 14 }}>
        {busy === "sending" ? "Sending your code by SMS and e-mail…" : sent ? `To ${what}: we sent it ${where}. Either code works.` : `To ${what}, ReqGen sends a code to your phone and e-mail.`}
      </p>
      <label className={`otp${bad ? " bad" : ""}`} aria-label="6-digit code">
        {Array.from({ length: 6 }).map((_, i) => <i key={i} className={i < code.length || i === code.length ? "on" : ""}>{code[i] || ""}</i>)}
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
