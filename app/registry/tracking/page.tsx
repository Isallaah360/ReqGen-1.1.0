"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { printA4Sheet, useA4Fit } from "@/lib/printA4";
import { stageTitle } from "@/lib/v4/requestText";
import { ageDaysOf, ageText, remindRequest, type Track } from "@/lib/v4/registry";
import { downloadXlsx } from "@/lib/v4/xlsx";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import PrivacyBar from "@/app/components/v4/PrivacyBar";
import { Select } from "@/app/components/v4/Select";
import { Chip, Notice, PageHead, Pager, Skeleton, Stats, V4Page, type StatItem } from "@/app/components/v4/ui";

type Move = { step_order: number; stage: string; person: string | null; state: "done" | "now" | "next" | "skipped"; at: string | null };
type Summary = { generated: number; signed: number; paid: number; returned: number };
const PAGE = 12;

/** Registry › Request Tracking (mock-up 69): where every request is now, today's movement, one-tap reminders. */
export default function RequestTrackingPage() {
  const me = useIdentity();
  const [now] = useState(() => Date.now());
  const [rows, setRows] = useState<Track[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<"today" | "week">("today");
  const [sum, setSum] = useState<Summary | null>(null);
  const [q, setQ] = useState("");
  const [at, setAt] = useState("all");
  const [late, setLate] = useState("all");
  const [page, setPage] = useState(1);
  const [pick, setPick] = useState<Track | null>(null);
  const [moves, setMoves] = useState<Move[] | null>(null);
  const [msg, setMsg] = useState<{ tone: "green" | "red" | "amber"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const sheet = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.rpc("reqgen_registry_tracking");
    setError(e ? e.message : null);
    const list = ((data || []) as Track[]).sort((a, b) => a.waiting_since.localeCompare(b.waiting_since));
    setRows(list);
    setPick((p) => p || list[0] || null);
  }, []);
  useEffect(() => { if (me.ready) queueMicrotask(() => { void load(); }); }, [me.ready, load]);

  useEffect(() => {
    if (!me.ready) return;
    let alive = true;
    const from = new Date(now); from.setHours(0, 0, 0, 0);
    if (period === "week") from.setDate(from.getDate() - 6);
    void supabase.rpc("reqgen_registry_summary", { p_from: from.toISOString() }).then(({ data }) => {
      if (alive && data) setSum((typeof data === "string" ? JSON.parse(data) : data) as Summary);
    });
    return () => { alive = false; };
  }, [me.ready, period, now]);

  useEffect(() => {
    if (!pick) return;
    let alive = true;
    queueMicrotask(() => {
      setMoves(null);
      void supabase.rpc("reqgen_registry_moves", { p_request_id: pick.id }).then(({ data }) => { if (alive) setMoves((data || []) as Move[]); });
    });
    return () => { alive = false; };
  }, [pick]);

  const stages = useMemo(() => [...new Set((rows || []).map((r) => r.stage))].sort(), [rows]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (rows || []).filter((r) => (at === "all" || r.stage === at) && (late === "all" || ageDaysOf(r.waiting_since, now) >= Number(late)) && (!t || `${r.request_no} ${r.office} ${r.owner_name}`.toLowerCase().includes(t)));
  }, [rows, q, at, late, now]);
  const stuck = (rows || []).filter((r) => ageDaysOf(r.waiting_since, now) >= 3);
  const waiting2 = (rows || []).filter((r) => ageDaysOf(r.waiting_since, now) >= 2);

  async function remind(r: Track) {
    setBusy(true); setMsg(null);
    const res = await remindRequest(r.id);
    setBusy(false);
    setMsg(res.error ? { tone: "red", text: `${r.request_no}: ${res.error}` } : { tone: "green", text: `Reminder for ${r.request_no} sent to ${res.sentTo}.` });
    if (!res.error) await load();
  }
  async function remindAll() {
    setBusy(true); setMsg(null);
    let sent = 0; const skipped: string[] = [];
    for (const r of waiting2) {
      const res = await remindRequest(r.id);
      if (res.error) skipped.push(`${r.request_no} (${res.error})`); else sent += 1;
    }
    setBusy(false);
    setMsg({ tone: skipped.length ? "amber" : "green", text: `${sent} reminder${sent === 1 ? "" : "s"} sent.${skipped.length ? ` Not sent: ${skipped.join("; ")}` : ""}` });
    await load();
  }

  useA4Fit(sheet, [rows, sum]);
  const stats: StatItem[] = [
    { label: "Generated", value: sum ? sum.generated : "…", note: period === "today" ? "Today" : "Last 7 days", icon: "plus", tone: "blue" },
    { label: "Signed", value: sum ? sum.signed : "…", note: "Steps completed", icon: "pentool", tone: "green" },
    { label: "Waiting", value: rows ? rows.length : "…", note: "Not yet signed", icon: "clock", tone: "amber", pressed: late === "all" && at === "all", onClick: () => { setLate("all"); setAt("all"); } },
    { label: "Stuck 3+ days", value: rows ? stuck.length : "…", note: stuck.length ? "Remind now" : "None", icon: "alert", tone: "red", pressed: late === "3", onClick: () => setLate(late === "3" ? "all" : "3") },
  ];

  return (
    <V4Page>
      <PageHead title="Request Tracking" sub="Where every request is now, today’s movement, and one-tap reminders by in-app alert, SMS and email."
        actions={[{ label: "Export Excel", icon: "download", kind: "secondary", disabled: !shown.length, onClick: () => downloadXlsx("Request_Tracking", [{ name: "Tracking", title: "ReqGen — Request tracking (numbers only)", rows: shown.map((r) => ({ Request: r.request_no || "", Office: r.office, "Now at": stageTitle(r.stage), Officer: r.owner_name, Waiting: ageText(r.waiting_since, now), "Last reminder": r.last_reminder ? new Date(r.last_reminder).toLocaleString("en-GB") : "" })) }]) }]} />
      <PrivacyBar />
      {error ? <Notice tone="red">{error}</Notice> : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <section className="v4-card v4-card-pad">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <h2 className="v4-h2">Movement summary</h2>
          <div className="v4-segmented" role="tablist" aria-label="Period">
            <button type="button" role="tab" aria-selected={period === "today"} onClick={() => setPeriod("today")}>Today</button>
            <button type="button" role="tab" aria-selected={period === "week"} onClick={() => setPeriod("week")}>This week</button>
          </div>
        </div>
        <Stats items={stats} />
        <div className="v4-form-actions" style={{ marginTop: 14 }}>
          <button className="v4-btn v4-btn-secondary" type="button" disabled={!rows} onClick={() => void printA4Sheet(sheet.current, "Registry daily summary")}><Icon name="printer" />Print daily summary</button>
          <button className="v4-btn v4-btn-primary" type="button" disabled={busy || !waiting2.length} onClick={() => void remindAll()}><Icon name="bell" />Remind everyone waiting 2+ days{waiting2.length ? ` (${waiting2.length})` : ""}</button>
        </div>
      </section>
      <div className="v4-cols">
        <section className="v4-card">
          <div className="v4-toolbar v4-t3">
            <label className="v4-field v4-f-search"><span className="v4-flabel">Search</span><span className="v4-control"><Icon name="search" /><input className="v4-input" placeholder="Request number, office or officer" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></span></label>
            <div className="v4-field"><span className="v4-flabel">Now at</span><Select size="compact" ariaLabel="Now at" value={at} onChange={(v) => { setAt(v); setPage(1); }} options={[{ value: "all", label: "Any office" }, ...stages.map((s) => ({ value: s, label: stageTitle(s) }))]} /></div>
            <div className="v4-field"><span className="v4-flabel">Waiting</span><Select size="compact" ariaLabel="Waiting" value={late} onChange={(v) => { setLate(v); setPage(1); }} options={[{ value: "all", label: "Any time" }, { value: "1", label: "Over 1 day" }, { value: "3", label: "Over 3 days" }]} /></div>
          </div>
          {rows === null ? <Skeleton lines={6} /> : shown.length ? (
            <div className="v4-table-wrap">
              <table className="v4-data v4-stack v4-fit">
                <thead><tr><th>Request</th><th>Now at</th><th>Waiting</th><th className="v4-r">Remind</th></tr></thead>
                <tbody>
                  {shown.slice((page - 1) * PAGE, page * PAGE).map((r) => {
                    const d = ageDaysOf(r.waiting_since, now);
                    return (
                      <tr key={r.id} onClick={() => setPick(r)} style={{ cursor: "pointer", background: pick?.id === r.id ? "var(--v4-surface-2)" : undefined }}>
                        <td><span className="v4-strong">{r.request_no}</span><span className="v4-sub">{r.office}</span></td>
                        <td data-label="Now at"><span className="v4-strong">{stageTitle(r.stage)}</span><span className="v4-sub">{r.owner_name || "—"}</span></td>
                        <td data-label="Waiting" className="v4-age"><Chip tone={d >= 3 ? "red" : d >= 1 ? "amber" : "blue"}>{ageText(r.waiting_since, now)}</Chip></td>
                        <td className="v4-r"><button className={`v4-btn ${d >= 1 ? "v4-btn-primary" : "v4-btn-secondary"}`} type="button" style={{ minHeight: 38, padding: "0 14px" }} disabled={busy || !r.owner_id} onClick={(e) => { e.stopPropagation(); void remind(r); }}><Icon name="bell" />Remind</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>No request is waiting{late !== "all" ? " that long" : ""}.</p>}
          <Pager page={page} pageSize={PAGE} total={shown.length} onPage={setPage} label="requests" />
        </section>
        <section className="v4-card v4-card-pad">
          {pick ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                <div><h2 className="v4-h2">{pick.request_no}</h2><p className="v4-help" style={{ margin: "4px 0 0" }}>{pick.office} · {pick.request_type}</p></div>
                <Chip tone="amber">{/^returned/i.test(pick.stage) ? "Returned to requester" : `With ${stageTitle(pick.stage)}`}</Chip>
              </div>
              {moves === null ? <Skeleton lines={4} /> : (
                <ol className="v4-moves">
                  {moves.filter((m) => m.state !== "skipped").map((m, i, all) => {
                    const prev = all.slice(0, i).reverse().find((x) => x.at);
                    const gap = m.at && prev?.at ? ageText(prev.at, new Date(m.at).getTime()) : null;
                    return (
                      <li key={`${m.step_order}-${m.stage}`} className={m.state === "now" ? "v4-now" : m.state === "next" ? "v4-next" : undefined}>
                        <span className="v4-dot"><Icon name={m.state === "done" ? "check" : m.state === "now" ? "clock" : "right"} size="sm" /></span>
                        <span><strong>{["Submitted", "Registry filing", "Returned for correction"].includes(m.stage) ? m.stage : stageTitle(m.stage)}</strong>
                          <span className="v4-s">{m.state === "now" ? `${m.person || "—"} · waiting ${ageText(pick.waiting_since, now)}${pick.last_reminder ? " · reminder sent" : ""}` : m.stage === "Registry filing" && m.state === "next" ? "After payment" : `${m.person || "—"}${gap ? ` · ${gap}` : ""}`}</span></span>
                        <span className="v4-t">{m.state === "now" ? "Now" : m.state === "next" ? (m.stage === "Registry filing" ? "Last" : "Next") : m.at ? new Date(m.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
              <Notice tone="blue">Title, amount and attachments are hidden from Registry.</Notice>
            </>
          ) : <p className="v4-muted" style={{ margin: 0 }}>Tap a request to see its journey.</p>}
        </section>
      </div>

      {/* daily summary — printed on one A4 page */}
      <div style={{ position: "absolute", left: -10000, top: 0 }} aria-hidden="true">
        <article ref={sheet} className="rg-a4-page">
          <div className="rg-a4-content v4-rpt">
            <div className="v4-rh"><div className="v4-o"><b>Islamic Education Trust</b><span>Registry — daily request movement</span><span>{new Date(now).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span></div><span /></div>
            <h3>Request movement summary</h3>
            <div className="v4-sum"><div><span>Generated today</span><b>{sum?.generated ?? 0}</b></div><div><span>Steps signed</span><b>{sum?.signed ?? 0}</b></div><div><span>Waiting</span><b>{rows?.length ?? 0}</b></div><div><span>Stuck 3+ days</span><b>{stuck.length}</b></div></div>
            <table><thead><tr><th>Request</th><th>Office</th><th>Now at</th><th>Officer</th><th className="v4-r">Waiting</th></tr></thead>
              <tbody>{(rows || []).slice(0, 40).map((r) => <tr key={r.id}><td>{r.request_no}</td><td>{r.office}</td><td>{stageTitle(r.stage)}</td><td>{r.owner_name}</td><td className="v4-r">{ageText(r.waiting_since, now)}</td></tr>)}</tbody></table>
            <p className="v4-note">Numbers, offices and people only. Printed by {me.name} from ReqGen Registry.</p>
            <div className="v4-rfoot"><span>ReqGen • Registry daily summary • Page 1 of 1</span><em>Building Bridges</em></div>
          </div>
        </article>
      </div>
    </V4Page>
  );
}
