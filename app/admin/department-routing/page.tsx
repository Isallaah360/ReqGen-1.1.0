"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, CircleAlert, GitBranch, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { PersonName } from "@/app/components/ui/PersonName";
import { IconAction, IconActions } from "@/app/components/ui/IconAction";
import { nameWithRole } from "@/lib/userIdentity";
import {
  GLOBAL_SLOT_SETTING,
  ROUTE_KINDS,
  deptGroupName,
  requiredSlots,
  routeSteps,
  type ApproverSlot,
} from "@/lib/departmentRouting";

/**
 * Admin → Department Routing (v3.0.4)
 *
 * Shows, for every department, the exact approval flow its requests follow
 * (Official, Personal Fund, Personal Other) and the real person at each step.
 * Admin sets the department's DOD (Director) and HOD here. Global officers
 * (DIN Admin, Registrar, HR, DG) come from System Settings; the Account
 * Officer comes from Account Routing; PO is anyone holding the PO role.
 * Any step with nobody behind it is flagged as "Needs routing".
 */
type Dept = { id: string; name: string; is_active: boolean | null; hod_user_id: string | null; director_user_id: string | null };
type Person = { id: string; full_name: string | null; email: string | null; role: string | null };
type RoleRow = { profile_id: string; role_key: string | null };
type Setting = { key: string; value: string | null };
type AccountRoute = { dept_id: string; officer_user_id: string | null; is_active: boolean | null };

function roleKey(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}
function personName(p?: Person | null) {
  return p?.full_name?.trim() || p?.email?.trim() || "";
}

const SETTING_KEYS = [...Object.values(GLOBAL_SLOT_SETTING), "ACCOUNT_USER_ID_1", "ACCOUNT_USER_ID"].filter(Boolean) as string[];

