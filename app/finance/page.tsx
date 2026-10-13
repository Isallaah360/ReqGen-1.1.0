"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { isAwaitingUser } from "@/lib/approvalQueue";
import { canSeeBudgetBalances } from "@/lib/v4/budgetVisibility";
import { num, subheadLabel, subheadUsed, utilisation, type Subhead } from "@/lib/v4/finance";
import { waitedFor } from "@/lib/v4/requestText";
import MotherPage from "@/app/components/v4/MotherPage";
import Icon from "@/app/components/v4/Icon";
import { useIdentity } from "@/app/components/v4/useIdentity";
import { Btn, Notice, naira } from "@/app/components/v4/ui";

type Req = { id: string; request_no: string | null; title: string | null; amount: number | null; status: string | null; current_stage: string | null; current_owner: string | null; assigned_account_officer_id: string | null; assigned_account_officer_user_id: string | null; updated_at: string | null; created_at: string | null };

/** Finance — mother page (mock-up 36): tiles, subheads to watch, and what is waiting for Finance. */
export default function FinanceHome() {
  const me = useIdentity();
  const [watch, setWatch] = useState<Subhead[] | null>(null);
  const [waiting, setWaiting] = useState<Req[] | null>(null);
  const mayView = canSeeBudgetBalances(me.role);

  useEffect(() => {
    if (!me.ready || !mayView) return;
    let alive = true;
    (async () => {
      const [s, r] = await Promise.all([
        supabase.from("subheads").select("id,dept_id,code,name,approved_allocation,reserved_amount,expenditure,balance,is_active,bank_account_id").eq("is_active", true),
        supabase.from("requests").select("id,request_no,title,amount,status,current_stage,current_owner,assigned_account_officer_id,assigned_account_officer_user_id,updated_at,created_at").order("updated_at", { ascending: true }).limit(2000),
      ]);
      if (!alive) return;
      setWatch(((s.data || []) as Subhead[]).filter((x) => num(x.approved_allocation) > 0).sort((a, b) => utilisation(b) - utilisation(a)).slice(0, 5));
      setWaiting(((r.data || []) as Req[]).filter((x) => String(x.current_stage || "").toLowerCase() === "account" && isAwaitingUser(x, me.userId, me.role)).slice(0, 5));
    })();
    return () => { alive = false; };
  }, [me.ready, me.userId, me.role, mayView]);

  return (
    <MotherPage moduleKey="finance">
      {mayView ? (
        <div className="v4-cols">
          <section className="v4-card v4-card-pad">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}><h2 className="v4-h2">Subheads to watch</h2><Link href="/finance/subheads" style={{ fontSize: 13.5 }}>All subheads</Link></div>
            {watch === null ? <p className="v4-muted" style={{ margin: 0 }}>Loading…</p> : watch.length ? (
              <ul className="v4-util">
                {watch.map((s) => {
                  const p = utilisation(s);
                  return (
                    <li key={s.id}><strong>{subheadLabel(s)}</strong><span className="v4-v">{naira(subheadUsed(s), { compact: true })} of {naira(s.approved_allocation, { compact: true })} · {p}%</span>
                      <span className="v4-bar"><span className={p >= 90 ? "v4-risk" : p >= 75 ? "v4-warn" : ""} style={{ width: `${Math.min(100, p)}%` }} /></span></li>
                  );
                })}
              </ul>
            ) : <p className="v4-muted" style={{ margin: 0 }}>No subhead has an allocation yet.</p>}
          </section>
          <section className="v4-card">
            <div className="v4-card-head"><h2 className="v4-h2">Waiting for you</h2><Link href="/finance/processing">Open <Icon name="right" size="sm" /></Link></div>
            {waiting === null ? <p className="v4-muted" style={{ padding: "16px 20px", margin: 0 }}>Loading…</p> : waiting.length ? (
              <ul className="v4-rows">
                {waiting.map((r) => (
                  <li key={r.id}><span className="v4-ri v4-t-amber"><Icon name="clock" /></span>
                    <span className="v4-rt"><strong>{r.request_no} · {r.title}</strong><span>Approved by DG · {waitedFor(r.updated_at || r.created_at)}</span></span>
                    <span className="v4-rr"><span className="v4-amt">{naira(r.amount)}</span><Btn small a={{ href: `/finance/request/${r.id}`, label: "Treat", kind: "primary" }} /></span></li>
                ))}
              </ul>
            ) : <p className="v4-muted" style={{ padding: "16px 20px", margin: 0 }}>Nothing is waiting for you.</p>}
          </section>
        </div>
      ) : null}
      <Notice tone="blue">Charts and statements are in <b>Reports › Finance Statements</b> and <b>Reports › Transactions + Analysis</b>. Reconciliation is in <b>Audit</b>. Finance keeps only the daily work.</Notice>
    </MotherPage>
  );
}
