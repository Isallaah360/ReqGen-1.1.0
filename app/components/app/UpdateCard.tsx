"use client";

import { useEffect, useState } from "react";
import Icon from "@/app/components/v4/Icon";
import { APP_UPDATE_EVENT, type AppRelease } from "@/lib/app/update";

/** ReqGen v4.6.11 — Home: "New update available" (app only). */
export default function UpdateCard() {
  const [release, setRelease] = useState<AppRelease | null>(null);
  useEffect(() => {
    queueMicrotask(() => setRelease((window as unknown as { __reqgenUpdate?: AppRelease | null }).__reqgenUpdate || null));
    const on = (e: Event) => setRelease(((e as CustomEvent).detail as AppRelease | null) || null);
    window.addEventListener(APP_UPDATE_EVENT, on);
    return () => window.removeEventListener(APP_UPDATE_EVENT, on);
  }, []);
  if (!release) return null;
  return (
    <button type="button" className="v4-ui v4-update-card" onClick={() => window.dispatchEvent(new Event("reqgen-open-update"))}>
      <span className="v4-me-ic"><Icon name="download" /></span>
      <span style={{ flex: 1, textAlign: "left" }}><b>New update available</b><small>ReqGen {release.version}{release.size ? `, ${release.size}` : ""}</small></span>
      <b className="v4-update-go">Update</b>
    </button>
  );
}
