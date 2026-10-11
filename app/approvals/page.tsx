"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isAwaitingUser, type ApprovalQueueRow } from "@/lib/approvalQueue";
import MotherPage from "@/app/components/v4/MotherPage";
import { useIdentity } from "@/app/components/v4/useIdentity";
import { Btn, Card, Chip, Rows, Skeleton, naira, type RowItem } from "@/app/components/v4/ui";
import { ageDays, stageWords, waitedFor } from "@/lib/v4/requestText";

type Row = ApprovalQueueRow & { id: string; request_no: string | null; title: string | null; amount: number | null; created_at: string | null; updated_at?: string | null };

/** Approvals — mother page (v4.0.0): oldest waiting first. */
export default function ApprovalsHome() {
  const me = useIdentity();
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    if (!me.ready || !me.userId) return;
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("requests")
        .select("id,request_no,title,amount,status,current_stage,current_owner,assigned_account_officer_id,assigned_account_officer_user_id,created_at")
        .order("created_at", { ascending: true })
        .limit(2000);
      if (!alive) return;
      setRows(((data || []) as Row[]).filter((r) => isAwaitingUser(r, me.userId, me.role)).slice(0, 6));
    })();
    return () => { alive = false; };
  }, [me.ready, me.userId, me.role]);

  const items: RowItem[] = (rows || []).map((r) => {
    const days = ageDays(r.created_at);
    return {
      key: r.id,
      icon: "file",
      tone: "brand",
      title: `${r.request_no || "Request"} · ${r.title || "Untitled"}`,
      sub: `${stageWords(r.current_stage)} · raised ${waitedFor(r.created_at)} ago`,
      right: <><span className="v4-amt">{naira(r.amount)}</span><Chip tone={days >= 3 ? "red" : days >= 1 ? "amber" : "green"}>{waitedFor(r.created_at)}</Chip><Btn small a={{ href: `/requests/${r.id}`, label: "Open", kind: "primary" }} /></>,
    };
  });

  return (
    <MotherPage moduleKey="approvals">
      <Card title="Oldest waiting" link={{ href: "/approvals/inbox", label: "See all" }}>
        {rows === null ? <Skeleton /> : <Rows items={items} empty="Nothing is waiting for you. New requests routed to you will appear here." />}
      </Card>
    </MotherPage>
  );
}
