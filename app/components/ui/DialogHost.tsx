"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, HelpCircle, Info, PencilLine } from "lucide-react";
import { getActiveDialog, getServerDialog, settleDialog, subscribeDialogs, type DialogRequest } from "@/lib/dialog";

/**
 * ReqGen v3.1.5 — renders every confirm / alert / prompt requested through
 * lib/dialog.ts as one centred IET dialog. Mounted once in app/layout.tsx.
 */
export default function DialogHost() {
  const active = useSyncExternalStore(subscribeDialogs, getActiveDialog, getServerDialog);
  if (!active || typeof document === "undefined") return null;
  return createPortal(<DialogCard key={active.id} dialog={active} />, document.body);
}

function DialogCard({ dialog }: { dialog: DialogRequest }) {
  const [value, setValue] = useState(dialog.defaultValue || "");
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isPrompt = dialog.kind === "prompt";
  const isAlert = dialog.kind === "alert";
  const blocked = isPrompt && dialog.required && !value.trim();

  function cancel() {
    settleDialog(dialog.id, isPrompt ? null : false);
  }

  function accept() {
    if (blocked) return;
    settleDialog(dialog.id, isPrompt ? value : true);
  }

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => {
      if (isPrompt) inputRef.current?.focus();
      else confirmRef.current?.focus();
    }, 20);
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        settleDialog(dialog.id, dialog.kind === "prompt" ? null : dialog.kind === "alert");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [dialog.id, dialog.kind, isPrompt]);

  const Icon = isPrompt
    ? PencilLine
    : dialog.tone === "danger" || dialog.tone === "warning"
      ? AlertTriangle
      : dialog.tone === "success"
        ? CheckCircle2
        : isAlert
          ? Info
          : HelpCircle;

  return (
    <div className="rg-modal-backdrop rg-attention-backdrop rg-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isAlert) cancel(); }}>
      <section
        className={`rg-attention rg-dialog is-${dialog.tone}`}
        role={isAlert || dialog.tone === "danger" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={`rg-dialog-title-${dialog.id}`}
        aria-describedby={dialog.message ? `rg-dialog-msg-${dialog.id}` : undefined}
      >
        <span className="rg-attention-icon rg-dialog-icon" aria-hidden="true"><Icon size={22} /></span>
        <h2 id={`rg-dialog-title-${dialog.id}`}>{dialog.title}</h2>
        {dialog.message ? <p id={`rg-dialog-msg-${dialog.id}`}>{dialog.message}</p> : null}
        {dialog.details?.length ? (
          <ul className="rg-dialog-details">
            {dialog.details.map((line) => <li key={line}>{line}</li>)}
          </ul>
        ) : null}
        {isPrompt ? (
          <label className="rg-dialog-field">
            {dialog.label ? <span>{dialog.label}</span> : null}
            <input
              ref={inputRef}
              value={value}
              placeholder={dialog.placeholder}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); accept(); } }}
            />
          </label>
        ) : null}
        <div className="rg-attention-actions rg-dialog-actions">
          {!isAlert ? (
            <button type="button" className="rg-btn rg-btn-secondary" onClick={cancel}>{dialog.cancelLabel}</button>
          ) : null}
          <button
            ref={confirmRef}
            type="button"
            className={`rg-btn ${dialog.tone === "danger" ? "rg-btn-danger" : "rg-btn-primary"}`}
            onClick={accept}
            disabled={blocked}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
