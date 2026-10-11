"use client";

import { useEffect, useRef } from "react";

/**
 * Six code boxes (v4). Typing moves to the next box, Backspace moves back,
 * pasting a whole code fills every box; onComplete fires on the sixth digit.
 */
export default function OtpBoxes({ value, onChange, onComplete, disabled, autoFocus, label = "6-digit code", align = "center" }: {
  value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; disabled?: boolean; autoFocus?: boolean; label?: string; align?: "center" | "start";
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  useEffect(() => { if (autoFocus) refs.current[0]?.focus(); }, [autoFocus]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || "");

  const set = (next: string) => {
    const clean = next.replace(/\D/g, "").slice(0, 6);
    onChange(clean);
    if (clean.length === 6) onComplete?.(clean);
  };

  return (
    <div className="v4-otp" role="group" aria-label={label} style={align === "start" ? { justifyContent: "flex-start" } : undefined}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1}`}
          maxLength={6}
          value={d}
          disabled={disabled}
          onChange={(e) => {
            const typed = e.target.value.replace(/\D/g, "");
            if (!typed) { set(value.slice(0, i) + value.slice(i + 1)); return; }
            if (typed.length > 1) { set((value.slice(0, i) + typed).slice(0, 6)); refs.current[Math.min(5, i + typed.length)]?.focus(); return; }
            const arr = digits.slice(); arr[i] = typed; set(arr.join(""));
            if (i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i] && i > 0) { refs.current[i - 1]?.focus(); set(value.slice(0, i - 1) + value.slice(i)); e.preventDefault(); }
            if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => { const t = e.clipboardData.getData("text").replace(/\D/g, ""); if (t) { e.preventDefault(); set(t); refs.current[Math.min(5, t.length - 1)]?.focus(); } }}
        />
      ))}
    </div>
  );
}
