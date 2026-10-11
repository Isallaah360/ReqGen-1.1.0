"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { roleDisplayName } from "@/lib/roles";
import { Btn, Card, Chip, Notice, PageHead, Pager, Skeleton, Tabs, V4Page, downloadCsv, naira, type ChipTone } from "@/app/components/v4/ui";

/** Approvals › Treated by Me (v4.1.0): every decision and signature by the signed-in officer. */

type Row = { kind: "request" | "voucher"; item_id: string; item_no: string | null; title: string | null; amount: number | null; action_type: string | null; acted_as: string | null; acted_at: string | null };
type Tab = "all" | "approved" | "returned" | "rejected" | "vouchers";

const PAGE = 20;

function decision(r: Row): { tab: Tab; label: string; tone: ChipTone } {
  const a = String(r.action_type || "").toLowerCase();
  if (r.kind === "voucher") return { tab: "vouchers", label: r.action_type || "Signed", tone: "green" };
  if (/reject/.test(a)) return { tab: "rejected", label: "Rejected", tone: "red" };
  if (/return|correct|query/.test(a)) return { tab: "returned", label: "Returned", tone: "amber" };
  return { tab: "approved", label: r.action_type || "Approved", tone: "green" };
}

function when(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (d.getTime() >= today.getTime()) return `Today ${time}`;
  if (d.getTime() >= today.getTime() - 86_400_000) return `Yesterday ${time}`;
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} ${time}`;
}

export default function TreatedByMePage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let alive = true;
    void supabase.rpc("reqgen_treated_by_me", { p_limit: 2000 }).then(({ data, error: e }) => {
      if (!alive) return;
      setError(e ? (/function|schema cache/i.test(e.message) ? "This page switches on after the Super Admin runs the v4.1.0 database step." : e.message) : null);
      setRows(e ? [] : (data || []) as Row[]);
    });
    return () => { alive = false; };
  }, []);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: 0, approved: 0, returned: 0, rejected: 0, vouchers: 0 };
    (rows || []).forEach((r) => { c.all += 1; c[decision(r).tab] += 1; });
    return c;
  }, [rows]);
  const shown = useMemo(() => (rows || []).filter((r) => tab === "all" || decision(r).tab === tab), [rows, tab]);
  const paged = shown.slice((page - 1) * PAGE, page * PAGE);

  return (
    <V4Page>
      <PageHead
        title="Treated by Me"
        sub="Every request and voucher you approved, returned, rejected or signed."
        actions={[{ label: "Export CSV", icon: "download", kind: "secondary", disabled: !shown.length, onClick: () => downloadCsv("Treated_by_me.csv", shown.map((r) => ({ When: when(r.acted_at), Item: r.item_no || "", Title: r.title || "", Amount: Number(r.amount || 0), Decision: decision(r).label, As: roleDisplayName(r.acted_as) }))) }]}
      />
      {error ? <Notice tone={rows && rows.length === 0 ? "amber" : "red"}>{error}</Notice> : null}
      <Card>
        <div style={{ padding: "0 12px" }}>
          <Tabs value={tab} onChange={(t) => { setTab(t); setPage(1); }} label="Show" items={[
            { key: "all", label: "All", count: counts.all },
            { key: "approved", label: "Approved", count: counts.approved },
            { key: "returned", label: "Returned", count: counts.returned },
            { key: "rejected", label: "Rejected", count: counts.rejected },
            { key: "vouchers", label: "Signed vouchers", count: counts.vouchers },
          ]} />
        </div>
        {rows === null ? <Skeleton lines={5} /> : shown.length ? (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th className="v4-hide-sm">When</th><th>Item</th><th className="v4-r">Amount</th><th>Decision</th><th className="v4-hide-sm">As</th><th className="v4-r">Action</th></tr></thead>
              <tbody>
                {paged.map((r, i) => {
                  const d = decision(r);
                  return (
                    <tr key={`${r.item_id}-${r.acted_at}-${i}`}>
                      <td className="v4-hide-sm">{when(r.acted_at)}</td>
                      <td><span className="v4-strong">{r.item_no || "—"}</span><span className="v4-sub">{r.title || (r.kind === "voucher" ? "Payment voucher" : "Request")}</span></td>
                      <td className="v4-r v4-num v4-strong">{r.amount ? naira(r.amount) : "—"}</td>
                      <td><Chip tone={d.tone}>{d.label}</Chip></td>
                      <td data-label="As" className="v4-hide-sm">{roleDisplayName(r.acted_as)}</td>
                      <td className="v4-r"><Btn small a={{ href: r.kind === "voucher" ? `/payment-vouchers/${r.item_id}` : `/requests/${r.item_id}`, label: "Open", kind: "secondary" }} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>Nothing here yet. Your approvals, returns, rejections and signatures will be listed here.</p>}
        <Pager page={page} pageSize={PAGE} total={shown.length} onPage={setPage} label="actions" />
      </Card>
    </V4Page>
  );
}
