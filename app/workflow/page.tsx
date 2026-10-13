"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { printA4Sheet } from "@/lib/printA4";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { Notice, PageHead, Skeleton, Stats, V4Page, type StatItem } from "@/app/components/v4/ui";

type Step = { phase: string; at: string; title: string; who: string; tone: "blue" | "green" | "brand" | "red"; stamped: boolean };

export default function WorkflowTracePage() {
  return <Suspense fallback={<V4Page><Skeleton lines={8} /></V4Page>}><Trace /></Suspense>;
}

const gapText = (ms: number) => {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ${String(m % 60).padStart(2, "0")} min`;
  return `${Math.round(h / 24)} days`;
};

/** Audit › Workflow Trace (mock-up 76): the full journey of any request or voucher. */
function Trace() {
  const me = useIdentity();
  const router = useRouter();
  const params = useSearchParams();
  const [no, setNo] = useState(params.get("no") || "");
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLElement>(null);

  // The number in the address is the one shown. Tracing only runs when that number
  // changes, so the page never loops; a new number is put in the address first.
  const urlNo = (params.get("no") || "").trim().toUpperCase();
  const trace = useCallback(async (v: string) => {
    setBusy(true); setError(null);
    const { data, error: e } = await supabase.rpc("reqgen_trace", { p_no: v });
    setBusy(false);
    if (e) { setError(e.message); setSteps(null); return; }
    setSteps(((data || []) as Step[]).sort((a, b) => a.at.localeCompare(b.at)));
  }, []);
  useEffect(() => { if (me.ready && urlNo) queueMicrotask(() => { void trace(urlNo); }); }, [me.ready, urlNo, trace]);
  const run = (value: string) => {
    const v = value.trim().toUpperCase();
    if (!v) return;
    if (v === urlNo) void trace(v);
    else router.replace(`/workflow?no=${encodeURIComponent(v)}`);
  };

  const gaps = useMemo(() => (steps || []).map((s, i, all) => (i === 0 ? null : new Date(s.at).getTime() - new Date(all[i - 1].at).getTime())), [steps]);
  const slowest = useMemo(() => {
    const i = gaps.reduce<number>((best, g, idx) => (g !== null && (best < 0 || g > (gaps[best] || 0)) ? idx : best), -1);
    return i >= 0 && steps ? { title: steps[i].title, ms: gaps[i] || 0 } : null;
  }, [gaps, steps]);
  const total = steps && steps.length > 1 ? new Date(steps[steps.length - 1].at).getTime() - new Date(steps[0].at).getTime() : 0;
  const people = new Set((steps || []).map((s) => s.who.split(" · ")[0].split(" — ")[0]).filter(Boolean));
  const stats: StatItem[] = [
    { label: "Start to last step", value: steps ? (total ? `${(total / 86400000).toFixed(1)} days` : "—") : "…", note: "Target 5 days", icon: "clock", tone: "blue" },
    { label: "People involved", value: steps ? people.size : "…", note: "Who signed or acted", icon: "users", tone: "brand" },
    { label: "Slowest step", value: slowest ? slowest.title.replace(/ by the Director General| by the Auditor/, "").slice(0, 26) : "—", note: slowest ? gapText(slowest.ms) : undefined, icon: "alert", tone: "amber" },
    { label: "IET stamps", value: steps ? steps.filter((s) => s.stamped).length : "…", note: "Request + voucher", icon: "pentool", tone: "green" },
  ];

  return (
    <V4Page>
      <PageHead title="Workflow Trace" sub="Type any request or voucher number to see its full journey — every step, who did it and how long it took."
        actions={[{ label: "Print A4", icon: "printer", kind: "secondary", disabled: !steps?.length, onClick: () => void printA4Sheet(box.current, `Workflow trace ${no}`) }]} />
      <section className="v4-card v4-card-pad">
        <form onSubmit={(e) => { e.preventDefault(); run(no); }} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label className="v4-field" style={{ flex: 1, minWidth: 240 }}><span className="v4-flabel">Request or voucher number</span><span className="v4-control"><Icon name="search" /><input className="v4-input" value={no} placeholder="REQ-202610-1182 or PV-2026-000014" onChange={(e) => setNo(e.target.value)} /></span></label>
          <button className="v4-btn v4-btn-primary" type="submit" disabled={busy || !no.trim()}><Icon name="route" />{busy ? "Tracing…" : "Trace"}</button>
        </form>
      </section>
      {error ? <Notice tone="red">{error}</Notice> : null}
      {steps ? (
        <>
          <Stats items={stats} />
          <article ref={box} className="rg-a4-page" style={{ width: "auto", height: "auto", padding: 0, boxShadow: "none", background: "transparent" }}>
            <section className="v4-card v4-card-pad rg-a4-content">
              {steps.length ? (
                <ol className="v4-journey">
                  {steps.map((s, i) => {
                    const head = i === 0 || s.phase !== steps[i - 1].phase ? s.phase : null;
                    const d = new Date(s.at);
                    const g = gaps[i];
                    return [
                      head ? <li key={`p-${i}`} className="v4-phase">{head}</li> : null,
                      <li key={i}>
                        <span className="v4-when"><b>{d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</b>{d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</span>
                        <span className="v4-rail"><span className={`v4-node v4-t-${s.tone}`}><Icon name={s.tone === "red" ? "returned" : s.stamped ? "pentool" : "check"} size="sm" /></span></span>
                        <span className="v4-body"><strong>{s.title}</strong><span>{s.who}</span>
                          {g !== null ? <span className={`v4-gap${g > 24 * 3600000 ? " v4-slow" : ""}`}>{gapText(g)}</span> : null}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {s.stamped ? <span className="v4-stamped"><img className="v4-iet-stamp" src="/v4/iet-stamp.png" alt="IET stamp" style={{ position: "static", width: 44 }} /><span className="v4-chip v4-chip-blue">IET stamp applied</span></span> : null}
                        </span>
                      </li>,
                    ];
                  })}
                </ol>
              ) : <p className="v4-muted" style={{ margin: 0 }}>No steps recorded yet.</p>}
            </section>
          </article>
        </>
      ) : !error ? <Notice tone="blue">Comments and request contents are not shown here — only who acted, in which position, and when.</Notice> : null}
    </V4Page>
  );
}
