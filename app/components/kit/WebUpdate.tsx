"use client";

import { useEffect, useState } from "react";
import Icon from "@/app/components/v4/Icon";
import { REQGEN_SEMVER } from "@/lib/version";

/**
 * ReqGen v4.6.12 (Kit K3, website): when a newer ReqGen goes live while a
 * page is open, a small box says "New version vX.Y.Z is ready" with Refresh.
 * Checked when the tab comes back into view and every 15 minutes. It never
 * reloads on its own, so nothing being typed is lost. The app shows the live
 * site, so the same box covers it.
 */
const newer = (a: string, b: string) => {
  const x = a.split(".").map(Number), y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); }
  return false;
};

export default function WebUpdate() {
  const [ready, setReady] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = 0;
    const check = async () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 60_000) return;
      last = Date.now();
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { version?: string };
        if (j.version && newer(j.version, REQGEN_SEMVER)) setReady(j.version);
      } catch { /* offline: try later */ }
    };
    const first = window.setTimeout(() => void check(), 20_000);
    const every = window.setInterval(() => void check(), 15 * 60_000);
    document.addEventListener("visibilitychange", check);
    return () => { window.clearTimeout(first); window.clearInterval(every); document.removeEventListener("visibilitychange", check); };
  }, []);
  if (!ready || hidden) return null;
  return (
    <div className="v4-ui k-webupdate" role="status">
      <span>New version v{ready} is ready.</span>
      <button className="v4-btn v4-btn-primary" type="button" onClick={() => window.location.reload()}><Icon name="returned" />Refresh</button>
      <button className="k-webupdate-x" type="button" aria-label="Not now" onClick={() => setHidden(true)}><Icon name="cross" /></button>
    </div>
  );
}
