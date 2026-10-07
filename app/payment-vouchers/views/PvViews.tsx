"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, CalendarDays, CheckCircle2, Clock3, Eye, Printer, RefreshCw, Search, UserCheck, Wallet, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { StatTile } from "@/app/components/ui/StatTile";

/**
 * ReqGen v3.1.7 — each Payment Voucher tab has its own purpose and layout:
 *   2 Pending Signatures — signing tracker: where every voucher is, who it is
 *                          waiting for, since when; send a reminder (in-app, SMS, email)
 *   3 Approved           — fully signed vouchers ready to pay
 *   4 History            — paid and cancelled vouchers, month by month
 *   5 Print Centre       — fully signed vouchers as print cards
 */

export type PvRow = {
  id: string;
  voucher_no: string;
  payee_name: string | null;
  narration: string | null;
  amount: number | null;
  total_amount: number | null;
  dept_name: string | null;
  disbursement_mode: string | null;
  status: string | null;
  created_at: string;
  prepared_by_name: string | null;
  authorized_by_name: string | null;
  item_count: number | null;
};

type TrackerRow = {
  id: string;
  voucher_no: string | null;
  payee_name: string | null;
  amount: number | null;
  disbursement_mode: string | null;
  voucher_type: string | null;
  status: string | null;
  step_no: number;
  waiting_with: string | null;
  prepared_by_name: string | null;
  created_at: string;
  waiting_since: string | null;
  last_reminder_at: string | null;
  reminder_count: number | null;
};

const STEPS = ["Prepared", "Checked", "Cheque signer", "Counter signer", "DG"];

function naira(n: number | null | undefined) {
  return `₦${Math.round(Number(n || 0)).toLocaleString("en-NG")}`;
}

