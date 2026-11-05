"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * ReqGen v4.6.9 motion layer (screens only; no database change).
 *
 *   celebrate()      the green tick in the centre after a save, submit, approval or payment
 *   useCelebrate()   fires celebrate() when a page's success message appears
 *   <SavedHost />    draws the tick (mounted once, in the app frame)
 *   <CountUp />      counts a whole number up from nought (never used on money)
 *   <PointerGlow />  the soft light that follows the pointer on tiles and summary cards
 *   hijriDate(), tipOfDay()  for the welcome card
 *
 * Everything respects "reduce motion" on the device, and nothing moves in print.
 */

export const CELEBRATE_EVENT = "reqgen-celebrate";
export type Celebration = { title: string; line?: string; stamp?: boolean };

let lastAt = 0;

/** Show the green tick (or the IET stamp after a Director General approval). */
export function celebrate(c: Celebration) {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastAt < 1200) return; // one tick per action, even if two parts of the page report it
  lastAt = now;
  window.dispatchEvent(new CustomEvent<Celebration>(CELEBRATE_EVENT, { detail: c }));
}

/** A short heading for the tick, from the page's own success message. */
export function titleFor(text: string) {
  const t = text.toLowerCase();
  if (/withdrawn|removed|deleted|taken out|deactivated/.test(t)) return "Done successfully";
  if (/submitted|generated/.test(t)) return "Submitted successfully";
  if (/approved|stamped/.test(t)) return "Approved successfully";
  if (/paid|payment treated/.test(t)) return "Payment recorded";
  if (/sent back|returned/.test(t)) return "Sent back successfully";
  if (/signed|signature/.test(t)) return "Signed successfully";
  if (/sent|reminder|delivered|dispatched|forwarded/.test(t)) return "Sent successfully";
  if (/filed|archived|acknowledged|recorded/.test(t)) return "Recorded successfully";
  return "Details saved successfully";
}

// Green messages that are not the result of a save.
const NOT_A_SAVE = /^preview|press save|already|nothing changed|^copied|^downloaded|you are now acting/i;

/** Fires the tick when a page's success message (green, or a string starting with a tick) appears. */
export function useCelebrate(msg: { tone: string; text: string } | string | null | undefined) {
  useEffect(() => {
    if (!msg) return;
    let text: string;
    if (typeof msg === "string") {
      if (!msg.startsWith("\u2713")) return;
      text = msg.replace(/^\u2713\s*/, "");
    } else {
      if (msg.tone !== "green") return;
      text = msg.text;
    }
    if (!text || NOT_A_SAVE.test(text.trim())) return;
    celebrate({ title: titleFor(text), line: text });
  }, [msg]);
}

/** Draws the tick in the centre of the screen for about two seconds. Clicks pass through. */
export function SavedHost() {
  const [shown, setShown] = useState<(Celebration & { key: number }) | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { queueMicrotask(() => setMounted(true)); }, []);
  useEffect(() => {
    let t: number | null = null;
    const on = (e: Event) => {
      const c = (e as CustomEvent<Celebration>).detail;
      if (!c) return;
      setShown({ ...c, key: Date.now() });
      if (t) window.clearTimeout(t);
      t = window.setTimeout(() => setShown(null), c.stamp ? 2600 : 2100);
    };
    window.addEventListener(CELEBRATE_EVENT, on);
    return () => { window.removeEventListener(CELEBRATE_EVENT, on); if (t) window.clearTimeout(t); };
  }, []);
  if (!mounted || !shown) return null;
  return createPortal(
    <div key={shown.key} className={`v4-ui v4-saved${shown.stamp ? " v4-saved-stamp" : ""}`} role="status" aria-live="polite">
      {shown.stamp ? (
        <div className="v4-stamp" aria-hidden="true">
          <svg viewBox="0 0 120 120" width="132" height="132">
            <defs><path id="v4-stamp-ring" d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" /></defs>
            <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="4" />
            <circle cx="60" cy="60" r="34" fill="none" stroke="currentColor" strokeWidth="2" />
            <text fontSize="10.5" fontWeight="800" letterSpacing="2" fill="currentColor"><textPath href="#v4-stamp-ring">ISLAMIC EDUCATION TRUST · IET ·</textPath></text>
            <text x="60" y="57" textAnchor="middle" fontSize="12" fontWeight="900" fill="currentColor">APPROVED</text>
            <text x="60" y="72" textAnchor="middle" fontSize="9" fontWeight="700" fill="currentColor">DG</text>
          </svg>
          <svg className="v4-ink" viewBox="0 0 160 40" width="170" height="42"><path d="M6 28c14-18 22-20 26-8s8 12 16-4 14-14 16 2 10 8 20-6 18-6 22 4 14 6 26 0 20-6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
        </div>
      ) : (
        <div className="v4-saved-circle" aria-hidden="true">
          <svg width="50" height="50" viewBox="0 0 44 44"><path className="v4-saved-tick" d="M12 23l7 7 13-16" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      )}
      <b>{shown.title}</b>
      {shown.line ? <span>{shown.line}</span> : null}
    </div>,
    document.body,
  );
}

const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Counts a whole number up from nought when it first appears. Money is never counted up. */
export function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const first = useRef(true);
  useEffect(() => {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0 || reduced()) { queueMicrotask(() => setShown(value)); return; }
    const from = first.current ? 0 : shown;
    first.current = false;
    if (from === value) return;
    const start = performance.now();
    const dur = Math.min(900, 380 + Math.abs(value - from) * 25);
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate only when the target changes
  }, [value]);
  return <>{shown.toLocaleString("en-GB")}</>;
}

/** The soft light under the pointer on tiles and summary cards (one listener for the whole app). */
export function PointerGlow() {
  useEffect(() => {
    if (reduced() || !window.matchMedia?.("(hover: hover)").matches) return;
    const on = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.(".v4-tile, .v4-stat") as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--v4-mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--v4-my", `${e.clientY - r.top}px`);
    };
    document.addEventListener("pointermove", on, { passive: true });
    return () => document.removeEventListener("pointermove", on);
  }, []);
  return null;
}

const HIJRI_MONTHS = ["Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani", "Jumada al-Ula", "Jumada al-Akhirah", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qadah", "Dhu al-Hijjah"];

/** "25 Jumada al-Ula 1448 AH" (Umm al-Qura calendar, Nigerian time). Empty if the device cannot tell. */
export function hijriDate(d: Date) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB-u-ca-islamic-umalqura", { day: "numeric", month: "numeric", year: "numeric", timeZone: "Africa/Lagos" }).formatToParts(d);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value || 0);
    const day = get("day"), month = get("month"), year = get("year");
    if (!day || !month || !year || month > 12) return "";
    return `${day} ${HIJRI_MONTHS[month - 1]} ${year} AH`;
  } catch {
    return "";
  }
}

const TIPS = [
  "Press the bell to see what changed on your requests since you last looked.",
  "Drafts are kept for 60 days under Requests › My Requests › Drafts.",
  "Add a fingerprint in My Account › Security to sign with one touch.",
  "Every approval carries your saved signature, so keep it clear and current.",
  "The search box at the top finds a request by its number, title or requester.",
  "A request sent back to you keeps the officer's reason on its record. Read it before you correct it.",
  "You can switch between your positions with the position menu at the top.",
  "Choose Light, Dark or IET green in My Account › Appearance.",
];

/** One quiet tip a day, the same for everybody on that day. */
export function tipOfDay(d: Date) {
  const day = Math.floor(d.getTime() / 86_400_000);
  return TIPS[day % TIPS.length];
}
