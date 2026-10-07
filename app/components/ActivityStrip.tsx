"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { subscribeActivity } from "@/lib/activity";

/**
 * v3.1.3 loading strip — sits directly BELOW the top bar, inside the app.
 * Shows whenever ReqGen is loading or saving (tracked requests) and briefly on
 * every page change. A 250 ms delay prevents flicker on instant responses.
 */
export default function ActivityStrip() {
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [nav, setNav] = useState(false);
  const timer = useRef<number | null>(null);
  const first = useRef(true);

  useEffect(() => subscribeActivity((b) => {
    if (timer.current) window.clearTimeout(timer.current);
    if (b) timer.current = window.setTimeout(() => setBusy(true), 250);
    else setBusy(false);
  }), []);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    queueMicrotask(() => setNav(true));
    const t = window.setTimeout(() => setNav(false), 650);
    return () => window.clearTimeout(t);
  }, [pathname]);

  const on = busy || nav;

  // v3.1.10: ONE loading bar. The IET stripe at the very top of the app comes
  // alive (animates) while ReqGen is loading; there is no second bar.
  useEffect(() => {
    document.documentElement.classList.toggle("rg-busy", on);
    return () => document.documentElement.classList.remove("rg-busy");
  }, [on]);

  return (
    <div className={`rg-activity-strip ${on ? "is-on" : ""}`} role="progressbar" aria-busy={on} aria-label="Loading" aria-hidden={!on}>
      <span />
    </div>
  );
}
