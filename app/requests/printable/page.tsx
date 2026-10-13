"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { loadTier, monthName, scopeLabel, type Tier } from "@/lib/v4/reports";
import { downloadXlsx } from "@/lib/v4/xlsx";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { Select } from "@/app/components/v4/Select";
import { Btn, Card, Notice, PageHead, Pager, Skeleton, Tabs, V4Page } from "@/app/components/v4/ui";

type Row = { tab: "mine" | "treated_by_me" | "all_treated"; doc_kind: "request" | "voucher" | "report"; doc_id: string | null; doc_no: string; label: string; for_name: string; times_printed: number; last_printed: string | null; last_by: string | null; link: string };
type Tab = "mine" | "treated_by_me" | "all_treated";
const PAGE = 20;

/** Reports › Print Register (mock-up 65): every printed request, voucher and report — what, for whom, how many times and by whom. */
export default function PrintRegisterPage() {
  const me = useIdentity();
  const [tier, setTier] = useState<Tier | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("mine");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const [month, setMonth] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!me.ready) return;
    let alive = true;
    queueMicrotask(() => {
      void loadTier(me.role).then((t) => { if (alive) { setTier(t); if (t !== "mine") setTab("treated_by_me"); } });
      void supabase.rpc("reqgen_print_register_v4").then(async ({ data, error: e }) => {
        if (!alive) return;
        if (e && /could not find the function|schema cache/i.test(e.message)) {
          // before the v4.4.0 database step: the v3.1.9 register (requests only, no print counts)
          const old = await supabase.rpc("reqgen_print_register");
          setError(old.error ? `${old.error.message} — run database/v3_1_9_print_register_tracker.sql, then v4_4_0_reports.sql.` : null);
          setRows(((old.data || []) as Array<{ id: string; request_no: string; is_mine: boolean; treated_by_me: boolean; treated_by_accounts: boolean; treated_by_name: string | null; treated_at: string | null }>).map((r) => ({
            tab: r.is_mine ? "mine" : r.treated_by_me ? "treated_by_me" : "all_treated", doc_kind: "request", doc_id: r.id, doc_no: r.request_no, label: "Request letter", for_name: "", times_printed: 0, last_printed: null, last_by: null, link: `/requests/${r.id}/print`,
          })));
          return;
        }
        setError(e ? e.message : null);
        setRows(((data || []) as Row[]).map((r) => ({ ...r, times_printed: Number(r.times_printed || 0) })));
      });
    });
    return () => { alive = false; };
  }, [me.ready, me.role]);

  const count = (t: Tab) => (rows || []).filter((r) => (t === "all_treated" ? r.tab !== "mine" || tier === "all" : r.tab === t)).length;
  const months = useMemo(() => [...new Set((rows || []).map((r) => String(r.last_printed || "").slice(0, 7)).filter(Boolean))].sort().reverse(), [rows]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (rows || [])
      .filter((r) => (tab === "all_treated" ? r.tab !== "mine" || tier === "all" : r.tab === tab))
      .filter((r) => (kind === "all" || r.doc_kind === kind) && (month === "all" || String(r.last_printed || "").startsWith(month)) && (!t || `${r.doc_no} ${r.for_name} ${r.last_by}`.toLowerCase().includes(t)))
      .sort((a, b) => String(b.last_printed || "").localeCompare(String(a.last_printed || "")) || b.doc_no.localeCompare(a.doc_no));
  }, [rows, tab, kind, month, q, tier]);

  const tabs = [
    { key: "mine" as Tab, label: "Mine", count: count("mine") },
    ...(tier && tier !== "mine" ? [{ key: "treated_by_me" as Tab, label: "Treated by me", count: count("treated_by_me") }] : []),
    ...(tier && tier !== "mine" ? [{ key: "all_treated" as Tab, label: "All treated", count: count("all_treated") }] : []),
  ];

  function exportXlsx() {
    downloadXlsx("Print_Register", [{ name: "Print register", title: "ReqGen — Print register", rows: shown.map((r) => ({ Document: r.doc_no, Kind: r.label, For: r.for_name, "Times printed": r.times_printed, "Last printed": r.last_printed ? new Date(r.last_printed).toLocaleString("en-GB") : "", By: r.last_by || "" })) }]);
  }

  return (
    <V4Page>
      <PageHead title="Print Register" sub="Every printed request, voucher and report — what, for whom, how many times and by whom." scope={tier ? scopeLabel(tier, me.roleName) : undefined}
        actions={[{ label: "Export Excel", icon: "download", kind: "secondary", onClick: exportXlsx, disabled: !shown.length }]} />
      {error ? <Notice tone="amber">{error}</Notice> : null}
      <Card>
        <div style={{ padding: "0 12px" }}><Tabs value={tab} onChange={(t) => { setTab(t); setPage(1); }} label="Show" items={tabs} /></div>
        <div className="v4-toolbar v4-t3">
          <label className="v4-field v4-f-search"><span className="v4-flabel">Search</span><span className="v4-control"><Icon name="search" /><input className="v4-input" placeholder="Number, payee or name" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></span></label>
          <div className="v4-field"><span className="v4-flabel">Kind</span><Select size="compact" ariaLabel="Kind" value={kind} onChange={(v) => { setKind(v); setPage(1); }} options={[{ value: "all", label: "Requests, vouchers and reports" }, { value: "request", label: "Request letters" }, { value: "voucher", label: "Payment vouchers" }, { value: "report", label: "Reports" }]} /></div>
          <div className="v4-field"><span className="v4-flabel">Month printed</span><Select size="compact" ariaLabel="Month printed" value={month} onChange={(v) => { setMonth(v); setPage(1); }} options={[{ value: "all", label: "Any time" }, ...months.map((m) => ({ value: m, label: monthName(m) }))]} /></div>
        </div>
        {rows === null ? <Skeleton lines={6} /> : shown.length ? (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Document</th><th>For</th><th className="v4-r">Times printed</th><th className="v4-hide-sm">Last printed</th><th className="v4-hide-sm v4-hide-md">By</th><th className="v4-r">Print</th></tr></thead>
              <tbody>
                {shown.slice((page - 1) * PAGE, page * PAGE).map((r, i) => (
                  <tr key={`${r.doc_kind}-${r.doc_id || r.doc_no}-${i}`}>
                    <td><span className="v4-strong">{r.doc_no}</span><span className="v4-sub">{r.label}</span></td>
                    <td data-label="For">{r.for_name || "—"}</td>
                    <td className="v4-r v4-num">{r.times_printed}</td>
                    <td className="v4-hide-sm">{r.last_printed ? new Date(r.last_printed).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Not printed yet"}</td>
                    <td className="v4-hide-sm v4-hide-md">{r.last_by || "—"}</td>
                    <td className="v4-r">{r.link ? <Btn small a={{ href: r.link, label: "Print", icon: "printer", kind: "secondary" }} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>Nothing here yet.</p>}
        <Pager page={page} pageSize={PAGE} total={shown.length} onPage={setPage} label="documents" />
      </Card>
    </V4Page>
  );
}
