"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { confirmDialog } from "@/lib/dialog";
import { GLOBAL_STAGE_SETTING, ROUTE_KINDS, ROUTE_KIND_LABEL, isAwayToday, loadEngineConfig, setOfficerAvailability, type EngineConfig, type EngineStage, type RouteKind } from "@/lib/routingEngine";
import { DEPT_ONLY, OFFICER_STAGES, REVIEW, STAGE_TEXT, loadRouting, routeOf, saveRoute, type IfVacant, type Lane, type OverviewRow, type OfficerStage, type StageOfficer } from "@/lib/v4/routing";
import { positionFor, type AdminPerson } from "@/lib/v4/admin";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import Modal from "@/app/components/v4/Modal";
import { Select, type SelectOption } from "@/app/components/v4/Select";
import { Notice, PageHead, Skeleton, Tabs, V4Page } from "@/app/components/v4/ui";

type Tab = "routes" | "officers" | "accounts" | "backups";
type Dept = { id: string; name: string; is_active: boolean | null };
type Account = { id: string; name: string; bank_name: string | null };
type AccRoute = { id: string; dept_id: string; iet_account_id: string; officer_user_id: string; is_active: boolean | null };
type Editor = { deptId: string; lanes: Record<RouteKind, Lane>; officers: Record<OfficerStage, string>; dgVacant: IfVacant; dirty: boolean };

/** Institution officers kept in System Settings (the engine reads these keys). */
const INSTITUTION: Array<{ key: string; label: string; position: string; legacy?: string }> = [
  { key: "DG_USER_ID", label: "Director General", position: "dg" },
  { key: "GENSEC_USER_ID", label: "General Secretary (acts for the DG)", position: "generalsecretary" },
  { key: "REGISTRAR_USER_ID", label: "Registrar", position: "registrar" },
  { key: "HR_USER_ID", label: "HR Coordinator", position: "hrcoordinator" },
  { key: "DIN_ADMIN_USER_ID", label: "DIN Admin", position: "dinadmin" },
  { key: "REGISTRY_USER_ID", label: "Registry officer", position: "registry" },
];

export default function RoutingEnginePage() {
  return <Suspense fallback={<V4Page><Skeleton lines={10} /></V4Page>}><RoutingEngine /></Suspense>;
}

