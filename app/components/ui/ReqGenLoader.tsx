"use client";

import { useEffect } from "react";
import { beginActivity, endActivity } from "@/lib/activity";

/**
 * Page-level loading state. It signals the IET loading strip under the top
 * bar and, since v4.6.11 (brief §4), shows grey shapes where the page's title,
 * summary cards and list will appear (no spinner).
 */
export default function ReqGenLoader({ title = "Loading" }: { title?: string; detail?: string; skeleton?: boolean }) {
  useEffect(() => { beginActivity(); return () => endActivity(); }, []);
  return (
    <div className="v4-ui rg-page-loading" role="status" aria-busy="true" aria-live="polite" style={{ padding: "24px 20px", display: "grid", gap: 16, maxWidth: 1100 }}>
      <span className="v4-sr-only">{title}</span>
      <div aria-hidden="true" style={{ display: "grid", gap: 16 }}>
        <span className="v4-sk" style={{ height: 26, width: "38%" }} />
        <span className="v4-sk" style={{ height: 12, width: "56%" }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          {[0, 1, 2, 3].map((i) => <span key={i} className="v4-sk" style={{ height: 92, borderRadius: 18 }} />)}
        </div>
        <span className="v4-sk" style={{ height: 260, borderRadius: 18 }} />
      </div>
    </div>
  );
}
