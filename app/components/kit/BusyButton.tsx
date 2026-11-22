"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * ReqGen v4.6.12 (Kit K5): a button that keeps its width, shows a small
 * spinner and the busy word, and ignores a second tap while busy. The only
 * place a spinner is allowed. The usual words stay in place, invisible,
 * so the button never changes size.
 */
export default function BusyButton({ busy, busyText, children, className = "v4-btn v4-btn-primary", disabled, onClick, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { busy: boolean; busyText: string; children: ReactNode }) {
  return (
    <button {...rest} className={`${className} k-busy`} disabled={disabled} aria-busy={busy || undefined}
      onClick={(e) => { if (busy) { e.preventDefault(); return; } onClick?.(e); }}>
      <span className="k-busy-face" aria-hidden={busy || undefined} style={busy ? { visibility: "hidden" } : undefined}>{children}</span>
      {busy ? (
        <span className="k-busy-over">
          <svg className="k-spin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="40 20" strokeLinecap="round" /></svg>
          {busyText}
        </span>
      ) : null}
    </button>
  );
}