export default function DepartmentRoutingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [roleRows, setRoleRows] = useState<RoleRow[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [accountRoutes, setAccountRoutes] = useState<AccountRoute[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [openDeptId, setOpenDeptId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [dodId, setDodId] = useState("");
  const [hodId, setHodId] = useState("");
  const pageSize = 10;

  const loadAll = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.replace("/login"); return; }
    const me = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
    if (me.error || roleKey(me.data?.role) !== "admin") { router.replace("/unauthorized"); return; }

    const [deptRes, peopleRes, rolesRes, settingsRes, accountRes] = await Promise.all([
      supabase.from("departments").select("id,name,is_active,hod_user_id,director_user_id").order("name", { ascending: true }),
      supabase.from("profiles").select("id,full_name,email,role").order("full_name", { ascending: true }),
      supabase.from("profile_roles").select("profile_id,role_key").eq("is_active", true),
      supabase.from("app_settings").select("key,value").in("key", SETTING_KEYS),
      supabase.from("department_account_routing").select("dept_id,officer_user_id,is_active"),
    ]);
    const error = deptRes.error || peopleRes.error || settingsRes.error;
    if (error) setMsg("Unable to load department routing: " + error.message);
    setDepts((deptRes.data || []) as Dept[]);
    setPeople((peopleRes.data || []) as Person[]);
    setRoleRows(rolesRes.error ? [] : ((rolesRes.data || []) as RoleRow[]));
    setSettings(Object.fromEntries(((settingsRes.data || []) as Setting[]).map((s) => [s.key, String(s.value || "")])));
    setAccountRoutes(accountRes.error ? [] : ((accountRes.data || []) as AccountRoute[]));
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAll(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAll]);

  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const rolesByPerson = useMemo(() => {
    const map = new Map<string, Set<string>>();
    people.forEach((p) => map.set(p.id, new Set([roleKey(p.role)])));
    roleRows.forEach((r) => { const set = map.get(r.profile_id) || new Set<string>(); set.add(roleKey(r.role_key)); map.set(r.profile_id, set); });
    return map;
  }, [people, roleRows]);
  const poHolders = useMemo(() => people.filter((p) => rolesByPerson.get(p.id)?.has("po")), [people, rolesByPerson]);
  const accountRouteByDept = useMemo(
    () => new Map(accountRoutes.filter((r) => r.is_active !== false).map((r) => [r.dept_id, r.officer_user_id])),
    [accountRoutes],
  );

  /** The person (or people) behind one approval step for one department. */
  const resolveSlot = useCallback((dept: Dept, slot: ApproverSlot, override?: { dod?: string; hod?: string }): Person[] => {
    const one = (id: string | null | undefined) => (id && personById.get(id) ? [personById.get(id)!] : []);
    switch (slot) {
      case "DOD": return one(override?.dod !== undefined ? override.dod : dept.director_user_id);
      case "HOD": return one(override?.hod !== undefined ? override.hod : dept.hod_user_id);
      case "PO": return poHolders;
      case "AccountOfficer": return one(accountRouteByDept.get(dept.id) || settings.ACCOUNT_USER_ID_1 || settings.ACCOUNT_USER_ID);
      default: return one(settings[GLOBAL_SLOT_SETTING[slot] || ""]);
    }
  }, [personById, poHolders, accountRouteByDept, settings]);

  const missingFor = useCallback((dept: Dept) => requiredSlots(dept.name).filter((slot) => resolveSlot(dept, slot).length === 0), [resolveSlot]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return depts;
    return depts.filter((d) => `${d.name} ${deptGroupName(d.name)} ${personName(personById.get(d.director_user_id || ""))} ${personName(personById.get(d.hod_user_id || ""))}`.toLowerCase().includes(q));
  }, [depts, search, personById]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const needsRouting = depts.filter((d) => missingFor(d).length > 0).length;
  const groups = new Set(depts.map((d) => deptGroupName(d.name))).size;

  const openDept = openDeptId ? depts.find((d) => d.id === openDeptId) || null : null;

  function open(dept: Dept, edit: boolean) {
    setOpenDeptId(dept.id);
    setEditing(edit);
    setDodId(dept.director_user_id || "");
    setHodId(dept.hod_user_id || "");
    setMsg(null);
  }

  async function save() {
    if (!openDept) return;
    setSaving(true);
    setMsg(null);
    const { error } = await supabase
      .from("departments")
      .update({ director_user_id: dodId || null, hod_user_id: hodId || null })
      .eq("id", openDept.id);
    if (error) setMsg("Save failed: " + error.message);
    else { setMsg(`✅ Routing saved for ${openDept.name}.`); setOpenDeptId(null); await loadAll(); }
    setSaving(false);
  }

  /** Candidates for a slot: matching role holders first, then everyone else. */
  const candidates = (roles: string[]) => {
    const match = people.filter((p) => roles.some((r) => rolesByPerson.get(p.id)?.has(r)));
    const rest = people.filter((p) => !match.includes(p));
    return { match, rest };
  };

  const slotLabel = (slot: string) => (slot === "AccountOfficer" ? "Account Officer" : slot);

  const renderStep = (dept: Dept, step: string, override?: { dod?: string; hod?: string }) => {
    const isSlot = ["DOD", "HOD", "PO", "DIN Admin", "Registrar", "HR", "DG", "AccountOfficer"].includes(step);
    if (!isSlot) return <span className="rg-route-step is-fixed">{step}</span>;
    const holders = resolveSlot(dept, step as ApproverSlot, override);
    const missing = holders.length === 0;
    const title = missing ? `${slotLabel(step)}: nobody assigned` : holders.map((p) => nameWithRole(personName(p), p.role)).join(", ");
    return (
      <span className={`rg-route-step ${missing ? "is-missing" : "is-set"}`} title={title}>
        <b>{slotLabel(step)}</b>
        <small>{missing ? "Not assigned" : holders.length > 1 ? `${holders.length} officers` : personName(holders[0])}</small>
      </span>
    );
  };

  if (loading) return <main className="admin-v3-page" data-rg-standard="phase7"><div className="admin-v3-loading">Loading department routing…</div></main>;

  return (
    <main className="admin-v3-page" data-rg-standard="phase7">
      <header className="admin-v3-header">
        <div>
          <h1>Department Routing</h1>
          <p>The approval flow each department&apos;s requests follow, and who approves at every step.</p>
        </div>
        <button className="admin-v3-secondary" onClick={() => void loadAll()}>Refresh</button>
      </header>
      {msg ? <div className="admin-v3-alert">{msg}</div> : null}

      <section className="admin-v3-kpis" aria-label="Department routing overview">
        <article className="admin-v3-kpi"><div><span>Departments</span><strong>{depts.length}</strong><small>Live department register</small></div><span className="admin-v3-kpi-icon"><Building2 size={19} /></span></article>
        <article className="admin-v3-kpi is-green"><div><span>Fully Routed</span><strong>{depts.length - needsRouting}</strong><small>Every step has an officer</small></div><span className="admin-v3-kpi-icon"><ShieldCheck size={19} /></span></article>
        <article className="admin-v3-kpi"><div><span>Route Groups</span><strong>{groups}</strong><small>DIN · ASAP-ALLI · Welfare · Liaison · General Admin</small></div><span className="admin-v3-kpi-icon"><GitBranch size={19} /></span></article>
        <article className="admin-v3-kpi is-amber"><div><span>Needs Routing</span><strong>{needsRouting}</strong><small>A step has nobody assigned</small></div><span className="admin-v3-kpi-icon"><CircleAlert size={19} /></span></article>
      </section>

      <section className="admin-v3-card">
        <div className="admin-v3-toolbar">
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search departments, groups or officers…" />
          <span>{filtered.length} department{filtered.length === 1 ? "" : "s"}</span>
        </div>
        <div className="admin-v3-table-scroll">
          <table className="admin-v3-table rg-std-table">
            <thead>
              <tr>
                <th className="rg-col-index">#</th>
                <th>Department</th>
                <th>Route Group</th>
                <th>Official Route</th>
                <th>DOD (Director)</th>
                <th>HOD</th>
                <th>Status</th>
                <th className="rg-col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((dept, index) => {
                const missing = missingFor(dept);
                const dod = personById.get(dept.director_user_id || "");
                const hod = personById.get(dept.hod_user_id || "");
                return (
                  <tr key={dept.id}>
                    <td className="rg-col-index">{(safePage - 1) * pageSize + index + 1}</td>
                    <td><strong>{dept.name}</strong></td>
                    <td><span className="rg-route-group">{deptGroupName(dept.name)}</span></td>
                    <td><span className="rg-route-inline">{routeSteps("Official", "", dept.name).map((s) => (s === "AccountOfficer" ? "Account" : s)).join(" → ")}</span></td>
                    <td>{dod ? <PersonName name={personName(dod)} role={dod.role} /> : <span className="rg-route-unset">Not assigned</span>}</td>
                    <td>{hod ? <PersonName name={personName(hod)} role={hod.role} /> : <span className="rg-route-unset">Not assigned</span>}</td>
                    <td>
                      <span className={`admin-v3-status ${missing.length ? "is-inactive" : "is-active"}`} title={missing.length ? `Missing: ${missing.map(slotLabel).join(", ")}` : "All steps assigned"}>
                        {missing.length ? `Needs: ${missing.map(slotLabel).join(", ")}` : "Complete"}
                      </span>
                    </td>
                    <td className="rg-col-actions">
                      <IconActions>
                        <IconAction kind="view" label={`View all routes for ${dept.name}`} onClick={() => open(dept, false)} />
                        <IconAction kind="edit" label={`Edit routing for ${dept.name}`} onClick={() => open(dept, true)} />
                      </IconActions>
                    </td>
                  </tr>
                );
              })}
              {!paged.length ? <tr><td colSpan={8} className="admin-v3-empty">No matching departments.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="admin-v3-pagination">
          <span>Showing {filtered.length ? (safePage - 1) * pageSize + 1 : 0} to {Math.min(safePage * pageSize, filtered.length)} of {filtered.length}</span>
          <div>
            <button disabled={safePage <= 1} onClick={() => setPage(Math.max(1, safePage - 1))}>‹</button>
            {Array.from({ length: pages }, (_, i) => i + 1).map((value) => (
              <button key={value} className={value === safePage ? "is-active" : ""} onClick={() => setPage(value)}>{value}</button>
            ))}
            <button disabled={safePage >= pages} onClick={() => setPage(Math.min(pages, safePage + 1))}>›</button>
          </div>
        </div>
      </section>

      {openDept ? (
        <div className="rg-modal-backdrop" role="presentation" onMouseDown={() => !saving && setOpenDeptId(null)}>
          <section className="rg-modal rg-route-modal" role="dialog" aria-modal="true" aria-labelledby="dept-route-title" onMouseDown={(e) => e.stopPropagation()}>
            <div className="rg-route-modal-head">
              <div>
                <h2 id="dept-route-title">{editing ? "Edit" : "View"} Department Routing</h2>
                <p><strong>{openDept.name}</strong> · {deptGroupName(openDept.name)} route group</p>
              </div>
              <button type="button" className="rg-icon-action is-neutral" aria-label="Close" onClick={() => setOpenDeptId(null)}><X size={16} /></button>
            </div>

            {editing ? (
              <div className="rg-route-form">
                <label>
                  DOD (Director)
                  <select value={dodId} onChange={(e) => setDodId(e.target.value)}>
                    <option value="">Not assigned</option>
                    {(() => { const c = candidates(["director", "dod"]); return (<>
                      {c.match.length ? <optgroup label="Directors">{c.match.map((p) => <option key={p.id} value={p.id}>{nameWithRole(personName(p), p.role)}</option>)}</optgroup> : null}
                      <optgroup label="All staff">{c.rest.map((p) => <option key={p.id} value={p.id}>{nameWithRole(personName(p), p.role)}</option>)}</optgroup>
                    </>); })()}
                  </select>
                </label>
                <label>
                  HOD
                  <select value={hodId} onChange={(e) => setHodId(e.target.value)}>
                    <option value="">Not assigned</option>
                    {(() => { const c = candidates(["hod"]); return (<>
                      {c.match.length ? <optgroup label="Heads of Department">{c.match.map((p) => <option key={p.id} value={p.id}>{nameWithRole(personName(p), p.role)}</option>)}</optgroup> : null}
                      <optgroup label="All staff">{c.rest.map((p) => <option key={p.id} value={p.id}>{nameWithRole(personName(p), p.role)}</option>)}</optgroup>
                    </>); })()}
                  </select>
                </label>
              </div>
            ) : null}

            <div className="rg-route-list">
              {ROUTE_KINDS.map((kind) => (
                <div key={kind.label} className="rg-route-row">
                  <h3>{kind.label}</h3>
                  <div className="rg-route-steps">
                    {routeSteps(kind.type, kind.category, openDept.name).map((step, i, all) => (
                      <span key={`${step}-${i}`} className="rg-route-step-wrap">
                        {renderStep(openDept, step, editing ? { dod: dodId, hod: hodId } : undefined)}
                        {i < all.length - 1 ? <span className="rg-route-arrow" aria-hidden="true">→</span> : null}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <p className="rg-route-note">
              DOD and HOD are set here. DIN Admin, Registrar, HR and DG are set in <Link href="/admin/settings">System Settings</Link>;
              the Account Officer in <Link href="/admin/account-routing">Account Routing</Link>; PO is anyone holding the PO role in <Link href="/admin/users">User Management</Link>.
            </p>

            <div className="rg-page-actions" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="rg-btn rg-btn-secondary" onClick={() => setOpenDeptId(null)} disabled={saving}>{editing ? "Cancel" : "Close"}</button>
              {editing ? (
                <button type="button" className="rg-btn rg-btn-primary" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save Routing"}</button>
              ) : (
                <button type="button" className="rg-btn rg-btn-primary" onClick={() => setEditing(true)}>Edit Routing</button>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
