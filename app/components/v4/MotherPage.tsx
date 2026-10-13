"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { canAccessPath } from "@/lib/permissions";
import { ALL_MODULES } from "@/lib/v4/modules";
import { summaryFor, type Summary } from "@/lib/v4/summaries";
import { useIdentity } from "./useIdentity";
import { PageHead, Stats, Tiles, V4Page, type Action, type StatItem } from "./ui";

/** Page-head buttons per module (shown only when the person may open them). */
const ACTIONS: Record<string, Action[]> = {
  requests: [{ href: "/requests/new", label: "New request", icon: "plus", kind: "primary" }],
  finance: [
    { href: "/reports/finance-statements", label: "Finance statements", icon: "chart", kind: "secondary" },
    { href: "/finance/processing", label: "Treat requests", icon: "clock", kind: "primary" },
  ],
  "payment-vouchers": [
    { href: "/payment-vouchers/print-centre", label: "Print Centre", icon: "printer", kind: "secondary" },
    { href: "/payment-vouchers/new", label: "Generate voucher", icon: "plus", kind: "primary" },
  ],
  reports: [{ href: "/reports/transactions", label: "Transactions", icon: "trend", kind: "primary" }],
  registry: [
    { href: "/registry/incoming", label: "Record incoming", icon: "download", kind: "secondary" },
    { href: "/registry/outgoing", label: "Record outgoing", icon: "upload", kind: "primary" },
  ],
  audit: [{ href: "/audit-centre/logs", label: "Audit Log", icon: "list", kind: "primary" }],
  admin: [{ href: "/admin/users", label: "Add staff", icon: "plus", kind: "primary" }],
};

/**
 * A module's home ("mother page"): title, live summary, and one tile per
 * page. Tiles the acting position may not open are not shown at all.
 */
export default function MotherPage({ moduleKey, children, sub, before }: { moduleKey: string; children?: ReactNode; sub?: ReactNode; before?: ReactNode }) {
  const me = useIdentity();
  const mod = ALL_MODULES.find((m) => m.key === moduleKey)!;
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    if (!me.ready || !me.userId) return;
    let alive = true;
    void summaryFor(moduleKey, me.userId, me.role).then((s) => { if (alive) setSummary(s); });
    return () => { alive = false; };
  }, [me.ready, me.userId, me.role, moduleKey]);

  const allowed = (href: string) => me.ready && canAccessPath(href.split(/[?#]/)[0], me.roleSet);
  const tiles = useMemo(
    () => mod.tiles.filter((t) => allowed(t.href)).map((t) => {
      const badge = summary?.badges?.[t.href.split("#")[0]];
      return { ...t, meta: summary?.meta[t.href.split("#")[0]], badge: badge ? <span className="v4-chip v4-chip-red">{badge}</span> : undefined };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mod, me.ready, me.roleSet, summary],
  );
  const actions = (ACTIONS[moduleKey] || []).filter((a) => !a.href || allowed(a.href));
  const stats: StatItem[] = (summary?.stats || []).map((s) => ({ ...s, href: s.href && allowed(s.href) ? s.href : undefined }));

  return (
    <V4Page>
      <PageHead title={mod.label} sub={sub ?? mod.intro} actions={actions} />
      {before}
      {summary === null && me.ready ? <section className="v4-stats" aria-hidden="true">{[0, 1, 2].map((i) => <div key={i} className="v4-stat"><span className="v4-ico v4-t-blue" /><span style={{ flex: 1 }}><span className="v4-l">&nbsp;</span><span className="v4-v">…</span></span></div>)}</section> : <Stats items={stats} />}
      {tiles.length ? <Tiles items={tiles} label={`${mod.label} pages`} /> : null}
      {children}
    </V4Page>
  );
}
