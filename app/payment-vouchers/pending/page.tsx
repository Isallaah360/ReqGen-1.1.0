"use client";

import { useState } from "react";
import { normalizeRole } from "@/lib/roles";
import { waitedFor } from "@/lib/v4/requestText";
import { pvAmount, pvInSigning, pvNowWith, pvStage, type Voucher } from "@/lib/v4/vouchers";
import { remindVoucher, useVouchers } from "@/app/components/v4/useVouchers";
import Icon from "@/app/components/v4/Icon";
import { Btn, Chip, Empty, Notice, PageHead, Skeleton, V4Page, naira } from "@/app/components/v4/ui";

type Lane = "all" | "check" | "counter" | "dg" | "late";
const DAY = 86400000;

/** Payment Vouchers › Signing Tracker (mock-up 51): where every unsigned voucher is, and for how long. */
export default function SigningTrackerPage() {
  const { me, rows, error, reload } = useVouchers();
  const role = normalizeRole(me.role).replace(/\d+$/, "");
  const canRemind = ["account", "accounts", "accountofficer", "auditor", "admin"].includes(role);
  const [lane, setLane] = useState<Lane>("all");
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const [now] = useState(() => Date.now());

  const since = (v: Voucher) => new Date(v.updated_at || v.created_at || now).getTime();
  const signing = (rows || []).filter((v) => pvInSigning(v.status)).sort((a, b) => since(a) - since(b));
  const late = (v: Voucher) => now - since(v) > 3 * DAY;
  const shown = signing.filter((v) => lane === "all" || (lane === "late" ? late(v) : pvStage(v.status) === lane));
  const count = (s: Lane) => signing.filter((v) => (s === "late" ? late(v) : pvStage(v.status) === s)).length;

  async function remind(v: Voucher) {
    const res = await remindVoucher(v.id);
    setMsg(res.error ? { tone: "red", text: res.error } : { tone: "green", text: `Reminder for ${v.voucher_no} sent to ${res.sentTo || pvNowWith(v)}.` });
    if (!res.error) await reload();
  }

  const lanes: Array<{ key: Lane; label: string }> = [
    { key: "check", label: "With the Auditor" }, { key: "counter", label: "With the Counter Signer" },
    { key: "dg", label: "With the Director General" }, { key: "late", label: "Waiting 3+ days" },
  ];

  return (
    <V4Page>
      <PageHead title="Signing Tracker" sub="Where every unsigned voucher is, and for how long. Remind sends an in-app alert, an SMS and an email to whoever holds it." />
      {error ? <Notice tone="red">{error}</Notice> : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <div className="v4-lanes" role="group" aria-label="Filter by who holds the voucher">
        {lanes.map((l) => (
          <button key={l.key} type="button" className={`v4-lane${l.key === "late" ? " v4-late" : ""}`} aria-pressed={lane === l.key} onClick={() => setLane(lane === l.key ? "all" : l.key)}>
            <b>{rows ? count(l.key) : "…"}</b><span>{l.label}</span>
          </button>
        ))}
      </div>
      {rows === null ? <Skeleton lines={6} /> : shown.length ? (
        <section className="v4-trackcards">
          {shown.map((v) => {
            const st = pvStage(v.status);
            const order = ["check", "counter", "dg"];
            const pos = order.indexOf(st);
            const days = Math.floor((now - since(v)) / DAY);
            return (
              <article className="v4-tcard" key={v.id}>
                <div className="v4-top">
                  <span><strong>{v.voucher_no}</strong><span>{String(Number(v.payee_count || 1) > 1 ? `${v.payee_count} payees` : v.payee_name || "—").toUpperCase()} · {v.disbursement_mode || "Transfer"}</span></span>
                  <b className="v4-num">{naira(pvAmount(v))}</b>
                </div>
                <div className="v4-steps5">
                  <div className="v4-done">Prepared</div>
                  {["Checked", "Counter", "DG"].map((label, i) => <div key={label} className={i < pos ? "v4-done" : i === pos ? "v4-now" : ""}>{label}</div>)}
                </div>
                <div className="v4-bottom">
                  <span>Now with <b>{pvNowWith(v)}</b> · <Chip tone={days >= 3 ? "red" : "amber"}>{waitedFor(v.updated_at || v.created_at)}</Chip></span>
                  <span style={{ display: "flex", gap: 8 }}>
                    <Btn small a={{ href: `/payment-vouchers/${v.id}`, label: "Open", kind: "secondary" }} />
                    {canRemind ? <button className="v4-btn v4-btn-primary" type="button" style={{ minHeight: 38 }} onClick={() => void remind(v)}><Icon name="bell" />Remind</button> : null}
                  </span>
                </div>
              </article>
            );
          })}
        </section>
      ) : <Empty icon="check" title={lane === "all" ? "No voucher is waiting for a signature." : "Nothing here."}>Vouchers appear here from the moment they are prepared until the Director General authorises them.</Empty>}
    </V4Page>
  );
}
