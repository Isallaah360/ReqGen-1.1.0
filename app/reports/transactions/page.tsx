"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { nairaExact } from "@/lib/v4/money";
import { addMonths, loadTier, loadTransactions, monthName, monthRange, scopeLabel, thisMonth, type Tier, type TxRow } from "@/lib/v4/reports";
import { downloadXlsx } from "@/lib/v4/xlsx";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { Select } from "@/app/components/v4/Select";
import { Card, Notice, PageHead, Pager, Skeleton, V4Page } from "@/app/components/v4/ui";

type Show = "all" | "out" | "in" | "transfer" | "pending";
type Line = { key: string; kind: TxRow["kind"]; at: string; ref: string; title: string; sub: string; amount: number; status: string; link?: string };
const PAGE = 25;

export default function TransactionsReportPage() {
  return <Suspense fallback={<V4Page><Skeleton lines={8} /></V4Page>}><Transactions /></Suspense>;
}

/** Reports › Transactions (mock-up 58): every naira in and out, like a bank app. */
function Transactions() {
  const me = useIdentity();
  const router = useRouter();
  const params = useSearchParams();
  const [tier, setTier] = useState<Tier | null>(null);
  const [month, setMonth] = useState(() => (/^\d{4}-\d{2}$/.test(params.get("month") || "") ? String(params.get("month")) : thisMonth()));
  const [dept, setDept] = useState("all");
  const [show, setShow] = useState<Show>("all");
  const [rows, setRows] = useState<TxRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setRows(null);
    const r = monthRange(month);
    const res = await loadTransactions(r.from, r.to);
    setError(res.error); setRows(res.rows);
  }, [month]);
  useEffect(() => { if (me.ready) queueMicrotask(() => { void loadTier(me.role).then(setTier); void load(); }); }, [me.ready, me.role, load]);

  // one line per voucher (its requests are added together), newest first
  const lines: Line[] = useMemo(() => {
    const m = new Map<string, Line & { depts: Set<string> }>();
    (rows || []).filter((r) => dept === "all" || r.dept_name === dept).forEach((r, i) => {
      const k = r.voucher_id ? `${r.kind}-${r.voucher_id}` : `${r.kind}-${r.ref}-${i}`;
      const prev = m.get(k);
      if (prev) { prev.amount += r.amount; if (r.dept_name) prev.depts.add(r.dept_name); return; }
      const time = new Date(r.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      const sub = r.kind === "out" || r.kind === "pending"
        ? [r.detail, r.subhead_code, r.mode, time].filter(Boolean).join(" · ")
        : [r.detail, time].filter(Boolean).join(" · ");
      m.set(k, { key: k, kind: r.kind, at: r.at, ref: r.ref, title: r.voucher_id ? `${r.ref} · ${r.title}` : r.title, sub, amount: r.amount, status: r.status,
        link: r.voucher_id && tier !== "mine" ? `/payment-vouchers/${r.voucher_id}` : r.kind === "transfer" ? `/finance/account-transfers?q=${r.ref}` : undefined, depts: new Set(r.dept_name ? [r.dept_name] : []) });
    });
    return [...m.values()].sort((a, b) => b.at.localeCompare(a.at));
  }, [rows, dept, tier]);

  const out = lines.filter((l) => l.kind === "out");
  const inn = lines.filter((l) => l.kind === "in" || l.kind === "transfer");
  const pend = lines.filter((l) => l.kind === "pending");
  const sum = (l: Line[]) => l.reduce((t, x) => t + x.amount, 0);
  const shown = lines.filter((l) => show === "all" || (show === "in" ? l.kind === "in" || l.kind === "transfer" : l.kind === show));
  const paged = shown.slice((page - 1) * PAGE, page * PAGE);
  const days = paged.reduce<Array<{ day: string; items: Line[] }>>((acc, l) => {
    const d = l.at.slice(0, 10);
    if (acc.length && acc[acc.length - 1].day === d) acc[acc.length - 1].items.push(l); else acc.push({ day: d, items: [l] });
    return acc;
  }, []);
  const depts = useMemo(() => [...new Set((rows || []).map((r) => r.dept_name).filter(Boolean))].sort(), [rows]);
  const mine = tier === "mine";

  function exportXlsx() {
    downloadXlsx(`Transactions_${month}`, [{ name: monthName(month), title: `ReqGen — Transactions, ${monthName(month)}${dept !== "all" ? ` · ${dept}` : ""}`, rows: shown.map((l) => ({
      Date: l.at.slice(0, 10), Reference: l.ref, Details: `${l.title} — ${l.sub}`, "Money out": l.kind === "out" || l.kind === "pending" ? l.amount : null,
      "Money in": l.kind === "in" || l.kind === "transfer" ? l.amount : null, Status: l.status,
    })) }]);
  }

  return (
    <V4Page>
      <PageHead title={mine ? "My Transactions" : "Transactions"} sub={mine ? "Money paid to you or for your requests. Pick a month; tap a line to open it." : "Every naira in and out, like a bank app. Pick a month; tap a line to open it."}
        scope={tier ? scopeLabel(tier, me.roleName) : undefined}
        actions={[
          { label: "Analysis", icon: "chart", kind: "primary", href: `/reports/analysis?month=${month}` },
          { label: "Export Excel", icon: "download", kind: "secondary", onClick: exportXlsx, disabled: !shown.length },
          ...(mine ? [] : [{ label: "Print A4", icon: "printer", kind: "secondary" as const, href: `/reports/print?report=monthly&month=${month}` }]),
        ]} />
      {error ? <Notice tone="red">{error}</Notice> : null}
      <Card>
        <div className="v4-toolbar" style={{ alignItems: "center" }}>
          <span className="v4-monthpick" aria-label="Month">
            <button type="button" aria-label="Previous month" onClick={() => { setMonth(addMonths(month, -1)); setPage(1); }}><Icon name="left" /></button>
            <b>{monthName(month)}</b>
            <button type="button" aria-label="Next month" disabled={month >= thisMonth()} onClick={() => { setMonth(addMonths(month, 1)); setPage(1); }}><Icon name="right" /></button>
          </span>
          {!mine ? <div className="v4-field" style={{ minWidth: 200 }}><Select size="compact" ariaLabel="Department" value={dept} onChange={(v) => { setDept(v); setPage(1); }} options={[{ value: "all", label: "All departments" }, ...depts.map((d) => ({ value: d, label: d }))]} /></div> : null}
        </div>
        <div className="v4-txsum">
          <div><div className="v4-l">{mine ? "Paid to you" : "Money out"}</div><div className="v4-v">{rows ? nairaExact(sum(out)) : "…"}</div><div className="v4-n">{out.length} voucher{out.length === 1 ? "" : "s"} paid</div></div>
          <div><div className="v4-l">Money in</div><div className="v4-v v4-credit">{rows ? nairaExact(sum(inn)) : "…"}</div><div className="v4-n">{mine ? "Not shown for staff" : "Allocations and transfers"}</div></div>
          <div><div className="v4-l">Still to pay</div><div className="v4-v">{rows ? nairaExact(sum(pend)) : "…"}</div><div className="v4-n">{pend.length} voucher{pend.length === 1 ? "" : "s"} ready</div></div>
        </div>
        <div className="v4-fchips" role="group" aria-label="Show">
          {([["all", "All"], ["out", "Money out"], ["in", "Money in"], ["transfer", "Transfers"], ["pending", "Pending"]] as Array<[Show, string]>).filter(([k]) => !mine || k === "all" || k === "out" || k === "pending").map(([k, l]) => (
            <button key={k} type="button" aria-pressed={show === k} onClick={() => { setShow(k); setPage(1); }}>{l}</button>
          ))}
        </div>
        {rows === null ? <Skeleton lines={6} /> : days.length ? days.map((d) => {
          const o = d.items.filter((l) => l.kind === "out" || l.kind === "pending").reduce((t, l) => t + l.amount, 0);
          const i = d.items.filter((l) => l.kind === "in" || l.kind === "transfer").reduce((t, l) => t + l.amount, 0);
          return (
            <div key={d.day}>
              <div className="v4-day v4-split2"><span>{new Date(`${d.day}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</span><span>Out {nairaExact(o).replace(".00", "")} · In {nairaExact(i).replace(".00", "")}</span></div>
              <ul className="v4-rows">
                {d.items.map((l) => {
                  const credit = l.kind === "in" || l.kind === "transfer";
                  return (
                    <li key={l.key} className={l.link ? "v4-click" : undefined} onClick={l.link ? () => router.push(l.link!) : undefined} onKeyDown={l.link ? (e) => { if (e.key === "Enter") router.push(l.link!); } : undefined} tabIndex={l.link ? 0 : undefined} role={l.link ? "link" : undefined}>
                      <span className={`v4-ri v4-round v4-t-${credit ? "green" : l.kind === "pending" ? "blue" : "amber"}`}><Icon name={credit ? "download" : l.kind === "pending" ? "clock" : "upload"} /></span>
                      <span className="v4-rt"><strong>{l.title}</strong><span>{l.sub}</span></span>
                      <span className="v4-rr"><span className="v4-stack"><span className={`v4-amt${credit ? " v4-credit" : ""}`}>{credit ? "+" : "−"}{nairaExact(l.amount)}</span><span className={`v4-st${l.kind === "pending" ? " v4-wait" : ""}`}>{l.status}</span></span></span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        }) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>Nothing {show === "all" ? "" : "of this kind "}in {monthName(month)}.</p>}
        <Pager page={page} pageSize={PAGE} total={shown.length} onPage={setPage} label={`lines in ${monthName(month, true)}`} />
      </Card>
    </V4Page>
  );
}
