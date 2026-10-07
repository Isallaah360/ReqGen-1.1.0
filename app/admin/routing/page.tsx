"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Copy, Lock, RefreshCw, Route, Save, ShieldAlert, Users } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { confirmDialog } from "@/lib/dialog";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { GLOBAL_STAGE_SETTING, ROUTE_KIND_LABEL, ROUTE_KINDS, type RouteKind } from "@/lib/routingEngine";

/**
 * ReqGen v3.1.11 — Admin → Routing Engine (one page).
 * For each department: switch each review step ON or OFF for Official,
 * Personal Fund and Personal Other requests, choose the officer who acts at
 * each step, see the exact route, and save — one action, validated by the
 * database (reqgen_save_department_route). DG, Account and HR Filing are fixed
 * by IET rules. Saving creates a new route version: requests already moving
 * keep their route; new requests follow the new one.
 */

type Dept = { id: string; name: string; is_active: boolean | null };
type Person = { id: string; full_name: string | null; role: string | null };
type OverviewRow = { dept_id: string; dept_name: string; template_code: string | null; route_kind: RouteKind; step_order: number; stage: string; if_vacant: "skip" | "block"; owner_id: string | null; owner_name: string | null };
type Lane = Record<ReviewStage, { on: boolean; ifVacant: "skip" | "block" }>;
type ReviewStage = (typeof REVIEW)[number];
type OfficerStage = (typeof OFFICER_STAGES)[number];

const REVIEW = ["PO", "DOD", "HOD", "DIN Admin", "HR", "Registrar"] as const;
const OFFICER_STAGES = ["PO", "DOD", "HOD", "DIN Admin", "HR", "Registrar", "DG"] as const;
const STAGE_TEXT: Record<string, string> = {
  PO: "Programme Officer (PO)", DOD: "Director / DOD", HOD: "Head of Department (HOD)", "DIN Admin": "DIN Admin",
  HR: "Human Resources (HR)", Registrar: "Registrar", DG: "Director General (DG)", Account: "Account Officer", "HR Filing": "HR Filing",
};
const DEPT_ONLY: OfficerStage[] = ["PO", "DOD", "HOD"];

function emptyLane(): Lane {
  return Object.fromEntries(REVIEW.map((s) => [s, { on: false, ifVacant: "skip" as const }])) as Lane;
}

