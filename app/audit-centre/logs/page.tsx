"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { Select } from "@/app/components/v4/Select";
import { Card, Notice, PageHead, Pager, Skeleton, Tabs, V4Page, downloadCsv } from "@/app/components/v4/ui";

type Ev = { at: string; actor_label: string | null; category: string; module: string; action: string; record_no: string | null; record_id: string | null; device: string | null };
type Tab = "all" | "signin" | "approval" | "stamp" | "data" | "settings";
const PAGE = 25;
const RANGES: Record<string, number> = { today: 0, "7": 7, "30": 30, "90": 90 };

export default function AuditLogPage() {
  return <Suspense fallback={<V4Page><Skeleton lines={8} /></V4Page>}><AuditLog /></Suspense>;
}

/** Audit › Audit Log (mock-up 75): one log for everything. Entries can't be changed or deleted. */
function AuditLog() {
  const me = useIdentity();
  const params = useSearchParams();
  const [rows, setRows] = useState<Ev[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(() => (["signin", "approval", "stamp", "data", "settings"].includes(params.get("tab") || "") ? (params.get("tab") as Tab) : "all"));
  const [q, setQ] = useState(() => params.get("q") || "");
  const [user, setUser] = useState("all");
  const [mod, setMod] = useState(() => params.get("module") || "all");
  const [range, setRange] = useState(() => (params.get("range") && params.get("range")! in RANGES ? params.get("range")! : "7"));
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!me.ready) return;
    let alive = true;
    queueMicrotask(() => {
      setRows(null);
      const to = new Date(); to.setDate(to.getDate() + 1); to.setHours(0, 0, 0, 0);
      const from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - RANGES[range]);
      void supabase.rpc("reqgen_audit_events", { p_from: from.toISOString(), p_to: to.toISOString() }).then(({ data, error: e }) => {
        if (!alive) return;
        setError(e ? e.message : null);
        setRows(((data || []) as Ev[]).sort((a, b) => b.at.localeCompare(a.at)));
      });
    });
    return () => { alive = false; };
  }, [me.ready, range]);

  const users = useMemo(() => [...new Set((rows || []).map((r) => r.actor_label || "").filter(Boolean))].sort(), [rows]);
  const modules = useMemo(() => [...new Set((rows || []).map((r) => r.module))].sort(), [rows]);
  const base = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (rows || []).filter((r) => (user === "all" || r.actor_label === user) && (mod === "all" || r.module === mod) && (!t || `${r.action} ${r.record_no} ${r.actor_label}`.toLowerCase().includes(t)));
  }, [rows, user, mod, q]);
  const inTab = (t: Tab) => base.filter((r) => t === "all" || r.category === t || (t === "approval" && r.category === "stamp") || (t === "data" && ["registry", "print", "backup", "other"].includes(r.category)));
  const shown = inTab(tab);
  const split = (label: string | null) => { const [name, pos] = String(label || "—").split(" — "); return { name, pos: pos || "" }; };

  return (
    <V4Page>
      <PageHead title="Audit Log" sub="One log for everything — sign-ins, approvals, signatures, stamps, edits and settings. Entries can’t be changed or deleted."
        actions={[{ label: "Export CSV", icon: "download", kind: "secondary", disabled: !shown.length, onClick: () => downloadCsv(`ReqGen_Audit_Log_${new Date().toISOString().slice(0, 10)}.csv`, shown.map((r) => ({ Time: new Date(r.at).toLocaleString("en-GB"), User: r.actor_label || "", Action: r.action, Record: r.record_no || "", Module: r.module, Device: r.device || "" }))) }]} />
      {error ? <Notice tone="red">{error}</Notice> : null}
      <Card>
        <div style={{ padding: "0 12px" }}>
          <Tabs value={tab} onChange={(t) => { setTab(t); setPage(1); }} label="Show" items={[
            { key: "all", label: "All events" }, { key: "signin", label: "Sign-ins" }, { key: "approval", label: "Approvals & signatures" },
            { key: "stamp", label: "Stamps", count: inTab("stamp").length }, { key: "data", label: "Data changes" }, { key: "settings", label: "Settings" },
          ]} />
        </div>
        <div className="v4-toolbar">
          <label className="v4-field v4-f-search"><span className="v4-flabel">Search</span><span className="v4-control"><Icon name="search" /><input className="v4-input" placeholder="Action, number or name" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></span></label>
          <div className="v4-field"><span className="v4-flabel">User</span><Select size="compact" searchable ariaLabel="User" value={user} onChange={(v) => { setUser(v); setPage(1); }} options={[{ value: "all", label: "Everyone" }, ...users.map((u) => ({ value: u, label: u }))]} /></div>
          <div className="v4-field"><span className="v4-flabel">Module</span><Select size="compact" ariaLabel="Module" value={mod} onChange={(v) => { setMod(v); setPage(1); }} options={[{ value: "all", label: "All modules" }, ...modules.map((m) => ({ value: m, label: m }))]} /></div>
          <div className="v4-field v4-f-extra"><span className="v4-flabel">Date</span><Select size="compact" ariaLabel="Date" value={range} onChange={(v) => { setRange(v); setPage(1); }} options={[{ value: "today", label: "Today" }, { value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }]} /></div>
          <button className="v4-btn v4-btn-ghost" type="button" onClick={() => { setQ(""); setUser("all"); setMod("all"); setRange("7"); setTab("all"); setPage(1); }}><Icon name="returned" />Reset</button>
        </div>
        {rows === null ? <Skeleton lines={8} /> : shown.length ? (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Record</th><th className="v4-hide-md">Module</th><th className="v4-hide-sm">Device</th></tr></thead>
              <tbody>
                {shown.slice((page - 1) * PAGE, page * PAGE).map((r, i) => {
                  const who = split(r.actor_label);
                  return (
                    <tr key={`${r.at}-${i}`}>
                      <td className="v4-num">{new Date(r.at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                      <td><span className="v4-strong">{who.name}</span>{who.pos ? <span className="v4-sub">{who.pos}</span> : null}</td>
                      <td><span className="v4-strong" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {r.category === "stamp" ? <img className="v4-iet-stamp" src="/v4/iet-stamp.png" alt="" style={{ position: "static", width: 22, height: 22 }} /> : null}{r.action}</span></td>
                      <td data-label="Record">{r.record_no || "—"}</td>
                      <td className="v4-hide-sm v4-hide-md">{r.module}</td>
                      <td className="v4-hide-sm">{r.device || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>No event in this period.</p>}
        <Pager page={page} pageSize={PAGE} total={shown.length} onPage={setPage} label="events" />
      </Card>
      <Notice tone="blue">Comments and request contents are not copied into the log — it records who did what, to which number, and when.</Notice>
    </V4Page>
  );
}
