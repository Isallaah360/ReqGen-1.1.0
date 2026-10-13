"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";

/**
 * ReqGen v4 — a form dialog (the mock-ups' "dialog"): dimmed page, card in
 * the middle, Escape or the cross closes it, focus stays inside while open.
 * For simple yes/no questions use confirmDialog / promptDialog (lib/dialog).
 */
export default function Modal({ open, title, sub, onClose, children, footer, wide, busy }: {
  open: boolean;
  title: string;
  sub?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  busy?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const before = useRef<HTMLElement | null>(null);
  // The latest onClose / busy, read by the key handler. Kept in refs so that a parent
  // re-render (e.g. each keystroke in a field) never re-runs the open effect — that
  // would move the focus back to the first field while the person is typing.
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => { closeRef.current = onClose; busyRef.current = busy; });

  useEffect(() => {
    if (!open) return;
    before.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      const first = box.current?.querySelector<HTMLElement>("input:not([type=hidden]):not([disabled]), textarea, button.v4-sel, select, [data-autofocus]");
      (first || box.current)?.focus();
    }, 20);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busyRef.current) {
        if (document.querySelector(".v4-sel-pop")) return; // a list is open: Escape closes the list first
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab" && box.current) {
        const items = Array.from(box.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])")).filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0]; const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      before.current?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="v4-ui v4-modal-layer">
      <div className="v4-backdrop v4-show" onClick={() => { if (!busy) onClose(); }} />
      <div ref={box} className={`v4-dialog v4-show v4-modal${wide ? " v4-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <div className="v4-modal-head">
          <div>
            <h2 className="v4-h2">{title}</h2>
            {sub ? <p className="v4-modal-sub">{sub}</p> : null}
          </div>
          <button type="button" className="v4-icon-btn v4-modal-x" onClick={onClose} disabled={busy} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="v4-modal-body">{children}</div>
        {footer ? <div className="v4-modal-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
