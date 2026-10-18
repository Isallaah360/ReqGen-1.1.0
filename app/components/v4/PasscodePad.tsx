"use client";

import { useEffect, useRef } from "react";
import Icon from "./Icon";

/**
 * Six passcode dots over ONE real input (v4.6.4). There is no on-screen number pad:
 * tapping the boxes opens the phone's own number keyboard, and on a laptop the
 * passcode is typed on the keyboard. Paste works too. onComplete fires on the sixth digit.
 * data-rg-reveal="off": the boxes already hide each number, so no show/hide eye is added.
 */
export default function PasscodePad({ value, onChange, onComplete, disabled, fingerprint, autoFocus = true, label = "Passcode" }: {
  value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; disabled?: boolean; fingerprint?: () => void; autoFocus?: boolean; label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus && !disabled) input.current?.focus({ preventScroll: true }); }, [autoFocus, disabled]);

  function set(raw: string) {
    const next = raw.replace(/\D/g, "").slice(0, 6);
    onChange(next);
    if (next.length === 6 && next !== value) onComplete?.(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
      <label className="v4-pin-field" aria-label={`${label}, ${value.length} of 6 entered`}>
        <span className="v4-pin" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => <span key={i} className={i < value.length ? "v4-f" : i === value.length ? "v4-next" : undefined} />)}
        </span>
        <input
          ref={input}
          className="v4-pin-input"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          data-rg-reveal="off"
          enterKeyHint="go"
          maxLength={6}
          value={value}
          disabled={disabled}
          aria-label={`${label} — 6 numbers`}
          onChange={(e) => set(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") onChange(""); }}
        />
      </label>
      <span className="v4-help" style={{ fontSize: 12.5 }}>{value.length ? "Backspace removes a number." : "Tap the boxes and type your 6 numbers."}</span>
      {fingerprint ? <button type="button" className="v4-btn v4-btn-secondary" onClick={fingerprint} disabled={disabled}><Icon name="fingerprint" />Use fingerprint instead</button> : null}
    </div>
  );
}