/** Administration › Routing Engine (mock-up 86). The live engine is read and saved only through its own functions. */
function RoutingEngine() {
  const me = useIdentity();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => (["officers", "accounts", "backups"].includes(params.get("tab") || "") ? (params.get("tab") as Tab) : "routes"));
  const [depts, setDepts] = useState<Dept[]>([]);
  const [people, setPeople] = useState<AdminPerson[]>([]);
  const [overview, setOverview] = useState<OverviewRow[] | null>(null);
  const [officers, setOfficers] = useState<StageOfficer[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accRoutes, setAccRoutes] = useState<AccRoute[]>([]);
  const [cfg, setCfg] = useState<EngineConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [accForm, setAccForm] = useState<{ deptId: string; account: string; officer: string } | null>(null);
  const [away, setAway] = useState<{ id: string; from: string; until: string; note: string } | null>(null);
  const [backupDept, setBackupDept] = useState("");

  const load = useCallback(async () => {
    const [d, p, s, eng, a, r, engine] = await Promise.all([
      supabase.from("departments").select("id,name,is_active").order("name"),
      supabase.rpc("reqgen_admin_people"),
      supabase.from("app_settings").select("key,value").in("key", [...INSTITUTION.map((i) => i.key)]),
      loadRouting(),
      supabase.from("iet_accounts").select("id,name,bank_name").eq("is_active", true).order("name"),
      supabase.from("department_account_routing").select("id,dept_id,iet_account_id,officer_user_id,is_active"),
      loadEngineConfig().catch(() => null),
    ]);
    setError(eng.error || p.error?.message || null);
    setDepts(((d.data || []) as Dept[]).filter((x) => x.is_active !== false));
    setPeople(((p.data || []) as AdminPerson[]).filter((x) => x.is_active && !x.system_account));
    const st = Object.fromEntries(((s.data || []) as Array<{ key: string; value: string | null }>).map((x) => [x.key, String(x.value || "")]));
    setSettings(st); setDraft(st);
    setOverview(eng.overview); setOfficers(eng.officers);
    setAccounts((a.data || []) as Account[]); setAccRoutes((r.data || []) as AccRoute[]);
    setCfg(engine);
  }, []);
  useEffect(() => { if (me.ready) queueMicrotask(() => { void load(); }); }, [me.ready, load]);

  const nameOf = useMemo(() => new Map(people.map((x) => [x.id, x.full_name || x.email])), [people]);
  const holders = useCallback((positionKey: string) => people.filter((x) => x.positions.some((p) => positionFor(p.key)?.keys.includes(positionKey))), [people]);
  const personOptions = useCallback((positionKey?: string, empty = "Nobody"): SelectOption[] => {
    const top = positionKey ? holders(positionKey) : [];
    const pos = positionKey ? positionFor(positionKey)?.name || "the position" : "";
    return [{ value: "", label: empty }, ...top.map((x) => ({ value: x.id, label: x.full_name, group: `Holds ${pos}` })),
      ...people.filter((x) => !top.includes(x)).map((x) => ({ value: x.id, label: x.full_name, group: top.length ? "Everyone else" : undefined }))];
  }, [holders, people]);

  // ---- Routes: departments with the same steps share one card (as configured, nothing changed) ----
  const groups = useMemo(() => {
    const byDept = new Map<string, OverviewRow[]>();
    (overview || []).forEach((r) => byDept.set(r.dept_id, [...(byDept.get(r.dept_id) || []), r]));
    const sig = (rows: OverviewRow[]) => ROUTE_KINDS.map((k) => rows.filter((r) => r.route_kind === k).sort((a, b) => a.step_order - b.step_order).map((r) => r.stage).join(">")).join("|");
    const out = new Map<string, { depts: Dept[]; rows: OverviewRow[] }>();
    depts.forEach((d) => {
      const rows = byDept.get(d.id) || [];
      if (!rows.length) return;
      const k = sig(rows);
      const g = out.get(k) || { depts: [], rows };
      g.depts.push(d); out.set(k, g);
    });
    return [...out.values()].sort((a, b) => b.depts.length - a.depts.length);
  }, [overview, depts]);
  const laneOf = (g: { depts: Dept[]; rows: OverviewRow[] }, kind: RouteKind) => {
    const first = g.rows.filter((r) => r.route_kind === kind).sort((a, b) => a.step_order - b.step_order);
    return first.map((r) => {
      const owners = new Set((overview || []).filter((x) => g.depts.some((d) => d.id === x.dept_id) && x.route_kind === kind && x.stage === r.stage).map((x) => x.owner_name || ""));
      return { stage: r.stage, who: owners.size === 1 ? [...owners][0] : "", vacant: owners.size === 1 && ![...owners][0] && r.stage !== "Account" };
    });
  };
  const auditor = holders("auditor")[0]?.full_name || "Auditor";

  function openEditor(deptId: string) {
    const r = routeOf(deptId, overview || [], officers);
    setMsg(null);
    setEditor({ deptId, ...r, dirty: false });
  }
  async function saveEditor() {
    if (!editor) return;
    const dept = depts.find((d) => d.id === editor.deptId);
    const ok = await confirmDialog({ title: `Save the route for ${dept?.name}?`, message: "New requests from this department follow this route. Requests already moving keep the route they started with.", confirmLabel: "Save route" });
    if (!ok) return;
    setBusy(true);
    try {
      await saveRoute(editor.deptId, editor.lanes, editor.officers, editor.dgVacant);
      setMsg({ tone: "green", text: `Route saved for ${dept?.name}.` });
      setEditor(null);
      await load();
    } catch (e) {
      setMsg({ tone: "red", text: e instanceof Error ? e.message : "The route could not be saved." });
    } finally { setBusy(false); }
  }

  async function saveOfficers() {
    const changed = INSTITUTION.filter((i) => (draft[i.key] || "") !== (settings[i.key] || ""));
    if (!changed.length) return;
    setBusy(true);
    const { error: e } = await supabase.from("app_settings").upsert(changed.map((i) => ({ key: i.key, value: draft[i.key] || "" })), { onConflict: "key" });
    setBusy(false);
    if (e) { setMsg({ tone: "red", text: e.message }); return; }
    void supabase.rpc("reqgen_audit_write", { p_category: "settings", p_module: "Administration", p_action: "Institution officers changed", p_record_no: changed.map((c) => c.label).join(", "), p_record_id: null, p_details: null });
    setMsg({ tone: "green", text: `Saved: ${changed.map((c) => c.label).join(", ")}. New requests use them at once.` });
    await load();
  }

  async function saveAccount() {
    if (!accForm) return;
    if (!accForm.account || !accForm.officer) { setMsg({ tone: "red", text: "Choose the account and its Account Officer." }); return; }
    setBusy(true);
    const existing = accRoutes.find((r) => r.dept_id === accForm.deptId);
    const payload = { dept_id: accForm.deptId, iet_account_id: accForm.account, officer_user_id: accForm.officer, is_active: true };
    const res = existing ? await supabase.from("department_account_routing").update(payload).eq("id", existing.id) : await supabase.from("department_account_routing").insert(payload);
    setBusy(false);
    if (res.error) { setMsg({ tone: "red", text: res.error.message }); return; }
    setMsg({ tone: "green", text: `${depts.find((d) => d.id === accForm.deptId)?.name} is now paid from ${accounts.find((a) => a.id === accForm.account)?.name}.` });
    setAccForm(null);
    await load();
  }

  // ---- Backups & away cover (same tables and functions as before) ----
  const backupsFor = (deptId: string | null, stage: string) => (cfg?.backups || []).filter((b) => b.is_active && b.stage === stage && b.dept_id === deptId).sort((a, b) => a.priority - b.priority);
  async function addBackup(deptId: string | null, stage: EngineStage, userId: string) {
    if (!userId) return;
    const existing = (cfg?.backups || []).filter((b) => b.dept_id === deptId && b.stage === stage);
    const priority = Math.min(9, Math.max(1, ...existing.map((b) => b.priority)) + 1);
    setBusy(true);
    const { error: e } = await supabase.from("reqgen_stage_backups").insert({ dept_id: deptId, stage, user_id: userId, priority, label: stage === "DG" ? "Acting for DG" : `${stage} ${priority}` });
    setBusy(false);
    setMsg(e ? { tone: "red", text: /duplicate|unique/i.test(e.message) ? "That officer is already a backup for this step." : e.message } : { tone: "green", text: `${nameOf.get(userId)} added as a backup.` });
    if (!e) await load();
  }
  async function removeBackup(id: string) {
    setBusy(true);
    const { error: e } = await supabase.from("reqgen_stage_backups").delete().eq("id", id);
    setBusy(false);
    setMsg(e ? { tone: "red", text: e.message } : { tone: "green", text: "Backup removed." });
    if (!e) await load();
  }
  async function markAway() {
    if (!away) return;
    setBusy(true);
    try {
      const moved = await setOfficerAvailability(away.id, true, away.from || null, away.until || null, away.note || null);
      setMsg({ tone: "green", text: `${nameOf.get(away.id)} marked away.${moved ? ` ${moved} waiting request${moved === 1 ? " was" : "s were"} moved to the backup.` : ""}` });
      setAway(null);
      await load();
    } catch (e) { setMsg({ tone: "red", text: e instanceof Error ? e.message : "Could not mark away." }); }
    finally { setBusy(false); }
  }
  async function markBack(id: string) {
    setBusy(true);
    try { await setOfficerAvailability(id, false, null, null, null); setMsg({ tone: "green", text: `${nameOf.get(id)} is available again.` }); await load(); }
    catch (e) { setMsg({ tone: "red", text: e instanceof Error ? e.message : "Could not update." }); }
    finally { setBusy(false); }
  }
  const watched = useMemo(() => {
    const ids = new Set<string>();
    (overview || []).forEach((r) => r.owner_id && ids.add(r.owner_id));
    Object.values(settings).forEach((v) => v && ids.add(v));
    (cfg?.backups || []).forEach((b) => ids.add(b.user_id));
    return [...ids].filter((id) => nameOf.has(id)).sort((a, b) => String(nameOf.get(a)).localeCompare(String(nameOf.get(b))));
  }, [overview, settings, cfg, nameOf]);
  const availability = new Map((cfg?.availability || []).map((a) => [a.user_id, a]));
  const dgId = settings.DG_USER_ID || holders("dg")[0]?.id || "";
  const gsId = settings.GENSEC_USER_ID || holders("generalsecretary")[0]?.id || "";

  const routeStep = (stage: string, who: string, vacant = false, key?: string) => (
    <span key={key} style={{ display: "contents" }}>
      <span className={`v4-st${stage === "DG" ? " v4-dg" : ""}`}><b>{STAGE_TEXT[stage] || stage}</b><small>{vacant ? "vacant · skipped" : who}</small></span>
    </span>
  );
  const arrow = (k: string) => <span key={k} className="v4-ar"><Icon name="right" /></span>;
  const dirty = INSTITUTION.some((i) => (draft[i.key] || "") !== (settings[i.key] || ""));

  return (
    <V4Page>
      <PageHead title="Routing Engine" sub="Who approves what, and in which order. Routing is set here and nowhere else."
        actions={tab === "officers" ? [{ label: busy ? "Saving…" : "Save officers", icon: "check", kind: "primary", disabled: busy || !dirty, onClick: () => void saveOfficers() }] : []} />
      {error ? <Notice tone="red">{error}</Notice> : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <section className="v4-card">
        <div style={{ padding: "0 12px" }}>
          <Tabs value={tab} onChange={(t) => { setTab(t); setMsg(null); }} label="Routing" items={[{ key: "routes", label: "Routes" }, { key: "officers", label: "Officers per step" }, { key: "accounts", label: "Accounts" }, { key: "backups", label: "Backups & away cover" }]} />
        </div>
        {overview === null ? <div className="v4-card-pad"><Skeleton lines={8} /></div> : null}

        {overview && tab === "routes" ? (
          <>
            <div style={{ margin: "16px 20px 0" }}><Notice tone="green">These are your <b>current live routes</b>, read straight from the Routing Engine tables. v4 keeps them exactly as they are — only the label “PO” now reads “PD” and “HR” reads “HR Coordinator”. A vacant step is <b>skipped</b>, never blocked, unless it is set to hold.</Notice></div>
            {groups.map((g) => (
              <div key={g.depts.map((d) => d.id).join()} className="v4-routecard">
                <div className="v4-rh">
                  <span><strong>{g.depts.length === 1 ? g.depts[0].name : `${g.depts.length} departments`}</strong>{g.depts.length > 1 ? <span className="v4-help" style={{ display: "block", margin: "2px 0 0" }}>{g.depts.map((d) => d.name).join(" · ")}</span> : null}</span>
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}><span className="v4-chip v4-chip-green">Live</span><button type="button" className="v4-btn v4-btn-secondary" style={{ minHeight: 38 }} onClick={() => openEditor(g.depts[0].id)}><Icon name="pen" />Change</button></span>
                </div>
                {ROUTE_KINDS.map((k) => (
                  <div key={k} style={{ display: "grid", gridTemplateColumns: "110px minmax(0,1fr)", gap: 10, alignItems: "center" }}>
                    <span className="v4-help" style={{ margin: 0, fontWeight: 700 }}>{ROUTE_KIND_LABEL[k]}</span>
                    <div className="v4-route">
                      {routeStep("Staff", "", false, "start")}
                      {laneOf(g, k).flatMap((s, i) => [arrow(`a${i}`), routeStep(s.stage, s.stage === "PD" && !s.who ? "was PO" : s.who, s.vacant, `s${i}`)])}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <div className="v4-routecard">
              <div className="v4-rh"><strong>Payment vouchers · all accounts</strong></div>
              <div className="v4-route">
                {routeStep("Account", "prepares", false, "p1")}{arrow("p2")}
                <span className="v4-st"><b>Auditor</b><small>{auditor}</small></span>{arrow("p3")}
                <span className="v4-st"><b>Counter Signer</b><small>chosen</small></span>{arrow("p4")}
                <span className="v4-st v4-dg"><b>DG + stamp</b><small>signs, stamps, authorises</small></span>
              </div>
              <p className="v4-help" style={{ margin: 0 }}>Counter Signers are set in <Link href="/payment-vouchers/settings">Payment Vouchers › Signatories</Link>.</p>
            </div>
          </>
        ) : null}

        {overview && tab === "officers" ? (
          <div className="v4-card-pad">
            <p className="v4-help" style={{ margin: "0 0 14px" }}>Officers who act for the whole Trust. Department officers (DOD, HOD, PD) are set on each department’s route — press <b>Change</b> on the Routes tab, or edit the department.</p>
            <div className="v4-form-grid">
              {INSTITUTION.map((i) => {
                const pos = positionFor(i.position);
                const only = holders(i.position);
                const locked = pos?.one && only.length === 1 && (draft[i.key] || "") === only[0].id;
                return (
                  <div key={i.key} className="v4-field"><span className="v4-flabel">{i.label}</span>
                    {locked ? <span className="v4-locked"><Icon name="lock" size="sm" />{only[0].full_name} · one holder</span>
                      : <Select ariaLabel={i.label} searchable value={draft[i.key] || ""} onChange={(v) => setDraft({ ...draft, [i.key]: v })} options={personOptions(i.position, "Not set")} />}
                    {pos?.one && only.length === 1 && !locked ? <span className="v4-help">{only[0].full_name} holds this position. <button type="button" className="v4-link" onClick={() => setDraft({ ...draft, [i.key]: only[0].id })}>Use {only[0].full_name}</button></span> : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {overview && tab === "accounts" ? (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Department</th><th>Paid from</th><th>Account Officer</th><th className="v4-r">Action</th></tr></thead>
              <tbody>
                {depts.map((d) => {
                  const r = accRoutes.find((x) => x.dept_id === d.id && x.is_active !== false);
                  const acc = accounts.find((a) => a.id === r?.iet_account_id);
                  return (
                    <tr key={d.id}>
                      <td className="v4-strong">{d.name}</td>
                      <td data-label="Paid from">{acc ? <><span className="v4-strong">{acc.name}</span><span className="v4-sub">{acc.bank_name}</span></> : <span className="v4-chip v4-chip-amber">Not set</span>}</td>
                      <td data-label="Account Officer">{r ? nameOf.get(r.officer_user_id) || "—" : "—"}</td>
                      <td className="v4-r"><button className="v4-btn v4-btn-secondary" type="button" style={{ minHeight: 38 }} onClick={() => setAccForm({ deptId: d.id, account: r?.iet_account_id || "", officer: r?.officer_user_id || "" })}>Change</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {overview && tab === "backups" ? (
          <div className="v4-card-pad" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p className="v4-help" style={{ margin: 0 }}>When someone is marked <b>Away</b>, their steps go to the next person below. ReqGen writes “for the DG” (or the officer covered) beside the name.</p>
            <div className="v4-routecard" style={{ padding: "0 0 14px" }}>
              <div className="v4-rh"><strong>Director General away</strong></div>
              <div className="v4-route"><span className="v4-st v4-dg"><b>DG</b><small>{nameOf.get(dgId) || "Not set"}{isAwayToday(availability.get(dgId)) ? " · away" : ""}</small></span>{arrow("dg1")}<span className="v4-st"><b>General Secretary</b><small>{nameOf.get(gsId) || "Not set"} · signs and stamps for the DG</small></span></div>
            </div>
            {cfg ? (
              <>
                <h3 className="v4-h3" style={{ margin: 0 }}>Institution-wide backups</h3>
                <div className="v4-bankcards">
                  {(["DG", "HR", "Registrar", "DIN Admin"] as EngineStage[]).map((stage) => (
                    <article key={stage} className="v4-bankcard">
                      <div className="v4-top"><span><strong>{STAGE_TEXT[stage].replace(" + stamp", "")}</strong><span>Primary: {nameOf.get(settings[GLOBAL_STAGE_SETTING[stage] || ""] || "") || "Not set"}</span></span></div>
                      {backupsFor(null, stage).map((b) => <span key={b.id} className="v4-pchip v4-office" style={{ justifyContent: "space-between" }}>{nameOf.get(b.user_id) || "Officer"}<button type="button" className="v4-link" aria-label="Remove backup" onClick={() => void removeBackup(b.id)} disabled={busy}><Icon name="x" size="sm" /></button></span>)}
                      <Select size="compact" ariaLabel={`Add ${stage} backup`} value="" placeholder="+ Add backup" onChange={(v) => void addBackup(null, stage, v)} options={personOptions(stage === "DG" ? "generalsecretary" : stage === "HR" ? "hrcoordinator" : stage === "Registrar" ? "registrar" : "dinadmin").filter((o) => o.value)} disabled={busy} />
                    </article>
                  ))}
                </div>
                <h3 className="v4-h3" style={{ margin: 0 }}>Department backups</h3>
                <div className="v4-field" style={{ maxWidth: 360 }}><span className="v4-flabel">Department</span><Select ariaLabel="Department for backups" searchable value={backupDept} placeholder="Choose a department" onChange={setBackupDept} options={depts.map((d) => ({ value: d.id, label: d.name }))} /></div>
                {backupDept ? (
                  <div className="v4-bankcards">
                    {(DEPT_ONLY as EngineStage[]).map((stage) => (
                      <article key={stage} className="v4-bankcard">
                        <div className="v4-top"><span><strong>{stage}</strong><span>Primary: {nameOf.get(routeOf(backupDept, overview, officers).officers[stage as OfficerStage]) || "Not set"}</span></span></div>
                        {backupsFor(backupDept, stage).map((b) => <span key={b.id} className="v4-pchip v4-office" style={{ justifyContent: "space-between" }}>{b.label || "Backup"} · {nameOf.get(b.user_id) || "Officer"}<button type="button" className="v4-link" aria-label="Remove backup" onClick={() => void removeBackup(b.id)} disabled={busy}><Icon name="x" size="sm" /></button></span>)}
                        <Select size="compact" ariaLabel={`Add ${stage} backup`} value="" placeholder={`+ Add ${stage} backup`} onChange={(v) => void addBackup(backupDept, stage, v)} options={personOptions(stage === "DOD" ? "director" : stage.toLowerCase()).filter((o) => o.value)} disabled={busy} />
                      </article>
                    ))}
                  </div>
                ) : null}
                <h3 className="v4-h3" style={{ margin: 0 }}>Who is away</h3>
                <div className="v4-table-wrap">
                  <table className="v4-data v4-stack">
                    <thead><tr><th>Officer</th><th>Status</th><th className="v4-hide-sm">Away period</th><th className="v4-r">Action</th></tr></thead>
                    <tbody>
                      {watched.map((id) => {
                        const av = availability.get(id); const now = isAwayToday(av);
                        return (
                          <tr key={id}>
                            <td className="v4-strong">{nameOf.get(id)}</td>
                            <td data-label="Status">{now ? <span className="v4-chip v4-chip-amber">Away</span> : av?.is_away ? <span className="v4-chip v4-chip-blue">Away later</span> : <span className="v4-chip v4-chip-green">Available</span>}</td>
                            <td className="v4-hide-sm">{av?.is_away ? `${av.away_from || "now"} → ${av.away_until || "until further notice"}${av.note ? ` · ${av.note}` : ""}` : "—"}</td>
                            <td className="v4-r">{av?.is_away
                              ? <button className="v4-btn v4-btn-secondary" type="button" style={{ minHeight: 38 }} disabled={busy} onClick={() => void markBack(id)}>Mark available</button>
                              : <button className="v4-btn v4-btn-secondary" type="button" style={{ minHeight: 38 }} disabled={busy} onClick={() => setAway({ id, from: "", until: "", note: "" })}>Mark away</button>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : <Notice tone="amber">Backups need the Routing Engine tables from the v3.0.5 database update.</Notice>}
          </div>
        ) : null}
      </section>

      <Modal open={!!editor} wide title={`Change the route — ${depts.find((d) => d.id === editor?.deptId)?.name || ""}`} sub="Switch a step ON to make every request of that type pass through it. DG, Account Officer and HR Filing are fixed by IET rules." onClose={() => setEditor(null)} busy={busy}
        footer={<><button type="button" className="v4-btn v4-btn-ghost" onClick={() => setEditor(null)} disabled={busy}>Cancel</button><button type="button" className="v4-btn v4-btn-primary" onClick={() => void saveEditor()} disabled={busy || !editor?.dirty}><Icon name="check" />{busy ? "Saving…" : "Save route"}</button></>}>
        {editor ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="v4-field" style={{ maxWidth: 360 }}><span className="v4-flabel">Department</span><Select ariaLabel="Department" searchable value={editor.deptId} onChange={(v) => { if (!editor.dirty) openEditor(v); }} disabled={editor.dirty} options={depts.map((d) => ({ value: d.id, label: d.name }))} /></div>
            <div className="v4-matrix-wrap">
              <table className="v4-matrix">
                <thead><tr><th>Step</th>{ROUTE_KINDS.map((k) => <th key={k}>{ROUTE_KIND_LABEL[k]}</th>)}</tr></thead>
                <tbody>
                  {REVIEW.map((s) => (
                    <tr key={s}>
                      <td>{STAGE_TEXT[s]}</td>
                      {ROUTE_KINDS.map((k) => {
                        const cell = editor.lanes[k][s];
                        const set = (patch: Partial<{ on: boolean; ifVacant: IfVacant }>) => setEditor({ ...editor, dirty: true, lanes: { ...editor.lanes, [k]: { ...editor.lanes[k], [s]: { ...cell, ...patch } } } });
                        return (
                          <td key={k}>
                            <label className="v4-check" style={{ justifyContent: "center", alignItems: "center" }}><input type="checkbox" checked={cell.on} onChange={(e) => set({ on: e.target.checked })} aria-label={`${STAGE_TEXT[s]} for ${ROUTE_KIND_LABEL[k]}`} /></label>
                            {cell.on ? <select className="v4-input" style={{ minHeight: 34, fontSize: 12.5, marginTop: 6 }} value={cell.ifVacant} onChange={(e) => set({ ifVacant: e.target.value as IfVacant })} aria-label="If nobody holds this step"><option value="skip">If vacant: skip</option><option value="block">If vacant: hold</option></select> : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr><td>DG + stamp</td>{ROUTE_KINDS.map((k) => <td key={k}><span className="v4-y">Always</span>{k === "official" ? <select className="v4-input" style={{ minHeight: 34, fontSize: 12.5, marginTop: 6 }} value={editor.dgVacant} onChange={(e) => setEditor({ ...editor, dirty: true, dgVacant: e.target.value as IfVacant })} aria-label="If the DG post is vacant"><option value="block">If vacant: hold</option><option value="skip">If vacant: skip</option></select> : null}</td>)}</tr>
                  <tr><td>Account Officer</td>{ROUTE_KINDS.map((k) => <td key={k}>{k === "personal_other" ? <span className="v4-n">Not used</span> : <span className="v4-y">After DG</span>}</td>)}</tr>
                  <tr><td>HR Filing</td>{ROUTE_KINDS.map((k) => <td key={k}>{k === "official" ? <span className="v4-n">Not used</span> : <span className="v4-y">Last</span>}</td>)}</tr>
                </tbody>
              </table>
            </div>
            <div className="v4-form-grid">
              {OFFICER_STAGES.map((s) => {
                const g = GLOBAL_STAGE_SETTING[s as keyof typeof GLOBAL_STAGE_SETTING];
                const def = g && settings[g] ? nameOf.get(settings[g]) : "";
                return (
                  <div key={s} className="v4-field"><span className="v4-flabel">{s === "DG" ? "Director General" : STAGE_TEXT[s]} for this department</span>
                    <Select ariaLabel={`${s} officer`} searchable value={editor.officers[s] || ""} onChange={(v) => setEditor({ ...editor, dirty: true, officers: { ...editor.officers, [s]: v } })}
                      options={personOptions(s === "DOD" ? "director" : s === "HR" ? "hrcoordinator" : s === "DIN Admin" ? "dinadmin" : s.toLowerCase(), DEPT_ONLY.includes(s) ? "Nobody (step skipped or held)" : def ? `Institution officer — ${def}` : "Institution officer (not set)")} />
                  </div>
                );
              })}
            </div>
            <Notice tone="blue">Saving makes a new route version. Requests already moving keep the route they started with; new requests follow this one.</Notice>
          </div>
        ) : null}
      </Modal>

      <Modal open={!!accForm} title={`Paying account — ${depts.find((d) => d.id === accForm?.deptId)?.name || ""}`} onClose={() => setAccForm(null)} busy={busy}
        footer={<><button type="button" className="v4-btn v4-btn-ghost" onClick={() => setAccForm(null)} disabled={busy}>Cancel</button><button type="button" className="v4-btn v4-btn-primary" onClick={() => void saveAccount()} disabled={busy}><Icon name="check" />Save</button></>}>
        {accForm ? (
          <div className="v4-form-grid">
            <div className="v4-field"><span className="v4-flabel">Account</span><Select ariaLabel="Account" value={accForm.account} placeholder="Choose the account" onChange={(v) => setAccForm({ ...accForm, account: v })} options={accounts.map((a) => ({ value: a.id, label: a.name, hint: a.bank_name || undefined }))} /></div>
            <div className="v4-field"><span className="v4-flabel">Account Officer</span><Select ariaLabel="Account Officer" searchable value={accForm.officer} placeholder="Choose the officer" onChange={(v) => setAccForm({ ...accForm, officer: v })} options={personOptions("accountofficer").filter((o) => o.value)} /></div>
          </div>
        ) : null}
      </Modal>

      <Modal open={!!away} title={`Mark ${nameOf.get(away?.id || "") || "officer"} away`} sub="Requests already waiting move to the backup at once; new requests skip them until they are back." onClose={() => setAway(null)} busy={busy}
        footer={<><button type="button" className="v4-btn v4-btn-ghost" onClick={() => setAway(null)} disabled={busy}>Cancel</button><button type="button" className="v4-btn v4-btn-primary" onClick={() => void markAway()} disabled={busy}><Icon name="check" />Mark away</button></>}>
        {away ? (
          <div className="v4-form-grid">
            <label className="v4-field"><span className="v4-flabel">From (optional)</span><input className="v4-input" type="date" value={away.from} onChange={(e) => setAway({ ...away, from: e.target.value })} /></label>
            <label className="v4-field"><span className="v4-flabel">Until (optional)</span><input className="v4-input" type="date" min={away.from || undefined} value={away.until} onChange={(e) => setAway({ ...away, until: e.target.value })} /></label>
            <label className="v4-field v4-span-2"><span className="v4-flabel">Reason (optional)</span><input className="v4-input" maxLength={120} placeholder="e.g. Travelling" value={away.note} onChange={(e) => setAway({ ...away, note: e.target.value })} /></label>
          </div>
        ) : null}
      </Modal>
    </V4Page>
  );
}
