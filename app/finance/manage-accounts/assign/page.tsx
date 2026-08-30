"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building2,
  Download,
  Eye,
  Filter,
  Link2,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserRoundCog,
  Users,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import styles from "./assign-bank.module.css";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  dept_id?: string | null;
};

type Department = { id: string; name: string | null };

type Account = {
  id: string;
  code: string | null;
  name: string;
  bank_name: string | null;
  is_active: boolean | null;
};

type AssignmentRow = {
  id: string;
  account_id: string;
  officer_user_id: string;
  created_at: string;
};

function roleKey(role: string | null | undefined) {
  return (role || "").trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, "");
}

function shortDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function initials(name: string | null | undefined, fallback = "AO") {
  const source = (name || "").trim();
  if (!source) return fallback;
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("");
}

function accountLabel(account: Account | undefined) {
  if (!account) return "Unknown Account";
  return account.code ? `${account.code} — ${account.name}` : account.name;
}

function officerLabel(officer: Profile | undefined) {
  if (!officer) return "Unknown Officer";
  return officer.full_name || officer.email || officer.id;
}

function safeUserCode(id: string | undefined) {
  if (!id) return "—";
  return `USR-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

export default function AssignBankToOfficerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [myRole, setMyRole] = useState("Staff");

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [officers, setOfficers] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);

  const [search, setSearch] = useState("");
  const [bankFilter, setBankFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedOfficerId, setSelectedOfficerId] = useState("");

  const canManage = ["admin", "auditor"].includes(roleKey(myRole));
  const pageSize = 8;

  const loadAll = useCallback(async (silent = false) => {
    if (silent) { setRefreshing(true); } else { setLoading(true); }
    setMessage(null);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (profileError) {
      setMessage(`Failed to load role: ${profileError.message}`);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const role = (profile?.role || "Staff") as string;
    setMyRole(role);
    if (!["admin", "auditor"].includes(roleKey(role))) {
      router.push(`/dashboard?updated=${Date.now()}`);
      router.refresh();
      return;
    }

    const [accountRes, officerRes, assignmentRes, departmentRes] = await Promise.all([
      supabase
        .from("iet_accounts")
        .select("id,code,name,bank_name,is_active")
        .order("is_active", { ascending: false })
        .order("name", { ascending: true }),
      supabase
        .from("profiles")
        .select("id,full_name,email,role,dept_id")
        .in("role", ["AccountOfficer", "Account", "Accounts"])
        .order("full_name", { ascending: true }),
      supabase
        .from("iet_account_officer_assignments")
        .select("id,account_id,officer_user_id,created_at")
        .order("created_at", { ascending: false }),
      supabase.from("departments").select("id,name").order("name", { ascending: true }),
    ]);

    if (accountRes.error) setMessage(`Failed to load accounts: ${accountRes.error.message}`);
    if (officerRes.error) setMessage(`Failed to load officers: ${officerRes.error.message}`);
    if (assignmentRes.error) setMessage(`Failed to load assignments: ${assignmentRes.error.message}`);

    setAccounts(((accountRes.data || []) as Account[]).map((item) => ({ ...item, is_active: item.is_active !== false })));
    setOfficers((officerRes.data || []) as Profile[]);
    setAssignments((assignmentRes.data || []) as AssignmentRow[]);
    setDepartments((departmentRes.data || []) as Department[]);
    setLoading(false);
    setRefreshing(false);
  }, [router]);

  useEffect(() => {
    queueMicrotask(() => void loadAll());
    const onFocus = () => void loadAll(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadAll]);

  const accountMap = useMemo(() => new Map(accounts.map((item) => [item.id, item])), [accounts]);
  const officerMap = useMemo(() => new Map(officers.map((item) => [item.id, item])), [officers]);
  const departmentMap = useMemo(() => new Map(departments.map((item) => [item.id, item.name || "Department"])), [departments]);
  const assignedOfficerIds = useMemo(() => new Set(assignments.map((item) => item.officer_user_id)), [assignments]);
  const assignedAccountIds = useMemo(() => new Set(assignments.map((item) => item.account_id)), [assignments]);

  const stats = useMemo(() => {
    const assignedOfficers = new Set(assignments.map((item) => item.officer_user_id)).size;
    return {
      officers: officers.length,
      assigned: assignedOfficers,
      unassigned: Math.max(officers.length - assignedOfficers, 0),
      accounts: accounts.filter((item) => item.is_active !== false).length,
    };
  }, [accounts, assignments, officers.length]);

  const bankOptions = useMemo(() => {
    return Array.from(new Set(accounts.map((item) => item.bank_name).filter(Boolean) as string[])).sort();
  }, [accounts]);

  const roleOptions = useMemo(() => {
    return Array.from(new Set(officers.map((item) => item.role).filter(Boolean) as string[])).sort();
  }, [officers]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assignments.filter((assignment) => {
      const account = accountMap.get(assignment.account_id);
      const officer = officerMap.get(assignment.officer_user_id);
      const departmentName = officer?.dept_id ? departmentMap.get(officer.dept_id) || "" : "";
      const status = account?.is_active === false ? "inactive" : "active";
      const matchesSearch = !query || [officerLabel(officer), officer?.email, account?.name, account?.code, account?.bank_name, departmentName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
      const matchesBank = bankFilter === "all" || account?.bank_name === bankFilter;
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const matchesRole = roleFilter === "all" || officer?.role === roleFilter;
      const matchesDepartment = departmentFilter === "all" || officer?.dept_id === departmentFilter;
      return matchesSearch && matchesBank && matchesStatus && matchesRole && matchesDepartment;
    });
  }, [accountMap, officerMap, departmentMap, assignments, search, bankFilter, statusFilter, roleFilter, departmentFilter]);

  useEffect(() => { queueMicrotask(() => setPage(1)); }, [search, bankFilter, statusFilter, roleFilter, departmentFilter]);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const summary = useMemo(() => {
    const activeAssigned = assignments.filter((item) => accountMap.get(item.account_id)?.is_active !== false).length;
    const inactiveAssigned = assignments.filter((item) => accountMap.get(item.account_id)?.is_active === false).length;
    const unassignedOfficers = Math.max(officers.length - assignedOfficerIds.size, 0);
    const availableAccounts = Math.max(accounts.filter((item) => item.is_active !== false).length - assignedAccountIds.size, 0);
    const total = Math.max(activeAssigned + inactiveAssigned + unassignedOfficers + availableAccounts, 1);
    return { activeAssigned, inactiveAssigned, unassignedOfficers, availableAccounts, total };
  }, [accounts, assignments, assignedAccountIds.size, assignedOfficerIds.size, accountMap, officers.length]);

  const donutBackground = useMemo(() => {
    const p1 = (summary.activeAssigned / summary.total) * 100;
    const p2 = p1 + (summary.availableAccounts / summary.total) * 100;
    const p3 = p2 + (summary.unassignedOfficers / summary.total) * 100;
    return `conic-gradient(#11a35c 0 ${p1}%,#0d63f3 ${p1}% ${p2}%,#7c3aed ${p2}% ${p3}%,#f59e0b ${p3}% 100%)`;
  }, [summary]);

  function openAssign(accountId = "", officerId = "") {
    setSelectedAccountId(accountId);
    setSelectedOfficerId(officerId);
    setShowModal(true);
  }

  async function saveAssignment() {
    if (!canManage) return setMessage("Not allowed.");
    if (!selectedAccountId) return setMessage("Please select a bank account.");
    if (!selectedOfficerId) return setMessage("Please select an officer.");

    const account = accountMap.get(selectedAccountId);
    if (account?.is_active === false) return setMessage("This bank account is inactive.");

    setSaving(true);
    setMessage(null);
    const { error } = await supabase.from("iet_account_officer_assignments").upsert(
      { account_id: selectedAccountId, officer_user_id: selectedOfficerId },
      { onConflict: "account_id" }
    );

    if (error) {
      setMessage(`Assignment failed: ${error.message}`);
    } else {
      setMessage("Bank account assigned successfully.");
      setShowModal(false);
      setSelectedAccountId("");
      setSelectedOfficerId("");
      await loadAll(true);
      router.refresh();
    }
    setSaving(false);
  }

  async function removeAssignment(id: string) {
    if (!canManage) return;
    if (!confirm("Remove this bank-account assignment?")) return;
    setSaving(true);
    const { error } = await supabase.from("iet_account_officer_assignments").delete().eq("id", id);
    setMessage(error ? `Remove failed: ${error.message}` : "Assignment removed.");
    if (!error) await loadAll(true);
    setSaving(false);
  }

  function exportAssignments() {
    const csv = [
      ["Officer", "Email", "Role", "Department", "Account", "Bank", "Status", "Assigned On"],
      ...rows.map((assignment) => {
        const officer = officerMap.get(assignment.officer_user_id);
        const account = accountMap.get(assignment.account_id);
        return [
          officerLabel(officer),
          officer?.email || "",
          officer?.role || "",
          officer?.dept_id ? departmentMap.get(officer.dept_id) || "" : "",
          accountLabel(account),
          account?.bank_name || "",
          account?.is_active === false ? "Inactive" : "Active",
          shortDate(assignment.created_at),
        ];
      }),
    ].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "reqgen-bank-officer-assignments.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <main className={styles.loading}>Loading bank account assignments...</main>;

  return (
    <main className={styles.page}>
      <div className={styles.breadcrumb}>Finance <span>›</span> IET Bank Accounts <span>›</span> <b>Assign Bank to Officer</b></div>

      <div className={styles.headingRow}>
        <div>
          <h1>Assign Bank Account to Officer</h1>
          <p>Assign and manage bank accounts for authorized finance officers.</p>
        </div>
        <button className={styles.primaryBtn} onClick={() => openAssign()} disabled={!canManage || saving}>
          <Plus size={15}/> Assign Bank to Officer
        </button>
      </div>

      {message && <div className={styles.message}>{message}</div>}
      <div className={styles.ruleNote}>One authorized officer is routed to each bank account. Reassigning an account replaces the previous assignment.</div>

      <section className={styles.kpiGrid}>
        <Kpi icon={<Users/>} tone="blue" title="Total Officers" value={stats.officers} note="Authorized finance officers"/>
        <Kpi icon={<UserCheck/>} tone="green" title="Assigned Officers" value={stats.assigned} note={`${stats.officers ? Math.round((stats.assigned / stats.officers) * 100) : 0}% of officers assigned`}/>
        <Kpi icon={<UserRoundCog/>} tone="orange" title="Unassigned Officers" value={stats.unassigned} note={`${stats.officers ? Math.round((stats.unassigned / stats.officers) * 100) : 0}% of officers unassigned`}/>
        <Kpi icon={<Link2/>} tone="purple" title="Bank Accounts" value={stats.accounts} note="Available active bank accounts"/>
      </section>

      <section className={styles.filterCard}>
        <label className={styles.searchField}><span>Search Officer</span><div><Search size={15}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, bank or code..."/></div></label>
        <label><span>Bank Account</span><select value={bankFilter} onChange={(e) => setBankFilter(e.target.value)}><option value="all">All Banks</option>{bankOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label><span>Assignment Status</span><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">All Statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        <label><span>Officer Role</span><select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}><option value="all">All Roles</option>{roleOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label><span>Department</span><select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}><option value="all">All Departments</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name || "Department"}</option>)}</select></label>
        <button className={styles.filterBtn} onClick={() => { setSearch(""); setBankFilter("all"); setStatusFilter("all"); setRoleFilter("all"); setDepartmentFilter("all"); }}><Filter size={14}/> Reset</button>
      </section>

      <section className={styles.contentGrid}>
        <div className={styles.tableCard}>
          <div className={styles.cardHeader}>
            <div><h2>Officer Bank Assignments ({rows.length})</h2><small>Live account-to-officer routing records</small></div>
            <span className={styles.sortLabel}>Newest assignment first</span>
          </div>

          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>#</th><th>Officer</th><th>Role</th><th>Department</th><th>Bank Account</th><th>Bank Name</th><th>Status</th><th>Assigned On</th><th>Actions</th></tr></thead>
              <tbody>
                {visibleRows.length === 0 ? <tr><td colSpan={9} className={styles.empty}>No bank-account assignment matches the selected filters.</td></tr> : visibleRows.map((assignment, index) => {
                  const account = accountMap.get(assignment.account_id);
                  const officer = officerMap.get(assignment.officer_user_id);
                  const department = officer?.dept_id ? departmentMap.get(officer.dept_id) || "—" : "—";
                  const active = account?.is_active !== false;
                  return <tr key={assignment.id}>
                    <td>{(page - 1) * pageSize + index + 1}</td>
                    <td><div className={styles.officerCell}><span className={styles.avatar}>{initials(officer?.full_name)}</span><div><strong>{officerLabel(officer)}</strong><small>{safeUserCode(officer?.id)}</small></div></div></td>
                    <td>{officer?.role || "Account Officer"}</td>
                    <td>{department}</td>
                    <td><strong>{account?.name || "Unknown"}</strong><small>{account?.code || "No code"}</small></td>
                    <td>{account?.bank_name || "Bank not set"}</td>
                    <td><span className={active ? styles.statusActive : styles.statusInactive}>{active ? "Active" : "Inactive"}</span></td>
                    <td>{shortDate(assignment.created_at)}</td>
                    <td><div className={styles.actionGroup}><button className={styles.iconBtn} title="View account" onClick={() => router.push(`/finance/manage-accounts?account=${assignment.account_id}`)}><Eye size={14}/></button><button className={styles.iconBtn} title="Reassign" onClick={() => openAssign(assignment.account_id, assignment.officer_user_id)} disabled={!canManage}><PencilLine size={14}/></button><button className={styles.iconBtn} title="Remove assignment" onClick={() => void removeAssignment(assignment.id)} disabled={!canManage || saving}><Trash2 size={14}/></button></div></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>

          <div className={styles.mobileCards}>
            {visibleRows.map((assignment) => {
              const account = accountMap.get(assignment.account_id);
              const officer = officerMap.get(assignment.officer_user_id);
              return <div className={styles.assignmentCard} key={assignment.id}>
                <div className={styles.assignmentCardHeader}><div><strong>{officerLabel(officer)}</strong><small>{officer?.email || "No email"}</small></div><span className={account?.is_active === false ? styles.statusInactive : styles.statusActive}>{account?.is_active === false ? "Inactive" : "Active"}</span></div>
                <div className={styles.assignmentCardGrid}><Metric label="Bank Account" value={accountLabel(account)}/><Metric label="Bank" value={account?.bank_name || "—"}/><Metric label="Department" value={officer?.dept_id ? departmentMap.get(officer.dept_id) || "—" : "—"}/><Metric label="Assigned" value={shortDate(assignment.created_at)}/></div>
              </div>;
            })}
          </div>

          <div className={styles.pagination}><span>Showing {rows.length === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, rows.length)} of {rows.length} assignments</span><div><button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>‹</button>{Array.from({ length: Math.min(totalPages, 4) }, (_, i) => i + 1).map((n) => <button key={n} onClick={() => setPage(n)} className={page === n ? styles.currentPage : ""}>{n}</button>)}<button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>›</button></div></div>
        </div>

        <aside className={styles.sideColumn}>
          <div className={styles.sideCard}>
            <h2>Assignment Summary</h2>
            <div className={styles.donutWrap}>
              <div className={styles.donut} style={{ background: donutBackground }}><span>{assignments.length}<small>Assigned</small></span></div>
              <div className={styles.legend}>
                <Legend color="#11a35c" label="Active assignments" value={summary.activeAssigned}/>
                <Legend color="#0d63f3" label="Available accounts" value={summary.availableAccounts}/>
                <Legend color="#7c3aed" label="Unassigned officers" value={summary.unassignedOfficers}/>
                <Legend color="#f59e0b" label="Inactive assignments" value={summary.inactiveAssigned}/>
              </div>
            </div>
          </div>

          <div className={styles.sideCard}>
            <h2>Quick Actions</h2>
            <QuickAction icon={<UserCheck size={17}/>} title="Assign Bank to Officer" note="Assign a bank account to an officer" onClick={() => openAssign()}/>
            <QuickAction icon={<RefreshCw size={17}/>} title="Refresh Assignments" note="Reload current routing records" onClick={() => void loadAll(true)}/>
            <QuickAction icon={<Building2 size={17}/>} title="View All Bank Accounts" note="Open IET Bank Accounts" onClick={() => router.push("/finance/manage-accounts")}/>
            <QuickAction icon={<Download size={17}/>} title="Export Assignments" note="Download assignments report" onClick={exportAssignments}/>
          </div>

          <div className={styles.noteCard}>
            <div><AlertCircle size={16}/> Important Note</div>
            <p>Bank account numbers are not displayed or required on this page. Routing is maintained using approved bank/account labels and internal account records.</p>
          </div>
        </aside>
      </section>

      {showModal && <div className={styles.modalBackdrop} onMouseDown={() => setShowModal(false)}>
        <div className={styles.modal} onMouseDown={(event) => event.stopPropagation()}>
          <button className={styles.modalClose} onClick={() => setShowModal(false)}><X size={16}/></button>
          <h2>Assign Bank to Officer</h2>
          <p>Select an active IET bank account and the authorized finance officer responsible for it.</p>
          <div className={styles.formGrid}>
            <label><span>Bank Account</span><select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} disabled={saving}><option value="">Select account</option>{accounts.filter((item) => item.is_active !== false).map((item) => <option key={item.id} value={item.id}>{accountLabel(item)} — {item.bank_name || "Bank"}{assignedAccountIds.has(item.id) ? " • Assigned" : ""}</option>)}</select></label>
            <label><span>Finance Officer</span><select value={selectedOfficerId} onChange={(e) => setSelectedOfficerId(e.target.value)} disabled={saving}><option value="">Select officer</option>{officers.map((item) => <option key={item.id} value={item.id}>{officerLabel(item)} — {item.role || "Account Officer"}</option>)}</select></label>
            <div className={styles.formWide + " " + styles.ruleNote}><ShieldCheck size={14}/> Saving an existing account assignment will reassign that bank account to the selected officer.</div>
          </div>
          <div className={styles.modalActions}><button className={styles.secondaryBtn} onClick={() => setShowModal(false)} disabled={saving}>Cancel</button><button className={styles.primaryBtn} onClick={saveAssignment} disabled={saving}>{saving ? "Saving..." : "Save Assignment"}</button></div>
        </div>
      </div>}
    </main>
  );
}

function Kpi({ icon, tone, title, value, note }: { icon: React.ReactNode; tone: string; title: string; value: number; note: string }) {
  return <div className={styles.kpi}><div className={styles.kpiIcon} data-tone={tone}>{icon}</div><div><span>{title}</span><strong>{value}</strong><small>{note}</small></div></div>;
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return <div><i style={{ background: color }}/><span>{label}</span><b>{value}</b></div>;
}

function QuickAction({ icon, title, note, onClick }: { icon: React.ReactNode; title: string; note: string; onClick: () => void }) {
  return <button className={styles.quickAction} onClick={onClick}><span>{icon}</span><div><strong>{title}</strong><small>{note}</small></div></button>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className={styles.metric}><span>{label}</span><strong>{value}</strong></div>;
}
