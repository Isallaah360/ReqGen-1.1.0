"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { canSeeBudgetBalances } from "@/lib/v4/budgetVisibility";
import { fyOf, num, subheadLabel, type Account, type Subhead } from "@/lib/v4/finance";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { Select } from "@/app/components/v4/Select";
import { Card, Notice, PageHead, Pager, Skeleton, Tabs, V4Page, downloadCsv, naira } from "@/app/components/v4/ui";

type View = "all" | "account" | "subhead";
type Period = "month" | "fy" | "custom";
type Entry = { key: string; at: string; ref: string; text: string; inAmt: number; outAmt: number; account?: string; link?: string };

type AccTx = { id: string; account_id: string; transaction_type: string | null; amount: number | null; reference_type: string | null; reference_id: string | null; reference_no: string | null; narration: string | null; created_at: string };
type BankRow = { id: string; bank_account_id: string | null; subhead_id: string | null; entry_type: string | null; amount: number | null; description: string | null; created_at: string };
type FinTx = { id: string; account_id: string | null; subhead_id: string | null; request_id: string | null; voucher_id: string | null; transaction_type: string | null; transaction_no: string | null; amount: number | null; narration: string | null; transaction_date: string | null; created_at: string | null };

const PAGE = 25;
const isOut = (t: string | null) => /debit|payment|out|withdraw/i.test(String(t || ""));

function bounds(period: Period, from: string, to: string) {
  const now = new Date();
  if (period === "month") return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
  if (period === "fy") { const y = fyOf(now); return { start: new Date(y, 8, 1), end: new Date(y + 1, 8, 1) }; }
  return { start: from ? new Date(from) : new Date(2000, 0, 1), end: to ? new Date(new Date(to).getTime() + 86400000) : new Date(2100, 0, 1) };
}
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const refLink = (refType: string | null, refId: string | null, refNo: string | null) =>
  /voucher|payment/i.test(String(refType || "")) && refId ? `/payment-vouchers/${refId}` : /transfer/i.test(String(refType || "")) || /^TRF/i.test(String(refNo || "")) ? `/finance/account-transfers?q=${encodeURIComponent(refNo || "")}` : undefined;

export default function LedgersPage() {
  return <Suspense fallback={<V4Page><Skeleton lines={6} /></V4Page>}><Ledgers /></Suspense>;
}

