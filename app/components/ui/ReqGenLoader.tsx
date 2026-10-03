"use client";

import { useEffect } from "react";
import { beginActivity, endActivity } from "@/lib/activity";

/**
 * v3.1.3: page-level loading state. It signals the single IET loading strip
 * under the top bar (ActivityStrip) and reserves calm empty space — one
 * loading indicator everywhere in ReqGen.
 */
export default function ReqGenLoader({ title = "Loading…" }: { title?: string; detail?: string; skeleton?: boolean }) {
  useEffect(() => { beginActivity(); return () => endActivity(); }, []);
  return <div className="rg-page-loading" role="status" aria-live="polite"><span className="sr-only">{title}</span></div>;
}
