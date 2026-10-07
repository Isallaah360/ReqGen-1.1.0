"use client";

import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { confirmDialog, promptDialog } from "@/lib/dialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Building2, CircleAlert, GitBranch, GripVertical, Plus, ShieldCheck, Trash2, UserMinus, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { PersonName } from "@/app/components/ui/PersonName";
import { IconAction, IconActions } from "@/app/components/ui/IconAction";
import { nameWithRole } from "@/lib/userIdentity";
import {
  DEPARTMENT_STAGES, ENGINE_STAGES, GLOBAL_STAGE_SETTING, ROUTE_KINDS, ROUTE_KIND_LABEL, STAGE_LABEL,
  isAwayToday, loadEngineConfig, saveRouteLane, setOfficerAvailability,
  type EngineConfig, type EngineStage, type IfVacant, type RouteKind,
} from "@/lib/routingEngine";

/**
 * Admin → Routing Engine (v3.0.5)
 * Every request's approval route is read from here by the database itself
 * (build_request_route). Changes apply to NEW requests; requests in progress
 * keep the route they started on.
 */
type Dept = { id: string; name: string; is_active: boolean | null; hod_user_id: string | null; director_user_id: string | null; po_id: string | null };
type Person = { id: string; full_name: string | null; email: string | null; role: string | null };
type Tab = "departments" | "templates" | "officers";
type Lane = { stage: EngineStage; if_vacant: IfVacant }[];

