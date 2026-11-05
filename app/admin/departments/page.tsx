"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { downloadXlsx } from "@/lib/v4/xlsx";
import { loadRouting, routeOf, saveRoute, type OverviewRow, type StageOfficer } from "@/lib/v4/routing";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import Modal from "@/app/components/v4/Modal";
import { Select } from "@/app/components/v4/Select";
import { nairaExact } from "@/lib/v4/money";
import { Card, Notice, PageHead, Skeleton, V4Page, naira } from "@/app/components/v4/ui";
import { useCelebrate } from "@/app/components/v4/Motion";

type Dept = { id: string; name: string; is_active: boolean | null; hod_user_id: string | null; director_user_id: string | null; pd_id: string | null };
type Person = { id: string; full_name: string | null; email: string | null; dept_id: string | null; officer: boolean };
type Account = { id: string; name: string; bank_name: string | null; total_fund: number; allocated_amount: number };
type AdminRow = { id: string; full_name: string | null; email: string | null; dept_id: string | null; is_active: boolean | null; system_account: string | null; positions: Array<{ key: string }> | null };
type DeptData = { routing: Routing[]; assignments: Assignment[]; accounts: Array<Account & { is_active: boolean }> };
const ACCOUNT_KEYS = ["account", "accounts", "accountofficer"];
type Routing = { id: string; dept_id: string; iet_account_id: string; officer_user_id: string; is_active: boolean | null };
type Assignment = { account_id: string; officer_user_id: string };
type Form = { id: string | null; name: string; active: boolean; dod: string; hod: string; pd: string; account: string; officer: string };

