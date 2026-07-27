"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type SubheadRow = {
  id: string;
  dept_id: string;
  code: string;
  name: string;
  approved_allocation: number | string;
  expenditure: number | string;
  balance: number | string;
  is_active: boolean;
  updated_at: string | null;
  account_id: string | null;
  bank_account_id: string | null;
  reserved_amount: number | string | null;
  allocation_note: string | null;
  allocation_date: string | null;
};

type FinanceTransactionRow = {
  id: string;
  transaction_no: string | null;
  account_id: string;
  subhead_id: string | null;
  request_id: string | null;
  voucher_id: string | null;
  transaction_type: string;
  amount: number | string;
  narration: string;
  external_reference: string | null;
  transaction_date: string;
  posted_by: string | null;
  posted_at: string;
  reversal_of: string | null;
  is_reversed: boolean;
  created_at: string;
};

type VoucherRow = {
  id: string;
  voucher_no: string | null;
  request_no: string | null;
  payee_name: string | null;
  status: string | null;
};

type AccountRow = {
  id: string;
  name?: string | null;
  account_name?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
};

type DepartmentRow = { id: string; name?: string | null; dept_name?: string | null };
type ProfileRow = { id: string; full_name?: string | null; name?: string | null; email?: string | null };

type LedgerView = FinanceTransactionRow & {
  voucher_no: string | null;
  request_no: string | null;
  payee_name: string | null;
  account_name: string;
  actor_name: string;
};

const num = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: number | string | null | undefined) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num(value));

const dateLabel = (value: string | null | undefined) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
};

const dateTimeLabel = (value: string | null | undefined) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const dateInput = (date: Date) => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
};

const beginningOfYear = () => {
  const date = new Date();
  date.setMonth(0, 1);
  return dateInput(date);
};

function accountName(account: AccountRow | undefined) {
  return account?.name || account?.account_name || account?.bank_name || "Unassigned account";
}

function departmentName(department: DepartmentRow | undefined) {
  return department?.name || department?.dept_name || "Department unavailable";
}

