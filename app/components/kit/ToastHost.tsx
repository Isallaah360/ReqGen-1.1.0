"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import Icon from "@/app/components/v4/Icon";
import { TOAST_CLEAR_EVENT, TOAST_EVENT, type Toast } from "@/lib/toast";

/**
 * ReqGen v4.6.12 (Kit K4): draws the centred toast. Enters with a fade and a
 * small rise (240 ms), leaves faster (180 ms). Reduced motion: it simply
 * appears and goes. Screen readers hear it once (role="status").
 */
export default function ToastHost() {
  const [t, setT] = useState<Toast | null>(null);
  const [mounted, setMounted] = useState(false);
  const timer = useRef<number | null>(null);
  const reduce = useReducedMotion();
  useEffect(() => { queueMicrotask(() => setMounted(true)); }, []);
  useEffect(() => {
    const on = (e: Event) => {
      const next = (e as CustomEvent<Toast>).detail;
      if (!next) return;
      setT(next);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setT(null), next.undo || next.tone === "error" ? 4000 : 2500);
    };
    const clear = () => setT(null);
    window.addEventListener(TOAST_EVENT, on);
    window.addEventListener(TOAST_CLEAR_EVENT, clear);
    return () => { window.removeEventListener(TOAST_EVENT, on); window.removeEventListener(TOAST_CLEAR_EVENT, clear); if (timer.current) window.clearTimeout(timer.current); };
  }, []);
  if (!mounted) return null;
  return createPortal(
    <div className="k-toast-host" aria-live="polite">
      <LazyMotion features={domAnimation} strict>
        <AnimatePresence>
          {t ? (
            <m.div
              key={t.id}
              className={`k-toast${t.tone === "error" ? " k-error" : ""}`}
              role="status"
              initial={reduce ? false : { opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.24, ease: [0.2, 0.9, 0.3, 1.1] } }}
              exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: 4, transition: { duration: 0.18, ease: "easeIn" } }}
            >
              <Icon name={t.tone === "error" ? "x" : t.tone === "info" ? "info" : "check"} />
              <span>{t.text}</span>
              {t.undo ? <button type="button" onClick={() => { t.undo?.(); setT(null); }}>{t.undoLabel || "Undo"}</button> : null}
            </m.div>
          ) : null}
        </AnimatePresence>
      </LazyMotion>
    </div>,
    document.body,
  );
}
