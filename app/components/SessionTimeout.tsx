"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// v4.6: the Super Admin sets this in Administration › Security Centre (10, 15, 20 or 30 minutes).
const DEFAULT_LIMIT_MS = 15 * 60 * 1000;
const WARNING_BEFORE_LOGOUT_MS = 60 * 1000;
const ACTIVITY_STORAGE_KEY = "reqgen:last-activity-at";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/mfa",
  "/mfa/setup",
  "/app",
  "/console",
  "/credits",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/check/");
}

function formatCountdown(secondsLeft: number) {
  const safeSeconds = Math.max(0, Number(secondsLeft || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function readLastActivity() {
  if (typeof window === "undefined") return Date.now();
  const stored = Number(window.localStorage.getItem(ACTIVITY_STORAGE_KEY) || 0);
  return Number.isFinite(stored) && stored > 0 ? stored : Date.now();
}

export default function SessionTimeout() {
  const router = useRouter();
  const pathname = usePathname();

  const [warningVisible, setWarningVisible] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(
    Math.ceil(WARNING_BEFORE_LOGOUT_MS / 1000)
  );

  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loggingOutRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const lastEventWriteRef = useRef(0);
  const limitRef = useRef(DEFAULT_LIMIT_MS);

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    warningTimerRef.current = null;
    logoutTimerRef.current = null;
    countdownRef.current = null;
  }, []);

  const logoutDueToInactivity = useCallback(async () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    clearTimers();

    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (error) {
      console.error("Unable to complete inactivity logout:", error);
    } finally {
      setWarningVisible(false);
      setSecondsLeft(Math.ceil(WARNING_BEFORE_LOGOUT_MS / 1000));
      router.replace("/login?reason=session-timeout");
      router.refresh();
    }
  }, [clearTimers, router]);

  const startCountdown = useCallback(() => {
    if (loggingOutRef.current) return;
    setWarningVisible(true);

    const update = () => {
      const elapsed = Date.now() - lastActivityRef.current;
      const remaining = Math.max(0, limitRef.current - elapsed);
      setSecondsLeft(Math.ceil(remaining / 1000));
      if (remaining <= 0) void logoutDueToInactivity();
    };

    update();
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(update, 1000);
  }, [logoutDueToInactivity]);

  const scheduleTimers = useCallback(
    (activityAt: number) => {
      if (loggingOutRef.current) return;
      clearTimers();
      lastActivityRef.current = activityAt;

      const elapsed = Math.max(0, Date.now() - activityAt);
      const warningDelay = Math.max(
        0,
        limitRef.current - WARNING_BEFORE_LOGOUT_MS - elapsed
      );
      const logoutDelay = Math.max(0, limitRef.current - elapsed);

      if (logoutDelay <= 0) {
        void logoutDueToInactivity();
        return;
      }

      if (warningDelay <= 0) startCountdown();
      else warningTimerRef.current = setTimeout(startCountdown, warningDelay);

      logoutTimerRef.current = setTimeout(
        () => void logoutDueToInactivity(),
        logoutDelay
      );
    },
    [clearTimers, logoutDueToInactivity, startCountdown]
  );

  const recordActivity = useCallback(() => {
    if (loggingOutRef.current) return;
    const now = Date.now();

    // Avoid writing to localStorage for every mouse movement.
    if (now - lastEventWriteRef.current < 1000) return;
    lastEventWriteRef.current = now;

    window.localStorage.setItem(ACTIVITY_STORAGE_KEY, String(now));
    setWarningVisible(false);
    setSecondsLeft(Math.ceil(WARNING_BEFORE_LOGOUT_MS / 1000));
    scheduleTimers(now);
  }, [scheduleTimers]);

  useEffect(() => {
    if (isPublicPath(pathname)) {
      clearTimers();
      setWarningVisible(false);
      return;
    }

    loggingOutRef.current = false;
    const initialActivity = Math.max(readLastActivity(), Date.now());
    window.localStorage.setItem(ACTIVITY_STORAGE_KEY, String(initialActivity));
    scheduleTimers(initialActivity);
    let alive = true;
    void supabase.from("reqgen_security_rules").select("idle_minutes").eq("id", 1).maybeSingle().then(({ data }) => {
      const minutes = Number((data as { idle_minutes?: number } | null)?.idle_minutes || 0);
      if (!alive || ![10, 15, 20, 30].includes(minutes) || minutes * 60000 === limitRef.current) return;
      limitRef.current = minutes * 60000;
      scheduleTimers(readLastActivity());
    });

    const activityEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "scroll",
      "touchstart",
    ];

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== ACTIVITY_STORAGE_KEY || !event.newValue) return;
      const value = Number(event.newValue);
      if (Number.isFinite(value) && value > lastActivityRef.current) {
        setWarningVisible(false);
        scheduleTimers(value);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      // Browser timers can be throttled in background tabs. Recalculate from
      // the absolute activity timestamp so the warning is never skipped.
      scheduleTimers(readLastActivity());
    };

    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, recordActivity, { passive: true })
    );
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      alive = false;
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, recordActivity)
      );
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearTimers();
    };
  }, [clearTimers, pathname, recordActivity, scheduleTimers]);

  if (isPublicPath(pathname) || !warningVisible) return null;

  // v4.6.12 (Kit K15): the same rule, in a K2 dialog with a countdown ring.
  const total = Math.ceil(WARNING_BEFORE_LOGOUT_MS / 1000);
  const C = 2 * Math.PI * 20;
  const gone = Math.min(1, Math.max(0, (total - secondsLeft) / total));
  const minutes = Math.round(limitRef.current / 60000);
  return (
    <div className="rg-session-backdrop rg-attention-backdrop" role="presentation">
      <section className="rg-session-dialog k-idle" role="alertdialog" aria-modal="true" aria-labelledby="rg-session-title" aria-describedby="rg-session-desc">
        <svg className="k-ring" viewBox="0 0 48 48" aria-hidden="true">
          <circle className="k-ring-bg" cx="24" cy="24" r="20" fill="none" strokeWidth="4" />
          <circle className="k-ring-fg" cx="24" cy="24" r="20" fill="none" strokeWidth="4" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * gone} transform="rotate(-90 24 24)" />
          <text x="24" y="28" textAnchor="middle">{formatCountdown(secondsLeft)}</text>
        </svg>
        <h2 id="rg-session-title">Still there?</h2>
        <p id="rg-session-desc">For your security, ReqGen signs you out after {minutes} minutes without activity. Signing out in about {secondsLeft > 30 ? "1 minute" : `${secondsLeft} seconds`}.</p>
        <div className="rg-session-actions">
          <button type="button" className="rg-btn rg-btn-secondary" onClick={() => void logoutDueToInactivity()}>
            Sign out
          </button>
          <button type="button" className="rg-btn rg-btn-primary" onClick={recordActivity} autoFocus>
            Stay signed in
          </button>
        </div>
      </section>
    </div>
  );
}