function profileName(profile: ProfileRow | undefined) {
  return profile?.full_name || profile?.name || profile?.email || "System user";
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export default function SubheadLedgerPage() {
  const [subheads, setSubheads] = useState<SubheadRow[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransactionRow[]>([]);
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState(beginningOfYear());
  const [toDate, setToDate] = useState(dateInput(new Date()));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setError("");

    try {
      const [subheadResult, transactionResult, voucherResult, accountResult, departmentResult, profileResult] =
        await Promise.all([
          supabase.from("subheads").select("*").order("code", { ascending: true }),
          supabase.from("finance_transactions").select("*").order("posted_at", { ascending: false }).limit(3000),
          supabase.from("payment_vouchers").select("id,voucher_no,request_no,payee_name,status").limit(3000),
          supabase.from("iet_accounts").select("*"),
          supabase.from("departments").select("*"),
          supabase.from("profiles").select("id,full_name,name,email"),
        ]);

      const firstError = [subheadResult, transactionResult, voucherResult, accountResult, departmentResult, profileResult]
        .map((result) => result.error)
        .find(Boolean);
      if (firstError) throw firstError;

      const loadedSubheads = (subheadResult.data ?? []) as SubheadRow[];
      setSubheads(loadedSubheads);
      setTransactions((transactionResult.data ?? []) as FinanceTransactionRow[]);
      setVouchers((voucherResult.data ?? []) as VoucherRow[]);
      setAccounts((accountResult.data ?? []) as AccountRow[]);
      setDepartments((departmentResult.data ?? []) as DepartmentRow[]);
      setProfiles((profileResult.data ?? []) as ProfileRow[]);
      setSelectedId((current) => current || loadedSubheads[0]?.id || "");
    } catch (caught: any) {
      console.error("Subhead Ledger load error:", caught);
      setError(caught?.message || caught?.details || "Unable to load the Subhead Ledger.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refreshSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void loadData(true), 500);
    };

    const channel = supabase
      .channel("subhead-ledger-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "subheads" }, refreshSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_transactions" }, refreshSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_vouchers" }, refreshSoon)
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [loadData]);

  const selected = useMemo(() => subheads.find((row) => row.id === selectedId), [subheads, selectedId]);
  const selectedAccount = useMemo(
    () => accounts.find((row) => row.id === (selected?.account_id || selected?.bank_account_id || "")),
    [accounts, selected]
  );
  const selectedDepartment = useMemo(
    () => departments.find((row) => row.id === selected?.dept_id),
    [departments, selected]
  );

  const voucherMap = useMemo(() => new Map(vouchers.map((row) => [row.id, row])), [vouchers]);
  const accountMap = useMemo(() => new Map(accounts.map((row) => [row.id, row])), [accounts]);
  const profileMap = useMemo(() => new Map(profiles.map((row) => [row.id, row])), [profiles]);

  const ledgerRows = useMemo<LedgerView[]>(() => {
    const needle = search.trim().toLowerCase();
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59.999`) : null;

    return transactions
      .filter((row) => row.subhead_id === selectedId)
      .map((row) => {
        const voucher = row.voucher_id ? voucherMap.get(row.voucher_id) : undefined;
        const account = accountMap.get(row.account_id);
        const profile = row.posted_by ? profileMap.get(row.posted_by) : undefined;
        return {
          ...row,
          voucher_no: voucher?.voucher_no || null,
          request_no: voucher?.request_no || null,
          payee_name: voucher?.payee_name || null,
          account_name: accountName(account),
          actor_name: profileName(profile),
        };
      })
      .filter((row) => {
        const date = new Date(row.transaction_date || row.posted_at);
        if (from && date < from) return false;
        if (to && date > to) return false;
        if (!needle) return true;
        return [
          row.transaction_no,
          row.transaction_type,
          row.voucher_no,
          row.request_no,
          row.payee_name,
          row.narration,
          row.external_reference,
          row.account_name,
          row.actor_name,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      })
      .sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime());
  }, [transactions, selectedId, search, fromDate, toDate, voucherMap, accountMap, profileMap]);

  const approved = num(selected?.approved_allocation);
  const reserved = num(selected?.reserved_amount);
  const expenditure = num(selected?.expenditure);
  const available = num(selected?.balance);
  const utilization = approved > 0 ? Math.min(100, (expenditure / approved) * 100) : 0;
  const isOverSpent = expenditure + reserved > approved || available < 0;
  const periodExpenditure = ledgerRows
    .filter((row) => !row.is_reversed && !/credit|refund|reversal/i.test(row.transaction_type))
    .reduce((sum, row) => sum + num(row.amount), 0);

  const exportCsv = () => {
    if (!selected || ledgerRows.length === 0) return;
    const rows = [
      ["SUBHEAD STATEMENT"],
      ["Subhead", `${selected.code} - ${selected.name}`],
      ["Department", departmentName(selectedDepartment)],
      ["Linked Account", accountName(selectedAccount)],
      ["Approved Allocation", approved],
      ["Reserved Amount", reserved],
      ["Expenditure", expenditure],
      ["Available Balance", available],
      [],
      ["Date", "Transaction No", "Type", "Voucher", "Request", "Payee", "Narration", "Reference", "Posted By", "Amount", "Reversed"],
      ...ledgerRows.map((row) => [
        row.transaction_date,
        row.transaction_no,
        row.transaction_type,
        row.voucher_no,
        row.request_no,
        row.payee_name,
        row.narration,
        row.external_reference,
        row.actor_name,
        num(row.amount),
        row.is_reversed ? "Yes" : "No",
      ]),
    ];

    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `subhead-${selected.code}-statement.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <main className="ledger-shell"><div className="loading-card">Loading Subhead Ledger…</div><style jsx>{styles}</style></main>;
  }

  return (
    <main className="ledger-shell">
      <section className="hero no-print">
        <div>
          <p className="eyebrow">FINANCE ACCOUNTING</p>
          <h1>Subhead Ledger</h1>
          <p>Review allocations, reservations, expenditure, available balances and linked finance transactions for every subhead.</p>
          <div className="hero-actions">
            <Link href="/finance" className="ghost-button">Finance Control Centre</Link>
            <Link href="/finance/account-ledger" className="blue-button">Account Ledger</Link>
          </div>
        </div>
        <div className="hero-summary">
          <span>SELECTED SUBHEAD</span>
          <strong>{selected ? `${selected.code} - ${selected.name}` : "No subhead selected"}</strong>
          <small>{departmentName(selectedDepartment)}</small>
          <small>{accountName(selectedAccount)}</small>
        </div>
      </section>

      {error && <div className="error-banner no-print">⚠ {error}</div>}

      <section className="summary-grid">
        <article><span>APPROVED ALLOCATION</span><strong>{money(approved)}</strong><small>Authorised provision</small></article>
        <article><span>RESERVED AMOUNT</span><strong>{money(reserved)}</strong><small>Committed but not yet expended</small></article>
        <article><span>EXPENDITURE</span><strong>{money(expenditure)}</strong><small>Cumulative posted spending</small></article>
        <article className={isOverSpent ? "danger" : "success"}><span>AVAILABLE BALANCE</span><strong>{money(available)}</strong><small>{isOverSpent ? "Over-expenditure warning" : "Available for further commitments"}</small></article>
      </section>

      <section className="control-card no-print">
        <div className="field wide"><label>FINANCE SUBHEAD</label><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{subheads.map((row) => <option key={row.id} value={row.id}>{row.code} - {row.name}</option>)}</select></div>
        <div className="field"><label>SEARCH LEDGER</label><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Transaction, voucher, request, narration…" /></div>
        <div className="field date"><label>FROM</label><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></div>
        <div className="field date"><label>TO</label><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></div>
        <div className="control-actions">
          <button className="refresh-button" onClick={() => void loadData(true)} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh Ledger"}</button>
          <button className="export-button" onClick={exportCsv} disabled={!selected || ledgerRows.length === 0}>Export Excel / CSV</button>
          <button className="print-button" onClick={() => window.print()} disabled={!selected}>Print / Save PDF</button>
        </div>
      </section>

      {selected && (
        <section className="statement-card">
          <div className="statement-heading">
            <div><p>SUBHEAD STATEMENT</p><h2>{selected.code} - {selected.name}</h2><small>{departmentName(selectedDepartment)} · {accountName(selectedAccount)}</small></div>
            <div className="statement-meta"><span>{ledgerRows.length} transaction{ledgerRows.length === 1 ? "" : "s"}</span><span>Period spending: {money(periodExpenditure)}</span></div>
          </div>

          <div className="allocation-detail">
            <div><span>Allocation Date</span><strong>{dateLabel(selected.allocation_date)}</strong></div>
            <div><span>Allocation Note</span><strong>{selected.allocation_note || "No allocation note"}</strong></div>
            <div><span>Last Updated</span><strong>{dateTimeLabel(selected.updated_at)}</strong></div>
            <div><span>Status</span><strong>{selected.is_active ? "Active" : "Inactive"}</strong></div>
          </div>

          <div className="utilization"><div><span>Budget Utilisation</span><strong>{utilization.toFixed(1)}%</strong></div><div className="track"><div style={{ width: `${utilization}%` }} /></div></div>

          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Transaction</th><th>References</th><th>Narration / Payee</th><th>Posted By</th><th className="amount">Amount</th><th>Status</th></tr></thead>
              <tbody>
                {ledgerRows.map((row) => (
                  <tr key={row.id}>
                    <td>{dateLabel(row.transaction_date)}<small>{dateTimeLabel(row.posted_at)}</small></td>
                    <td><strong>{row.transaction_no || "No number"}</strong><small>{row.transaction_type}</small></td>
                    <td><strong>{row.voucher_no || "No voucher"}</strong><small>{row.request_no || "No request"}</small><small>{row.external_reference || "No external reference"}</small></td>
                    <td><strong>{row.narration}</strong><small>{row.payee_name || "Payee unavailable"}</small><small>{row.account_name}</small></td>
                    <td>{row.actor_name}</td>
                    <td className="amount"><strong>{money(row.amount)}</strong></td>
                    <td><span className={row.is_reversed ? "status reversed" : "status posted"}>{row.is_reversed ? "Reversed" : "Posted"}</span></td>
                  </tr>
                ))}
                {ledgerRows.length === 0 && <tr><td colSpan={7} className="empty">No linked finance transactions were found for this subhead and date range.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <style jsx>{styles}</style>
    </main>
  );
}

const styles = `
  :global(body){background:#f3f6fb;color:#102038}.ledger-shell{max-width:1240px;margin:0 auto;padding:28px 20px 60px;font-family:Arial,sans-serif}.hero{display:grid;grid-template-columns:1fr 310px;gap:28px;padding:38px;border-radius:30px;background:radial-gradient(circle at 60% 30%,#073ec1 0,#071d61 45%,#120c1c 100%);color:white;box-shadow:0 20px 50px rgba(12,30,80,.18)}.eyebrow,.statement-heading p{margin:0 0 12px;font-size:12px;font-weight:900;letter-spacing:2px;color:#ffb31f}.hero h1{font-size:48px;line-height:1;margin:0 0 18px}.hero p{max-width:760px;line-height:1.8;color:#d7e5ff}.hero-actions{display:flex;gap:12px;margin-top:24px;flex-wrap:wrap}.ghost-button,.blue-button{display:inline-flex;padding:13px 18px;border-radius:13px;text-decoration:none;font-weight:800}.ghost-button{border:1px solid rgba(255,255,255,.35);color:white}.blue-button{background:#15a9ff;color:white}.hero-summary{align-self:stretch;padding:24px;border-radius:24px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);display:flex;flex-direction:column;gap:9px}.hero-summary span,.hero-summary small{font-size:12px;letter-spacing:1px;color:#cbd9ff}.hero-summary strong{font-size:23px;line-height:1.3}.error-banner{margin:20px 0;padding:16px 18px;border-radius:14px;background:#fff1f2;color:#9f1239;border:1px solid #fecdd3;font-weight:700}.summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:24px 0}.summary-grid article{padding:22px;border-radius:20px;background:white;border:1px solid #dce4ef;box-shadow:0 8px 24px rgba(24,44,85,.06)}.summary-grid span{display:block;font-size:12px;letter-spacing:1.3px;font-weight:900;color:#53647a}.summary-grid strong{display:block;margin:12px 0 8px;font-size:25px}.summary-grid small{color:#68778a}.summary-grid .success{border-color:#bbf7d0;background:#f0fdf4}.summary-grid .danger{border-color:#fecaca;background:#fff1f2}.control-card{display:grid;grid-template-columns:1.5fr 1.4fr .65fr .65fr;gap:14px;padding:20px;border-radius:22px;background:white;border:1px solid #dce4ef}.field{display:flex;flex-direction:column;gap:8px}.field label{font-size:11px;font-weight:900;letter-spacing:1px;color:#334155}.field input,.field select{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:13px;padding:13px;background:white;color:#172033;font-size:14px}.control-actions{grid-column:1/-1;display:flex;gap:10px;flex-wrap:wrap}.control-actions button{border:0;border-radius:12px;padding:13px 17px;font-weight:900;cursor:pointer}.control-actions button:disabled{opacity:.5;cursor:not-allowed}.refresh-button{background:#0ea5e9;color:white}.export-button{background:#16a34a;color:white}.print-button{background:#e2e8f0;color:#172033}.statement-card{margin-top:24px;padding:24px;border-radius:24px;background:white;border:1px solid #dce4ef}.statement-heading{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.statement-heading h2{margin:0;font-size:28px}.statement-heading small{color:#64748b}.statement-meta{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}.statement-meta span{background:#eff6ff;color:#1d4ed8;padding:9px 12px;border-radius:999px;font-size:12px;font-weight:800}.allocation-detail{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:22px 0}.allocation-detail div{padding:14px;border-radius:14px;background:#f8fafc}.allocation-detail span{display:block;font-size:11px;color:#64748b;margin-bottom:8px}.allocation-detail strong{font-size:13px}.utilization{margin:16px 0 22px}.utilization>div:first-child{display:flex;justify-content:space-between;margin-bottom:8px}.track{height:10px;border-radius:999px;background:#e2e8f0;overflow:hidden}.track div{height:100%;background:linear-gradient(90deg,#0ea5e9,#2563eb);border-radius:999px}.table-wrap{overflow:auto;border:1px solid #e2e8f0;border-radius:16px}table{width:100%;border-collapse:collapse;min-width:1080px}th{background:#0f172a;color:white;text-align:left;padding:14px;font-size:12px}td{padding:15px 14px;border-bottom:1px solid #e5e7eb;vertical-align:top;font-size:13px}td small{display:block;color:#64748b;margin-top:5px}.amount{text-align:right}.status{display:inline-flex;padding:7px 10px;border-radius:999px;font-size:11px;font-weight:900}.posted{background:#dcfce7;color:#166534}.reversed{background:#fee2e2;color:#991b1b}.empty{text-align:center;padding:40px;color:#64748b}.loading-card{margin:100px auto;max-width:500px;padding:30px;text-align:center;background:white;border-radius:20px;box-shadow:0 10px 35px rgba(15,23,42,.1)}
  @media(max-width:900px){.hero{grid-template-columns:1fr}.summary-grid{grid-template-columns:repeat(2,1fr)}.control-card{grid-template-columns:1fr 1fr}.wide{grid-column:1/-1}.allocation-detail{grid-template-columns:repeat(2,1fr)}}
  @media(max-width:560px){.ledger-shell{padding:14px}.hero{padding:25px}.hero h1{font-size:36px}.summary-grid,.control-card,.allocation-detail{grid-template-columns:1fr}.field,.wide{grid-column:1/-1}.statement-heading{flex-direction:column}.statement-meta{justify-content:flex-start}.summary-grid strong{font-size:21px}}
  @media print{.no-print{display:none!important}:global(body){background:white}.ledger-shell{max-width:none;padding:0}.summary-grid{grid-template-columns:repeat(4,1fr);margin:0 0 18px}.statement-card{border:0;padding:0}.table-wrap{overflow:visible}table{min-width:0;font-size:10px}th,td{padding:7px}.statement-heading{margin-bottom:12px}}
`;
