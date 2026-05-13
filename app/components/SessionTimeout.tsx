"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const INACTIVITY_LIMIT_MS = 3 * 60 * 1000;
const WARNING_BEFORE_LOGOUT_MS = 30 * 1000;

const PUBLIC_PATHS = ["/", "/login", "/signup", "/forgot-password", "/reset-password", "/mfa", "/mfa/setup"];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return false;
}

export default function SessionTimeout() {
  const router = useRouter();
  const pathname = usePathname();

  const [warningVisible, setWarningVisible] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(30);

  const lastActivityRef = useRef<number>(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loggingOutRef = useRef(false);

  async function logoutDueToInactivity() {
    if (loggingOutRef.current) return;

    loggingOutRef.current = true;

    try {
      await supabase.auth.signOut();
    } finally {
      setWarningVisible(false);
      router.push("/login?reason=session-timeout");
      router.refresh();
    }
  }

  function resetActivityTimer() {
    if (loggingOutRef.current) return;

    lastActivityRef.current = Date.now();
    setWarningVisible(false);
    setSecondsLeft(30);

    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }

  function stayLoggedIn() {
    resetActivityTimer();
  }

  useEffect(() => {
    if (isPublicPath(pathname)) {
      setWarningVisible(false);
      return;
    }

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

    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const inactiveFor = now - lastActivityRef.current;
      const timeLeft = INACTIVITY_LIMIT_MS - inactiveFor;

      if (timeLeft <= 0) {
        logoutDueToInactivity();
        return;
      }

      if (timeLeft <= WARNING_BEFORE_LOGOUT_MS && !warningVisible) {
        setWarningVisible(true);
        setSecondsLeft(Math.max(1, Math.ceil(timeLeft / 1000)));

        if (!countdownRef.current) {
          countdownRef.current = setInterval(() => {
            const currentTimeLeft = INACTIVITY_LIMIT_MS - (Date.now() - lastActivityRef.current);

            if (currentTimeLeft <= 0) {
              logoutDueToInactivity();
              return;
            }

            setSecondsLeft(Math.max(1, Math.ceil(currentTimeLeft / 1000)));
          }, 1000);
        }
      }
    }, 1000);

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetActivityTimer);
      });

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, warningVisible]);

  if (isPublicPath(pathname)) return null;

  if (!warningVisible) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-3xl border bg-white p-6 shadow-2xl">
        <div className="text-xl font-extrabold text-slate-900">Session Timeout Warning</div>

        <p className="mt-3 text-base leading-7 text-slate-700">
          For security reasons, you will be logged out soon because your account has been inactive.
        </p>

        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-lg font-extrabold text-amber-900">
          Logging out in {minutes}:{String(seconds).padStart(2, "0")}
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