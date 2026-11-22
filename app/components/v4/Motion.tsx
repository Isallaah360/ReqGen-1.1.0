"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clearToast, toast } from "@/lib/toast";
import SuccessTick, { warmSuccessTick } from "@/app/components/kit/SuccessTick";

/**
 * ReqGen v4.6.9 motion layer (screens only; no database change).
 *
 *   celebrate()      the green tick in the centre after a save, submit, approval or payment
 *   useCelebrate()   fires celebrate() when a page's success message appears
 *   <SavedHost />    draws the K9 success moment, or the K4 toast for an ordinary save
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

// Real milestones get the K9 success moment; every other save gets the K4 toast.
const MILESTONE = /^(submitted successfully|approved successfully|approved and stamped|payment recorded|request sent|voucher paid)/i;

/**
 * v4.6.12 (Kit K9 and K4): draws the success moment in the centre for about
 * two seconds (clicks pass through). Only real milestones (request sent, an
 * approval, a payment) get the big tick; an ordinary save shows the centred
 * toast instead. After a Director General approval the IET stamp lands
 * beside the signature (scale 1.15 to 1, 300 ms, once). Print-outs are
 * never animated.
 */
export function SavedHost() {
  const [shown, setShown] = useState<(Celebration & { key: number }) | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { queueMicrotask(() => setMounted(true)); }, []);
  useEffect(() => {
    // Load the tick player quietly once the page has settled.
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const t0 = window.setTimeout(() => { if (w.requestIdleCallback) w.requestIdleCallback(() => void warmSuccessTick(), { timeout: 4000 }); else void warmSuccessTick(); }, 3000);
    return () => window.clearTimeout(t0);
  }, []);
  useEffect(() => {
    let t: number | null = null;
    let t2: number | null = null;
    const on = (e: Event) => {
      const c = (e as CustomEvent<Celebration>).detail;
      if (!c) return;
      if (!c.stamp && !MILESTONE.test(c.title)) {
        toast({ text: c.line && c.line.length < 120 ? c.line.replace(/^\u2713\s*/, "") : c.title });
        return;
      }
      clearToast();
      setLeaving(false);
      setShown({ ...c, key: Date.now() });
      if (t) window.clearTimeout(t);
      if (t2) window.clearTimeout(t2);
      const life = c.stamp ? 2600 : 2100;
      t = window.setTimeout(() => setLeaving(true), life - 160);
      t2 = window.setTimeout(() => setShown(null), life);
    };
    window.addEventListener(CELEBRATE_EVENT, on);
    return () => { window.removeEventListener(CELEBRATE_EVENT, on); if (t) window.clearTimeout(t); if (t2) window.clearTimeout(t2); };
  }, []);
  if (!mounted || !shown) return null;
  return createPortal(
    <div key={shown.key} className={`v4-ui k-success${leaving ? " k-out" : ""}`} role="status" aria-live="polite">
      <div className="k-success-in">
        {shown.stamp ? (
          <div className="k-stamp-moment" aria-hidden="true">
            <svg className="k-sig" viewBox="0 0 160 40"><path d="M6 28c14-18 22-20 26-8s8 12 16-4 14-14 16 2 10 8 20-6 18-6 22 4 14 6 26 0 20-6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
            <span className="k-line" />
            <small>Director General</small>
            {/* eslint-disable-next-line @next/next/no-img-element -- the IET stamp, the same file the print-out uses */}
            <img src="/v4/iet-stamp.png" alt="" />
          </div>
        ) : <SuccessTick />}
        <b>{shown.title}</b>
        {shown.line ? <span>{shown.line}</span> : null}
      </div>
    </div>,
    document.body,
  );
}

const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * v4.6.12 (Kit K10): counts a whole number up from nought once, when it is
 * first seen on screen (about 1.4 s, easing out). Later changes count from
 * the old number. Real numbers only; money is never counted up. Reduced
 * motion shows the final number at once. The width is reserved, so the
 * layout never shifts while it counts.
 */
export function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const el = useRef<HTMLSpanElement>(null);
  const seen = useRef(false);
  const from = useRef(0);
  useEffect(() => {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0 || reduced()) { queueMicrotask(() => setShown(value)); from.current = value; return; }
    let raf = 0;
    const run = () => {
      const start = performance.now();
      const a = from.current;
      if (a === value) { setShown(value); return; }
      const dur = 1400;
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        setShown(Math.round(a + (value - a) * eased));
        if (p < 1) raf = requestAnimationFrame(step);
        else from.current = value;
      };
      raf = requestAnimationFrame(step);
    };
    if (seen.current) { run(); return () => cancelAnimationFrame(raf); }
    queueMicrotask(() => setShown(0));
    const node = el.current;
    if (!node || typeof IntersectionObserver === "undefined") { seen.current = true; run(); return () => cancelAnimationFrame(raf); }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); seen.current = true; run(); }
    }, { threshold: 0.4 });
    io.observe(node);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value]);
  const final = Number.isFinite(value) ? value.toLocaleString("en-GB") : String(value);
  return (
    <span ref={el} className="k-ticker" style={{ display: "inline-grid" }}>
      <span style={{ gridArea: "1 / 1", visibility: "hidden" }} aria-hidden="true">{final}</span>
      <span style={{ gridArea: "1 / 1" }} aria-hidden="true">{shown.toLocaleString("en-GB")}</span>
      <span className="v4-sr-only">{final}</span>
    </span>
  );
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
