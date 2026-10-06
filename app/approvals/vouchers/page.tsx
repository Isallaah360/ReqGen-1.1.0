"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PenLine, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { StatTile } from "@/app/components/ui/StatTile";

/** ReqGen v3.1.6 — Approvals → 2. Voucher Signing: PVs waiting for the signed-in officer. */

type Row = { id: string; voucher_no: string | null; request_no: string | null; payee_name: string | null; amount: number | null; disbursement_mode: string | null; status: string | null; signing_stage: string | null; created_at: string };

function naira(n: number | null | undefined) {
  return `₦${Math.round(Number(n || 0)).toLocaleString("en-NG")}`;
}

function dateText(d: string | null | undefined) {
  if (!d) return "—";
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function VoucherSigningPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    const { data, error } = await supabase.rpc("get_payment_vouchers_assigned_to_me");
    if (error) setMessage(error.message);
    setRows(((data || []) as Row[]).filter((row) => String(row.status || "").startsWith("Pending")));
    setLoading(false);
  }, []);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return (
    <main className="rg-register-page">
      <PageHeader
        title="Voucher Signing"
        description="Payment vouchers waiting for your check, signature or authorisation."
        actions={<button type="button" className="rg-btn rg-btn-secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={15} /> Refresh</button>}
      />
      {message ? <div className="rg-register-message" role="alert">{message}</div> : null}
      <section className="rg-register-stats">
        <StatTile title="Waiting for you" value={rows.length} tone="orange" note="Vouchers to sign" />
        <StatTile title="Value waiting" value={naira(total)} tone="blue" note="Total of these vouchers" />
      </section>
      <section className="rg-register-card">
        <div className="rg-register-table">
          <table>
            <thead><tr><th>Voucher</th><th>Payee</th><th>Request</th><th>Mode</th><th>Amount</th><th>Your step</th><th>Raised</th><th>Action</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="rg-register-empty">Loading vouchers...</td></tr>
              ) : rows.length ? rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.voucher_no || "—"}</td>
                  <td>{row.payee_name || "—"}</td>
                  <td>{row.request_no || "—"}</td>
                  <td>{row.disbursement_mode || "—"}</td>
                  <td>{naira(row.amount)}</td>
                  <td>{row.signing_stage || row.status}</td>
                  <td>{dateText(row.created_at)}</td>
                  <td><Link className="rg-register-print" href={`/approvals/vouchers/${row.id}`}><PenLine size={14} /> Open and sign</Link></td>
                </tr>
              )) : (
                <tr><td colSpan={8} className="rg-register-empty">No voucher is waiting for your signature.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
