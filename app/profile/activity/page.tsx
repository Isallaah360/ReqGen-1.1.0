"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { Select } from "@/app/components/v4/Select";
import { Card, Notice, PageHead, Skeleton, Stats, V4Page, downloadCsv, type StatItem } from "@/app/components/v4/ui";

type Ev = { at: string; category: string; module: string; action: string; record_no: string | null; device: string | null };
type Kind = "all" | "requests" | "approvals" | "signatures" | "signins" | "profile";
type Period = "7" | "month" | "fy";

const isSubmit = (e: Ev) => e.action.startsWith("Submitted");
const isApproval = (e: Ev) => e.category === "approval" && e.action.startsWith("Approved");
const isSignature = (e: Ev) => e.category === "stamp" || /signed|counter-signed|authorised/i.test(e.action) && !isSubmit(e);
const isSignIn = (e: Ev) => e.category === "signin";
const isProfile = (e: Ev) => e.category === "settings" || e.category === "data" && /profile|signature|photo|password|passcode|2fa/i.test(e.action);

const KINDS: Record<Kind, (e: Ev) => boolean> = {
  all: () => true, requests: (e) => e.module === "Requests" && !isApproval(e), approvals: isApproval, signatures: isSignature, signins: isSignIn, profile: isProfile,
};
function toneOf(e: Ev) {
  if (e.category === "stamp") return "brand";
  if (isApproval(e) || /signed|paid/i.test(e.action)) return "green";
  if (isSignIn(e) || isSubmit(e)) return "blue";
  if (/return|reject|sent back|withdraw/i.test(e.action)) return "red";
  return "amber";
}
function iconOf(e: Ev) {
  if (e.category === "stamp") return "pentool";
  if (isSignIn(e)) return "lock";
  if (isSubmit(e)) return "send";
  if (/return|sent back/i.test(e.action)) return "returned";
  if (e.category === "print") return "printer";
  if (e.category === "settings" || e.category === "data") return "settings";
  return "check";
}
function rangeOf(p: Period) {
  const to = new Date(); to.setDate(to.getDate() + 1); to.setHours(0, 0, 0, 0);
  const from = new Date(); from.setHours(0, 0, 0, 0);
  if (p === "7") from.setDate(from.getDate() - 6);
  else if (p === "month") from.setDate(1);
  else { const y = from.getMonth() >= 8 ? from.getFullYear() : from.getFullYear() - 1; from.setFullYear(y, 8, 1); }
  return { from, to };
}
function dayLabel(d: Date) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const that = new Date(d); that.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - that.getTime()) / 86400000);
  const long = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  return diff === 0 ? `Today · ${long}` : diff === 1 ? `Yesterday · ${long}` : long;
}

/** My Account › My Activity (mock-up 20): everything you did in ReqGen. Only you and the Auditor can see it. */
export default function MyActivityPage() {
  const me = useIdentity();
  const [rows, setRows] = useState<Ev[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [period, setPeriod] = useState<Period>("month");

  useEffect(() => {
    if (!me.ready || !me.userId) return;
    let alive = true;
    queueMicrotask(() => {
      setRows(null);
      const r = rangeOf(period);
      void supabase.rpc("reqgen_my_activity", { p_from: r.from.toISOString(), p_to: r.to.toISOString() }).then(({ data, error: e }) => {
        if (!alive) return;
        setError(e ? e.message : null);
        setRows(((data || []) as Ev[]).sort((a, b) => b.at.localeCompare(a.at)));
      });
    });
    return () => { alive = false; };
  }, [me.ready, me.userId, period]);

  const all = rows || [];
  const t = q.trim().toLowerCase();
  const shown = all.filter((e) => KINDS[kind](e) && (!t || `${e.action} ${e.record_no || ""} ${e.module}`.toLowerCase().includes(t)));
  const periodNote = period === "7" ? "Last 7 days" : period === "month" ? "This month" : "This financial year";
  const stats: StatItem[] = [
    { label: "Requests made", value: rows ? all.filter(isSubmit).length : "…", note: periodNote, icon: "file", tone: "blue" },
    { label: "Approvals given", value: rows ? all.filter(isApproval).length : "…", note: periodNote, icon: "check", tone: "green" },
    { label: "Documents signed", value: rows ? all.filter(isSignature).length : "…", note: periodNote, icon: "pentool", tone: "brand" },
    { label: "Sign-ins", value: rows ? all.filter((e) => isSignIn(e) && e.action.startsWith("Signed in")).length : "…", note: periodNote, icon: "lock", tone: "amber" },
  ];
  const days: Array<{ label: string; items: Ev[] }> = [];
  for (const e of shown) {
    const label = dayLabel(new Date(e.at));
    const last = days[days.length - 1];
    if (last && last.label === label) last.items.push(e); else days.push({ label, items: [e] });
  }

  return (
    <V4Page>
      <PageHead title="My Activity" sub="Everything you did in ReqGen. Only you (and the Auditor) can see this list."
        actions={[{ label: "Export CSV", icon: "download", kind: "secondary", disabled: !shown.length, onClick: () => downloadCsv(`ReqGen_My_Activity_${new Date().toISOString().slice(0, 10)}.csv`, shown.map((e) => ({ Time: new Date(e.at).toLocaleString("en-GB"), Action: e.action, Record: e.record_no || "", Module: e.module, Device: e.device || "" }))) }]} />
      {error ? <Notice tone="red">{error}</Notice> : null}
      <Stats items={stats} />
      <Card>
        <div className="v4-toolbar">
          <label className="v4-field v4-f-search"><span className="v4-flabel">Search</span><span className="v4-control"><Icon name="search" /><input className="v4-input" placeholder="Request or voucher number" value={q} onChange={(e) => setQ(e.target.value)} /></span></label>
          <div className="v4-field"><span className="v4-flabel">Type</span><Select size="compact" ariaLabel="Type" value={kind} onChange={(v) => setKind(v as Kind)} options={[
            { value: "all", label: "Everything" }, { value: "requests", label: "Requests" }, { value: "approvals", label: "Approvals" },
            { value: "signatures", label: "Signatures" }, { value: "signins", label: "Sign-ins" }, { value: "profile", label: "Profile changes" },
          ]} /></div>
          <div className="v4-field"><span className="v4-flabel">Period</span><Select size="compact" ariaLabel="Period" value={period} onChange={(v) => setPeriod(v as Period)} options={[
            { value: "7", label: "Last 7 days" }, { value: "month", label: "This month" }, { value: "fy", label: "Financial year" },
          ]} /></div>
          <button className="v4-btn v4-btn-ghost" type="button" onClick={() => { setQ(""); setKind("all"); setPeriod("month"); }}><Icon name="returned" />Reset</button>
        </div>
        {rows === null ? <div className="v4-card-body"><Skeleton lines={6} /></div> : days.length ? days.map((d) => (
          <div key={d.label}>
            <div className="v4-day">{d.label}</div>
            <div className="v4-card-body">
              <ul className="v4-timeline">
                {d.items.map((e, i) => (
                  <li key={`${e.at}-${i}`}>
                    <span className={`v4-ti v4-t-${toneOf(e)}`}><Icon name={iconOf(e)} /></span>
                    <span><strong>{e.action}{e.record_no ? ` · ${e.record_no}` : ""}</strong><span>{e.module}{e.device ? ` · ${e.device}` : ""}</span></span>
                    <span className="v4-time">{new Date(e.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>Nothing recorded in this period.</p>}
      </Card>
    </V4Page>
  );
}
