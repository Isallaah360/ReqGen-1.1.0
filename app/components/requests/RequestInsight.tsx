"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { nairaExact } from "@/lib/v4/money";
import { stageWords } from "@/lib/v4/requestText";
import Icon from "@/app/components/v4/Icon";
import { Notice, Skeleton, Tabs } from "@/app/components/v4/ui";

type Mini = { id: string; request_no: string | null; title: string | null; amount: number | null; status: string | null; stage?: string | null; created_at: string | null; same_requester?: boolean; same_subhead?: boolean; possible_duplicate?: boolean };
type Insight = {
  request_no: string | null;
  amount: number | null;
  balances_shown: boolean;
  similar: Mini[];
  subhead: { code: string | null; name: string | null; used_this_year: number; balances_shown: boolean; allocation: number | null; reserved: number | null; expenditure: number | null; available: number | null } | null;
  subhead_recent: Mini[];
  amount_check: { count: number; average: number | null; lowest: number | null; highest: number | null } | null;
  requester: { name: string | null; count: number; total: number; returned: number; last_at: string | null } | null;
  follow_up: Mini[];
  route: Array<{ action: string | null; by_position: string | null; from_stage: string | null; to_stage: string | null; at: string }>;
  created_at: string | null;
};
type TabKey = "similar" | "subhead" | "amount" | "requester" | "route";

const day = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const hours = (ms: number) => {
  const h = Math.max(0, ms) / 3_600_000;
  if (h < 1) return "under an hour";
  if (h < 48) return `${Math.round(h)} hour${Math.round(h) === 1 ? "" : "s"}`;
  return `${Math.round(h / 24)} days`;
};

function MiniList({ rows, empty }: { rows: Mini[]; empty: string }) {
  if (!rows.length) return <p className="v4-muted" style={{ margin: 0 }}>{empty}</p>;
  return (
    <ul className="v4-insight-list">
      {rows.map((r) => (
        <li key={r.id}>
          <Link href={`/requests/${r.id}`}>{r.request_no || "Request"}</Link>
          <span className="v4-insight-t">{r.title || "Untitled"}{r.same_requester ? " · same requester" : ""}{r.same_subhead ? " · same subhead" : ""}</span>
          <span className="v4-insight-r"><b>{nairaExact(r.amount)}</b><span>{r.status || stageWords(r.stage || null)} · {day(r.created_at)}</span></span>
        </li>
      ))}
    </ul>
  );
}

/**
 * v4.6.9 Request Insight — for the DG and the other officers who decide on a request.
 * Read-only (reqgen_request_insight). Subhead balances appear only for positions allowed to see
 * them; the database decides that, not this screen.
 */
