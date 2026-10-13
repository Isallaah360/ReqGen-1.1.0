"use client";

import { useMemo, useState } from "react";
import { fyOf } from "@/lib/v4/finance";
import { nairaExact } from "@/lib/v4/money";
import { shortDate } from "@/lib/v4/requestText";
import { pvAmount, pvStage, type Voucher } from "@/lib/v4/vouchers";
import { useVouchers } from "@/app/components/v4/useVouchers";
import Icon from "@/app/components/v4/Icon";
import { Select } from "@/app/components/v4/Select";
import { Btn, Card, Chip, Notice, PageHead, Skeleton, V4Page, downloadCsv, naira } from "@/app/components/v4/ui";

type Show = "both" | "paid" | "cancelled";
const fyText = (y: number) => `${y}/${String((y + 1) % 100).padStart(2, "0")}`;
const dayOf = (v: Voucher) => (pvStage(v.status) === "paid" ? v.paid_on || v.paid_at || v.updated_at : v.updated_at) || v.created_at || "";

/** Payment Vouchers › Paid History (mock-up 53): paid and cancelled vouchers, grouped by month. */
export default function PaidHistoryPage() {
  const { rows, error } = useVouchers();
  const [q, setQ] = useState("");
  const [show, setShow] = useState<Show>("both");
  const [fy, setFy] = useState(fyOf());
  const [now] = useState(() => Date.now());

  const done = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (rows || [])
      .filter((v) => { const s = pvStage(v.status); return show === "both" ? s === "paid" || s === "cancelled" : s === show; })
      .filter((v) => fyOf(new Date(dayOf(v) || now)) === fy)
      .filter((v) => !t || `${v.voucher_no} ${v.payee_name} ${v.narration} ${v.paid_reference}`.toLowerCase().includes(t))
      .sort((a, b) => dayOf(b).localeCompare(dayOf(a)));
  }, [rows, q, show, fy, now]);

  const months = useMemo(() => {
    const m = new Map<string, Voucher[]>();
    done.forEach((v) => { const k = dayOf(v).slice(0, 7); m.set(k, [...(m.get(k) || []), v]); });
    return [...m.entries()];
  }, [done]);

  function exportCsv() {
    downloadCsv(`Paid_History_FY_${fyText(fy).replace("/", "-")}.csv`, done.map((v) => ({
      Voucher: v.voucher_no || "", Payee: v.payee_name || "", Mode: v.disbursement_mode || "", Amount: pvAmount(v),
      Status: pvStage(v.status) === "paid" ? "Paid" : "Cancelled", Date: shortDate(dayOf(v)), "Bank reference": v.paid_reference || "", Reason: v.cancel_reason || "",
    })));
  }

  return (
    <V4Page>
      <PageHead title="Paid History" sub="Paid and cancelled vouchers, grouped by the month they were paid." actions={[{ label: "Export CSV", icon: "download", kind: "secondary", onClick: exportCsv, disabled: !done.length }]} />
      {error ? <Notice tone="red">{error}</Notice> : null}
      <Card>
        <div className="v4-toolbar v4-t3">
          <label className="v4-field v4-f-search"><span className="v4-flabel">Search</span><span className="v4-control"><Icon name="search" /><input className="v4-input" placeholder="Voucher no., payee or reference" value={q} onChange={(e) => setQ(e.target.value)} /></span></label>
          <div className="v4-field"><span className="v4-flabel">Status</span><Select size="compact" ariaLabel="Status" value={show} onChange={(v) => setShow(v as Show)} options={[{ value: "both", label: "Paid and cancelled" }, { value: "paid", label: "Paid" }, { value: "cancelled", label: "Cancelled" }]} /></div>
          <div className="v4-field"><span className="v4-flabel">Financial year</span><Select size="compact" ariaLabel="Financial year" value={String(fy)} onChange={(v) => setFy(Number(v))} options={[0, 1, 2, 3].map((n) => ({ value: String(fyOf() - n), label: `FY ${fyText(fyOf() - n)}` }))} /></div>
          <button className="v4-btn v4-btn-ghost" type="button" onClick={() => { setQ(""); setShow("both"); setFy(fyOf()); }}><Icon name="returned" />Reset</button>
        </div>
        {rows === null ? <Skeleton lines={6} /> : months.length ? months.map(([k, list]) => {
          const paid = list.filter((v) => pvStage(v.status) === "paid");
          const cancelled = list.length - paid.length;
          return (
            <div key={k}>
              <div className="v4-month"><span>{new Date(`${k}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span><span className="v4-num">{paid.length} paid{cancelled ? ` · ${cancelled} cancelled` : ""} · {naira(paid.reduce((t, v) => t + pvAmount(v), 0))}</span></div>
              <ul className="v4-rows">
                {list.map((v) => {
                  const isPaid = pvStage(v.status) === "paid";
                  return (
                    <li key={v.id}>
                      <span className={`v4-ri v4-t-${isPaid ? "green" : "red"}`}><Icon name={isPaid ? "check" : "x"} /></span>
                      <span className="v4-rt"><strong>{v.voucher_no} · {String(Number(v.payee_count || 1) > 1 ? `${v.payee_count} payees` : v.payee_name || "—").toUpperCase()}</strong>
                        <span>{isPaid ? `Paid ${shortDate(dayOf(v))} · ${v.disbursement_mode || "Transfer"}${v.paid_reference ? ` · ref ${v.paid_reference}` : ""}` : `Cancelled ${shortDate(dayOf(v))}${v.cancel_reason ? ` · ${v.cancel_reason}` : ""}`}</span></span>
                      <span className="v4-rr"><span className="v4-amt">{nairaExact(pvAmount(v))}</span><Chip tone={isPaid ? "green" : "red"}>{isPaid ? "Paid" : "Cancelled"}</Chip><Btn small a={{ href: `/payment-vouchers/${v.id}`, label: "View", kind: "secondary" }} /></span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        }) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>No paid or cancelled voucher in FY {fyText(fy)}.</p>}
      </Card>
    </V4Page>
  );
}
