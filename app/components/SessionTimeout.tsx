"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const INACTIVITY_LIMIT_MS = 3 * 60 * 1000;
const WARNING_BEFORE_LOGOUT_MS = 30 * 1000;

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

export default function SessionTimeout() {
  const router = useRouter();
  const pathname = usePathname();

  const [warningVisible, setWarningVisible] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(30);

  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loggingOutRef = useRef(false);
  const warningVisibleRef = useRef(false);

  async function logoutDueToInactivity() {
    if (loggingOutRef.current) return;

    loggingOutRef.current = true;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      await supabase.auth.signOut();
    } finally {
      warningVisibleRef.current = false;
      setWarningVisible(false);
      setSecondsLeft(30);
      router.push("/login?reason=session-timeout");
      router.refresh();
    }
  }

  function resetActivityTimer() {
    if (loggingOutRef.current) return;

    lastActivityRef.current = Date.now();
    warningVisibleRef.current = false;
    setWarningVisible(false);
    setSecondsLeft(Math.ceil(WARNING_BEFORE_LOGOUT_MS / 1000));
  }

  function stayLoggedIn() {
    resetActivityTimer();
  }

  useEffect(() => {
    if (isPublicPath(pathname)) {
      warningVisibleRef.current = false;
      setWarningVisible(false);
      setSecondsLeft(Math.ceil(WARNING_BEFORE_LOGOUT_MS / 1000));

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      return;
    }

    loggingOutRef.current = false;
    lastActivityRef.current = Date.now();
    warningVisibleRef.current = false;
    setWarningVisible(false);
    setSecondsLeft(Math.ceil(WARNING_BEFORE_LOGOUT_MS / 1000));

    const activityEvents: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetActivityTimer, { passive: true });
    });

    timerRef.current = setInterval(() => {
      if (loggingOutRef.current) return;

      const inactiveFor = Date.now() - lastActivityRef.current;
      const timeLeftMs = INACTIVITY_LIMIT_MS - inactiveFor;

      if (timeLeftMs <= 0) {
        setSecondsLeft(0);
        logoutDueToInactivity();
        return;
      }

      if (timeLeftMs <= WARNING_BEFORE_LOGOUT_MS) {
        const nextSecondsLeft = Math.max(1, Math.ceil(timeLeftMs / 1000));

        if (!warningVisibleRef.current) {
          warningVisibleRef.current = true;
          setWarningVisible(true);
        }

        setSecondsLeft(nextSecondsLeft);
      } else {
        if (warningVisibleRef.current) {
          warningVisibleRef.current = false;
          setWarningVisible(false);
        }

        setSecondsLeft(Math.ceil(WARNING_BEFORE_LOGOUT_MS / 1000));
      }
    }, 1000);

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetActivityTimer);
      });

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (isPublicPath(pathname)) return null;
  if (!warningVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-3xl border bg-white p-6 shadow-2xl">
        <div className="text-xl font-extrabold text-slate-900">
          Session Timeout Warning
        </div>

        <p className="mt-3 text-base leading-7 text-slate-700">
          For security reasons, you will be logged out soon because your account has been inactive.
        </p>

        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
          <div className="text-xs font-black uppercase tracking-wide text-amber-700">
            Logging out in
          </div>
          <div className="mt-1 text-4xl font-black tabular-nums text-amber-900">
            {formatCountdown(secondsLeft)}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={logoutDueToInactivity}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100"
          >
            Logout Now
          </button>

          <button
            type="button"
            onClick={stayLoggedIn}
            className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
          >
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  );
}