const roleKey = (v: string | null | undefined) => String(v || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
const personName = (p?: Person | null) => p?.full_name?.trim() || p?.email?.trim() || "";
const DEPT_COLUMN: Record<string, "director_user_id" | "hod_user_id" | "po_id"> = { DOD: "director_user_id", HOD: "hod_user_id", PO: "po_id" };

export default function RoutingEnginePage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("departments");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [cfg, setCfg] = useState<EngineConfig | null>(null);
  const [search, setSearch] = useState("");
  const [editDeptId, setEditDeptId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [lanes, setLanes] = useState<Record<RouteKind, Lane>>({ official: [], personal_fund: [], personal_other: [] });
  const [dirty, setDirty] = useState<Record<RouteKind, boolean>>({ official: false, personal_fund: false, personal_other: false });
  const [drag, setDrag] = useState<{ kind: RouteKind; index: number } | null>(null);
  const [awayFor, setAwayFor] = useState<Person | null>(null);
  const [awayForm, setAwayForm] = useState({ from: "", until: "", note: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.replace("/login"); return; }
    const me = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
    if (me.error || roleKey(me.data?.role) !== "admin") { router.replace("/unauthorized"); return; }
    try {
      const [deptRes, peopleRes, settingsRes, engine] = await Promise.all([
        supabase.from("departments").select("id,name,is_active,hod_user_id,director_user_id,po_id").order("name"),
        supabase.from("profiles").select("id,full_name,email,role").order("full_name"),
        supabase.from("app_settings").select("key,value").in("key", [...Object.values(GLOBAL_STAGE_SETTING), "GENSEC_USER_ID"] as string[]),
        loadEngineConfig(),
      ]);
      if (deptRes.error) throw new Error(deptRes.error.message);
      setDepts((deptRes.data || []) as Dept[]);
      setPeople((peopleRes.data || []) as Person[]);
      setSettings(Object.fromEntries(((settingsRes.data || []) as { key: string; value: string | null }[]).map((s) => [s.key, String(s.value || "")])));
      setCfg(engine);
      setTemplateId((cur) => cur || engine.templates[0]?.id || null);
    } catch (e) {
      setMsg({ tone: "error", text: "Unable to load the Routing Engine: " + (e instanceof Error ? e.message : "unknown error") });
    }
    setLoading(false);
  }, [router]);

  useEffect(() => { const t = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(t); }, [load]);

  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const availability = useMemo(() => new Map((cfg?.availability || []).map((a) => [a.user_id, a])), [cfg]);
  const templateById = useMemo(() => new Map((cfg?.templates || []).map((t) => [t.id, t])), [cfg]);
  const deptTemplate = useCallback((deptId: string) => cfg?.deptRoutes.find((r) => r.dept_id === deptId)?.template_id || null, [cfg]);
  const stepsFor = useCallback((tid: string | null, kind: RouteKind) =>
    (cfg?.steps || []).filter((s) => s.template_id === tid && s.route_kind === kind).sort((a, b) => a.step_order - b.step_order), [cfg]);

  /** Primary officer for a stage in a department (mirrors the database). */
  const primaryFor = useCallback((dept: Dept, stage: EngineStage): string | null => {
    if (stage === "DOD") return dept.director_user_id;
    if (stage === "HOD") return dept.hod_user_id;
    if (stage === "PO") return dept.po_id;
    if (stage === "HR Filing") return settings.HR_USER_ID || null;
    const key = GLOBAL_STAGE_SETTING[stage];
    return key ? settings[key] || null : null;
  }, [settings]);
  const backupsFor = useCallback((deptId: string | null, stage: EngineStage) =>
    (cfg?.backups || []).filter((b) => b.is_active && b.stage === (stage === "HR Filing" ? "HR" : stage) && (b.dept_id === deptId || (deptId !== null && b.dept_id === null)))
      .sort((a, b) => (a.dept_id === null ? 10 : 0) + a.priority - ((b.dept_id === null ? 10 : 0) + b.priority)), [cfg]);

  /** Who will actually receive this stage today (first available candidate). */
  const holderToday = useCallback((dept: Dept, stage: EngineStage) => {
    if (stage === "Account") return { id: null as string | null, covering: false, vacant: false };
    const chain = [primaryFor(dept, stage), ...backupsFor(dept.id, stage).map((b) => b.user_id)].filter(Boolean) as string[];
    if (!chain.length) return { id: null, covering: false, vacant: true };
    const free = chain.find((id) => !isAwayToday(availability.get(id)));
    return { id: free || chain[0], covering: Boolean(free && free !== chain[0]), vacant: false };
  }, [primaryFor, backupsFor, availability]);

  const vacanciesFor = useCallback((dept: Dept) => {
    const tid = deptTemplate(dept.id);
    const out: { stage: EngineStage; block: boolean }[] = [];
    for (const kind of ROUTE_KINDS) for (const s of stepsFor(tid, kind)) {
      if (holderToday(dept, s.stage).vacant && !out.some((o) => o.stage === s.stage)) out.push({ stage: s.stage, block: s.if_vacant === "block" });
    }
    return out;
  }, [deptTemplate, stepsFor, holderToday]);

  // ---------- template editor state ----------
  useEffect(() => {
    if (!templateId) return;
    const next = {} as Record<RouteKind, Lane>;
    for (const k of ROUTE_KINDS) next[k] = stepsFor(templateId, k).map((s) => ({ stage: s.stage, if_vacant: s.if_vacant }));
    queueMicrotask(() => { setLanes(next); setDirty({ official: false, personal_fund: false, personal_other: false }); });
  }, [templateId, stepsFor]);

  const editLane = (kind: RouteKind, fn: (lane: Lane) => Lane) => { setLanes((l) => ({ ...l, [kind]: fn([...l[kind]]) })); setDirty((d) => ({ ...d, [kind]: true })); };
  const move = (kind: RouteKind, from: number, to: number) => editLane(kind, (lane) => { if (to < 0 || to >= lane.length) return lane; const [x] = lane.splice(from, 1); lane.splice(to, 0, x); return lane; });
  const onDrop = (kind: RouteKind, to: number) => (e: DragEvent) => { e.preventDefault(); if (drag && drag.kind === kind) move(kind, drag.index, to); setDrag(null); };

  async function run(label: string, fn: () => Promise<string | void>) {
    setBusy(true); setMsg(null);
    try { const text = await fn(); setMsg({ tone: "ok", text: text || `✓ ${label}` }); await load(); }
    catch (e) { setMsg({ tone: "error", text: (e instanceof Error ? e.message : String(e)).replace(/^.*?Routing incomplete/, "Routing incomplete") }); }
    setBusy(false);
  }

  const saveLane = (kind: RouteKind) => templateId && run(`${ROUTE_KIND_LABEL[kind]} route saved for ${templateById.get(templateId)?.name}.`, () =>
    saveRouteLane(templateId, kind, lanes[kind].map((s) => s.stage), lanes[kind].map((s) => s.if_vacant)));

  const assignTemplate = (dept: Dept, tid: string) => run(`${dept.name} now uses the ${templateById.get(tid)?.name} route for new requests.`, async () => {
    const { error } = await supabase.from("reqgen_department_routes").upsert({ dept_id: dept.id, template_id: tid, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
  });

  const setPrimary = (dept: Dept, stage: EngineStage, userId: string) => run(`${STAGE_LABEL(stage)} updated for ${dept.name}.`, async () => {
    const col = DEPT_COLUMN[stage]; if (!col) return;
    const { error } = await supabase.from("departments").update({ [col]: userId || null }).eq("id", dept.id);
    if (error) throw new Error(error.message);
  });

  const addBackup = (deptId: string | null, stage: EngineStage, userId: string) => userId && run("Backup officer added.", async () => {
    const existing = (cfg?.backups || []).filter((b) => b.dept_id === deptId && b.stage === stage);
    const priority = Math.min(9, Math.max(1, ...existing.map((b) => b.priority)) + 1);
    const label = stage === "DG" ? "Acting for DG" : `${stage} ${priority}`;
    const { error } = await supabase.from("reqgen_stage_backups").insert({ dept_id: deptId, stage, user_id: userId, priority, label });
    if (error) throw new Error(/duplicate|unique/i.test(error.message) ? "That officer is already a backup for this step." : error.message);
  });

  const removeBackup = (id: string) => run("Backup officer removed.", async () => {
    const { error } = await supabase.from("reqgen_stage_backups").delete().eq("id", id);
    if (error) throw new Error(error.message);
  });

  const markAway = () => awayFor && run("", async () => {
    const moved = await setOfficerAvailability(awayFor.id, true, awayForm.from || null, awayForm.until || null, awayForm.note || null);
    setAwayFor(null);
    return `✓ ${personName(awayFor)} marked away.${moved ? ` ${moved} waiting request${moved === 1 ? " was" : "s were"} moved to backup officers.` : ""}`;
  });
  const markBack = (p: Person) => run(`${personName(p)} is available again.`, async () => { await setOfficerAvailability(p.id, false, null, null, null); });

  // ---------- derived lists ----------
  const filteredDepts = depts.filter((d) => !search.trim() || `${d.name} ${templateById.get(deptTemplate(d.id) || "")?.name || ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const needsRouting = depts.filter((d) => vacanciesFor(d).length > 0).length;
  const officers = useMemo(() => {
    const ids = new Set<string>();
    depts.forEach((d) => [d.director_user_id, d.hod_user_id, d.po_id].forEach((id) => id && ids.add(id)));
    Object.values(GLOBAL_STAGE_SETTING).forEach((k) => k && settings[k] && ids.add(settings[k]));
    (cfg?.backups || []).forEach((b) => ids.add(b.user_id));
    return [...ids].map((id) => personById.get(id)).filter(Boolean).sort((a, b) => personName(a).localeCompare(personName(b))) as Person[];
  }, [depts, settings, cfg, personById]);
  const awayCount = officers.filter((p) => isAwayToday(availability.get(p.id))).length;
  const editDept = editDeptId ? depts.find((d) => d.id === editDeptId) || null : null;

  const peopleOptions = (prefer: string[]) => {
    const match = people.filter((p) => prefer.includes(roleKey(p.role)));
    const rest = people.filter((p) => !match.includes(p));
    return (<>
      {match.length ? <optgroup label="Matching role">{match.map((p) => <option key={p.id} value={p.id}>{nameWithRole(personName(p), p.role)}</option>)}</optgroup> : null}
      <optgroup label="All staff">{rest.map((p) => <option key={p.id} value={p.id}>{nameWithRole(personName(p), p.role)}</option>)}</optgroup>
    </>);
  };
  const PREFER: Record<string, string[]> = { DOD: ["director", "dod"], HOD: ["hod"], PO: ["po"], DG: ["generalsecretary", "gensec", "dg"], HR: ["hr", "hrofficer1", "hrofficer2"], Registrar: ["registrar"], "DIN Admin": ["dinadmin"] };

  const officerChip = (id: string | null, covering = false) => {
    if (!id) return <span className="rg-route-unset">Not assigned</span>;
    const p = personById.get(id);
    const away = isAwayToday(availability.get(id));
    return <span className="rg-engine-person">{p ? <PersonName name={personName(p)} role={p.role} /> : "Unknown officer"}{away ? <em className="is-away">Away</em> : null}{covering ? <em className="is-cover">Covering</em> : null}</span>;
  };

  if (loading) return <main className="admin-v3-page" data-rg-standard="phase7"><div className="admin-v3-loading">Loading Routing Engine…</div></main>;

  return (
    <main className="admin-v3-page" data-rg-standard="phase7">
      <header className="admin-v3-header">
        <div>
          <h1>Advanced Routing</h1>
        </div>
        <button className="admin-v3-secondary" onClick={() => void load()} disabled={busy}>Refresh</button>
      </header>
      {msg ? <div className={`rg-alert ${msg.tone === "error" ? "is-error" : "is-ok"}`} role="status">{msg.text}</div> : null}

      {!cfg?.installed ? (
        <section className="rg-gate" style={{ borderColor: "#f5d08a" }}>
          <CircleAlert size={26} />
          <div><h2>Routing Engine not installed yet</h2><p>Run <strong>database/v3_0_5_routing_engine.sql</strong> in the Supabase SQL Editor, then press Refresh. Until then, requests keep following the current built-in routes.</p></div>
        </section>
      ) : (<>
        <section className="admin-v3-kpis" aria-label="Routing overview">
          <article className="admin-v3-kpi"><div><span>Departments</span><strong>{depts.length}</strong><small>Each assigned a route</small></div><span className="admin-v3-kpi-icon"><Building2 size={19} /></span></article>
          <article className="admin-v3-kpi"><div><span>Route Templates</span><strong>{cfg.templates.length}</strong><small>Official · Personal Fund · Personal Other</small></div><span className="admin-v3-kpi-icon"><GitBranch size={19} /></span></article>
          <article className="admin-v3-kpi is-green"><div><span>Fully Routed</span><strong>{depts.length - needsRouting}</strong><small>Every step has an officer</small></div><span className="admin-v3-kpi-icon"><ShieldCheck size={19} /></span></article>
          <article className="admin-v3-kpi is-amber"><div><span>Away Today</span><strong>{awayCount}</strong><small>Backups are covering</small></div><span className="admin-v3-kpi-icon"><UserMinus size={19} /></span></article>
        </section>

        <nav data-rg-tabs="true" role="tablist" aria-label="Routing Engine sections">
          {([["departments", "Departments"], ["templates", "Route Templates"], ["officers", "Officers & Availability"]] as [Tab, string][]).map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "is-active" : ""} onClick={() => setTab(key)}>{label}</button>
          ))}
        </nav>

        {tab === "departments" ? (
          <section className="admin-v3-card">
            <div className="admin-v3-toolbar"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search departments or routes…" /><span>{filteredDepts.length} departments</span></div>
            <div className="admin-v3-table-scroll">
              <table className="admin-v3-table rg-std-table">
                <thead><tr><th className="rg-col-index">#</th><th>Department</th><th>Route</th><th>Official Route</th><th>DOD</th><th>HOD</th><th>Status</th><th className="rg-col-actions">Actions</th></tr></thead>
                <tbody>
                  {filteredDepts.map((d, i) => {
                    const tid = deptTemplate(d.id);
                    const vac = vacanciesFor(d);
                    const dod = holderToday(d, "DOD"); const hod = holderToday(d, "HOD");
                    return (
                      <tr key={d.id}>
                        <td className="rg-col-index">{i + 1}</td>
                        <td><strong>{d.name}</strong></td>
                        <td>
                          <select className="rg-engine-select" value={tid || ""} disabled={busy} onChange={(e) => e.target.value && void assignTemplate(d, e.target.value)} aria-label={`Route template for ${d.name}`}>
                            {!tid ? <option value="">Choose…</option> : null}
                            {cfg.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </td>
                        <td><span className="rg-route-inline">{stepsFor(tid, "official").map((s) => (s.stage === "Account" ? "Account" : s.stage)).join(" → ") || "—"}</span></td>
                        <td>{officerChip(dod.vacant ? null : dod.id, dod.covering)}</td>
                        <td>{officerChip(hod.vacant ? null : hod.id, hod.covering)}</td>
                        <td>
                          <span className={`admin-v3-status ${vac.length ? "is-inactive" : "is-active"}`} title={vac.map((v) => `${STAGE_LABEL(v.stage)}: ${v.block ? "blocks submission" : "skipped"}`).join(" · ")}>
                            {vac.length ? `Vacant: ${vac.map((v) => STAGE_LABEL(v.stage)).join(", ")}` : "Complete"}
                          </span>
                        </td>
                        <td className="rg-col-actions"><IconActions><IconAction kind="edit" label={`Officers for ${d.name}`} onClick={() => setEditDeptId(d.id)} /></IconActions></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="rg-route-note">&quot;Vacant&quot; steps are skipped, or block submission if set to <strong>Block</strong> in Route Templates. ASAP-ALLI and any department can use any template; create a new template for special flows.</p>
          </section>
        ) : null}

        {tab === "templates" && templateId ? (
          <section className="admin-v3-card">
            <div className="rg-engine-template-bar">
              <label>Template
                <select className="rg-engine-select" value={templateId} onChange={(e) => { const next = e.target.value; void (async () => { if (Object.values(dirty).some(Boolean) && !(await confirmDialog({ title: "Discard unsaved changes?", message: "You have unsaved route changes. Discard them and switch template?", confirmLabel: "Discard changes", tone: "warning" }))) return; setTemplateId(next); })(); }}>
                  {cfg.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              <span className="rg-route-note" style={{ margin: 0 }}>
                Used by: {depts.filter((d) => deptTemplate(d.id) === templateId).map((d) => d.name).join(", ") || "no departments"}
              </span>
              <button type="button" className="rg-btn rg-btn-secondary" disabled={busy} onClick={async () => {
                const name = await promptDialog({ title: "New route template", label: "Template name", placeholder: "e.g. ASAP-ALLI Special", message: `The new template starts as a copy of ${templateById.get(templateId)?.name || "the current template"}.`, confirmLabel: "Create template" }); if (!name?.trim()) return;
                const code = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
                void run(`Template "${name.trim()}" created — copy of ${templateById.get(templateId)?.name}.`, async () => {
                  const { data, error } = await supabase.from("reqgen_route_templates").insert({ code, name: name.trim() }).select("id").single();
                  if (error) throw new Error(/duplicate|unique/i.test(error.message) ? "A template with that name already exists." : error.message);
                  for (const kind of ROUTE_KINDS) await saveRouteLane(data.id, kind, lanes[kind].map((s) => s.stage), lanes[kind].map((s) => s.if_vacant));
                  setTemplateId(data.id);
                });
              }}><Plus size={15} />New template</button>
            </div>

            {ROUTE_KINDS.map((kind) => {
              const lane = lanes[kind];
              const unused = ENGINE_STAGES.filter((s) => !lane.some((l) => l.stage === s));
              return (
                <div key={kind} className="rg-engine-lane">
                  <div className="rg-engine-lane-head">
                    <h3>{ROUTE_KIND_LABEL[kind]}</h3>
                    <div className="rg-page-actions">
                      <select className="rg-engine-select" value="" aria-label={`Add a step to ${ROUTE_KIND_LABEL[kind]}`} onChange={(e) => { const st = e.target.value as EngineStage; if (st) editLane(kind, (l) => [...l, { stage: st, if_vacant: "skip" }]); }}>
                        <option value="">+ Add step…</option>
                        {unused.map((s) => <option key={s} value={s}>{STAGE_LABEL(s)}</option>)}
                      </select>
                      <button type="button" className="rg-btn rg-btn-primary" disabled={busy || !dirty[kind]} onClick={() => void saveLane(kind)}>Save {ROUTE_KIND_LABEL[kind]}</button>
                    </div>
                  </div>
                  <ol className="rg-engine-steps">
                    <li className="rg-engine-step is-fixed"><span>Staff (requester)</span></li>
                    {lane.map((s, i) => (
                      <li key={`${s.stage}-${i}`} className={`rg-engine-step ${drag?.kind === kind && drag.index === i ? "is-dragging" : ""}`}
                        draggable onDragStart={() => setDrag({ kind, index: i })} onDragOver={(e) => e.preventDefault()} onDrop={onDrop(kind, i)} onDragEnd={() => setDrag(null)}>
                        <GripVertical size={15} className="rg-engine-grip" aria-hidden="true" />
                        <b>{i + 1}</b>
                        <span className="rg-engine-step-name">{STAGE_LABEL(s.stage)}</span>
                        {s.stage !== "Account" ? (
                          <select className="rg-engine-vacant" value={s.if_vacant} aria-label={`If ${s.stage} is vacant`} onChange={(e) => editLane(kind, (l) => { l[i] = { ...l[i], if_vacant: e.target.value as IfVacant }; return l; })}>
                            <option value="skip">If vacant: Skip</option>
                            <option value="block">If vacant: Block</option>
                          </select>
                        ) : <span className="rg-engine-vacant-note">Set by Account Routing</span>}
                        <span className="rg-engine-step-actions">
                          <button type="button" aria-label="Move up" onClick={() => move(kind, i, i - 1)} disabled={i === 0}><ArrowUp size={14} /></button>
                          <button type="button" aria-label="Move down" onClick={() => move(kind, i, i + 1)} disabled={i === lane.length - 1}><ArrowDown size={14} /></button>
                          <button type="button" aria-label={`Remove ${s.stage}`} className="is-danger" onClick={() => editLane(kind, (l) => l.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
                        </span>
                      </li>
                    ))}
                  </ol>
                  {dirty[kind] ? <p className="rg-engine-dirty">Unsaved changes — press Save {ROUTE_KIND_LABEL[kind]}.</p> : null}
                </div>
              );
            })}
            <p className="rg-route-note">Rules enforced on save: every route includes DG; on Official and Personal Fund routes Account comes straight after DG; personal routes end with HR Filing; a step can appear only once. Drag a step, or use the arrows, to reorder.</p>
          </section>
        ) : null}

        {tab === "officers" ? (
          <section className="admin-v3-card">
            <h3 className="rg-engine-section-title">Institution-wide backups</h3>
            <div className="rg-engine-global">
              {(["DG", "HR", "Registrar", "DIN Admin"] as EngineStage[]).map((stage) => (
                <div key={stage} className="rg-engine-global-card">
                  <h4>{stage}</h4>
                  <div className="rg-engine-chain">
                    <span className="rg-engine-rank">Primary</span>{officerChip(settings[GLOBAL_STAGE_SETTING[stage] || ""] || null)}
                  </div>
                  {backupsFor(null, stage).filter((b) => b.dept_id === null).map((b) => (
                    <div key={b.id} className="rg-engine-chain">
                      <span className="rg-engine-rank">Backup</span>{officerChip(b.user_id)}
                      <button type="button" className="rg-icon-action is-danger" aria-label="Remove backup" onClick={() => void removeBackup(b.id)}><X size={14} /></button>
                    </div>
                  ))}
                  <select className="rg-engine-select" value="" onChange={(e) => void addBackup(null, stage, e.target.value)} aria-label={`Add ${stage} backup`}>
                    <option value="">+ Add backup…</option>{peopleOptions(PREFER[stage] || [])}
                  </select>
                </div>
              ))}
            </div>
            <p className="rg-route-note">Primary officers are set in <Link href="/admin/settings">System Settings</Link>. Backups act only while the primary is marked away.</p>

            <h3 className="rg-engine-section-title">Availability</h3>
            <div className="admin-v3-table-scroll">
              <table className="admin-v3-table rg-std-table">
                <thead><tr><th>Officer</th><th>Status</th><th>Away period</th><th>Note</th><th className="rg-col-actions">Action</th></tr></thead>
                <tbody>
                  {officers.map((p) => {
                    const av = availability.get(p.id); const away = isAwayToday(av);
                    const future = av?.is_away && !away;
                    return (
                      <tr key={p.id}>
                        <td><PersonName name={personName(p)} role={p.role} /></td>
                        <td><span className={`admin-v3-status ${away ? "is-inactive" : "is-active"}`}>{away ? "Away" : future ? "Away (scheduled)" : "Available"}</span></td>
                        <td>{av?.is_away ? `${av.away_from || "now"} → ${av.away_until || "until further notice"}` : "—"}</td>
                        <td>{av?.is_away ? av.note || "—" : "—"}</td>
                        <td className="rg-col-actions">
                          {av?.is_away
                            ? <button type="button" className="rg-btn rg-btn-secondary" disabled={busy} onClick={() => void markBack(p)}>Mark available</button>
                            : <button type="button" className="rg-btn rg-btn-secondary" disabled={busy} onClick={() => { setAwayFor(p); setAwayForm({ from: "", until: "", note: "" }); }}>Mark away</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </>)}

      {editDept && cfg?.installed ? (
        <div className="rg-modal-backdrop" role="presentation" onMouseDown={() => !busy && setEditDeptId(null)}>
          <section className="rg-modal rg-route-modal" role="dialog" aria-modal="true" aria-labelledby="eng-dept-title" onMouseDown={(e) => e.stopPropagation()}>
            <div className="rg-route-modal-head">
              <div><h2 id="eng-dept-title">{editDept.name}</h2><p>{templateById.get(deptTemplate(editDept.id) || "")?.name || "No"} route · department officers and backups</p></div>
              <button type="button" className="rg-icon-action is-neutral" aria-label="Close" onClick={() => setEditDeptId(null)}><X size={16} /></button>
            </div>
            {DEPARTMENT_STAGES.map((stage) => (
              <div key={stage} className="rg-engine-global-card" style={{ marginBottom: 10 }}>
                <h4>{stage}</h4>
                <label className="rg-engine-chain"><span className="rg-engine-rank">Primary</span>
                  <select className="rg-engine-select" value={primaryFor(editDept, stage) || ""} disabled={busy} onChange={(e) => void setPrimary(editDept, stage, e.target.value)}>
                    <option value="">Not assigned</option>{peopleOptions(PREFER[stage] || [])}
                  </select>
                </label>
                {backupsFor(editDept.id, stage).filter((b) => b.dept_id === editDept.id).map((b) => (
                  <div key={b.id} className="rg-engine-chain">
                    <span className="rg-engine-rank">{b.label || "Backup"}</span>{officerChip(b.user_id)}
                    <button type="button" className="rg-icon-action is-danger" aria-label="Remove backup" onClick={() => void removeBackup(b.id)}><X size={14} /></button>
                  </div>
                ))}
                <select className="rg-engine-select" value="" disabled={busy} onChange={(e) => void addBackup(editDept.id, stage, e.target.value)} aria-label={`Add ${stage} backup`}>
                  <option value="">+ Add backup {stage}…</option>{peopleOptions(PREFER[stage] || [])}
                </select>
              </div>
            ))}
            <p className="rg-route-note">Backups step in automatically when the primary is marked away — requests already waiting are moved to them at once.</p>
          </section>
        </div>
      ) : null}

      {awayFor ? (
        <div className="rg-modal-backdrop" role="presentation" onMouseDown={() => !busy && setAwayFor(null)}>
          <section className="rg-modal" style={{ width: "min(440px,100%)" }} role="dialog" aria-modal="true" aria-labelledby="away-title" onMouseDown={(e) => e.stopPropagation()}>
            <div className="rg-route-modal-head">
              <div><h2 id="away-title">Mark away</h2><p>{nameWithRole(personName(awayFor), awayFor.role)}</p></div>
              <button type="button" className="rg-icon-action is-neutral" aria-label="Close" onClick={() => setAwayFor(null)}><X size={16} /></button>
            </div>
            <div className="rg-route-form">
              <label>From (optional)<input type="date" value={awayForm.from} onChange={(e) => setAwayForm({ ...awayForm, from: e.target.value })} /></label>
              <label>Until (optional)<input type="date" value={awayForm.until} min={awayForm.from || undefined} onChange={(e) => setAwayForm({ ...awayForm, until: e.target.value })} /></label>
              <label style={{ gridColumn: "1 / -1" }}>Reason (optional)<input value={awayForm.note} maxLength={120} placeholder="e.g. Travelling, network issues" onChange={(e) => setAwayForm({ ...awayForm, note: e.target.value })} /></label>
            </div>
            <p className="rg-route-note">Requests already waiting on this officer move to their backup immediately, and new requests skip them until they are marked available.</p>
            <div className="rg-page-actions" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="rg-btn rg-btn-secondary" onClick={() => setAwayFor(null)} disabled={busy}>Cancel</button>
              <button type="button" className="rg-btn rg-btn-primary" onClick={() => void markAway()} disabled={busy}>{busy ? "Saving…" : "Mark away"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