export default function RoutingEnginePage() {
  const [depts, setDepts] = useState<Dept[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [globals, setGlobals] = useState<Record<string, string>>({});
  const [overview, setOverview] = useState<OverviewRow[]>([]);
  const [deptOfficers, setDeptOfficers] = useState<Array<{ dept_id: string; stage: string; user_id: string }>>([]);
  const [selected, setSelected] = useState<string>("");
  const [lanes, setLanes] = useState<Record<RouteKind, Lane>>({ official: emptyLane(), personal_fund: emptyLane(), personal_other: emptyLane() });
  const [officers, setOfficers] = useState<Record<OfficerStage, string>>({ PO: "", DOD: "", HOD: "", "DIN Admin": "", HR: "", Registrar: "", DG: "" });
  const [dgVacant, setDgVacant] = useState<"skip" | "block">("block");
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTargets, setCopyTargets] = useState<string[]>([]);

  const nameOf = useCallback((id: string | null | undefined) => people.find((p) => p.id === id)?.full_name || "", [people]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    const [deptRes, peopleRes, settingsRes, overviewRes, officerRes] = await Promise.all([
      supabase.from("departments").select("id,name,is_active").order("name"),
      supabase.from("profiles").select("id,full_name,role").order("full_name"),
      supabase.from("app_settings").select("key,value").in("key", Object.values(GLOBAL_STAGE_SETTING) as string[]),
      supabase.rpc("reqgen_department_route_overview"),
      supabase.from("reqgen_department_stage_officers").select("dept_id,stage,user_id"),
    ]);
    if (overviewRes.error) {
      setMessage({
        tone: "error",
        text: /could not find the function|schema cache|does not exist/i.test(overviewRes.error.message)
          ? "The Routing Engine needs the database update database/v3_1_11_routing_engine_v2.sql. Run it in Supabase, then refresh."
          : overviewRes.error.message,
      });
    }
    setDepts(((deptRes.data || []) as Dept[]).filter((d) => d.is_active !== false));
    setPeople((peopleRes.data || []) as Person[]);
    setGlobals(Object.fromEntries(((settingsRes.data || []) as Array<{ key: string; value: string | null }>).map((s) => [s.key, s.value || ""])));
    setOverview((overviewRes.data || []) as OverviewRow[]);
    setDeptOfficers((officerRes.data || []) as Array<{ dept_id: string; stage: string; user_id: string }>);
    setLoading(false);
  }, []);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  // Fill the editor from the department's current route.
  const openDept = useCallback((deptId: string) => {
    const rows = overview.filter((r) => r.dept_id === deptId);
    const next = { official: emptyLane(), personal_fund: emptyLane(), personal_other: emptyLane() } as Record<RouteKind, Lane>;
    let dg: "skip" | "block" = "block";
    for (const r of rows) {
      if ((REVIEW as readonly string[]).includes(r.stage)) next[r.route_kind][r.stage as ReviewStage] = { on: true, ifVacant: r.if_vacant };
      if (r.stage === "DG") dg = r.if_vacant;
    }
    const own = Object.fromEntries(OFFICER_STAGES.map((s) => [s, deptOfficers.find((o) => o.dept_id === deptId && o.stage === s)?.user_id || ""])) as Record<OfficerStage, string>;
    // PO / DOD / HOD set before v3.1.11 live on the department record: show the resolved owner.
    for (const s of DEPT_ONLY) {
      if (!own[s]) own[s] = rows.find((r) => r.stage === s && r.owner_id)?.owner_id || "";
    }
    setSelected(deptId);
    setLanes(next);
    setOfficers(own);
    setDgVacant(dg);
    setDirty(false);
    setMessage(null);
  }, [deptOfficers, overview]);

  useEffect(() => {
    if (!selected && depts.length && overview.length) queueMicrotask(() => openDept(depts[0].id));
  }, [depts, openDept, overview.length, selected]);

  async function switchDept(id: string) {
    if (dirty && !(await confirmDialog({ title: "Discard unsaved changes?", message: "You have changed this department's route without saving.", confirmLabel: "Discard changes", tone: "warning" }))) return;
    openDept(id);
  }

  // Who acts at a stage for this department (department choice, else institution default).
  const actingFor = useCallback((stage: string) => {
    if (stage === "Account") return "Assigned by Account Routing (subhead's account officer)";
    const key = stage === "HR Filing" ? "HR" : stage;
    const own = officers[key as OfficerStage];
    if (own) return nameOf(own) || "Selected officer";
    const g = GLOBAL_STAGE_SETTING[key as keyof typeof GLOBAL_STAGE_SETTING];
    if (g && globals[g]) return `${nameOf(globals[g]) || "Institution officer"} (institution default)`;
    return "";
  }, [globals, nameOf, officers]);

  const routeFor = useCallback((kind: RouteKind) => {
    const steps: Array<{ stage: string; who: string; vacantRule: "skip" | "block"; fixed: boolean }> = [];
    for (const s of REVIEW) if (lanes[kind][s].on) steps.push({ stage: s, who: actingFor(s), vacantRule: lanes[kind][s].ifVacant, fixed: false });
    steps.push({ stage: "DG", who: actingFor("DG"), vacantRule: dgVacant, fixed: true });
    if (kind !== "personal_other") steps.push({ stage: "Account", who: actingFor("Account"), vacantRule: "skip", fixed: true });
    if (kind !== "official") steps.push({ stage: "HR Filing", who: actingFor("HR Filing"), vacantRule: "skip", fixed: true });
    return steps;
  }, [actingFor, dgVacant, lanes]);

  const problems = useMemo(() => {
    const list: string[] = [];
    for (const kind of ROUTE_KINDS) for (const step of routeFor(kind)) {
      if (!step.who && step.vacantRule === "block") list.push(`${ROUTE_KIND_LABEL[kind]}: ${STAGE_TEXT[step.stage]} is set to Hold but has no officer — requests would stop there.`);
    }
    return Array.from(new Set(list));
  }, [routeFor]);

  function toggle(kind: RouteKind, stage: ReviewStage) {
    setLanes((cur) => ({ ...cur, [kind]: { ...cur[kind], [stage]: { ...cur[kind][stage], on: !cur[kind][stage].on } } }));
    setDirty(true);
  }
  function setVacant(kind: RouteKind, stage: ReviewStage, v: "skip" | "block") {
    setLanes((cur) => ({ ...cur, [kind]: { ...cur[kind], [stage]: { ...cur[kind][stage], ifVacant: v } } }));
    setDirty(true);
  }

  function payload() {
    const routes = Object.fromEntries(ROUTE_KINDS.map((k) => [k, REVIEW.filter((s) => lanes[k][s].on).map((s) => ({ stage: s, if_vacant: lanes[k][s].ifVacant }))]));
    const offs = Object.fromEntries(OFFICER_STAGES.map((s) => [s, officers[s] || null]));
    return { routes, offs };
  }

  async function saveTo(deptIds: string[]) {
    const { routes, offs } = payload();
    for (const id of deptIds) {
      // Copying keeps each department's own officers; only the steps are copied.
      const ownOfficers = id === selected ? offs : Object.fromEntries(OFFICER_STAGES.map((s) => [s, deptOfficers.find((o) => o.dept_id === id && o.stage === s)?.user_id || (DEPT_ONLY.includes(s) ? overview.find((r) => r.dept_id === id && r.stage === s && r.owner_id)?.owner_id || null : null)]));
      const { error } = await supabase.rpc("reqgen_save_department_route", { p_dept_id: id, p_routes: routes, p_officers: ownOfficers, p_dg_if_vacant: dgVacant });
      if (error) throw new Error(`${depts.find((d) => d.id === id)?.name || "Department"}: ${error.message}`);
    }
  }

  async function save() {
    const dept = depts.find((d) => d.id === selected);
    if (!dept) return;
    const ok = await confirmDialog({
      title: `Save the route for ${dept.name}?`,
      message: "New requests from this department will follow this route. Requests already moving keep the route they started with.",
      details: problems.length ? problems : undefined,
      confirmLabel: "Save route",
      tone: problems.length ? "warning" : "default",
    });
    if (!ok) return;
    setSaving(true);
    try {
      await saveTo([selected]);
      setMessage({ tone: "ok", text: `Route saved for ${dept.name}.` });
      setDirty(false);
      await load();
    } catch (caught) {
      setMessage({ tone: "error", text: caught instanceof Error ? caught.message : "The route could not be saved." });
    } finally {
      setSaving(false);
    }
  }

  async function copyRoute() {
    if (!copyTargets.length) return;
    const ok = await confirmDialog({
      title: `Copy this route to ${copyTargets.length} department(s)?`,
      message: "The ON/OFF steps and Hold rules are copied. Each department keeps its own officers.",
      confirmLabel: "Copy route",
      tone: "warning",
    });
    if (!ok) return;
    setSaving(true);
    try {
      await saveTo(copyTargets);
      setMessage({ tone: "ok", text: `Route copied to ${copyTargets.length} department(s).` });
      setCopyOpen(false);
      setCopyTargets([]);
      await load();
    } catch (caught) {
      setMessage({ tone: "error", text: caught instanceof Error ? caught.message : "The route could not be copied." });
    } finally {
      setSaving(false);
    }
  }

  const deptSummary = useCallback((id: string) => {
    const rows = overview.filter((r) => r.dept_id === id && r.route_kind === "official");
    const gaps = overview.filter((r) => r.dept_id === id && !r.owner_id && r.stage !== "Account" && r.if_vacant === "block").length;
    return { chain: rows.map((r) => r.stage).join(" → "), gaps };
  }, [overview]);

  const visibleDepts = depts;
  const dept = depts.find((d) => d.id === selected);

  return (
    <main className="rg-route">
      <PageHeader
        title="Routing Engine"
        description="Choose, for each department, which officers a request passes through and who acts at each step."
        actions={<div className="rg-pvd-actions"><a className="rg-btn rg-btn-secondary" href="/admin/department-routing">Backups &amp; away cover</a><button type="button" className="rg-btn rg-btn-secondary" onClick={() => void load()} disabled={loading || saving}><RefreshCw size={15} /> Refresh</button></div>}
      />

      {message ? <div className={`rg-pvd-message is-${message.tone}`} role="status">{message.text}</div> : null}

      <div className="rg-route-layout">
        <aside className="rg-route-depts">
          <ul>
            {visibleDepts.map((d) => {
              const sum = deptSummary(d.id);
              return (
                <li key={d.id}>
                  <button type="button" className={d.id === selected ? "is-active" : ""} onClick={() => void switchDept(d.id)}>
                    <strong>{d.name}</strong>
                    <small>{sum.chain ? `Staff → ${sum.chain}` : "Loading route..."}</small>
                    {sum.gaps ? <em className="is-gap"><ShieldAlert size={12} /> {sum.gaps} step(s) on hold, no officer</em> : sum.chain ? <em><CheckCircle2 size={12} /> Ready</em> : null}
                  </button>
                </li>
              );
            })}
            {!loading && !visibleDepts.length ? <li className="rg-pvv-empty">No department found.</li> : null}
          </ul>
        </aside>

        {dept ? (
          <section className="rg-route-editor">
            <header className="rg-route-head">
              <div><h2><Route size={18} /> {dept.name}</h2><p>Switch a step ON to make every request of that type pass through that officer. OFF skips the step.</p></div>
              <div className="rg-pvd-actions">
                <button type="button" className="rg-btn rg-btn-secondary" onClick={() => setCopyOpen((v) => !v)} disabled={saving}><Copy size={15} /> Copy to other departments</button>
                <button type="button" className="rg-btn rg-btn-primary" onClick={() => void save()} disabled={saving || !dirty}><Save size={15} /> {saving ? "Saving..." : dirty ? "Save route" : "Saved"}</button>
              </div>
            </header>

            {copyOpen ? (
              <div className="rg-route-copy">
                <p>Copy this department&apos;s ON/OFF steps to:</p>
                <div>
                  {depts.filter((d) => d.id !== selected).map((d) => (
                    <label key={d.id}><input type="checkbox" checked={copyTargets.includes(d.id)} onChange={(e) => setCopyTargets((cur) => e.target.checked ? [...cur, d.id] : cur.filter((x) => x !== d.id))} /> {d.name}</label>
                  ))}
                </div>
                <button type="button" className="rg-btn rg-btn-primary" onClick={() => void copyRoute()} disabled={!copyTargets.length || saving}>Copy route</button>
              </div>
            ) : null}

            <div className="rg-route-matrix">
              <table>
                <thead>
                  <tr><th>Step</th>{ROUTE_KINDS.map((k) => <th key={k}>{ROUTE_KIND_LABEL[k]}</th>)}</tr>
                </thead>
                <tbody>
                  {REVIEW.map((s) => (
                    <tr key={s}>
                      <th scope="row">{STAGE_TEXT[s]}</th>
                      {ROUTE_KINDS.map((k) => {
                        const cell = lanes[k][s];
                        return (
                          <td key={k}>
                            <div className="rg-route-cell">
                              <button type="button" role="switch" aria-checked={cell.on} className={`rg-switch ${cell.on ? "is-on" : ""}`} onClick={() => toggle(k, s)} aria-label={`${STAGE_TEXT[s]} for ${ROUTE_KIND_LABEL[k]}`}>
                                <span />{cell.on ? "ON" : "OFF"}
                              </button>
                              {cell.on ? (
                                <select value={cell.ifVacant} onChange={(e) => setVacant(k, s, e.target.value as "skip" | "block")} aria-label="If nobody holds this step">
                                  <option value="skip">If vacant: skip</option>
                                  <option value="block">If vacant: hold</option>
                                </select>
                              ) : null}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="is-fixed">
                    <th scope="row">{STAGE_TEXT.DG}</th>
                    {ROUTE_KINDS.map((k) => <td key={k}><span className="rg-route-fixed"><Lock size={12} /> Always</span>{k === "official" ? <select value={dgVacant} onChange={(e) => { setDgVacant(e.target.value as "skip" | "block"); setDirty(true); }} aria-label="If the DG post is vacant"><option value="block">If vacant: hold</option><option value="skip">If vacant: skip</option></select> : null}</td>)}
                  </tr>
                  <tr className="is-fixed">
                    <th scope="row">{STAGE_TEXT.Account}</th>
                    {ROUTE_KINDS.map((k) => <td key={k}>{k === "personal_other" ? <span className="rg-route-none">Not used</span> : <span className="rg-route-fixed"><Lock size={12} /> Always, after DG</span>}</td>)}
                  </tr>
                  <tr className="is-fixed">
                    <th scope="row">{STAGE_TEXT["HR Filing"]}</th>
                    {ROUTE_KINDS.map((k) => <td key={k}>{k === "official" ? <span className="rg-route-none">Not used</span> : <span className="rg-route-fixed"><Lock size={12} /> Always, last</span>}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="rg-route-officers">
              <h3><Users size={16} /> Who acts at each step in {dept.name}</h3>
              <div className="rg-route-officer-grid">
                {OFFICER_STAGES.map((s) => {
                  const g = GLOBAL_STAGE_SETTING[s as keyof typeof GLOBAL_STAGE_SETTING];
                  const defaultName = g && globals[g] ? nameOf(globals[g]) : "";
                  return (
                    <label key={s}>
                      <span>{STAGE_TEXT[s]}</span>
                      <select value={officers[s]} onChange={(e) => { setOfficers((cur) => ({ ...cur, [s]: e.target.value })); setDirty(true); }}>
                        <option value="">{DEPT_ONLY.includes(s) ? "Nobody (step is skipped or held)" : defaultName ? `Institution default — ${defaultName}` : "Institution default (not set)"}</option>
                        {people.map((p) => <option key={p.id} value={p.id}>{p.full_name || "Unnamed"}{p.role ? ` · ${p.role}` : ""}</option>)}
                      </select>
                    </label>
                  );
                })}
              </div>
              <p className="rg-route-note">Backups and &quot;away&quot; cover still work: if the officer is marked away, waiting requests move to their backup (Advanced routing → Officers &amp; availability).</p>
            </div>

            <div className="rg-route-preview">
              <h3>Exact route for new requests</h3>
              {ROUTE_KINDS.map((k) => (
                <div key={k} className="rg-route-lane">
                  <strong>{ROUTE_KIND_LABEL[k]}</strong>
                  <ol>
                    <li className="is-start"><b>Staff</b><small>Requester</small></li>
                    {routeFor(k).map((step) => (
                      <li key={step.stage} className={!step.who ? (step.vacantRule === "block" ? "is-hold" : "is-skip") : ""}>
                        <ArrowRight size={13} aria-hidden="true" />
                        <b>{STAGE_TEXT[step.stage]}</b>
                        <small>{step.who || (step.vacantRule === "block" ? "No officer — requests will HOLD here" : "No officer — skipped")}</small>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
              <p className="rg-route-note">Each officer is notified in the app (and by SMS / email where enabled) when a request reaches their step; the requester is notified of every decision.</p>
            </div>

            {problems.length ? <div className="rg-approvals-held" role="alert"><ShieldAlert size={18} /><p>{problems.join(" ")}</p></div> : null}
          </section>
        ) : (
          <section className="rg-route-editor"><p className="rg-pvv-empty">{loading ? "Loading departments..." : "Choose a department."}</p></section>
        )}
      </div>
    </main>
  );
}
