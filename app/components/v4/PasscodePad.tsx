"use client";

import { useEffect } from "react";
import Icon from "./Icon";

/**
 * Six passcode dots and a number pad (v4). The keyboard works too:
 * digits, Backspace and Escape (clear). onComplete fires on the sixth digit.
 */
export default function PasscodePad({ value, onChange, onComplete, disabled, fingerprint }: {
  value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; disabled?: boolean; fingerprint?: () => void;
}) {
  const press = (d: string) => {
    if (disabled || value.length >= 6) return;
    const next = value + d;
    onChange(next);
    if (next.length === 6) onComplete?.(next);
  };
  const back = () => { if (!disabled) onChange(value.slice(0, -1)); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (/^\d$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === "Backspace") { e.preventDefault(); back(); }
      else if (e.key === "Escape") onChange("");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center" }}>
      <div className="v4-pin" role="status" aria-label={`Passcode, ${value.length} of 6 entered`}>
        {Array.from({ length: 6 }, (_, i) => <span key={i} className={i < value.length ? "v4-f" : undefined} />)}
      </div>
      <div className="v4-keypad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => <button key={d} type="button" onClick={() => press(d)} disabled={disabled}>{d}</button>)}
        {fingerprint
          ? <button type="button" className="v4-ghost" onClick={fingerprint} disabled={disabled} aria-label="Use fingerprint"><Icon name="fingerprint" /></button>
          : <button type="button" className="v4-ghost" onClick={() => onChange("")} disabled={disabled}>Clear</button>}
        <button type="button" onClick={() => press("0")} disabled={disabled}>0</button>
        <button type="button" className="v4-ghost" onClick={back} disabled={disabled}>Delete</button>
      </div>
    </div>
  );
}
