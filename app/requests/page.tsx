"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import MotherPage from "@/app/components/v4/MotherPage";
import { Card, Chip, Rows, Skeleton, naira, type RowItem } from "@/app/components/v4/ui";
import { shortDate, stageWords, statusChip } from "@/lib/v4/requestText";

type Row = { id: string; request_no: string | null; title: string | null; amount: number | null; status: string | null; current_stage: string | null; created_at: string | null };

/** Requests — mother page (v4.0.0). */
export default function RequestsHome() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase
        .from("requests")
        .select("id,request_no,title,amount,status,current_stage,created_at")
        .eq("created_by", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (alive) setRows((data || []) as Row[]);
    })();
    return () => { alive = false; };
  }, []);

  const items: RowItem[] = (rows || []).map((r) => {
    const chip = statusChip(r.status, r.current_stage);
    return {
      key: r.id,
      icon: "file",
      tone: chip.tone === "red" ? "red" : chip.tone === "green" ? "green" : "blue",
      title: `${r.request_no || "Draft"} · ${r.title || "Untitled request"}`,
      sub: `${stageWords(r.current_stage)} · ${shortDate(r.created_at)}`,
      right: <><span className="v4-amt">{naira(r.amount)}</span><Chip tone={chip.tone}>{chip.label}</Chip></>,
      href: `/requests/${r.id}`,
    };
  });

  return (
    <MotherPage moduleKey="requests">
      <Card title="Latest requests" link={{ href: "/requests/mine", label: "All my requests" }}>
        {rows === null ? <Skeleton /> : <Rows items={items} empty="You have not made a request yet. Choose New Request to start." />}
      </Card>
    </MotherPage>
  );
}