/** Administration › Departments (mock-up 85). */
export default function DepartmentsPage() {
  const me = useIdentity();
  const [depts, setDepts] = useState<Dept[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [routing, setRouting] = useState<Routing[]>([]);
  const [assign, setAssign] = useState<Assignment[]>([]);
  const [overview, setOverview] = useState<OverviewRow[]>([]);
  const [officers, setOfficers] = useState<StageOfficer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  useCelebrate(msg);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [showOff, setShowOff] = useState(false);
  const [needsSql, setNeedsSql] = useState(false);

  /**
   * v4.6.8: Administration reads through its own functions (Super Admin and Developer only), so the
   * Super Admin sees every staff member, account and paying account whatever the older table rules
   * say. If the v4.6.8 database step has not been run yet, the page falls back to the tables.
   */
  const load = useCallback(async () => {
    const [d, ppl, data, eng] = await Promise.all([
      supabase.from("departments").select("*").order("name"),
      supabase.rpc("reqgen_admin_people"),
      supabase.rpc("reqgen_admin_departments_data"),
      loadRouting(),
    ]);
    setError(d.error?.message || eng.error || null);
    setDepts(((d.data || []) as Array<Record<string, unknown>>).map((x) => ({
      id: String(x.id), name: String(x.name || ""), is_active: (x.is_active as boolean | null) ?? null,
      hod_user_id: (x.hod_user_id as string | null) ?? null, director_user_id: (x.director_user_id as string | null) ?? null, pd_id: ((x.pd_id ?? x.po_id) as string | null) ?? null,
    })));
    if (!ppl.error) {
      setPeople(((ppl.data || []) as AdminRow[]).filter((x) => x.is_active !== false && !x.system_account).map((x) => ({
        id: x.id, full_name: x.full_name, email: x.email, dept_id: x.dept_id,
        officer: (x.positions || []).some((p) => ACCOUNT_KEYS.includes(String(p.key || "").toLowerCase())),
      })));
    } else {
      const p = await supabase.from("profiles").select("id,full_name,email,dept_id,system_account").order("full_name");
      setPeople(((p.data || []) as Array<Person & { system_account?: string | null }>).filter((x) => !x.system_account).map((x) => ({ ...x, officer: false })));
    }
    if (!data.error && data.data) {
      const x = data.data as DeptData;
      setAccounts((x.accounts || []).filter((a) => a.is_active !== false));
      setRouting(x.routing || []);
      setAssign(x.assignments || []);
      setNeedsSql(false);
    } else {
      const [a, r, s] = await Promise.all([
        supabase.from("iet_accounts").select("id,name,bank_name,total_fund,allocated_amount").eq("is_active", true).order("name"),
        supabase.from("department_account_routing").select("id,dept_id,iet_account_id,officer_user_id,is_active"),
        supabase.from("iet_account_officer_assignments").select("account_id,officer_user_id"),
      ]);
      setAccounts((a.data || []) as Account[]);
      setRouting((r.data || []) as Routing[]);
      setAssign((s.data || []) as Assignment[]);
      setNeedsSql(true);
    }
    setOverview(eng.overview);
    setOfficers(eng.officers);
  }, []);
  useEffect(() => { if (me.ready) queueMicrotask(() => { void load(); }); }, [me.ready, load]);

  const nameOf = useMemo(() => new Map(people.map((p) => [p.id, p.full_name || p.email || "—"])), [people]);
  const who = (id: string | null | undefined) => (id ? nameOf.get(id) || "Name not available" : "—");
  const staffIn = useMemo(() => { const m = new Map<string, number>(); people.forEach((p) => p.dept_id && m.set(p.dept_id, (m.get(p.dept_id) || 0) + 1)); return m; }, [people]);
  const accName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const routeFor = (deptId: string) => routing.find((r) => r.dept_id === deptId && r.is_active !== false);
  const ownerAt = (deptId: string, stage: string) => overview.find((r) => r.dept_id === deptId && r.stage === stage && r.owner_id)?.owner_id || null;

  const head = (d: Dept) => {
    const parts: string[] = [];
    const hod = ownerAt(d.id, "HOD") || d.hod_user_id; if (hod) parts.push(`${who(hod)} (HOD)`);
    const pd = ownerAt(d.id, "PD") || d.pd_id; if (pd) parts.push(`${who(pd)} (PD)`);
    const din = officers.find((o) => o.dept_id === d.id && o.stage === "DIN Admin")?.user_id || ownerAt(d.id, "DIN Admin"); if (din) parts.push(`${who(din)} (DIN Admin)`);
    return parts.join(" · ") || "—";
  };
  const dod = (d: Dept) => { const id = ownerAt(d.id, "DOD") || d.director_user_id; return id ? who(id) : "—"; };
  const paysFrom = (d: Dept) => { const r = routeFor(d.id); return r ? `${accName.get(r.iet_account_id) || "Account"} · ${who(r.officer_user_id)}` : "Not set"; };
  /** The account's own Account Officer (Finance › Officer Assignment), used when an account is chosen. */
  const officerOf = (accountId: string) => assign.find((x) => x.account_id === accountId)?.officer_user_id || "";
  const fundHint = (a: Account) => `${a.bank_name ? `${a.bank_name} · ` : ""}${Number(a.total_fund) > 0 ? `${naira(a.total_fund, { compact: true })} fund` : "no fund yet"}`;
  /** The line under "Pays from account": what the chosen account holds. */
  const fundLine = (id: string) => {
    const a = accounts.find((x) => x.id === id);
    if (!a) return "Funded accounts are listed first. The account’s own Account Officer is filled in for you.";
    if (!(Number(a.total_fund) > 0)) return `${a.name} has no fund yet (not allocated). Set its fund in Finance › Manage Accounts.`;
    return `Fund ${nairaExact(a.total_fund)} · Given to subheads ${nairaExact(a.allocated_amount)} · Balance ${nairaExact(Math.max(0, Number(a.total_fund) - Number(a.allocated_amount || 0)))}`;
  };
  const shown = (depts || []).filter((d) => showOff || d.is_active !== false);

  function open(d: Dept | null) {
    setMsg(null);
    if (!d) { setForm({ id: null, name: "", active: true, dod: "", hod: "", pd: "", account: "", officer: "" }); return; }
    const cur = routeOf(d.id, overview, officers).officers;
    const r = routeFor(d.id);
    setForm({ id: d.id, name: d.name, active: d.is_active !== false, dod: cur.DOD || d.director_user_id || "", hod: cur.HOD || d.hod_user_id || "", pd: cur.PD || d.pd_id || "", account: r?.iet_account_id || "", officer: r?.officer_user_id || "" });
  }

  async function save() {
    if (!form) return;
    const name = form.name.trim();
    if (name.length < 2) { setMsg({ tone: "red", text: "Write the department name." }); return; }
    if (!!form.account !== !!form.officer) { setMsg({ tone: "red", text: "Choose both the account and its Account Officer, or neither." }); return; }
    setBusy(true); setMsg(null);
    try {
      let id = form.id;
      const saved = await supabase.rpc("reqgen_admin_save_department", { p_dept_id: form.id, p_name: name, p_is_active: form.active, p_account_id: form.account || null, p_officer_id: form.officer || null });
      if (saved.error) {
        if (!/reqgen_admin_save_department|function .* does not exist|schema cache/i.test(saved.error.message)) throw new Error(saved.error.message);
        throw new Error("The v4.6.8 database step has not been run yet. Run database/v4_6_8_admin_access.sql in Supabase, then save again.");
      }
      id = String(saved.data);
      if (form.id && !form.account && !form.officer && routeFor(form.id)) {
        const cleared = await supabase.rpc("reqgen_admin_set_department_account", { p_dept_id: form.id, p_account_id: null, p_officer_id: null });
        if (cleared.error) throw new Error(cleared.error.message);
      }
      // DOD / HOD / PD are officers of the department's route: saved through the Routing Engine itself.
      const cur = routeOf(id, overview, officers);
      if (form.id && (cur.officers.DOD !== form.dod || cur.officers.HOD !== form.hod || cur.officers.PD !== form.pd)) {
        await saveRoute(id, cur.lanes, { ...cur.officers, DOD: form.dod, HOD: form.hod, PD: form.pd }, cur.dgVacant);
      }
      const shownName = (await supabase.from("departments").select("name").eq("id", id).maybeSingle()).data?.name || name;
      setMsg({ tone: "green", text: form.id ? `${shownName} saved.` : `${shownName} added. Its approval route follows the institution route until you set it in Routing Engine › Routes (use "Copy steps from" to match another department).` });
      setForm(null);
      await load();
    } catch (e) {
      setMsg({ tone: "red", text: e instanceof Error ? e.message : "The department could not be saved." });
    } finally {
      setBusy(false);
    }
  }

  const peopleOptions = [{ value: "", label: "Nobody" }, ...people.map((p) => ({ value: p.id, label: p.full_name || p.email || "—" }))];
  const isAccountOfficer = (id: string) => people.some((p) => p.id === id && p.officer) || assign.some((a) => a.officer_user_id === id);
  const officerOptions = [...people].sort((x, y) => Number(isAccountOfficer(y.id)) - Number(isAccountOfficer(x.id)) || String(x.full_name).localeCompare(String(y.full_name)))
    .map((p) => ({ value: p.id, label: p.full_name || p.email || "—", group: isAccountOfficer(p.id) ? "Account Officers" : "Everyone else" }));
  const sections = accounts.map((a) => ({
    a, officers: [...new Set(assign.filter((x) => x.account_id === a.id).map((x) => x.officer_user_id))].map((id) => who(id)),
    depts: (depts || []).filter((d) => routing.some((r) => r.dept_id === d.id && r.iet_account_id === a.id && r.is_active !== false)).map((d) => d.name),
  })).filter((s) => s.officers.length || s.depts.length);

  return (
    <V4Page>
      <PageHead title="Departments" sub="Each department has its director, head and the account its money is paid from."
        actions={[
          { label: "Export Excel", icon: "download", kind: "secondary", disabled: !shown.length, onClick: () => downloadXlsx("Departments", [{ name: "Departments", title: "ReqGen — Departments", rows: shown.map((d) => ({ Department: d.name, Staff: staffIn.get(d.id) || 0, "Director (DOD)": dod(d), "Head / PD / DIN Admin": head(d), "Pays from": paysFrom(d), Status: d.is_active === false ? "Inactive" : "Active" })) }]) },
          { label: "Add department", icon: "plus", kind: "primary", onClick: () => open(null) },
        ]} />
      {error ? <Notice tone="red">{error}</Notice> : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {needsSql ? <Notice tone="amber">Run the v4.6.8 database step (database/v4_6_8_admin_access.sql) so this page can show every staff member and paying account.</Notice> : null}
      <Card>
        {depts === null ? <Skeleton lines={8} /> : (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Department</th><th>Director (DOD)</th><th>Head / PD / DIN Admin</th><th>Pays from (account · Account Officer)</th><th className="v4-r">Action</th></tr></thead>
              <tbody>
                {shown.map((d) => (
                  <tr key={d.id}>
                    <td><span className="v4-strong">{d.name}</span><span className="v4-sub">{staffIn.get(d.id) || 0} staff{d.is_active === false ? " · inactive" : ""}</span></td>
                    <td data-label="Director (DOD)">{dod(d)}</td>
                    <td data-label="Head / PD / DIN">{head(d)}</td>
                    <td data-label="Pays from">{routeFor(d.id) ? paysFrom(d) : <span className="v4-chip v4-chip-amber">Not set</span>}</td>
                    <td className="v4-r"><button className="v4-btn v4-btn-secondary" type="button" style={{ minHeight: 38 }} onClick={() => open(d)}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(depts || []).some((d) => d.is_active === false) ? <div className="v4-card-pad" style={{ borderTop: "1px solid var(--v4-line-2)" }}><label className="v4-check"><input type="checkbox" checked={showOff} onChange={(e) => setShowOff(e.target.checked)} /> Show inactive departments</label></div> : null}
      </Card>
      <section className="v4-card v4-card-pad">
        <h2 className="v4-h2" style={{ marginBottom: 12 }}>Account sections and their Account Officers</h2>
        <p className="v4-help" style={{ margin: "0 0 14px" }}>When an Account Officer prepares a voucher, ReqGen writes which account it is for — e.g. “Prepared by Nasir Garba — Account Officer, DIN”. Account lists show the account name only — no payment words like POS, cash or transfer.</p>
        {sections.length ? (
          <div className="v4-bankcards">
            {sections.map((s) => (
              <article key={s.a.id} className="v4-bankcard">
                <div className="v4-top"><span><strong>{s.a.name}</strong><span>{s.depts.length ? s.depts.join(" · ") : s.a.bank_name || ""}</span></span></div>
                <span className="v4-pos">{s.officers.length ? s.officers.map((o) => <span key={o} className="v4-pchip v4-office">{o}</span>) : <span className="v4-chip v4-chip-amber">No Account Officer</span>}</span>
              </article>
            ))}
          </div>
        ) : <p className="v4-muted" style={{ margin: 0 }}>No account has an Account Officer yet. Assign them in Finance › Officer Assignment.</p>}
      </section>

      <Modal open={!!form} wide title={form?.id ? `Edit ${form.name || "department"}` : "Add department"} sub={form?.id ? "Changing the director, head or PD starts a new route version — requests already moving keep the route they started with." : "Add its officers after saving."} onClose={() => setForm(null)} busy={busy}
        footer={<><button type="button" className="v4-btn v4-btn-ghost" onClick={() => setForm(null)} disabled={busy}>Cancel</button><button type="button" className="v4-btn v4-btn-primary" onClick={() => void save()} disabled={busy}><Icon name="check" />{busy ? "Saving…" : "Save"}</button></>}>
        {form ? (
          <div className="v4-form-grid">
            <label className="v4-field"><span className="v4-flabel">Name <span className="v4-req">*</span></span><input className="v4-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="v4-check" style={{ alignSelf: "end", minHeight: 46, alignItems: "center" }}><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active (shown on new requests)</label>
            {form.id ? (
              <>
                <div className="v4-field"><span className="v4-flabel">Director (DOD)</span><Select ariaLabel="Director (DOD)" searchable value={form.dod} onChange={(v) => setForm({ ...form, dod: v })} options={peopleOptions} /></div>
                <div className="v4-field"><span className="v4-flabel">Head (HOD)</span><Select ariaLabel="Head (HOD)" searchable value={form.hod} onChange={(v) => setForm({ ...form, hod: v })} options={peopleOptions} /></div>
                <div className="v4-field"><span className="v4-flabel">PD · Program Director</span><Select ariaLabel="PD" searchable value={form.pd} onChange={(v) => setForm({ ...form, pd: v })} options={peopleOptions} /></div>
                <div className="v4-field" />
              </>
            ) : null}
            <div className="v4-field"><span className="v4-flabel">Pays from account</span><Select ariaLabel="Pays from account" searchable value={form.account} placeholder="Choose the account"
              onChange={(v) => setForm({ ...form, account: v, officer: officerOf(v) || form.officer })}
              options={[{ value: "", label: "Not set" }, ...[...accounts].sort((x, y) => Number(y.total_fund > 0) - Number(x.total_fund > 0) || x.name.localeCompare(y.name))
                .map((a) => ({ value: a.id, label: a.name, hint: fundHint(a), group: Number(a.total_fund) > 0 ? "Funded accounts" : "No fund yet" }))]} />
              <span className="v4-help" data-testid="fund-line">{fundLine(form.account)}</span></div>
            <div className="v4-field"><span className="v4-flabel">Account Officer</span><Select ariaLabel="Account Officer" searchable value={form.officer} placeholder="Choose the officer" onChange={(v) => setForm({ ...form, officer: v })}
              options={[{ value: "", label: "Not set" }, ...officerOptions]} /></div>
          </div>
        ) : null}
      </Modal>
    </V4Page>
  );
}
