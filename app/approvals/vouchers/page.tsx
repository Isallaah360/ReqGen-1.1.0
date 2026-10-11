"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { APPROVAL_QUEUE_CHANGED_EVENT } from "@/lib/approvalQueue";
import { ageDays, waitedFor } from "@/lib/v4/requestText";
import { Btn, Card, Chip, Notice, PageHead, Skeleton, Stats, V4Page, naira, type StatItem } from "@/app/components/v4/ui";

/** Approvals › Vouchers to Sign (v4.1.0): payment vouchers waiting for the signed-in officer. */

type Row = { id: string; voucher_no: string | null; request_no: string | null; payee_name: string | null; amount: number | null; disbursement_mode: string | null; status: string | null; signing_stage: string | null; created_at: string };

function stepTone(step: string) {
  const s = step.toLowerCase();
  if (/author|dg/.test(s)) return "brand" as const;
  if (/check|audit/.test(s)) return "amber" as const;
  return "blue" as const;
}

export default function VouchersToSignPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_payment_vouchers_assigned_to_me");
    setMessage(error ? error.message : null);
    setRows(((data || []) as Row[]).filter((row) => String(row.status || "").startsWith("Pending")));
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void load(); });
    const again = () => void load();
    window.addEventListener(APPROVAL_QUEUE_CHANGED_EVENT, again);
    return () => window.removeEventListener(APPROVAL_QUEUE_CHANGED_EVENT, again);
  }, [load]);

  const total = useMemo(() => (rows || []).reduce((sum, r) => sum + Number(r.amount || 0), 0), [rows]);
  const late = (rows || []).filter((r) => ageDays(r.created_at) >= 3).length;
  const stats: StatItem[] = [
    { label: "Waiting for me", value: rows ? rows.length : "…", note: "Vouchers to check or sign", icon: "pen", tone: "brand" },
    { label: "Value waiting", value: rows ? naira(total) : "…", note: "Total of these vouchers", icon: "wallet", tone: "blue" },
    { label: "Waiting 3+ days", value: rows ? late : "…", note: late ? "Please sign these first" : "None", icon: "clock", tone: late ? "red" : "green" },
  ];

  return (
    <V4Page>
      <PageHead
        title="Vouchers to Sign"
        sub="Payment vouchers waiting for your check, counter signature, or signature and authorisation."
        actions={[{ label: "Refresh", icon: "returned", kind: "secondary", onClick: () => { setRows(null); void load(); } }]}
      />
      {message ? <Notice tone="red">{message}</Notice> : null}
      <Stats items={stats} />
      <Card>
        {rows === null ? <Skeleton lines={4} /> : rows.length ? (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Voucher</th><th className="v4-r">Amount</th><th>Payee</th><th className="v4-hide-sm">Paid by</th><th>Your step</th><th className="v4-hide-sm">Waiting</th><th className="v4-r">Action</th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const step = r.signing_stage || r.status || "Sign";
                  const days = ageDays(r.created_at);
                  return (
                    <tr key={r.id}>
                      <td><span className="v4-strong">{r.voucher_no || "—"}</span><span className="v4-sub">{r.request_no || "Manual voucher"}</span></td>
                      <td className="v4-r v4-num v4-strong">{naira(r.amount)}</td>
                      <td data-label="Payee">{r.payee_name || "—"}</td>
                      <td className="v4-hide-sm">{r.disbursement_mode || "—"}</td>
                      <td><Chip tone={stepTone(step)}>{step}</Chip></td>
                      <td className="v4-hide-sm"><Chip tone={days >= 3 ? "red" : days >= 1 ? "amber" : "green"}>{waitedFor(r.created_at)}</Chip></td>
                      <td className="v4-r"><Btn small a={{ href: `/approvals/vouchers/${r.id}`, label: /check/i.test(step) ? "Check" : "Sign", kind: "primary" }} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>No voucher is waiting for your signature.</p>}
      </Card>
    </V4Page>
  );
}