/** Finance › Ledgers (mock-up 43): every money movement with a running balance. */
function Ledgers() {
  const me = useIdentity();
  const params = useSearchParams();
  const [view, setView] = useState<View>(() => (params.get("view") === "subhead" ? "subhead" : params.get("view") === "all" ? "all" : "account"));
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [subs, setSubs] = useState<Subhead[]>([]);
  const [accTx, setAccTx] = useState<AccTx[] | null>(null);
  const [bank, setBank] = useState<BankRow[]>([]);
  const [fin, setFin] = useState<FinTx[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState(params.get("account") || "");
  const [subheadId, setSubheadId] = useState(params.get("subhead") || "");
  const [period, setPeriod] = useState<Period>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const mayView = canSeeBudgetBalances(me.role);

  const load = useCallback(async () => {
    const [a, s, t, b, f] = await Promise.all([
      supabase.from("iet_accounts").select("id,code,name,bank_name,is_active,total_fund").order("name"),
      supabase.from("subheads").select("id,dept_id,code,name,approved_allocation,reserved_amount,expenditure,balance,is_active,bank_account_id").order("code"),
      supabase.from("iet_account_transactions").select("id,account_id,transaction_type,amount,reference_type,reference_id,reference_no,narration,created_at").order("created_at", { ascending: true }).limit(20000),
      supabase.from("iet_bank_ledger").select("id,bank_account_id,subhead_id,entry_type,amount,description,created_at").order("created_at", { ascending: true }).limit(20000),
      supabase.from("finance_transactions").select("id,account_id,subhead_id,request_id,voucher_id,transaction_type,transaction_no,amount,narration,transaction_date,created_at").order("created_at", { ascending: true }).limit(20000),
    ]);
    const err = [a.error, t.error, b.error, f.error].filter(Boolean).map((e) => e!.message);
    setError(err.length ? err.join(" · ") : null);
    const acc = (a.data || []) as Account[];
    setAccounts(acc);
    setSubs((s.data || []) as Subhead[]);
    setAccTx((t.data || []) as AccTx[]);
    setBank((b.data || []) as BankRow[]);
    setFin((f.data || []) as FinTx[]);
    setAccountId((cur) => cur || acc.find((x) => x.is_active !== false)?.id || "");
  }, []);
  useEffect(() => { if (me.ready && mayView) queueMicrotask(() => { void load(); }); }, [me.ready, mayView, load]);
  useEffect(() => { if (!subheadId && subs.length) queueMicrotask(() => setSubheadId(subs[0].id)); }, [subs, subheadId]);

  const accName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  // Every movement, oldest first, as money in / money out for the chosen ledger.
  const entries: Entry[] = useMemo(() => {
    if (!accTx) return [];
    if (view === "subhead") {
      const alloc = bank.filter((r) => r.subhead_id === subheadId).map((r) => ({
        key: `b${r.id}`, at: r.created_at, ref: /^TRF-/.test(String(r.description || "")) ? String(r.description || "").split(" ")[0] : "Allocation",
        text: `${r.entry_type || "Allocation"} — ${r.description || ""}`, inAmt: num(r.amount) > 0 ? num(r.amount) : 0, outAmt: num(r.amount) < 0 ? -num(r.amount) : 0,
      }));
      const pays = fin.filter((r) => r.subhead_id === subheadId).map((r) => ({
        key: `f${r.id}`, at: r.created_at || r.transaction_date || "", ref: r.transaction_no || "Payment", text: r.narration || r.transaction_type || "Payment",
        inAmt: isOut(r.transaction_type) || /payment/i.test(String(r.transaction_type)) ? 0 : num(r.amount), outAmt: /payment/i.test(String(r.transaction_type)) || isOut(r.transaction_type) ? num(r.amount) : 0,
        link: r.voucher_id ? `/payment-vouchers/${r.voucher_id}` : undefined,
      }));
      return [...alloc, ...pays].sort((x, y) => x.at.localeCompare(y.at));
    }
    const pick = (id: string | null) => view === "all" || id === accountId;
    const tx = accTx.filter((r) => pick(r.account_id)).map((r) => ({
      key: `t${r.id}`, at: r.created_at, ref: r.reference_no || r.reference_type || "—", text: r.narration || r.transaction_type || "",
      inAmt: isOut(r.transaction_type) ? 0 : num(r.amount), outAmt: isOut(r.transaction_type) ? num(r.amount) : 0,
      account: accName.get(r.account_id), link: refLink(r.reference_type, r.reference_id, r.reference_no),
    }));
    const funding = bank.filter((r) => /funding/i.test(String(r.entry_type)) && pick(r.bank_account_id)).map((r) => ({
      key: `f${r.id}`, at: r.created_at, ref: "Fund", text: r.description || "Fund set", inAmt: num(r.amount) > 0 ? num(r.amount) : 0, outAmt: num(r.amount) < 0 ? -num(r.amount) : 0,
      account: accName.get(r.bank_account_id || ""),
    }));
    return [...tx, ...funding].sort((x, y) => x.at.localeCompare(y.at));
  }, [view, accTx, bank, fin, accountId, subheadId, accName]);

  const { start, end } = bounds(period, from, to);
  const opening = entries.filter((e) => new Date(e.at) < start).reduce((t, e) => t + e.inAmt - e.outAmt, 0);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const inPeriod = useMemo(() => {
    const out: Array<Entry & { balance: number }> = [];
    entries.filter((e) => { const d = new Date(e.at).getTime(); return d >= startMs && d < endMs; })
      .reduce((bal, e) => { const next = bal + e.inAmt - e.outAmt; out.push({ ...e, balance: next }); return next; }, opening);
    return out;
  }, [entries, opening, startMs, endMs]);
  const moneyIn = inPeriod.reduce((t, e) => t + e.inAmt, 0);
  const moneyOut = inPeriod.reduce((t, e) => t + e.outAmt, 0);
  const closing = opening + moneyIn - moneyOut;
  const newestFirst = [...inPeriod].reverse();
  const paged = newestFirst.slice((page - 1) * PAGE, page * PAGE);
  const periodText = period === "month" ? new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : period === "fy" ? `FY ${fyOf()}/${String((fyOf() + 1) % 100).padStart(2, "0")}` : "chosen dates";

  function exportCsv() {
    downloadCsv(`Ledger_${view}_${periodText.replace(/\W+/g, "_")}.csv`, inPeriod.map((e) => ({
      Date: new Date(e.at).toLocaleDateString("en-GB"), Reference: e.ref, Description: e.text, ...(view === "all" ? { Account: e.account || "" } : {}),
      "Money in": e.inAmt || "", "Money out": e.outAmt || "", Balance: e.balance,
    })));
  }

  if (me.ready && !mayView) return <V4Page><PageHead title="Ledgers" /><Notice tone="amber">Ledgers show balances, which are private for the position you are acting as ({me.roleName}).</Notice></V4Page>;

  return (
    <V4Page className="v4-ledgers">
      <PageHead title="Ledgers" sub="Every money movement, with a running balance. Click a reference to open the voucher or transfer."
        actions={[{ label: "Export CSV", icon: "download", kind: "secondary", onClick: exportCsv, disabled: !inPeriod.length }, { label: "Print", icon: "printer", kind: "secondary", onClick: () => window.print() }]} />
      {error ? <Notice tone="amber">Some records could not be read: {error}</Notice> : null}
      <Card>
        <div style={{ padding: "0 12px" }}>
          <Tabs value={view} onChange={(v) => { setView(v); setPage(1); }} label="Ledger" items={[{ key: "all", label: "All transactions" }, { key: "account", label: "Account ledger" }, { key: "subhead", label: "Subhead ledger" }]} />
        </div>
        <div className="v4-picker">
          {view === "account" ? <div className="v4-field"><span className="v4-flabel">Account <span className="v4-req">*</span></span>
            <Select ariaLabel="Account" size="compact" value={accountId} onChange={(v) => { setAccountId(v); setPage(1); }} options={accounts.map((a) => ({ value: a.id, label: a.name, hint: a.bank_name || undefined }))} /></div> : null}
          {view === "subhead" ? <div className="v4-field"><span className="v4-flabel">Subhead <span className="v4-req">*</span></span>
            <Select ariaLabel="Subhead" size="compact" value={subheadId} onChange={(v) => { setSubheadId(v); setPage(1); }} options={subs.map((s) => ({ value: s.id, label: subheadLabel(s) }))} menuMinWidth={300} /></div> : null}
          <div className="v4-field"><span className="v4-flabel">Period</span>
            <Select ariaLabel="Period" size="compact" value={period} onChange={(v) => { setPeriod(v as Period); setPage(1); }} options={[{ value: "month", label: `This month (${new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })})` }, { value: "fy", label: "This financial year" }, { value: "custom", label: "Custom dates" }]} /></div>
          {period === "custom" ? (<>
            <label className="v4-field" style={{ minWidth: 150, flex: "0 1 170px" }}><span className="v4-flabel">From</span><input className="v4-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="v4-field" style={{ minWidth: 150, flex: "0 1 170px" }}><span className="v4-flabel">To</span><input className="v4-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          </>) : null}
          <button className="v4-btn v4-btn-ghost" type="button" onClick={() => { setPeriod("month"); setFrom(""); setTo(""); setPage(1); }}><Icon name="returned" />Reset</button>
        </div>
        <div style={{ padding: "16px 20px" }}>
          <div className="v4-balance-strip">
            <div><span>Opening ({start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })})</span><b>{naira(opening)}</b></div>
            <div><span>Money in</span><b className="v4-credit">{naira(moneyIn)}</b></div>
            <div><span>Money out</span><b className="v4-debit">{naira(moneyOut)}</b></div>
            <div><span>Closing</span><b>{naira(closing)}</b></div>
          </div>
        </div>
        {accTx === null ? <Skeleton lines={6} /> : paged.length ? (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Date</th><th>Reference · description</th>{view === "all" ? <th className="v4-hide-sm">Account</th> : null}<th className="v4-r">Money in</th><th className="v4-r">Money out</th><th className="v4-r">Balance</th></tr></thead>
              <tbody>
                {paged.map((e) => (
                  <tr key={e.key}>
                    <td className="v4-hide-sm">{day(e.at)}</td>
                    <td><span className="v4-strong">{e.link ? <Link href={e.link}>{e.ref}</Link> : e.ref}</span><span className="v4-sub">{e.text}</span></td>
                    {view === "all" ? <td className="v4-hide-sm">{e.account || "—"}</td> : null}
                    <td className="v4-r v4-num v4-credit">{e.inAmt ? naira(e.inAmt) : ""}</td>
                    <td className="v4-r v4-num v4-debit">{e.outAmt ? naira(e.outAmt) : ""}</td>
                    <td className="v4-r v4-num v4-strong" data-label="Balance">{naira(e.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>No movement in {periodText}.</p>}
        <Pager page={page} pageSize={PAGE} total={newestFirst.length} onPage={setPage} label={`entries in ${periodText}`} />
      </Card>
    </V4Page>
  );
}