export default function RequestInsight({ requestId }: { requestId: string }) {
  const [data, setData] = useState<Insight | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "hidden">("loading");
  const [tab, setTab] = useState<TabKey>("similar");
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    void supabase.rpc("reqgen_request_insight", { p_request_id: requestId }).then(({ data: d, error }) => {
      if (!alive) return;
      if (error || !d) { setState("hidden"); return; } // not installed yet, or not on this route
      setData(d as Insight);
      setNow(Date.now());
      setState("ready");
    });
    return () => { alive = false; };
  }, [requestId]);

  if (state === "hidden") return null;

  const dupes = (data?.follow_up || []).filter((f) => f.possible_duplicate);
  const amt = data?.amount_check;
  const ratio = amt?.average && data?.amount ? data.amount / amt.average : null;
  const route = data?.route || [];

  return (
    <section className="v4-card v4-insight" aria-labelledby="v4-insight-title">
      <div className="v4-card-head">
        <h2 className="v4-h2" id="v4-insight-title"><Icon name="chart" /> Request Insight</h2>
        <span className="v4-help">Earlier requests like this one, to help you decide. Read only.</span>
      </div>
      {state === "loading" || !data ? <Skeleton lines={4} /> : (
        <div className="v4-card-pad" style={{ paddingTop: 0 }}>
          {dupes.length ? (
            <Notice tone="amber" title="Possible repeat.">
              The same requester asked for the same amount on {dupes.map((d, i) => <span key={d.id}>{i ? ", " : ""}<Link href={`/requests/${d.id}`}>{d.request_no}</Link> ({day(d.created_at)})</span>)}. Check that this is not paid twice.
            </Notice>
          ) : data.follow_up.length ? (
            <Notice tone="blue" title="Follow-up.">
              This looks like a follow-up to {data.follow_up.slice(0, 3).map((d, i) => <span key={d.id}>{i ? ", " : ""}<Link href={`/requests/${d.id}`}>{d.request_no}</Link> ({day(d.created_at)})</span>)}.
            </Notice>
          ) : null}
          <Tabs value={tab} onChange={setTab} label="Insight" items={[
            { key: "similar", label: "Similar before", count: data.similar.length },
            { key: "subhead", label: "This subhead" },
            { key: "amount", label: "Amount check" },
            { key: "requester", label: "Requester" },
            { key: "route", label: "Time on route" },
          ]} />
          <div className="v4-insight-body">
            {tab === "similar" ? <MiniList rows={data.similar} empty="No similar request in this department before." /> : null}

            {tab === "subhead" ? (data.subhead ? (
              <>
                <p style={{ margin: "0 0 10px" }}><b>{[data.subhead.code, data.subhead.name].filter(Boolean).join(" — ")}</b> · used by {data.subhead.used_this_year} other request{data.subhead.used_this_year === 1 ? "" : "s"} in the last 12 months.</p>
                {data.subhead.balances_shown && data.subhead.allocation !== null ? (() => {
                  const alloc = Number(data.subhead.allocation || 0);
                  const used = Number(data.subhead.reserved || 0) + Number(data.subhead.expenditure || 0);
                  const after = Number(data.subhead.available || 0) - Number(data.amount || 0);
                  const pct = alloc > 0 ? Math.min(100, Math.round((used / alloc) * 100)) : 0;
                  return (
                    <div className="v4-insight-budget">
                      <div className="v4-meter" aria-hidden="true"><span style={{ width: `${pct}%`, background: pct >= 90 ? "var(--v4-red)" : pct >= 60 ? "#E0661F" : undefined }} /></div>
                      <p className="v4-help" style={{ margin: "8px 0 0" }}>Allocation {nairaExact(alloc)} · reserved and spent {nairaExact(used)} ({pct}%) · available {nairaExact(data.subhead.available)}</p>
                      <p style={{ margin: "6px 0 0", fontWeight: 700, color: after < 0 ? "var(--v4-red)" : "var(--v4-green)" }}>{after < 0 ? `This request is more than what is left by ${nairaExact(-after)}.` : `Left after this request: ${nairaExact(after)}.`}</p>
                    </div>
                  );
                })() : <p className="v4-help" style={{ margin: "0 0 10px" }}>Balances are not shown for the position you are acting as.</p>}
                <MiniList rows={data.subhead_recent} empty="No other request has used this subhead yet." />
              </>
            ) : <p className="v4-muted" style={{ margin: 0 }}>No subhead is attached to this request yet.</p>) : null}

            {tab === "amount" ? (amt && amt.count ? (
              <>
                <p style={{ margin: "0 0 6px" }}>{amt.count} approved request{amt.count === 1 ? "" : "s"} of the same kind in the last 12 months.</p>
                <p className="v4-help" style={{ margin: 0 }}>Average {nairaExact(amt.average)} · lowest {nairaExact(amt.lowest)} · highest {nairaExact(amt.highest)}</p>
                {ratio !== null ? (
                  <p style={{ margin: "10px 0 0", fontWeight: 700, color: ratio > 1.5 ? "#8A5200" : "var(--v4-ink)" }}>
                    This request ({nairaExact(data.amount)}) is {ratio >= 0.95 && ratio <= 1.05 ? "about the average" : ratio > 1 ? `${ratio.toFixed(1)} times the average` : `${Math.round(ratio * 100)}% of the average`}.
                  </p>
                ) : null}
              </>
            ) : <p className="v4-muted" style={{ margin: 0 }}>Nothing of the same kind was approved in the last 12 months to compare with.</p>) : null}

            {tab === "requester" ? (data.requester ? (
              <p style={{ margin: 0, lineHeight: 1.6 }}>
                <b>{data.requester.name || "The requester"}</b> made {data.requester.count} other request{data.requester.count === 1 ? "" : "s"} in the last 12 months
                {data.requester.count ? <> (total {nairaExact(data.requester.total)}), {data.requester.returned} sent back at least once. The last was on {day(data.requester.last_at)}.</> : "."}
              </p>
            ) : null) : null}

            {tab === "route" ? (
              <ol className="v4-insight-route">
                {route.map((s, i) => {
                  const prev = i ? new Date(route[i - 1].at).getTime() : null;
                  return (
                    <li key={`${s.at}-${i}`}>
                      <span className="v4-insight-dot" aria-hidden="true" />
                      <span><b>{s.action || "Step"}</b>{s.by_position ? ` · ${s.by_position}` : ""}{s.to_stage ? ` → ${stageWords(s.to_stage)}` : ""}<br /><span className="v4-help">{day(s.at)}{prev !== null ? ` · after ${hours(new Date(s.at).getTime() - prev)}` : ""}</span></span>
                    </li>
                  );
                })}
                {route.length && now ? <li className="v4-now"><span className="v4-insight-dot" aria-hidden="true" /><span><b>Now with you</b><br /><span className="v4-help">waiting {hours(now - new Date(route[route.length - 1].at).getTime())}</span></span></li> : null}
              </ol>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
