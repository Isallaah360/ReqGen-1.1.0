import { useEffect, useState } from "react";
import { Delete, Fingerprint } from "lucide-react";
import { finger, pin, buzz } from "../lib/native";
import { first } from "../lib/text";
import { store } from "../lib/core";
import type { Me } from "../lib/data";
import { Avatar, Body, Note, Sheet } from "../ui";

/** The 6 dots and the number pad. onFull returns false to clear and shake. */
export function PinPad({ onFull, error, onFinger }: { onFull: (p: string) => Promise<boolean> | boolean; error?: string | null; onFinger?: () => void }) {
  const [v, setV] = useState("");
  const [bad, setBad] = useState(false);
  async function add(d: string) {
    if (v.length >= 6) return;
    buzz.tap();
    const n = v + d; setV(n);
    if (n.length === 6) {
      const ok = await onFull(n);
      // cleared at once, so the next numbers typed are never lost; the dots shake to show it
      setV("");
      if (!ok) { buzz.bad(); setBad(true); window.setTimeout(() => setBad(false), 380); }
    }
  }
  return (
    <>
      <div className={`dots${bad ? " bad" : ""}`} role="img" aria-label={`${v.length} of 6 numbers typed`}>
        {Array.from({ length: 6 }).map((_, i) => <i key={i} className={i < v.length ? "on" : ""} />)}
      </div>
      {error ? <Note tone="er">{error}</Note> : null}
      <div className="pad">
        {"123456789".split("").map((d) => <button key={d} type="button" onClick={() => void add(d)}>{d}</button>)}
        {onFinger ? <button type="button" aria-label="Use fingerprint" onClick={onFinger} style={{ color: "var(--or)" }}><Fingerprint size={30} /></button> : <span />}
        <button type="button" onClick={() => void add("0")}>0</button>
        <button type="button" aria-label="Delete last number" onClick={() => setV((x) => x.slice(0, -1))}><Delete size={26} /></button>
      </div>
    </>
  );
}

export default function Unlock({ me, onOpen, onSwitch }: { me: Me; onOpen: () => Promise<void>; onSwitch: () => Promise<void> }) {
  const [useFinger, setUseFinger] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);

  async function tryFinger() {
    try { await finger.check("Open ReqGen"); await store.set("rg:pinTries", 0); await onOpen(); } catch { /* use the PIN */ }
  }
  useEffect(() => {
    void (async () => { const on = (await finger.on()) && (await finger.ready()); setUseFinger(on); if (on) void tryFinger(); })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="scr">
      <Body className="center">
        <Avatar name={me.full_name} url={me.avatar_url} size="xl" />
        <p className="title">Welcome back, {first(me.full_name)}</p>
        <p className="mu">Enter your app PIN</p>
        <PinPad error={msg} onFinger={useFinger ? () => void tryFinger() : undefined} onFull={async (p) => {
          if (await pin.matches(p)) { await store.set("rg:pinTries", 0); setMsg(null); await onOpen(); return true; }
          const tries = (await store.get<number>("rg:pinTries", 0)) + 1;
          await store.set("rg:pinTries", tries);
          if (tries >= 5) { setMsg("5 wrong PINs. Sign in again with your password."); window.setTimeout(() => void onSwitch(), 1600); return false; }
          setMsg(`That PIN is not right. ${5 - tries} ${5 - tries === 1 ? "try" : "tries"} left.`);
          return false;
        }} />
        <div className="row" style={{ width: "100%", maxWidth: 360 }}>
          <button type="button" className="link" onClick={() => setForgot(true)}>Forgot PIN?</button>
          <button type="button" className="link" onClick={() => void onSwitch()}>Not you? Switch</button>
        </div>
      </Body>
      <Sheet open={forgot} onClose={() => setForgot(false)} title="Forgot your PIN?">
        <p className="mu" style={{ fontSize: 14 }}>Sign in again with your e-mail, password and the code sent to your phone. Then choose a new PIN.</p>
        <button type="button" className="btn bp block" onClick={() => void onSwitch()}>Sign in again</button>
        <button type="button" className="btn bs block" onClick={() => setForgot(false)}>Cancel</button>
      </Sheet>
    </div>
  );
}
