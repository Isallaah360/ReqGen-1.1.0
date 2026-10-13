"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { REQGEN_VERSION } from "@/lib/version";
import { fetchRoutePreview, STAGE_LABEL } from "@/lib/routingEngine";
import { whenText } from "@/lib/v4/admin";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { Select } from "@/app/components/v4/Select";
import { Notice, PageHead, Skeleton, Tabs, V4Page } from "@/app/components/v4/ui";

type Diag = {
  tables: number; rls_on: number; rls_off: string[]; last_notification: string | null; last_nightly: { at: string | null; bytes: number | null } | null;
  old_po_codes: number; audit_events_today: number; response_ms: number; checks: Array<{ label: string; count: number }>;
};
type Tab = "health" | "data" | "route";
type Step = { step_order: number; stage: string; is_vacant: boolean; if_vacant: "skip" | "block"; route_group: string };

export default function DiagnosticsPage() {
  return <Suspense fallback={<V4Page><Skeleton lines={8} /></V4Page>}><Diagnostics /></Suspense>;
}

const size = (b: number | null | undefined) => (!b ? "" : b > 1048576 ? ` · ${(b / 1048576).toFixed(1)} MB` : ` · ${Math.max(1, Math.round(b / 1024))} KB`);

/** Administration › Diagnostics (mock-up 88): system health, data checks and a route test. */
function Diagnostics() {
  const me = useIdentity();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => (params.get("tab") === "data" ? "data" : params.get("tab") === "route" ? "route" : "health"));
  const [d, setD] = useState<Diag | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ranAt, setRanAt] = useState<string | null>(null);
  const [depts, setDepts] = useState<Array<{ id: string; name: string }>>([]);
  const [test, setTest] = useState({ dept: "", type: "Official", category: "Fund" });
  const [route, setRoute] = useState<Step[] | null | "none">(null);

  const run = useCallback(async () => {
    setBusy(true);
    const [{ data, error: e }, dp] = await Promise.all([supabase.rpc("reqgen_diagnostics"), supabase.from("departments").select("id,name").eq("is_active", true).order("name")]);
    setBusy(false);
    setError(e?.message || null);
    setD(e ? null : ((typeof data === "string" ? JSON.parse(data) : data) as Diag));
    setDepts((dp.data || []) as Array<{ id: string; name: string }>);
    setRanAt(new Date().toISOString());
  }, []);
  useEffect(() => { if (me.ready) queueMicrotask(() => { void run(); }); }, [me.ready, run]);

  async function tryRoute() {
    if (!test.dept) return;
    setRoute(null);
    const steps = await fetchRoutePreview(test.dept, test.type, test.type === "Personal" ? test.category : null);
    setRoute(steps === null ? "none" : steps);
  }

  const nightlyAge = d?.last_nightly?.at && ranAt ? (new Date(ranAt).getTime() - new Date(d.last_nightly.at).getTime()) / 3600000 : null;
  const health = d ? [
    { ok: true, label: "Database", s: `${d.tables} tables · response ${d.response_ms} ms`, chip: "Healthy" },
    { ok: d.rls_off.length === 0, warn: true, label: "Row-level security", s: d.rls_off.length ? `On for ${d.rls_on} of ${d.tables} tables · off: ${d.rls_off.slice(0, 6).join(", ")}${d.rls_off.length > 6 ? "…" : ""}` : `On for all ${d.tables} tables`, chip: d.rls_off.length ? "Check" : "Healthy" },
    { ok: true, label: "Notifications and phone alerts", s: d.last_notification ? `Last sent ${whenText(d.last_notification)}` : "None sent yet", chip: "Healthy" },
    { ok: nightlyAge !== null && nightlyAge < 30, warn: true, label: "Nightly backup", s: d.last_nightly?.at ? `${whenText(d.last_nightly.at)}${size(d.last_nightly.bytes)}` : "No nightly copy yet — the first runs at 02:00", chip: nightlyAge !== null && nightlyAge < 30 ? "Healthy" : "Check" },
    { ok: d.old_po_codes === 0, warn: true, label: "Old position codes", s: d.old_po_codes ? `${d.old_po_codes} records still say “PO” — they show as PD everywhere` : "Every record uses PD", chip: d.old_po_codes ? "To migrate" : "Healthy" },
    { ok: true, label: "Audit Log", s: `${d.audit_events_today} event${d.audit_events_today === 1 ? "" : "s"} recorded today`, chip: "Healthy" },
    { ok: true, info: true, label: "Version", s: `ReqGen ${REQGEN_VERSION} · released by Barderian Enterprises`, chip: "Current" },
  ] : [];

  return (
    <V4Page>
      <PageHead title="Diagnostics" sub="System health and data checks. Developer repairs need a written reason and are logged."
        actions={[{ label: busy ? "Checking…" : "Run checks now", icon: "activity", kind: "primary", disabled: busy, onClick: () => void run() }]} />
      {error ? <Notice tone="red">{error}</Notice> : null}
      <section className="v4-card">
        <div style={{ padding: "0 12px" }}>
          <Tabs value={tab} onChange={setTab} label="Diagnostics" items={[{ key: "health", label: "System health" }, { key: "data", label: "Data checks", count: d ? d.checks.filter((c) => c.count).length : undefined }, { key: "route", label: "Route test" }]} />
        </div>
        {!d && !error ? <div className="v4-card-pad"><Skeleton lines={6} /></div> : null}
        {d && tab === "health" ? (
          <ul className="v4-health">
            {health.map((h) => (
              <li key={h.label}>
                <span className={`v4-hi ${h.ok ? (h.info ? "v4-t-blue" : "v4-t-green") : "v4-t-amber"}`}><Icon name={h.ok ? "check" : "alert"} /></span>
                <span><strong>{h.label}</strong><span className="v4-s">{h.s}</span></span>
                <span className={`v4-chip ${h.info ? "v4-chip-blue" : h.ok ? "v4-chip-green" : "v4-chip-amber"}`}>{h.chip}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {d && tab === "data" ? (
          <ul className="v4-health">
            {d.checks.map((c) => (
              <li key={c.label}>
                <span className={`v4-hi ${c.count ? "v4-t-amber" : "v4-t-green"}`}><Icon name={c.count ? "alert" : "check"} /></span>
                <span><strong>{c.label}</strong><span className="v4-s">{c.count ? `${c.count} found` : "None found"}</span></span>
                <span className={`v4-chip ${c.count ? "v4-chip-amber" : "v4-chip-green"}`}>{c.count ? "To look at" : "OK"}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {tab === "route" ? (
          <div className="v4-card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p className="v4-help" style={{ margin: 0 }}>See the exact route a new request would follow today — nothing is created.</p>
            <div className="v4-form-grid">
              <div className="v4-field"><span className="v4-flabel">Department</span><Select ariaLabel="Department" searchable value={test.dept} placeholder="Choose a department" onChange={(v) => setTest({ ...test, dept: v })} options={depts.map((x) => ({ value: x.id, label: x.name }))} /></div>
              <div className="v4-field"><span className="v4-flabel">Request type</span><Select ariaLabel="Request type" value={test.type} onChange={(v) => setTest({ ...test, type: v })} options={[{ value: "Official", label: "Official" }, { value: "Personal", label: "Personal" }]} /></div>
              {test.type === "Personal" ? <div className="v4-field"><span className="v4-flabel">Personal request for</span><Select ariaLabel="Personal category" value={test.category} onChange={(v) => setTest({ ...test, category: v })} options={[{ value: "Fund", label: "Fund" }, { value: "Other", label: "Other" }]} /></div> : null}
            </div>
            <div><button type="button" className="v4-btn v4-btn-primary" disabled={!test.dept} onClick={() => void tryRoute()}><Icon name="route" />Show the route</button></div>
            {route === "none" ? <Notice tone="amber">The route preview needs the Routing Engine database update (v3.0.5).</Notice> : route ? (
              <div className="v4-route">
                <span className="v4-st"><b>Staff</b><small>Requester</small></span>
                {route.map((s) => [
                  <span key={`a${s.step_order}`} className="v4-ar"><Icon name="right" /></span>,
                  <span key={`s${s.step_order}`} className={`v4-st${s.stage === "DG" ? " v4-dg" : ""}`}><b>{STAGE_LABEL(s.stage)}</b><small>{s.is_vacant ? (s.if_vacant === "block" ? "vacant · holds" : "vacant · skipped") : "has an officer"}</small></span>,
                ])}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
      {ranAt ? <p className="v4-help" style={{ margin: 0 }}>Checked {whenText(ranAt)}.</p> : null}
    </V4Page>
  );
}
