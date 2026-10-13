"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { nairaExact } from "@/lib/v4/money";
import { pvAmount, pvInSigning, pvStage, type Voucher } from "@/lib/v4/vouchers";
import { useVouchers } from "@/app/components/v4/useVouchers";
import Icon from "@/app/components/v4/Icon";
import { Select } from "@/app/components/v4/Select";
import { Btn, Card, Chip, Notice, PageHead, Skeleton, V4Page } from "@/app/components/v4/ui";

type Show = "both" | "ready" | "paid";
const MAX = 30;
const monthOf = (v: Voucher) => String(v.paid_on || v.authorized_at || v.created_at || "").slice(0, 7);

/** Payment Vouchers › Print Centre (mock-up 55): only fully signed vouchers print — one A4 page each. */
export default function PrintCentrePage() {
  const router = useRouter();
  const { rows, error } = useVouchers();
  const [q, setQ] = useState("");
  const [show, setShow] = useState<Show>("both");
  const [month, setMonth] = useState("all");
  const [picked, setPicked] = useState<string[]>([]);

  const printable = useMemo(() => (rows || []).filter((v) => ["ready", "paid"].includes(pvStage(v.status))), [rows]);
  const months = useMemo(() => [...new Set(printable.map(monthOf).filter(Boolean))].sort().reverse(), [printable]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return printable.filter((v) => (show === "both" || pvStage(v.status) === show) && (month === "all" || monthOf(v) === month) && (!t || `${v.voucher_no} ${v.payee_name}`.toLowerCase().includes(t)));
  }, [printable, q, show, month]);
  const unsigned = (rows || []).filter((v) => pvInSigning(v.status)).length;
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX ? p : [...p, id]));

  return (
    <V4Page>
      <PageHead title="Print Centre" sub="Only fully signed vouchers can be printed. Tick several to print them together, one A4 page each."
        actions={[{ label: picked.length ? `Print ${picked.length} selected` : "Print selected", icon: "printer", kind: "primary", disabled: !picked.length, onClick: () => router.push(`/payment-vouchers/print-centre/batch?ids=${picked.join(",")}`) }]} />
      {error ? <Notice tone="red">{error}</Notice> : null}
      <Card>
        <div className="v4-toolbar v4-t3">
          <label className="v4-field v4-f-search"><span className="v4-flabel">Search</span><span className="v4-control"><Icon name="search" /><input className="v4-input" placeholder="Voucher no. or payee" value={q} onChange={(e) => setQ(e.target.value)} /></span></label>
          <div className="v4-field"><span className="v4-flabel">Status</span><Select size="compact" ariaLabel="Status" value={show} onChange={(v) => setShow(v as Show)} options={[{ value: "both", label: "Authorised and paid" }, { value: "ready", label: "Authorised (not yet paid)" }, { value: "paid", label: "Paid" }]} /></div>
          <div className="v4-field"><span className="v4-flabel">Month</span><Select size="compact" ariaLabel="Month" value={month} onChange={setMonth} options={[{ value: "all", label: "All months" }, ...months.map((m) => ({ value: m, label: new Date(`${m}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" }) }))]} /></div>
          <button className="v4-btn v4-btn-ghost" type="button" onClick={() => { setQ(""); setShow("both"); setMonth("all"); setPicked([]); }}><Icon name="returned" />Reset</button>
        </div>
      </Card>
      {rows === null ? <Skeleton lines={6} /> : shown.length ? (
        <div className="v4-printgrid">
          {shown.map((v) => {
            const paid = pvStage(v.status) === "paid";
            return (
              <article className="v4-printcard" key={v.id}>
                <input className="v4-pick" type="checkbox" checked={picked.includes(v.id)} onChange={() => toggle(v.id)} aria-label={`Select ${v.voucher_no}`} />
                <strong>{v.voucher_no}</strong>
                <span className="v4-help">{String(Number(v.payee_count || 1) > 1 ? `${v.payee_count} payees` : v.payee_name || "—").toUpperCase()} · {v.disbursement_mode || "Transfer"}</span>
                <span className="v4-amt">{nairaExact(pvAmount(v))}</span>
                <span style={{ width: "fit-content" }}><Chip tone={paid ? "green" : "blue"}>{paid ? "Paid" : "Authorised"}</Chip></span>
                <span style={{ marginTop: 6 }}><Btn small a={{ href: `/payment-vouchers/${v.id}/print`, label: "Print A4", icon: "printer", kind: "secondary" }} /></span>
              </article>
            );
          })}
        </div>
      ) : <Notice tone="blue">No authorised or paid voucher matches these filters.</Notice>}
      {unsigned ? <Notice tone="amber">{unsigned} voucher{unsigned === 1 ? " is" : "s are"} still being signed and cannot be printed yet. See the <Link href="/payment-vouchers/pending">Signing Tracker</Link>.</Notice> : null}
    </V4Page>
  );
}
