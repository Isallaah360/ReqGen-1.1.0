"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { canAccessPath } from "@/lib/permissions";
import { fyLabel, fyOfMonth, fyRange, loadTier, loadTransactions, addMonths, monthName, monthRange, nairaShort, pct, scopeLabel, thisMonth, type Tier } from "@/lib/v4/reports";
import { useIdentity } from "@/app/components/v4/useIdentity";
import { Notice, PageHead, Stats, Tiles, V4Page, type StatItem, type TileItem } from "@/app/components/v4/ui";

type Counts = { outNow: number; outBefore: number; reqs: number; approved: number; paid: number; paidAmt: number; budgetUsed: number; pace: number; atRisk: number; mine: number };

/** Reports — mother page (mock-up 57): one tile per report, shown by what the acting position may see. */
export default function ReportsHome() {
  const me = useIdentity();
  const [tier, setTier] = useState<Tier | null>(null);
  const [c, setC] = useState<Counts | null>(null);
  const month = thisMonth();
  const fy = fyOfMonth(month);

  useEffect(() => {
    if (!me.ready) return;
    let alive = true;
    (async () => {
      const t = await loadTier(me.role);
      if (!alive) return;
      setTier(t);
      const range = fyRange(fy);
      const [tx, rq, subs] = await Promise.all([
        loadTransactions(monthRange(addMonths(month, -1)).from, monthRange(month).to),
        supabase.rpc("reqgen_report_requests", { p_from: range.from, p_to: range.to }),
        t === "mine" ? Promise.resolve({ data: [] }) : supabase.from("subheads").select("approved_allocation,expenditure,reserved_amount,is_active").eq("is_active", true),
      ]);
      if (!alive) return;
      const out = tx.rows.filter((r) => r.kind === "out");
      const reqs = (rq.data || []) as Array<{ bucket: string; is_mine: boolean }>;
      const sh = (subs.data || []) as Array<{ approved_allocation: number | null; expenditure: number | null; reserved_amount: number | null }>;
      const alloc = sh.reduce((s, x) => s + Number(x.approved_allocation || 0), 0);
      const used = sh.reduce((s, x) => s + Number(x.expenditure || 0), 0);
      const monthsGone = Math.max(1, (Number(month.slice(5, 7)) + 3) % 12 + 1);
      setC({
        outNow: out.filter((r) => r.at.startsWith(month)).reduce((s, r) => s + r.amount, 0),
        outBefore: out.filter((r) => r.at.startsWith(addMonths(month, -1))).reduce((s, r) => s + r.amount, 0),
        reqs: reqs.length, approved: reqs.filter((r) => r.bucket === "approved").length,
        paid: new Set(out.map((r) => r.ref)).size, paidAmt: out.reduce((s, r) => s + r.amount, 0),
        budgetUsed: pct(used, alloc), pace: Math.round((monthsGone / 12) * 100),
        atRisk: sh.filter((x) => Number(x.approved_allocation || 0) > 0 && (Number(x.expenditure || 0) + Number(x.reserved_amount || 0)) / Number(x.approved_allocation) >= 0.9).length,
        mine: reqs.filter((r) => r.is_mine).length,
      });
    })();
    return () => { alive = false; };
  }, [me.ready, me.role, month, fy]);

  const allowed = (href: string) => me.ready && canAccessPath(href, me.roleSet);
  const tiles: TileItem[] = useMemo(() => {
    if (!tier) return [];
    const fyText = `FY ${fyLabel(fy)}`;
    const all: TileItem[] = tier === "mine" ? [
      { href: "/reports/transactions", title: "My Transactions", purpose: "Money paid to you or for your requests, with charts.", icon: "trend", tone: "brand", meta: c ? `${monthName(month, true)} · ${nairaShort(c.outNow)}` : undefined },
      { href: "/reports/requests", title: "My Requests", purpose: "Your requests by status and how long approval took.", icon: "file", tone: "blue", meta: c ? `${c.mine} this FY` : undefined },
      { href: "/requests/printable", title: "Print Register", purpose: "Your requests and their print history.", icon: "printer", tone: "blue", meta: "Mine" },
      { href: "/reports/registry", title: "Registry Reports", purpose: "Incoming, outgoing, dispatched and archived — counts only.", icon: "archive", tone: "blue" },
    ] : [
      { href: "/reports/transactions", title: "Transactions + Analysis", purpose: "Every naira in and out, month by month, with charts.", icon: "trend", tone: "brand", meta: c ? `${monthName(month, true)} · ${nairaShort(c.outNow)} out` : undefined },
      { href: "/reports/requests", title: "Request Reports", purpose: tier === "all" ? "Submitted, approved, returned and rejected, by department." : "Requests treated by Finance and Account.", icon: "file", tone: "blue", meta: c ? `${c.reqs} this FY` : undefined },
      { href: "/reports/finance-statements", title: "Finance Statements", purpose: "Monthly, annual and subhead statements, IET financial year.", icon: "landmark", tone: "green", meta: fyText },
      { href: "/reports/vouchers", title: "Voucher Reports", purpose: "Vouchers by mode and status, signing times, top payees.", icon: "card", tone: "brand" },
      { href: "/reports/registry", title: "Registry Reports", purpose: "Incoming, outgoing, dispatched and archived — counts only.", icon: "archive", tone: "blue" },
      { href: "/reports/enterprise-analytics", title: "Executive Analytics", purpose: "Budget pace, risk subheads and exceptions on one page.", icon: "alert", tone: "amber", meta: c ? `${c.atRisk} subhead${c.atRisk === 1 ? "" : "s"} at risk` : undefined, badge: c?.atRisk ? <span className="v4-chip v4-chip-red">{c.atRisk} risk{c.atRisk === 1 ? "" : "s"}</span> : undefined },
      { href: "/requests/printable", title: "Print Register", purpose: "What has been printed, by whom and how many times.", icon: "printer", tone: "blue", meta: tier === "all" ? "Mine · treated · all" : "Treated by me" },
      { href: "/reports/compliance", title: "Compliance", purpose: "Automatic checks on vouchers, signatures and security.", icon: "shield", tone: "green" },
    ];
    return all.filter((t) => allowed(t.href));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, c, me.ready, me.roleSet, month, fy]);

  const stats: StatItem[] = tier === "mine" ? [
    { label: `Paid to you in ${monthName(month, true)}`, value: c ? nairaShort(c.outNow) : "…", note: c ? `${nairaShort(c.outBefore)} last month` : undefined, icon: "wallet", tone: "brand" },
    { label: "My requests this FY", value: c ? c.mine : "…", note: c ? `${c.approved} approved` : undefined, icon: "file", tone: "blue" },
  ] : [
    { label: `Spent in ${monthName(month, true)}`, value: c ? nairaShort(c.outNow) : "…", note: c ? (c.outBefore ? `${c.outNow >= c.outBefore ? "+" : ""}${pct(c.outNow - c.outBefore, c.outBefore)}% on ${monthName(addMonths(month, -1), true)}` : "Vouchers paid") : undefined, icon: "trend", tone: "brand", href: "/reports/transactions" },
    { label: "Requests this FY", value: c ? c.reqs : "…", note: c ? `${c.approved} approved` : undefined, icon: "file", tone: "blue", href: "/reports/requests" },
    { label: "Vouchers paid", value: c ? c.paid : "…", note: c ? nairaShort(c.paidAmt) : undefined, icon: "check", tone: "green" },
    { label: "Budget used", value: c ? `${c.budgetUsed}%` : "…", note: c ? `Pace for ${Math.round((c.pace / 100) * 12)} month${Math.round((c.pace / 100) * 12) === 1 ? "" : "s"}: ${c.pace}%` : undefined, icon: "chart", tone: "amber" },
  ];

  return (
    <V4Page>
      <PageHead title="Reports" sub="Every report in one place. Each person sees only what they are allowed to see." scope={tier ? scopeLabel(tier, me.roleName) : undefined}
        actions={[{ label: tier === "mine" ? "My transactions" : "Transactions", icon: "trend", kind: "primary", href: "/reports/transactions" }]} />
      <Stats items={stats} />
      {tiles.length ? <Tiles items={tiles} label="Reports" /> : null}
      {tier === "finance" ? <Notice tone="blue">Account and Finance see finance reports for every department. Registry, Executive and Compliance reports are for the Super Admin and the Auditor{me.role === "dg" ? " (Executive Analytics also for the Director General)" : ""}.</Notice> : null}
      {tier === "mine" ? <Notice tone="blue">You see only your own requests and money paid to you. Subhead balances stay private.</Notice> : null}
    </V4Page>
  );
}
