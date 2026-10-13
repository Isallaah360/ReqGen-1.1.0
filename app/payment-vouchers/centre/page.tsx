"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { normalizeRole } from "@/lib/roles";
import { fyOf } from "@/lib/v4/finance";
import { shortDate } from "@/lib/v4/requestText";
import { pvAmount, pvChip, pvInSigning, pvNowWith, pvStage, isManual, type Voucher } from "@/lib/v4/vouchers";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { Select } from "@/app/components/v4/Select";
import { Btn, Card, Chip, Notice, PageHead, Pager, Skeleton, Stats, Tabs, V4Page, downloadCsv, naira, type StatItem } from "@/app/components/v4/ui";

type Tab = "all" | "signing" | "ready" | "paid" | "cancelled";
const PAGE = 15;
const fyText = (y: number) => `${y}/${String((y + 1) % 100).padStart(2, "0")}`;

export default function VoucherCentrePage() {
  return <Suspense fallback={<V4Page><Skeleton lines={6} /></V4Page>}><VoucherCentre /></Suspense>;
}

/** Payment Vouchers › Voucher Centre (mock-up 47): every voucher in one list. */
function VoucherCentre() {
  const me = useIdentity();
  const params = useSearchParams();
  const role = normalizeRole(me.role);
  const canPrepare = ["account", "accounts", "accountofficer", "admin"].includes(role);
  const [rows, setRows] = useState<Voucher[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(() => (["signing", "ready", "paid", "cancelled"].includes(params.get("tab") || "") ? (params.get("tab") as Tab) : "all"));
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");
  const [mode, setMode] = useState("all");
  const [fy, setFy] = useState(fyOf());
  const [page, setPage] = useState(1);
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    let res = await supabase.rpc("reqgen_pv_list");
    if (res.error && /could not find the function|schema cache/i.test(res.error.message)) res = await supabase.rpc("get_payment_vouchers");
    setError(res.error ? res.error.message : null);
    setRows(res.error ? [] : ((res.data || []) as Voucher[]));
  }, []);
  useEffect(() => { if (me.ready) queueMicrotask(() => { void load(); }); }, [me.ready, load]);

  const inYear = useMemo(() => (rows || []).filter((v) => fyOf(new Date(v.created_at || now)) === fy), [rows, fy, now]);
  const depts = useMemo(() => [...new Set(inYear.map((v) => v.dept_name).filter(Boolean) as string[])].sort(), [inYear]);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return inYear.filter((v) =>
      (dept === "all" || v.dept_name === dept) && (mode === "all" || (v.disbursement_mode || "Transfer") === mode) &&
      (!t || `${v.voucher_no} ${v.payee_name} ${v.narration} ${v.request_no}`.toLowerCase().includes(t)));
  }, [inYear, q, dept, mode]);
  const byTab = (t: Tab) => filtered.filter((v) => t === "all" || (t === "signing" ? pvInSigning(v.status) || pvStage(v.status) === "returned" : t === "ready" ? pvStage(v.status) === "ready" : t === "paid" ? pvStage(v.status) === "paid" : pvStage(v.status) === "cancelled"));
  const shown = byTab(tab);
  const paged = shown.slice((page - 1) * PAGE, page * PAGE);
  const sum = (l: Voucher[]) => l.reduce((t, v) => t + pvAmount(v), 0);
  const signing = byTab("signing");
  const late = signing.filter((v) => now - new Date(v.updated_at || v.created_at || now).getTime() > 3 * 86400000).length;

  const stats: StatItem[] = [
    { label: "All vouchers", value: rows ? filtered.length : "…", note: rows ? naira(sum(filtered)) : undefined, icon: "card", tone: "blue", pressed: tab === "all", onClick: () => { setTab("all"); setPage(1); } },
    { label: "In signing", value: rows ? signing.length : "…", note: late ? `${late} waiting 3+ days` : "On time", icon: "pen", tone: "amber", pressed: tab === "signing", onClick: () => { setTab("signing"); setPage(1); } },
    { label: "Ready to pay", value: rows ? byTab("ready").length : "…", note: rows ? naira(sum(byTab("ready"))) : undefined, icon: "wallet", tone: "blue", pressed: tab === "ready", onClick: () => { setTab("ready"); setPage(1); } },
    { label: "Paid", value: rows ? byTab("paid").length : "…", note: rows ? naira(sum(byTab("paid"))) : undefined, icon: "check", tone: "green", pressed: tab === "paid", onClick: () => { setTab("paid"); setPage(1); } },
  ];

  function exportCsv() {
    downloadCsv(`Vouchers_FY_${fyText(fy).replace("/", "-")}.csv`, shown.map((v) => ({
      Voucher: v.voucher_no || "", Date: shortDate(v.created_at), Payee: v.payee_name || "", Narration: v.narration || "", Department: v.dept_name || "",
      Mode: v.disbursement_mode || "", Amount: pvAmount(v), Status: pvChip(v.status).label, "Now with": pvNowWith(v), "Prepared as": v.prepared_section || "",
    })));
  }

  return (
    <V4Page>
      <PageHead title="Voucher Centre" sub={`Every payment voucher, financial year ${fyText(fy)} (1 Sep ${fy} – 31 Aug ${fy + 1}).`}
        actions={[
          { label: "Export CSV", icon: "download", kind: "secondary", onClick: exportCsv, disabled: !shown.length },
          ...(canPrepare ? [{ label: "Generate voucher", icon: "plus", kind: "primary" as const, href: "/payment-vouchers/new" }] : []),
        ]} />
      {error ? <Notice tone="red">{error}</Notice> : null}
      <Stats items={stats} />
      <Card>
        <div style={{ padding: "0 12px" }}>
          <Tabs value={tab} onChange={(t) => { setTab(t); setPage(1); }} label="Show" items={[
            { key: "all", label: "All", count: filtered.length }, { key: "signing", label: "In signing", count: signing.length },
            { key: "ready", label: "Ready to pay", count: byTab("ready").length }, { key: "paid", label: "Paid", count: byTab("paid").length },
            { key: "cancelled", label: "Cancelled", count: byTab("cancelled").length },
          ]} />
        </div>
        <div className="v4-toolbar">
          <label className="v4-field v4-f-search"><span className="v4-flabel">Search</span><span className="v4-control"><Icon name="search" /><input className="v4-input" placeholder="Voucher no., payee or narration" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></span></label>
          <div className="v4-field"><span className="v4-flabel">Department</span><Select size="compact" ariaLabel="Department" value={dept} onChange={(v) => { setDept(v); setPage(1); }} options={[{ value: "all", label: "All departments" }, ...depts.map((d) => ({ value: d, label: d }))]} /></div>
          <div className="v4-field"><span className="v4-flabel">Mode</span><Select size="compact" ariaLabel="Mode" value={mode} onChange={(v) => { setMode(v); setPage(1); }} options={[{ value: "all", label: "All modes" }, { value: "Transfer", label: "Transfer" }, { value: "Cash", label: "Cash" }, { value: "Cheque", label: "Cheque" }]} /></div>
          <div className="v4-field v4-f-extra"><span className="v4-flabel">Financial year</span><Select size="compact" ariaLabel="Financial year" value={String(fy)} onChange={(v) => { setFy(Number(v)); setPage(1); }} options={[0, 1, 2, 3].map((n) => ({ value: String(fyOf() - n), label: `FY ${fyText(fyOf() - n)}` }))} /></div>
          <button className="v4-btn v4-btn-ghost" type="button" onClick={() => { setQ(""); setDept("all"); setMode("all"); setFy(fyOf()); setTab("all"); setPage(1); }}><Icon name="returned" />Reset</button>
        </div>
        {rows === null ? <Skeleton lines={8} /> : paged.length ? (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Voucher</th><th className="v4-r">Amount</th><th>Payee · narration</th><th className="v4-hide-md">Department</th><th>Mode</th><th>Status</th><th className="v4-hide-md">Now with</th><th className="v4-r">Action</th></tr></thead>
              <tbody>
                {paged.map((v) => {
                  const chip = pvChip(v.status);
                  return (
                    <tr key={v.id}>
                      <td><span className="v4-strong">{v.voucher_no || "—"}</span><span className="v4-sub">{shortDate(v.created_at)}{isManual(v) ? " · manual" : ""}</span></td>
                      <td className="v4-r v4-num v4-strong">{naira(pvAmount(v))}</td>
                      <td data-label="Payee"><span className="v4-strong">{String(v.payee_name || "—").toUpperCase()}</span><span className="v4-sub">{Number(v.item_count || 1) > 1 ? `${v.item_count} requests${Number(v.payee_count || 1) > 1 ? " · Transfer schedule" : ""}` : v.narration || ""}</span></td>
                      <td className="v4-hide-sm v4-hide-md">{v.dept_name || (Number(v.item_count || 1) > 1 ? "Multiple" : "—")}</td>
                      <td className="v4-hide-sm">{v.disbursement_mode || "—"}</td>
                      <td><Chip tone={chip.tone}>{chip.label}</Chip></td>
                      <td data-label="Now with" className="v4-hide-sm v4-hide-md">{pvNowWith(v)}</td>
                      <td className="v4-r"><Btn small a={{ href: `/payment-vouchers/${v.id}`, label: "Open", kind: "secondary" }} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>{rows.length ? "No voucher matches these filters." : "No voucher yet."}</p>}
        <Pager page={page} pageSize={PAGE} total={shown.length} onPage={setPage} label="vouchers" />
      </Card>
    </V4Page>
  );
}
