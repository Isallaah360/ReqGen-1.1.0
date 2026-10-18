"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { positionName } from "@/app/components/v4/RoleSelect";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { Select } from "@/app/components/v4/Select";
import { Card, Notice, PageHead, Skeleton, V4Page } from "@/app/components/v4/ui";

type Move = { id: string; request_id: string; action_type: string | null; from_stage: string | null; to_stage: string | null; actor_name: string | null; actor_role_name: string | null; created_at: string };
type Period = "7" | "30" | "90";

const STAGE: Record<string, string> = { HR: "HR Coordinator", PO: "PD", Account: "Account", "HR Filing": "HR filing", Completed: "Completed" };
const stage = (s: string | null) => (s ? STAGE[s] || s : "");
function describe(m: Move) {
  const a = String(m.action_type || "").toLowerCase();
  if (a.startsWith("submit")) return { text: `Submitted${m.to_stage ? ` to ${stage(m.to_stage)}` : ""}`, icon: "send", tone: "blue" };
  if (a.startsWith("approv")) return { text: `Approved at ${stage(m.from_stage)}${m.to_stage ? ` → ${stage(m.to_stage)}` : ""}`, icon: "check", tone: "green" };
  if (a.startsWith("return")) return { text: `Returned at ${stage(m.from_stage)}`, icon: "returned", tone: "red" };
  if (a.startsWith("reject")) return { text: `Rejected at ${stage(m.from_stage)}`, icon: "x", tone: "red" };
  if (a.startsWith("withdraw")) return { text: "Withdrawn by the requester", icon: "returned", tone: "amber" };
  if (a.startsWith("paid") || a.startsWith("treat")) return { text: "Fund released by Account", icon: "wallet", tone: "brand" };
  return { text: `${m.action_type || "Updated"}${m.from_stage ? ` at ${stage(m.from_stage)}` : ""}`, icon: "history", tone: "amber" };
}

/**
 * Dashboard › Recent Activity (v4): what happened to the requests you can see — who acted,
 * in which position and when. Comments and request contents are not shown here.
 */
export default function RecentActivityPage() {
  const me = useIdentity();
  const [rows, setRows] = useState<Move[] | null>(null);
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("7");

  useEffect(() => {
    if (!me.ready) return;
    let alive = true;
    queueMicrotask(async () => {
      setRows(null);
      const since = new Date(Date.now() - Number(period) * 86400000).toISOString();
      const h = await supabase.from("request_history").select("id,request_id,action_type,from_stage,to_stage,actor_name,actor_role_name,created_at")
        .gte("created_at", since).not("action_type", "ilike", "attachment%").order("created_at", { ascending: false }).limit(300);
      if (!alive) return;
      if (h.error) { setError(h.error.message); setRows([]); return; }
      const list = (h.data || []) as Move[];
      const ids = [...new Set(list.map((m) => m.request_id))];
      const r = ids.length ? await supabase.from("requests").select("id,request_no").in("id", ids) : { data: [] };
      if (!alive) return;
      setNumbers(Object.fromEntries(((r.data || []) as Array<{ id: string; request_no: string }>).map((x) => [x.id, x.request_no])));
      setError(null);
      setRows(list);
    });
    return () => { alive = false; };
  }, [me.ready, period]);

  const days: Array<{ label: string; items: Move[] }> = [];
  for (const m of rows || []) {
    const label = new Date(m.created_at).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    const last = days[days.length - 1];
    if (last && last.label === label) last.items.push(m); else days.push({ label, items: [m] });
  }
  const isRegistry = me.role === "registry";

  return (
    <V4Page>
      <PageHead title="Recent Activity" sub="What happened to the requests you can see: who acted, in which position, and when." />
      {error ? <Notice tone="red">{error}</Notice> : null}
      <Card>
        <div className="v4-toolbar" style={{ gridTemplateColumns: "minmax(180px, 260px)" }}>
          <div className="v4-field"><span className="v4-flabel">Period</span><Select size="compact" ariaLabel="Period" value={period} onChange={(v) => setPeriod(v as Period)} options={[{ value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }]} /></div>
        </div>
        {rows === null ? <div className="v4-card-body"><Skeleton lines={6} /></div> : days.length ? days.map((d) => (
          <div key={d.label}>
            <div className="v4-day">{d.label}</div>
            <div className="v4-card-body">
              <ul className="v4-timeline">
                {d.items.map((m) => {
                  const x = describe(m);
                  const no = numbers[m.request_id] || "Request";
                  return (
                    <li key={m.id}>
                      <span className={`v4-ti v4-t-${x.tone}`}><Icon name={x.icon} /></span>
                      <span>
                        <strong>{isRegistry ? no : <Link href={`/requests/${m.request_id}`}>{no}</Link>} · {x.text}</strong>
                        <span>{m.actor_name || "Someone"}{m.actor_role_name ? ` · ${positionName(m.actor_role_name, m.actor_role_name)}` : ""}</span>
                      </span>
                      <span className="v4-time">{new Date(m.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>Nothing happened in this period on the requests you can see.</p>}
      </Card>
      <Notice tone="blue">Comments and request contents are not shown here. Your own actions are in <Link href="/profile/activity">My Activity</Link>.</Notice>
    </V4Page>
  );
}
