"use client";

import { useState } from "react";
import { nairaExact } from "@/lib/v4/money";
import { pvAmount, pvMode, pvStage, type Voucher } from "@/lib/v4/vouchers";
import { useVouchers } from "@/app/components/v4/useVouchers";
import { Btn, Card, Empty, Notice, PageHead, Skeleton, Stats, V4Page, naira, type StatItem } from "@/app/components/v4/ui";

type Mode = "all" | "Transfer" | "Cash" | "Cheque";

/** Payment Vouchers › Ready to Pay (mock-up 52): signed and authorised by the DG — pay, then mark paid. */
export default function ReadyToPayPage() {
  const { rows, error } = useVouchers();
  const [mode, setMode] = useState<Mode>("all");
  const ready = (rows || []).filter((v) => pvStage(v.status) === "ready").sort((a, b) => String(a.authorized_at || "").localeCompare(String(b.authorized_at || "")));
  const of = (m: Mode) => ready.filter((v) => m === "all" || (v.disbursement_mode || "Transfer") === m);
  const sum = (l: Voucher[]) => l.reduce((t, v) => t + pvAmount(v), 0);
  const shown = of(mode);

  const stats: StatItem[] = (["all", "Transfer", "Cash", "Cheque"] as Mode[]).map((m) => ({
    label: m === "all" ? "Ready to pay" : m, value: rows ? of(m).length : "…", note: rows ? (sum(of(m)) ? naira(sum(of(m))) : "—") : undefined,
    icon: m === "all" ? "wallet" : m === "Transfer" ? "arrows" : m === "Cash" ? "card" : "file", tone: m === "Cash" ? "amber" : m === "Cheque" ? "brand" : "blue",
    pressed: mode === m, onClick: () => setMode(mode === m ? "all" : m),
  }));

  return (
    <V4Page>
      <PageHead title="Ready to Pay" sub="Signed and authorised by the Director General. Pay, then mark paid." />
      {error ? <Notice tone="red">{error}</Notice> : null}
      <Stats items={stats} />
      {rows === null ? <Skeleton lines={5} /> : shown.length ? (
        <Card>
          {shown.map((v) => {
            const many = Number(v.payee_count || 1) > 1;
            const what = many ? `${v.item_count || 0} Official requests · see Transfer Schedule` : v.narration || `${v.item_count || 1} request${Number(v.item_count || 1) === 1 ? "" : "s"}`;
            return (
              <div className="v4-paycard" key={v.id}>
                <span><strong style={{ fontSize: 15 }}>{v.voucher_no} · {many ? `${v.payee_count} PAYEES` : String(v.payee_name || "—").toUpperCase()}</strong>
                  <span className="v4-help" style={{ display: "block" }}>{what} · {pvMode(v)}{v.authorized_by_name ? ` · authorised by ${v.authorized_by_name}` : ""}</span></span>
                <span className="v4-amt">{nairaExact(pvAmount(v))}</span>
                <span style={{ gridColumn: "1/-1", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Btn small a={{ href: `/payment-vouchers/${v.id}/print`, label: "Print", icon: "printer", kind: "secondary" }} />
                  <Btn small a={{ href: `/payment-vouchers/${v.id}`, label: "Mark paid", icon: "check", kind: "primary" }} />
                </span>
              </div>
            );
          })}
        </Card>
      ) : <Empty icon="check" title="Nothing is waiting to be paid.">A voucher comes here once the Director General signs, stamps and authorises it.</Empty>}
    </V4Page>
  );
}
