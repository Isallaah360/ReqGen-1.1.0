"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type AccountRow = {
  id: string;
  name?: string | null;
  account_name?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  available_balance?: number | string | null;
  balance?: number | string | null;
  is_active?: boolean | null;
};

type TransferRow = {
  id: string;
  transfer_no: string | null;
  source_account_id: string;
  destination_account_id: string;
  amount: number | string;
  narration: string;
  external_reference: string | null;
  status: string | null;
  initiated_by: string | null;
  initiated_by_name: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  posted_by: string | null;
  posted_by_name: string | null;
  initiated_at: string | null;
  approved_at: string | null;
  posted_at: string | null;
  created_at: string;
};

type TransferRpcResult = {
  transfer_id?: string;
  transfer_no?: string;
  transaction_no?: string;
  source_balance_after?: number;
  destination_balance_after?: number;
};

const numberValue = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numberValue(value));

const dateTimeLabel = (value?: string | null) => {
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

function accountLabel(account?: AccountRow) {
  if (!account) return "Unknown account";
  const name = account.name || account.account_name || account.bank_name || "IET Account";
  return account.account_number ? `${name} • ${account.account_number}` : name;
}

function accountBalance(account?: AccountRow) {
  return numberValue(account?.available_balance ?? account?.balance);
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function extractRpcResult(data: unknown): TransferRpcResult {
  if (Array.isArray(data)) return (data[0] ?? {}) as TransferRpcResult;
  return (data ?? {}) as TransferRpcResult;
}

export default function AccountTransfersPage() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [amount, setAmount] = useState("");
  const [narration, setNarration] = useState("");
  const [reference, setReference] = useState("");
  const [confirmation, setConfirmation] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedTransfer, setSelectedTransfer] = useState<TransferRow | null>(null);

  const loadData = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setError("");

    try {
      const [accountResult, transferResult] = await Promise.all([
        supabase.from("iet_accounts").select("*").order("name", { ascending: true, nullsFirst: false }),
        supabase.from("account_transfers").select("*").order("created_at", { ascending: false }).limit(500),
      ]);

      if (accountResult.error) throw accountResult.error;
      if (transferResult.error) throw transferResult.error;

      setAccounts(((accountResult.data ?? []) as AccountRow[]).filter((row) => row.is_active !== false));
      setTransfers((transferResult.data ?? []) as TransferRow[]);
    } catch (caught: any) {
      console.error("Account Transfers load error:", caught);
      setError(caught?.message || caught?.details || "Unable to load Account Transfers.");
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
      .channel("account-transfers-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "account_transfers" }, refreshSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "iet_accounts" }, refreshSoon)
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [loadData]);

  const accountMap = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const sourceAccount = accountMap.get(sourceId);
  const destinationAccount = accountMap.get(destinationId);
  const transferAmount = numberValue(amount);
  const sourceBefore = accountBalance(sourceAccount);
  const destinationBefore = accountBalance(destinationAccount);
  const sourceAfter = sourceBefore - transferAmount;
  const destinationAfter = destinationBefore + transferAmount;

  const validationMessage = useMemo(() => {
    if (!sourceId) return "Select the source account.";
    if (!destinationId) return "Select the destination account.";
    if (sourceId === destinationId) return "Source and destination accounts must be different.";
    if (transferAmount <= 0) return "Enter a transfer amount greater than zero.";
    if (transferAmount > sourceBefore) return "The source account has insufficient available balance.";
    if (narration.trim().length < 5) return "Enter a clear transfer narration.";
    if (!confirmation) return "Confirm the transfer details before posting.";
    return "";
  }, [sourceId, destinationId, transferAmount, sourceBefore, narration, confirmation]);

  const clearForm = () => {
    setSourceId("");
    setDestinationId("");
    setAmount("");
    setNarration("");
    setReference("");
    setConfirmation(false);
  };

  const postTransfer = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setPosting(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("post_account_transfer", {
        p_source_account_id: sourceId,
        p_destination_account_id: destinationId,
        p_amount: transferAmount,
        p_narration: narration.trim(),
        p_external_reference: reference.trim() || null,
      });

      if (rpcError) throw rpcError;
      const result = extractRpcResult(data);
      const transferNo = result.transfer_no || "the generated transfer";
      setSuccess(`${transferNo} was posted successfully. Both account balances and ledger entries were updated.`);
      clearForm();
      await loadData(true);
    } catch (caught: any) {
      console.error("Account transfer posting error:", caught);
      const detail = [caught?.message, caught?.details, caught?.hint, caught?.code].filter(Boolean).join(" — ");
      setError(detail || "Unable to post the account transfer.");
    } finally {
      setPosting(false);
    }
  };

  const filteredTransfers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return transfers.filter((row) => {
      const status = row.status || "Posted";
      if (statusFilter !== "All" && status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (!needle) return true;
      const source = accountLabel(accountMap.get(row.source_account_id));
      const destination = accountLabel(accountMap.get(row.destination_account_id));
      return [
        row.transfer_no,
        source,
        destination,
        row.narration,
        row.external_reference,
        row.initiated_by_name,
        row.posted_by_name,
        status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [transfers, search, statusFilter, accountMap]);

  const totals = useMemo(() => {
    const posted = transfers.filter((row) => (row.status || "Posted").toLowerCase() === "posted");
    return {
      records: transfers.length,
      posted: posted.length,
      postedValue: posted.reduce((sum, row) => sum + numberValue(row.amount), 0),
      accounts: new Set(posted.flatMap((row) => [row.source_account_id, row.destination_account_id])).size,
    };
  }, [transfers]);

  const exportCsv = () => {
    const headers = [
      "Transfer Number",
      "Source Account",
      "Destination Account",
      "Amount",
      "Narration",
      "External Reference",
      "Status",
      "Initiated By",
      "Posted By",
      "Posted At",
    ];
    const rows = filteredTransfers.map((row) => [
      row.transfer_no,
      accountLabel(accountMap.get(row.source_account_id)),
      accountLabel(accountMap.get(row.destination_account_id)),
      numberValue(row.amount),
      row.narration,
      row.external_reference,
      row.status || "Posted",
      row.initiated_by_name,
      row.posted_by_name,
      row.posted_at || row.created_at,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `account-transfers-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <main className="page-shell loading-shell">
        <div className="spinner" />
        <h1>Loading Account Transfers</h1>
        <p>Preparing authorised IET accounts and transfer history.</p>
        <style jsx>{styles}</style>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="hero no-print">
        <div>
          <span className="eyebrow">FINANCE ACCOUNTING</span>
          <h1>Account Transfers</h1>
          <p>Move funds securely between authorised IET accounts with dual ledger entries, balance protection and complete traceability.</p>
          <div className="hero-actions">
            <Link href="/finance" className="button button-outline transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60">Finance Control Centre</Link>
            <Link href="/finance/account-ledger" className="button button-cyan transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60">Account Ledger</Link>
          </div>
        </div>
        <aside className="hero-summary">
          <span>TRANSFER ACTIVITY</span>
          <strong>{money(totals.postedValue)}</strong>
          <p>Total value of posted internal account transfers.</p>
          <div className="mini-grid">
            <div><b>{totals.records}</b><small>Records</small></div>
            <div><b>{totals.posted}</b><small>Posted</small></div>
            <div><b>{totals.accounts}</b><small>Accounts</small></div>
          </div>
        </aside>
      </section>

      {error && <div className="alert alert-error no-print">⚠ {error}</div>}
      {success && <div className="alert alert-success no-print">✓ {success}</div>}

      <section className="summary-grid no-print">
        <article><span>Source balance</span><strong>{money(sourceBefore)}</strong><p>Available before transfer</p></article>
        <article><span>Transfer amount</span><strong>{money(transferAmount)}</strong><p>Internal fund movement</p></article>
        <article><span>Source after</span><strong className={sourceAfter < 0 ? "danger" : ""}>{money(sourceAfter)}</strong><p>Projected source balance</p></article>
        <article><span>Destination after</span><strong>{money(destinationAfter)}</strong><p>Projected destination balance</p></article>
      </section>

      <section className="panel no-print">
        <div className="section-heading">
          <div><span className="eyebrow blue">NEW TRANSFER</span><h2>Post an internal account transfer</h2></div>
          <span className="security-pill">Atomic posting</span>
        </div>

        <form onSubmit={postTransfer}>
          <div className="form-grid">
            <label>
              <span>Source IET Account *</span>
              <select value={sourceId} onChange={(e) => { setSourceId(e.target.value); if (e.target.value === destinationId) setDestinationId(""); }} disabled={posting}>
                <option value="">Select source account</option>
                {accounts.map((account) => <option key={account.id} value={account.id}>{accountLabel(account)} — {money(accountBalance(account))}</option>)}
              </select>
            </label>
            <label>
              <span>Destination IET Account *</span>
              <select value={destinationId} onChange={(e) => setDestinationId(e.target.value)} disabled={posting || !sourceId}>
                <option value="">Select destination account</option>
                {accounts.filter((account) => account.id !== sourceId).map((account) => <option key={account.id} value={account.id}>{accountLabel(account)} — {money(accountBalance(account))}</option>)}
              </select>
            </label>
            <label>
              <span>Amount *</span>
              <div className="money-input"><b>NGN</b><input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" disabled={posting} /></div>
            </label>
            <label>
              <span>External Reference</span>
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Cheque, bank or memo reference" maxLength={120} disabled={posting} />
            </label>
            <label className="full-width">
              <span>Narration *</span>
              <textarea value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="State the purpose and authority for this transfer" rows={4} maxLength={500} disabled={posting} />
            </label>
          </div>

          <div className="transfer-preview">
            <div><span>From</span><b>{sourceAccount ? accountLabel(sourceAccount) : "Not selected"}</b><small>{money(sourceBefore)} → {money(sourceAfter)}</small></div>
            <div className="arrow">→</div>
            <div><span>To</span><b>{destinationAccount ? accountLabel(destinationAccount) : "Not selected"}</b><small>{money(destinationBefore)} → {money(destinationAfter)}</small></div>
          </div>

          <label className="confirmation">
            <input type="checkbox" checked={confirmation} onChange={(e) => setConfirmation(e.target.checked)} disabled={posting} />
            <span>I confirm that the source, destination, amount, narration and available balances have been verified. This action will create matching debit and credit ledger entries.</span>
          </label>

          <div className="form-actions">
            <button type="button" className="button button-light transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60" onClick={clearForm} disabled={posting}><span aria-hidden="true">↺</span>Clear Form</button>
            <button type="submit" className="button button-primary transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60" disabled={posting || Boolean(validationMessage)}><span aria-hidden="true">⇄</span>{posting ? "Posting Transfer…" : "Post Transfer"}</button>
          </div>
          {validationMessage && <p className="validation-note">{validationMessage}</p>}
        </form>
      </section>

      <section className="panel">
        <div className="section-heading no-print">
          <div><span className="eyebrow blue">TRANSFER REGISTER</span><h2>Account transfer history</h2></div>
          <span className="record-count">{filteredTransfers.length} record{filteredTransfers.length === 1 ? "" : "s"}</span>
        </div>

        <div className="filters no-print">
          <label><span>Search</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Transfer number, account, narration…" /></label>
          <label><span>Status</span><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>All</option><option>Draft</option><option>Pending</option><option>Approved</option><option>Posted</option><option>Cancelled</option><option>Reversed</option></select></label>
          <div className="filter-actions">
            <button className="button button-cyan transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void loadData(true)} disabled={refreshing}>{refreshing ? "Refreshing…" : "↻ Refresh"}</button>
            <button className="button button-green transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60" onClick={exportCsv} disabled={!filteredTransfers.length}>⇩ Export CSV</button>
            <button className="button button-light transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60" onClick={() => window.print()} disabled={!filteredTransfers.length}>⎙ Print / PDF</button>
          </div>
        </div>

        <div className="print-title"><h1>IET Account Transfer Register</h1><p>Generated {dateTimeLabel(new Date().toISOString())}</p></div>

        <div className="table-wrap">
          <table>
            <thead><tr><th>Date / Number</th><th>Source Account</th><th>Destination Account</th><th>Narration / Reference</th><th>Status</th><th className="amount-cell">Amount</th><th className="no-print">Action</th></tr></thead>
            <tbody>
              {filteredTransfers.length ? filteredTransfers.map((row) => (
                <tr key={row.id}>
                  <td><b>{dateTimeLabel(row.posted_at || row.created_at)}</b><small>{row.transfer_no || "Pending number"}</small></td>
                  <td>{accountLabel(accountMap.get(row.source_account_id))}</td>
                  <td>{accountLabel(accountMap.get(row.destination_account_id))}</td>
                  <td><b>{row.narration}</b><small>{row.external_reference || "No external reference"}</small></td>
                  <td><span className={`status status-${(row.status || "Posted").toLowerCase()}`}>{row.status || "Posted"}</span></td>
                  <td className="amount-cell"><b>{money(row.amount)}</b></td>
                  <td className="no-print"><button className="details-button transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60" onClick={() => setSelectedTransfer(row)}>Details</button></td>
                </tr>
              )) : <tr><td colSpan={7} className="empty">No account transfers match the current filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {selectedTransfer && (
        <div className="modal-backdrop no-print" onMouseDown={(e) => { if (e.currentTarget === e.target) setSelectedTransfer(null); }}>
          <section className="modal" role="dialog" aria-modal="true" aria-label="Transfer details">
            <div className="modal-head"><div><span className="eyebrow blue">TRANSFER DETAILS</span><h2>{selectedTransfer.transfer_no || "Account Transfer"}</h2></div><button onClick={() => setSelectedTransfer(null)} aria-label="Close transfer details">×</button></div>
            <div className="detail-grid transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60">
              <div><span>Source account</span><b>{accountLabel(accountMap.get(selectedTransfer.source_account_id))}</b></div>
              <div><span>Destination account</span><b>{accountLabel(accountMap.get(selectedTransfer.destination_account_id))}</b></div>
              <div><span>Amount</span><b>{money(selectedTransfer.amount)}</b></div>
              <div><span>Status</span><b>{selectedTransfer.status || "Posted"}</b></div>
              <div><span>External reference</span><b>{selectedTransfer.external_reference || "Not supplied"}</b></div>
              <div><span>Posted by</span><b>{selectedTransfer.posted_by_name || selectedTransfer.initiated_by_name || "System user"}</b></div>
              <div className="full-width"><span>Narration</span><b>{selectedTransfer.narration}</b></div>
              <div className="full-width"><span>Posted at</span><b>{dateTimeLabel(selectedTransfer.posted_at || selectedTransfer.created_at)}</b></div>
            </div>
            <div className="modal-actions"><button className="button button-light transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60" onClick={() => setSelectedTransfer(null)}>Close</button></div>
          </section>
        </div>
      )}

      <style jsx>{styles}</style>
    </main>
  );
}

const styles = `
  :global(body){background:#f5f7fb;color:#11213a}
  :global(*){box-sizing:border-box}
  .page-shell{max-width:1280px;margin:0 auto;padding:30px 22px 64px;font-family:inherit;animation:pageIn .45s ease both}
  .hero{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:30px;padding:38px 40px;border-radius:30px;background:radial-gradient(circle at 63% 35%,#0a49d5 0,#081f69 44%,#120c1d 100%);color:white;box-shadow:0 22px 55px rgba(11,31,83,.2)}
  .hero:before{content:"";position:absolute;inset:-80px auto auto 48%;width:320px;height:320px;border-radius:50%;background:rgba(34,193,255,.13);filter:blur(12px);animation:floatOrb 8s ease-in-out infinite}
  .hero:after{content:"";position:absolute;inset:auto -90px -130px auto;width:330px;height:330px;border-radius:50%;background:rgba(245,158,11,.12);filter:blur(2px);pointer-events:none;animation:floatOrb 10s ease-in-out infinite reverse}
  .hero>div,.hero-summary{position:relative;z-index:1}
  .eyebrow{display:block;margin:0 0 12px;font-size:12px;font-weight:900;letter-spacing:2.2px;color:#fbbf24}.eyebrow.blue{color:#1d6ed8}
  .hero h1{font-size:46px;font-weight:950;letter-spacing:-1.5px;line-height:1.04;margin:0 0 16px}
  .hero p{max-width:770px;margin:0;line-height:1.78;font-size:16px;font-weight:600;color:#dbeafe}
  .hero-actions{display:flex;gap:12px;margin-top:25px;flex-wrap:wrap}
  .button{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:46px;border:1px solid transparent;border-radius:13px;padding:0 18px;font:inherit;font-weight:900;text-decoration:none;cursor:pointer;box-shadow:0 8px 18px rgba(15,23,42,.08);transition:transform .18s ease,box-shadow .18s ease,filter .18s ease,background .18s ease}
  .button:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 11px 24px rgba(15,23,42,.13);filter:saturate(1.06)}.button:disabled{opacity:.48;cursor:not-allowed;box-shadow:none}
  .button-outline{border-color:rgba(255,255,255,.34);background:rgba(255,255,255,.06);color:white}.button-cyan{background:linear-gradient(135deg,#22c1ff,#1687ff);color:white;box-shadow:0 10px 24px rgba(10,143,255,.26)}
  .button-primary{background:linear-gradient(135deg,#0a49d5,#173bb7);color:white}.button-green{background:linear-gradient(135deg,#16a34a,#0f8a3d);color:white}.button-light{background:#fff;color:#172033;border-color:#cbd5e1}
  .hero-summary{align-self:stretch;padding:24px;border-radius:24px;background:linear-gradient(145deg,rgba(255,255,255,.14),rgba(255,255,255,.07));border:1px solid rgba(255,255,255,.16);display:flex;flex-direction:column;gap:9px;box-shadow:inset 0 1px rgba(255,255,255,.08)}
  .hero-summary>span{font-size:12px;letter-spacing:1px;color:#cbd9ff;font-weight:900}.hero-summary>strong{font-size:30px;line-height:1.25}.hero-summary p{font-size:13px;line-height:1.55;color:#dbeafe}
  .mini-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:auto}.mini-grid div{text-align:center;padding:12px 6px;border-radius:15px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.08)}.mini-grid b{display:block;font-size:18px}.mini-grid small{text-transform:uppercase;font-size:9px;font-weight:900;letter-spacing:.7px}
  .alert{margin:20px 0;padding:16px 18px;border-radius:15px;font-weight:800;animation:slideDown .25s ease both}.alert-error{background:#fff1f2;color:#9f1239;border:1px solid #fecdd3}.alert-success{background:#ecfdf5;color:#047857;border:1px solid #a7f3d0}
  .summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:24px 0}.summary-grid article{padding:22px;border-radius:21px;background:white;border:1px solid #dce5f0;box-shadow:0 9px 25px rgba(24,44,85,.055);animation:cardRise .45s ease both}.summary-grid article:nth-child(2){animation-delay:.04s}.summary-grid article:nth-child(3){animation-delay:.08s}.summary-grid article:nth-child(4){animation-delay:.12s}
  .summary-grid span{display:block;font-size:12px;letter-spacing:1.35px;font-weight:900;color:#50647d}.summary-grid strong{display:block;margin:12px 0 8px;font-size:25px;letter-spacing:-.4px}.summary-grid p{margin:0;color:#68778a;font-size:13px}.danger{color:#be123c!important}
  .panel{margin-top:24px;padding:25px;border-radius:24px;background:white;border:1px solid #dce5f0;box-shadow:0 9px 28px rgba(24,44,85,.045);animation:cardRise .5s ease both}
  .section-heading{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:22px}.section-heading h2{margin:0;font-size:28px;font-weight:950;letter-spacing:-.5px}.security-pill,.record-count{background:#eff6ff;color:#1d4ed8;padding:9px 12px;border-radius:999px;font-size:12px;font-weight:850}
  .form-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}.full-width{grid-column:1/-1}.form-grid label>span,.filters label>span,.detail-grid span,.transfer-preview span{display:block;font-size:11px;font-weight:900;letter-spacing:1.2px;color:#31445d;text-transform:uppercase}
  .form-grid input,.form-grid select,.form-grid textarea,.filters input,.filters select{width:100%;margin-top:8px;border:1px solid #cbd5e1;border-radius:13px;padding:13px 14px;background:#fff;color:#172033;font:inherit;font-size:14px;outline:none;transition:border-color .2s,box-shadow .2s}.form-grid input:focus,.form-grid select:focus,.form-grid textarea:focus,.filters input:focus,.filters select:focus{border-color:#2395ff;box-shadow:0 0 0 4px rgba(35,149,255,.12)}
  .money-input{display:flex;margin-top:8px;border:1px solid #cbd5e1;border-radius:13px;overflow:hidden;background:#fff}.money-input b{display:flex;align-items:center;padding:0 14px;background:#eff6ff;color:#1d4ed8}.money-input input{margin:0;border:0;border-radius:0}
  .transfer-preview{display:grid;grid-template-columns:1fr auto 1fr;gap:18px;align-items:center;margin-top:22px;padding:20px;border-radius:18px;background:linear-gradient(135deg,#f5f9ff,#f5fff9);border:1px solid #dce5f0}.transfer-preview b,.transfer-preview small{display:block;margin-top:6px}.transfer-preview small{color:#60728b}.arrow{font-size:2rem;color:#1776df;animation:arrowPulse 1.6s ease-in-out infinite}
  .confirmation{display:flex;gap:12px;align-items:flex-start;margin-top:20px;padding:16px;border-radius:16px;background:#fff8e8;border:1px solid #f2d99b;line-height:1.55;color:#60470d}.confirmation input{margin-top:4px;width:18px;height:18px}.validation-note{margin:10px 0 0;color:#8a5b05;font-size:13px}.form-actions,.filter-actions,.modal-actions{display:flex;gap:11px;flex-wrap:wrap;margin-top:22px}
  .filters{display:grid;grid-template-columns:1.6fr .7fr auto;gap:14px;align-items:end;margin-bottom:18px}.filter-actions{margin:0}
  .print-title{display:none}.table-wrap{overflow:auto;border:1px solid #e2e8f0;border-radius:16px}table{width:100%;border-collapse:collapse;min-width:1050px}th{background:#10213c;color:white;text-align:left;padding:14px;font-size:12px;letter-spacing:.2px}td{padding:15px 14px;border-bottom:1px solid #e5e7eb;vertical-align:top;font-size:13px}tbody tr:hover{background:#f8fbff}td small{display:block;color:#64748b;margin-top:5px}.amount-cell{text-align:right}
  .status{display:inline-flex;padding:7px 10px;border-radius:999px;font-size:11px;font-weight:900;background:#e2e8f0;color:#475569}.status-posted{background:#dcfce7;color:#166534}.status-pending,.status-draft{background:#fef3c7;color:#92400e}.status-cancelled,.status-reversed{background:#fee2e2;color:#991b1b}.details-button{border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;border-radius:10px;padding:8px 12px;font-weight:900;cursor:pointer;transition:.18s}.details-button:hover{transform:translateY(-1px);background:#dbeafe}.empty{text-align:center;padding:40px;color:#64748b}
  .modal-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:22px;background:rgba(5,14,29,.62);backdrop-filter:blur(7px);animation:fadeIn .2s ease both}.modal{width:min(760px,100%);max-height:90vh;overflow:auto;background:white;border-radius:24px;padding:25px;box-shadow:0 30px 100px rgba(0,0,0,.28);animation:modalUp .25s ease both}.modal-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.modal-head h2{margin:7px 0 0}.modal-head button{width:42px;height:42px;border-radius:12px;border:1px solid #dde5ef;background:white;color:#1b2940;font-size:1.7rem;cursor:pointer}.detail-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:22px}.detail-grid>div{padding:15px;border-radius:15px;background:#f8fafc;border:1px solid #eef2f7}.detail-grid b{display:block;margin-top:7px;line-height:1.5}
  .loading-shell{display:grid;place-items:center;align-content:center;text-align:center;min-height:70vh}.spinner{width:48px;height:48px;border:5px solid #dce8f7;border-top-color:#1674df;border-radius:50%;animation:spin .8s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}@keyframes pageIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@keyframes cardRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes modalUp{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}@keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}@keyframes arrowPulse{50%{transform:translateX(4px)}}@keyframes floatOrb{50%{transform:translate3d(16px,12px,0) scale(1.05)}}
  @media(max-width:900px){.hero{grid-template-columns:1fr}.summary-grid{grid-template-columns:repeat(2,1fr)}.filters{grid-template-columns:1fr 1fr}.filter-actions{grid-column:1/-1}.form-grid{grid-template-columns:1fr}.full-width{grid-column:auto}.transfer-preview{grid-template-columns:1fr}.arrow{transform:rotate(90deg);text-align:center}}
  @media(max-width:560px){.page-shell{padding:14px}.hero{padding:25px}.hero h1{font-size:36px}.summary-grid,.filters{grid-template-columns:1fr}.panel{padding:18px}.section-heading{flex-direction:column}.detail-grid{grid-template-columns:1fr}.hero-actions,.form-actions,.filter-actions{display:grid;grid-template-columns:1fr}.button{width:100%}}
  @media print{.page-shell{max-width:none;padding:0}.no-print,.hero,.summary-grid{display:none!important}.panel{border:0;padding:0;box-shadow:none}.print-title{display:block;margin-bottom:20px}.table-wrap{overflow:visible;border:0}table{min-width:0;font-size:10px}th{background:#eee!important;color:#000!important;-webkit-print-color-adjust:exact}td,th{padding:8px}}
`;