function dateText(d: string | null | undefined) {
  if (!d) return "—";
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function since(d: string | null | undefined) {
  if (!d) return "—";
  const ms = Date.now() - new Date(d).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return `${Math.max(1, Math.floor(ms / 60000))} min`;
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} days`;
}

function ageTone(d: string | null | undefined) {
  if (!d) return "";
  const days = (Date.now() - new Date(d).getTime()) / 86400000;
  return days >= 3 ? "is-late" : days >= 1 ? "is-warn" : "";
}

function amountOf(row: PvRow) {
  return Number(row.total_amount ?? row.amount ?? 0);
}

/* ------------------------------------------------------------------ */
/* 2. Pending Signatures — signing tracker                             */
/* ------------------------------------------------------------------ */
export function PendingTracker() {
  const router = useRouter();
  const [rows, setRows] = useState<TrackerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [stepFilter, setStepFilter] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("reqgen_pv_tracker");
    if (error) setMessage({ tone: "error", text: error.message });
    setRows((data || []) as TrackerRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  async function remind(row: TrackerRow) {
    setSending(row.id);
    setMessage(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      const response = await fetch("/api/pv/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ voucherId: row.id }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string; recipients?: Array<{ name: string; sms: string; email: string }> };
      if (!response.ok || !result.ok) throw new Error(result.error || "The reminder could not be sent.");
      const who = (result.recipients || []).map((r) => `${r.name} (SMS ${r.sms}, email ${r.email})`).join("; ");
      setMessage({ tone: "ok", text: `Reminder sent for ${row.voucher_no}: ${who}.` });
      await load();
    } catch (caught) {
      setMessage({ tone: "error", text: caught instanceof Error ? caught.message : "The reminder could not be sent." });
    } finally {
      setSending(null);
    }
  }

  const counts = useMemo(() => [2, 3, 4, 5].map((step) => rows.filter((r) => r.step_no === step).length), [rows]);
  const visible = stepFilter ? rows.filter((r) => r.step_no === stepFilter) : rows;
  const overdue = rows.filter((r) => ageTone(r.waiting_since) === "is-late").length;

  return (
    <section className="rg-pvv">
      <div className="rg-pvv-head">
        <div>
          <h2>Signing tracker</h2>
          <p>Where every unsigned voucher is, who it is waiting for and for how long. Send a reminder by in-app alert, SMS and email.</p>
        </div>
        <button type="button" className="rg-btn rg-btn-secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={15} /> Refresh</button>
      </div>

      <div className="rg-pvv-lanes" role="tablist" aria-label="Filter by signing step">
        {[
          { step: 2, label: "With the Auditor (check)" },
          { step: 3, label: "With the Cheque Signer" },
          { step: 4, label: "With the Counter Signer" },
          { step: 5, label: "With the Director General" },
        ].map((lane, index) => (
          <button
            key={lane.step}
            type="button"
            role="tab"
            aria-selected={stepFilter === lane.step}
            className={stepFilter === lane.step ? "is-active" : ""}
            onClick={() => setStepFilter(stepFilter === lane.step ? null : lane.step)}
          >
            <strong>{counts[index]}</strong>
            <span>{lane.label}</span>
          </button>
        ))}
        <div className={`rg-pvv-overdue ${overdue ? "has-overdue" : ""}`}><strong>{overdue}</strong><span>Waiting 3+ days</span></div>
      </div>

      {message ? <div className={`rg-pvd-message is-${message.tone}`} role="status">{message.text}</div> : null}

      <div className="rg-pvv-list">
        {loading ? <p className="rg-pvv-empty">Loading the signing tracker...</p> : null}
        {!loading && !visible.length ? <p className="rg-pvv-empty"><CheckCircle2 size={18} /> No voucher is waiting for a signature{stepFilter ? " at this step" : ""}.</p> : null}
        {visible.map((row) => (
          <article key={row.id} className="rg-pvv-track">
            <div className="rg-pvv-track-main">
              <div className="rg-pvv-track-title">
                <strong>{row.voucher_no}</strong>
                {row.voucher_type === "Manual" ? <em>Manual</em> : null}
                <span>{row.payee_name || "—"} · {naira(row.amount)} · {row.disbursement_mode || "—"}</span>
              </div>
              <ol className="rg-pvv-steps" aria-label="Signing progress">
                {STEPS.map((label, index) => {
                  const stepNo = index + 1;
                  const state = stepNo < row.step_no ? "done" : stepNo === row.step_no ? "current" : "waiting";
                  return <li key={label} className={`is-${state}`}><span />{label}</li>;
                })}
              </ol>
            </div>
            <div className="rg-pvv-track-side">
              <div className="rg-pvv-with"><small>Waiting for</small><strong>{row.waiting_with || "—"}</strong></div>
              <div className={`rg-pvv-age ${ageTone(row.waiting_since)}`}><Clock3 size={14} /> {since(row.waiting_since)}</div>
              <div className="rg-pvv-reminded">{row.last_reminder_at ? `Last reminder ${since(row.last_reminder_at)} ago${row.reminder_count ? ` (${row.reminder_count})` : ""}` : "No reminder sent"}</div>
              <div className="rg-pvv-actions">
                <button type="button" className="rg-btn rg-btn-secondary" onClick={() => router.push(`/payment-vouchers/${row.id}`)}><Eye size={14} /> Open</button>
                <button
                  type="button"
                  className="rg-btn rg-btn-primary"
                  onClick={() => void remind(row)}
                  disabled={sending === row.id || (row.waiting_with || "").startsWith("Account Officer")}
                  title={(row.waiting_with || "").startsWith("Account Officer") ? "Assign the signers on the voucher first" : "Send in-app, SMS and email reminder"}
                >
                  <BellRing size={14} /> {sending === row.id ? "Sending..." : "Remind"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Approved — fully signed, ready to pay                            */
/* ------------------------------------------------------------------ */
export function ApprovedView({ rows }: { rows: PvRow[] }) {
  const router = useRouter();
  const ready = rows.filter((r) => r.status === "Authorized");
  const total = ready.reduce((sum, r) => sum + amountOf(r), 0);
  const modes = ["Transfer", "Cash", "Cheque"].map((mode) => ({ mode, count: ready.filter((r) => r.disbursement_mode === mode).length, amount: ready.filter((r) => r.disbursement_mode === mode).reduce((s, r) => s + amountOf(r), 0) }));

  return (
    <section className="rg-pvv">
      <div className="rg-pvv-head">
        <div>
          <h2>Ready to pay</h2>
          <p>Fully signed and authorised by the Director General. Pay, then mark each voucher paid — the payee&apos;s signature is added as &quot;Received by&quot;.</p>
        </div>
      </div>
      <div className="rg-pvv-stats">
        <StatTile title="Ready to pay" value={ready.length} tone="emerald" note="Authorised vouchers" />
        <StatTile title="Amount to pay" value={naira(total)} tone="blue" note="Total of ready vouchers" />
        {modes.map((m) => <StatTile key={m.mode} title={m.mode} value={m.count} tone="slate" note={naira(m.amount)} />)}
      </div>
      <div className="rg-pvv-paylist">
        {!ready.length ? <p className="rg-pvv-empty"><Wallet size={18} /> No voucher is waiting for payment.</p> : null}
        {ready.map((row) => (
          <article key={row.id}>
            <div className="rg-pvv-pay-amount">{naira(amountOf(row))}</div>
            <div className="rg-pvv-pay-body">
              <strong>{row.voucher_no} · {row.payee_name || "—"}</strong>
              <span>{row.narration || "—"}</span>
              <small>{row.dept_name || "—"} · {row.disbursement_mode || "—"} · Authorised by {row.authorized_by_name || "the DG"}</small>
            </div>
            <div className="rg-pvv-actions">
              <button type="button" className="rg-btn rg-btn-secondary" onClick={() => router.push(`/payment-vouchers/${row.id}/print`)}><Printer size={14} /> Print</button>
              <button type="button" className="rg-btn rg-btn-primary" onClick={() => router.push(`/payment-vouchers/${row.id}`)}><UserCheck size={14} /> Mark paid</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 4. History — paid and cancelled, by month                           */
/* ------------------------------------------------------------------ */
export function HistoryView({ rows }: { rows: PvRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const closed = rows.filter((r) => r.status === "Paid" || r.status === "Cancelled");
  const filtered = closed.filter((r) => [r.voucher_no, r.payee_name, r.narration, r.dept_name].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  const monthMap = new Map<string, PvRow[]>();
  for (const row of [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())) {
    const label = new Date(row.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    monthMap.set(label, [...(monthMap.get(label) || []), row]);
  }
  const months = Array.from(monthMap.entries());
  const paidTotal = closed.filter((r) => r.status === "Paid").reduce((s, r) => s + amountOf(r), 0);

  return (
    <section className="rg-pvv">
      <div className="rg-pvv-head">
        <div><h2>Voucher history</h2><p>Every paid and cancelled voucher, month by month.</p></div>
        <label className="rg-register-search"><Search size={15} aria-hidden="true" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search voucher, payee or department" /></label>
      </div>
      <div className="rg-pvv-stats">
        <StatTile title="Paid vouchers" value={closed.filter((r) => r.status === "Paid").length} tone="emerald" note={naira(paidTotal)} />
        <StatTile title="Cancelled" value={closed.filter((r) => r.status === "Cancelled").length} tone="red" note="Raised in error" />
      </div>
      {!months.length ? <p className="rg-pvv-empty"><CalendarDays size={18} /> No paid or cancelled voucher yet.</p> : null}
      {months.map(([month, list]) => (
        <div key={month} className="rg-pvv-month">
          <h3>{month}<span>{list.length} voucher(s) · {naira(list.filter((r) => r.status === "Paid").reduce((s, r) => s + amountOf(r), 0))} paid</span></h3>
          <ul>
            {list.map((row) => (
              <li key={row.id} className={row.status === "Paid" ? "is-paid" : "is-cancelled"}>
                {row.status === "Paid" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                <span className="rg-pvv-month-date">{dateText(row.created_at)}</span>
                <strong>{row.voucher_no}</strong>
                <span className="rg-pvv-month-payee">{row.payee_name || "—"}</span>
                <span className="rg-pvv-month-amt">{naira(amountOf(row))}</span>
                <button type="button" className="rg-btn rg-btn-secondary" onClick={() => router.push(`/payment-vouchers/${row.id}`)}><Eye size={14} /> View</button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Print Centre — fully signed vouchers as print cards              */
/* ------------------------------------------------------------------ */
export function PrintCentreView({ rows }: { rows: PvRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const printable = rows
    .filter((r) => r.status === "Authorized" || r.status === "Paid")
    .filter((r) => [r.voucher_no, r.payee_name, r.dept_name].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  const waiting = rows.filter((r) => String(r.status || "").startsWith("Pending")).length;

  return (
    <section className="rg-pvv">
      <div className="rg-pvv-head">
        <div><h2>Print centre</h2><p>Only fully signed vouchers can be printed. Each prints on one A4 page; use &quot;Save as PDF&quot; in the print dialog for a digital copy.</p></div>
        <label className="rg-register-search"><Search size={15} aria-hidden="true" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search voucher, payee or department" /></label>
      </div>
      {waiting ? <p className="rg-pvv-note"><Clock3 size={15} /> {waiting} voucher(s) are still being signed and will appear here once the DG authorises them.</p> : null}
      <div className="rg-pvv-cards">
        {!printable.length ? <p className="rg-pvv-empty"><Printer size={18} /> No fully signed voucher to print yet.</p> : null}
        {printable.map((row) => (
          <article key={row.id}>
            <header><strong>{row.voucher_no}</strong><span className={row.status === "Paid" ? "is-paid" : "is-ready"}>{row.status === "Paid" ? "Paid" : "Authorised"}</span></header>
            <p>{row.payee_name || "—"}</p>
            <small>{row.dept_name || "—"} · {row.disbursement_mode || "—"} · {dateText(row.created_at)}</small>
            <div className="rg-pvv-card-foot">
              <b>{naira(amountOf(row))}</b>
              <button type="button" className="rg-btn rg-btn-primary" onClick={() => router.push(`/payment-vouchers/${row.id}/print`)}><Printer size={14} /> Print A4</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
