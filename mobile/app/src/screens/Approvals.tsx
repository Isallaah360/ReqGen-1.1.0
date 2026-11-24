import { useState } from "react";
import { ShieldCheck, Check, CornerUpLeft, X, Wallet } from "lucide-react";
import { db } from "../lib/core";
import { LIST_COLS, useOnline, useSaved, type Req, type DirectWaiting } from "../lib/data";
import { ago, naira, waitingForMe, initials } from "../lib/text";
import { useApp } from "../App";
import { Big, Body, Cell, Chip, Empty, LoadError, Seg, Skeleton, Updated, useNav } from "../ui";
import Detail from "./Detail";
import Vouchers from "./Vouchers";

type Row = { id: string; title: string; who: string; amount: number | null; at: string | null; direct: boolean; unread?: boolean };
type Done = { kind: string; item_id: string; item_no: string | null; title: string | null; amount: number | null; action_type: string | null; acted_as: string | null; acted_at: string | null };

export default function Approvals() {
  const { me, refreshPending } = useApp();
  const { push } = useNav();
  const online = useOnline();
  const [tab, setTab] = useState<"wait" | "done">("wait");
  const waiting = useSaved<Row[]>(`appr:${me.id}`, async () => {
    const s = await db();
    const [r, d] = await Promise.all([
      s.from("requests").select(LIST_COLS).or(`current_owner.eq.${me.id},assigned_account_officer_id.eq.${me.id},assigned_account_officer_user_id.eq.${me.id}`).order("created_at", { ascending: true }).limit(500),
      s.rpc("reqgen_direct_waiting"),
    ]);
    if (r.error) throw new Error(r.error.message);
    const routed: Row[] = ((r.data || []) as Req[]).filter((x) => waitingForMe(x, me.id)).map((x) => ({ id: x.id, title: x.title || "Request", who: x.requester_name || "Staff", amount: x.amount, at: x.created_at, direct: !!x.direct_to }));
    const direct: Row[] = ((d.data || []) as DirectWaiting[]).map((x) => ({ id: x.id, title: x.title || "Direct request", who: x.requester_name || "Staff", amount: x.amount, at: x.created_at, direct: true, unread: !x.read_at }));
    const seen = new Set<string>();
    return [...direct, ...routed].filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
  });
  const done = useSaved<Done[]>(tab === "done" ? `done:${me.id}` : null, async () => {
    const { data, error } = await (await db()).rpc("reqgen_treated_by_me", { p_limit: 40 });
    if (error) throw new Error(error.message);
    return (data || []) as Done[];
  });
  const n = waiting.data?.length || 0;
  const cur = tab === "wait" ? waiting : done;
  return (
    <>
      <Big>Approvals</Big>
      <Body tabs onRefresh={async () => { await Promise.all([cur.reload(), refreshPending()]); }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ flex: 1 }}><Seg value={tab} onChange={setTab} items={[{ k: "wait", label: n ? `Waiting ${n}` : "Waiting" }, { k: "done", label: "Done" }]} /></div>
          <button type="button" className="btn bs sm" onClick={() => push(<Vouchers />)} aria-label="Vouchers"><Wallet size={18} />Vouchers</button>
        </div>
        <LoadError error={cur.error} />
        {tab === "wait" ? (
          waiting.loading && !waiting.data ? <Skeleton rows={4} /> : n ? (
            <div className="grp">
              {waiting.data!.map((x) => (
                <Cell key={x.id} icon={initials(x.who)} title={x.title} sub={`${x.direct ? "Direct from " : ""}${x.who}${Number(x.amount) > 0 ? `, ${naira(x.amount)}` : ""}, ${ago(x.at)}`}
                  right={x.unread ? <Chip tone="or">New</Chip> : undefined}
                  onClick={() => push(<Detail id={x.id} meId={me.id} onChanged={() => { void waiting.reload(); void refreshPending(); }} />)} />
              ))}
            </div>
          ) : <Empty icon={<ShieldCheck size={28} />} title="Nothing waiting for you" text="When a request reaches you, it shows here and you get an SMS and e-mail." />
        ) : done.loading && !done.data ? <Skeleton rows={4} /> : done.data && done.data.length ? (
          <div className="grp">
            {done.data.filter((x) => x.kind !== "voucher").map((x, i) => {
              const a = String(x.action_type || "").toLowerCase();
              const icon = a === "return" ? <CornerUpLeft size={18} /> : /reject|declin/.test(a) ? <X size={18} /> : <Check size={18} />;
              return <Cell key={`${x.item_id}-${i}`} icon={icon} iconTone={a === "return" ? "wa" : /reject|declin/.test(a) ? "er" : "ok"} title={x.title || x.item_no || "Request"}
                sub={`${x.item_no || ""}, ${x.action_type || "Done"}${Number(x.amount) > 0 ? `, ${naira(x.amount)}` : ""}, ${ago(x.acted_at)}`}
                onClick={() => push(<Detail id={x.item_id} meId={me.id} />)} />;
            })}
          </div>
        ) : <Empty icon={<Check size={28} />} title="Nothing done yet" text="Requests you approve or send back show here." />}
        <Updated at={cur.at} offline={!online} />
      </Body>
    </>
  );
}
