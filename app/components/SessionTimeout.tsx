"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const INACTIVITY_LIMIT_MS = 15 * 60 * 1000;
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
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.includes(pathname);
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
      const remaining = Math.max(0, INACTIVITY_LIMIT_MS - elapsed);
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
        INACTIVITY_LIMIT_MS - WARNING_BEFORE_LOGOUT_MS - elapsed
      );
      const logoutDelay = Math.max(0, INACTIVITY_LIMIT_MS - elapsed);

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
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, recordActivity)
      );
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearTimers();
    };
  }, [clearTimers, pathname, recordActivity, scheduleTimers]);

  if (isPublicPath(pathname) || !warningVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-md">
      <div className="w-full max-w-[430px] overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-2xl">
        <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-cyan-800 px-5 py-4 text-white">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
            Security Session Notice
          </div>
          <div className="mt-1 text-xl font-black">Session timeout warning</div>
          <p className="mt-2 text-sm font-semibold leading-6 text-blue-100">
            No activity has been detected. ReqGen will sign you out unless you continue your session.
          </p>
        </div>

        <div className="p-5">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-center">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
              Automatic logout in
            </div>
            <div className="mt-1 text-4xl font-black tabular-nums text-amber-950">
              {formatCountdown(secondsLeft)}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void logoutDueToInactivity()}
              className="reqgen-btn reqgen-btn-rose w-full"
            >
              Logout Now
            </button>
            <button
              type="button"
              onClick={recordActivity}
              className="reqgen-btn reqgen-btn-blue w-full"
            >
              Stay Logged In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
