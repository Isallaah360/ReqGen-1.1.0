"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Dept = { id: string; name: string };
type IetAccount = { id: string; code: string | null; name: string; account_number: string | null; bank_name: string | null; is_active: boolean | null };
type Officer = { id: string; full_name: string | null; email: string | null; role: string | null };
type RouteRow = { id: string; dept_id: string; iet_account_id: string; officer_user_id: string; is_active: boolean };

function roleKey(value: string | null | undefined) { return String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, ""); }
function officerLabel(officer?: Officer) { return officer?.full_name?.trim() || officer?.email?.trim() || "Not assigned"; }
function accountLabel(account?: IetAccount) { if (!account) return "Not assigned"; return `${account.code || "—"} · ${account.name}${account.bank_name ? ` · ${account.bank_name}` : ""}`; }

export default function AccountRoutingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [accounts, setAccounts] = useState<IetAccount[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState("");
  const [officerId, setOfficerId] = useState("");
  const pageSize = 10;

  async function loadAll() {
    const { data: auth } = await supabase.auth.getUser();
    setLoading(true);
    setMsg(null);
    if (!auth.user) { router.replace("/login"); return; }
    const me = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
    if (me.error || roleKey(me.data?.role) !== "admin") { router.replace("/unauthorized"); return; }

    const [deptRes, accountRes, officerRes, routeRes] = await Promise.all([
      supabase.from("departments").select("id,name").order("name", { ascending: true }),
      supabase.from("iet_accounts").select("id,code,name,account_number,bank_name,is_active").eq("is_active", true).order("name", { ascending: true }),
      supabase.from("profiles").select("id,full_name,email,role").eq("role", "AccountOfficer").order("full_name", { ascending: true }),
      supabase.from("department_account_routing").select("id,dept_id,iet_account_id,officer_user_id,is_active").order("created_at", { ascending: true }),
    ]);
    const error = deptRes.error || accountRes.error || officerRes.error || routeRes.error;
    if (error) setMsg("Unable to load account routing: " + error.message);
    setDepts((deptRes.data || []) as Dept[]); setAccounts((accountRes.data || []) as IetAccount[]); setOfficers((officerRes.data || []) as Officer[]); setRoutes((routeRes.data || []) as RouteRow[]);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAll();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []); // loadAll intentionally runs once for the initial authorised workspace load

  const routeByDept = useMemo(() => new Map(routes.map((route) => [route.dept_id, route])), [routes]);
  const accountMap = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const officerMap = useMemo(() => new Map(officers.map((officer) => [officer.id, officer])), [officers]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return depts.filter((dept) => {
      if (!q) return true;
      const route = routeByDept.get(dept.id);
      return `${dept.name} ${accountLabel(route ? accountMap.get(route.iet_account_id) : undefined)} ${officerLabel(route ? officerMap.get(route.officer_user_id) : undefined)}`.toLowerCase().includes(q);
    });
  }, [depts, search, routeByDept, accountMap, officerMap]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((Math.min(page, pages) - 1) * pageSize, Math.min(page, pages) * pageSize);

  function startEdit(deptId: string) {
    const route = routeByDept.get(deptId);
    setEditingDeptId(deptId); setAccountId(route?.iet_account_id || ""); setOfficerId(route?.officer_user_id || ""); setMsg(null);
  }

  async function save() {
    if (!editingDeptId || !accountId || !officerId) { setMsg("Select a department account and responsible Account Officer before saving."); return; }
    setSaving(true); setMsg(null);
    const existing = routeByDept.get(editingDeptId);
    const payload = { dept_id: editingDeptId, iet_account_id: accountId, officer_user_id: officerId, is_active: true };
    const result = existing
      ? await supabase.from("department_account_routing").update(payload).eq("id", existing.id)
      : await supabase.from("department_account_routing").insert(payload);
    if (result.error) setMsg("Save failed: " + result.error.message);
    else { setMsg("✅ Department account routing saved."); setEditingDeptId(null); await loadAll(); }
    setSaving(false);
  }

  async function remove(deptId: string) {
    const route = routeByDept.get(deptId); if (!route) return;
    if (!window.confirm("Remove this department account routing?")) return;
    setSaving(true); const result = await supabase.from("department_account_routing").delete().eq("id", route.id);
    if (result.error) setMsg("Delete failed: " + result.error.message); else { setMsg("✅ Routing removed."); await loadAll(); }
    setSaving(false);
  }

  if (loading) return <main className="admin-v3-page"><div className="admin-v3-loading">Loading account routing…</div></main>;

  return (
    <main className="admin-v3-page">
      <header className="admin-v3-header"><div><h1>Account Routing Management</h1><p>Manage department-to-IET-account routing and responsible Account Officers.</p></div><button className="admin-v3-secondary" onClick={() => void loadAll()}>Refresh</button></header>
      {msg ? <div className="admin-v3-alert">{msg}</div> : null}
      <section className="admin-v3-card">
        <div className="admin-v3-toolbar"><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search departments, accounts or officers…"/><span>{filtered.length} department{filtered.length === 1 ? "" : "s"}</span></div>
        <div className="admin-v3-table-scroll"><table className="admin-v3-table"><thead><tr><th>#</th><th>Department</th><th>Primary Account</th><th>Sign-off Officer</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          {paged.map((dept, index) => { const route = routeByDept.get(dept.id); return <tr key={dept.id}><td>{(page - 1) * pageSize + index + 1}</td><td><strong>{dept.name}</strong></td><td>{accountLabel(route ? accountMap.get(route.iet_account_id) : undefined)}</td><td>{officerLabel(route ? officerMap.get(route.officer_user_id) : undefined)}</td><td><span className={`admin-v3-status ${route?.is_active ? "is-active" : "is-inactive"}`}>{route?.is_active ? "Active" : "Not configured"}</span></td><td><div className="admin-v3-row-actions"><button onClick={() => startEdit(dept.id)}>Edit</button>{route ? <button className="is-danger" onClick={() => void remove(dept.id)} disabled={saving}>Remove</button> : null}</div></td></tr>; })}
          {!paged.length ? <tr><td colSpan={6} className="admin-v3-empty">No matching departments.</td></tr> : null}
        </tbody></table></div>
        <div className="admin-v3-pagination"><span>Showing {filtered.length ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, filtered.length)} of {filtered.length}</span><div><button disabled={page <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))}>‹</button>{Array.from({ length: pages }, (_, index) => index + 1).slice(Math.max(0, page - 3), Math.max(5, page + 2)).map((value) => <button key={value} className={value === page ? "is-active" : ""} onClick={() => setPage(value)}>{value}</button>)}<button disabled={page >= pages} onClick={() => setPage((v) => Math.min(pages, v + 1))}>›</button></div></div>
      </section>

      {editingDeptId ? <section className="admin-v3-card admin-v3-editor"><div className="admin-v3-card-head"><div><h2>Edit Department Routing</h2><p>{depts.find((dept) => dept.id === editingDeptId)?.name}</p></div><button className="admin-v3-secondary" onClick={() => setEditingDeptId(null)}>Cancel</button></div><div className="admin-v3-form-grid"><label>IET Account<select value={accountId} onChange={(e) => setAccountId(e.target.value)}><option value="">Select account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{accountLabel(account)}</option>)}</select></label><label>Account Officer<select value={officerId} onChange={(e) => setOfficerId(e.target.value)}><option value="">Select officer</option>{officers.map((officer) => <option key={officer.id} value={officer.id}>{officerLabel(officer)}{officer.email ? ` · ${officer.email}` : ""}</option>)}</select></label></div><div className="admin-v3-modal-actions"><button className="reqgen-btn reqgen-btn-blue rounded-xl px-4 py-2 text-sm font-black text-white" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save Routing"}</button></div></section> : null}
    </main>
  );
}
