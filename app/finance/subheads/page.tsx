"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  Pencil,
  MoreVertical,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Download,
  Layers3,
  ShieldCheck,
  PauseCircle,
  GitBranch,
  FolderKanban,
  Network,
  WalletCards,
  AlertCircle,
  X,
  Save,
  Power,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { exportTableToExcel } from "@/lib/reportExport";
import styles from "./finance-subheads.module.css";

type Dept = { id: string; name: string };

type BankAccount = {
  id: string;
  code: string | null;
  name: string;
  bank_name: string | null;
  is_active: boolean | null;
  total_fund: number | null;
  unallocated_balance: number | null;
  available_balance: number | null;
};

type Subhead = {
  id: string;
  dept_id: string | null;
  bank_account_id: string | null;
  code: string | null;
  name: string;
  approved_allocation: number;
  reserved_amount: number;
  expenditure: number;
  balance: number;
  is_active: boolean;
  updated_at: string | null;
  allocation_note: string | null;
  allocation_date: string | null;
  request_count?: number;
};

type FilterStatus = "all" | "active" | "inactive";
type FilterLevel = "all" | "1" | "2" | "3+";

function roleKey(role: string | null | undefined) {
  return (role || "").trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, "");
}

function money(value: number | null | undefined) {
  return `₦${Number(value || 0).toLocaleString("en-NG", {
    maximumFractionDigits: 0,
  })}`;
}

function subheadLevel(code: string | null | undefined) {
  if (!code) return 1;
  return Math.max(1, code.split(".").length);
}

function parentCode(code: string | null | undefined) {
  if (!code || !code.includes(".")) return null;
  return code.split(".").slice(0, -1).join(".");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function getParentLabel(sub: Subhead, byCode: Map<string, Subhead>) {
  const code = parentCode(sub.code);
  if (!code) return "Top-level head";
  const parent = byCode.get(code);
  return parent ? `${parent.code || code} — ${parent.name}` : code;
}

export default function FinanceSubheadsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [role, setRole] = useState("Staff");
  const [userId, setUserId] = useState<string | null>(null);
  const canManage = ["admin", "auditor"].includes(roleKey(role));

  const [departments, setDepartments] = useState<Dept[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [subheads, setSubheads] = useState<Subhead[]>([]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<FilterStatus>("all");
  const [level, setLevel] = useState<FilterLevel>("all");
  const [parent, setParent] = useState("all");
  const [department, setDepartment] = useState("all");

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [selected, setSelected] = useState<Subhead | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formDept, setFormDept] = useState("");
  const [formBank, setFormBank] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formAllocation, setFormAllocation] = useState(0);
  const [formNote, setFormNote] = useState("");
  const [formActive, setFormActive] = useState(true);

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setMessage(null);

    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }

      setUserId(auth.user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", auth.user.id)
        .maybeSingle();
      setRole((profile?.role || "Staff") as string);

      await supabase.rpc("reqgen_recalculate_all_iet_accounts");

      const [deptRes, bankRes, subRes] = await Promise.all([
        supabase.from("departments").select("id,name").order("name", { ascending: true }),
        supabase
          .from("iet_accounts")
          .select("id,code,name,bank_name,is_active,total_fund,unallocated_balance,available_balance")
          .order("name", { ascending: true }),
        supabase
          .from("subheads")
          .select(
            "id,dept_id,bank_account_id,code,name,approved_allocation,reserved_amount,expenditure,balance,is_active,updated_at,allocation_note,allocation_date"
          )
          .order("code", { ascending: true, nullsFirst: false }),
      ]);

      if (deptRes.error) throw new Error(deptRes.error.message);
      if (bankRes.error) throw new Error(bankRes.error.message);
      if (subRes.error) throw new Error(subRes.error.message);

      const freshSubheads = ((subRes.data || []) as Subhead[]).map((item) => ({
        ...item,
        approved_allocation: Number(item.approved_allocation || 0),
        reserved_amount: Number(item.reserved_amount || 0),
        expenditure: Number(item.expenditure || 0),
        balance: Number(item.balance || 0),
        is_active: item.is_active !== false,
      }));

      let requestCountBySubhead: Record<string, number> = {};
      if (freshSubheads.length) {
        const { data: linkedRows } = await supabase
          .from("requests")
          .select("subhead_id")
          .not("subhead_id", "is", null);
        (linkedRows || []).forEach((row: any) => {
          if (row.subhead_id) requestCountBySubhead[row.subhead_id] = (requestCountBySubhead[row.subhead_id] || 0) + 1;
        });
      }

      setDepartments((deptRes.data || []) as Dept[]);
      setBanks((bankRes.data || []) as BankAccount[]);
      setSubheads(
        freshSubheads.map((item) => ({ ...item, request_count: requestCountBySubhead[item.id] || 0 }))
      );
    } catch (error: any) {
      setMessage(`Unable to load finance subheads: ${error?.message || "Unknown error"}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const departmentMap = useMemo(() => {
    const map = new Map<string, string>();
    departments.forEach((item) => map.set(item.id, item.name));
    return map;
  }, [departments]);

  const bankMap = useMemo(() => {
    const map = new Map<string, BankAccount>();
    banks.forEach((item) => map.set(item.id, item));
    return map;
  }, [banks]);

  const byCode = useMemo(() => {
    const map = new Map<string, Subhead>();
    subheads.forEach((item) => {
      if (item.code) map.set(item.code, item);
    });
    return map;
  }, [subheads]);

  const parentOptions = useMemo(
    () => subheads.filter((item) => subheadLevel(item.code) === 1 && item.code),
    [subheads]
  );

  const total = subheads.length;
  const activeCount = subheads.filter((item) => item.is_active).length;
  const inactiveCount = total - activeCount;
  const childCount = subheads.filter((item) => subheadLevel(item.code) > 1).length;

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return subheads.filter((item) => {
      if (status === "active" && !item.is_active) return false;
      if (status === "inactive" && item.is_active) return false;
      const itemLevel = subheadLevel(item.code);
      if (level === "1" && itemLevel !== 1) return false;
      if (level === "2" && itemLevel !== 2) return false;
      if (level === "3+" && itemLevel < 3) return false;
      if (department !== "all" && item.dept_id !== department) return false;
      if (parent !== "all") {
        const p = parentCode(item.code);
        if (item.code !== parent && p !== parent && !item.code?.startsWith(`${parent}.`)) return false;
      }
      if (!needle) return true;
      const bank = item.bank_account_id ? bankMap.get(item.bank_account_id) : null;
      return [
        item.code,
        item.name,
        getParentLabel(item, byCode),
        item.dept_id ? departmentMap.get(item.dept_id) : "",
        bank?.name,
        bank?.bank_name,
        item.is_active ? "active" : "inactive",
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [subheads, search, status, level, department, parent, bankMap, byCode, departmentMap]);

  useEffect(() => setPage(1), [search, status, level, department, parent]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const allocationTotal = subheads.reduce((sum, item) => sum + Number(item.approved_allocation || 0), 0);
  const categoryData = useMemo(() => {
    const groups = new Map<string, number>();
    subheads.forEach((item) => {
      const root = item.code?.split(".")[0] || "Other";
      const rootItem = byCode.get(root);
      const label = rootItem?.name || root;
      groups.set(label, (groups.get(label) || 0) + 1);
    });
    return [...groups.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, value]) => ({ label, value }));
  }, [subheads, byCode]);

  const donutStops = useMemo(() => {
    const colors = ["#1677ff", "#16a36a", "#f59e0b", "#7c3aed", "#94a3b8"];
    const totalValue = Math.max(1, categoryData.reduce((sum, item) => sum + item.value, 0));
    let cursor = 0;
    return categoryData
      .map((item, index) => {
        const start = cursor;
        cursor += (item.value / totalValue) * 100;
        return `${colors[index]} ${start}% ${cursor}%`;
      })
      .join(", ");
  }, [categoryData]);

  function resetForm() {
    setEditId(null);
    setFormDept("");
    setFormBank("");
    setFormCode("");
    setFormName("");
    setFormAllocation(0);
    setFormNote("");
    setFormActive(true);
  }

  function openCreate() {
    resetForm();
    setFormOpen(true);
  }

  function openEdit(item: Subhead) {
    setEditId(item.id);
    setFormDept(item.dept_id || "");
    setFormBank(item.bank_account_id || "");
    setFormCode(item.code || "");
    setFormName(item.name);
    setFormAllocation(Number(item.approved_allocation || 0));
    setFormNote(item.allocation_note || "");
    setFormActive(item.is_active);
    setFormOpen(true);
  }

  async function saveSubhead() {
    if (!canManage) return setMessage("Your current role does not allow subhead changes.");
    if (!formName.trim()) return setMessage("Enter a subhead name.");
    if (!formBank) return setMessage("Select the IET Bank funding this subhead.");
    if (Number(formAllocation) < 0) return setMessage("Allocation cannot be negative.");

    setSaving(true);
    setMessage(null);
    try {
      const current = editId ? subheads.find((item) => item.id === editId) || null : null;
      const bank = bankMap.get(formBank) || null;
      const currentAllocation = current?.bank_account_id === formBank ? Number(current.approved_allocation || 0) : 0;
      const availableCapacity = Number(bank?.unallocated_balance || 0) + currentAllocation;
      const committed = Number(current?.reserved_amount || 0) + Number(current?.expenditure || 0);

      if (editId && formAllocation < committed) {
        throw new Error(`Allocation cannot be below committed amount (${money(committed)}).`);
      }
      if (formAllocation > availableCapacity) {
        throw new Error(`Allocation exceeds available bank capacity (${money(availableCapacity)}).`);
      }

      let subheadId = editId;
      const payload = {
        dept_id: formDept || null,
        code: formCode.trim() || null,
        name: formName.trim(),
        is_active: formActive,
      };

      if (subheadId) {
        const { error } = await supabase.from("subheads").update(payload).eq("id", subheadId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("subheads")
          .insert({
            ...payload,
            bank_account_id: null,
            approved_allocation: 0,
            reserved_amount: 0,
            expenditure: 0,
            balance: 0,
          })
          .select("id")
          .single();
        if (error) throw error;
        subheadId = data.id;
      }

      const { error: allocationError } = await supabase.rpc("reqgen_assign_subhead_bank_allocation", {
        p_subhead_id: subheadId,
        p_bank_account_id: formBank,
        p_new_allocation: Number(formAllocation || 0),
        p_actor_id: userId,
        p_note: formNote.trim() || "Updated from Finance Subheads.",
      });
      if (allocationError) throw allocationError;

      setMessage(editId ? "Subhead updated successfully." : "New subhead created successfully.");
      setFormOpen(false);
      resetForm();
      await load(true);
    } catch (error: any) {
      setMessage(error?.message || "Unable to save subhead.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: Subhead) {
    if (!canManage) return setMessage("Your current role does not allow subhead changes.");
    setSaving(true);
    try {
      const { error } = await supabase
        .from("subheads")
        .update({ is_active: !item.is_active })
        .eq("id", item.id);
      if (error) throw error;
      setMessage(item.is_active ? "Subhead deactivated." : "Subhead activated.");
      await load(true);
    } catch (error: any) {
      setMessage(error?.message || "Unable to update subhead status.");
    } finally {
      setSaving(false);
    }
  }

  async function removeUnused(item: Subhead) {
    if (!canManage) return setMessage("Your current role does not allow subhead changes.");
    const linked = Number(item.request_count || 0) > 0 || Number(item.approved_allocation || 0) > 0 || Number(item.reserved_amount || 0) > 0 || Number(item.expenditure || 0) > 0;
    if (linked) return setMessage("This subhead has financial or request activity. Deactivate it instead of deleting it.");
    if (!window.confirm(`Delete unused subhead “${item.name}”?`)) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("subheads").delete().eq("id", item.id);
      if (error) throw error;
      setMessage("Unused subhead deleted.");
      await load(true);
    } catch (error: any) {
      setMessage(error?.message || "Unable to delete subhead.");
    } finally {
      setSaving(false);
    }
  }

  async function exportCsv() {
    setExporting(true);
    try {
      exportTableToExcel<Subhead>({
        fileName: `finance_subheads_${new Date().toISOString().slice(0, 10)}`,
        sheetName: "Finance Subheads",
        title: "FINANCE SUBHEADS",
        subtitle: `${filtered.length} visible subheads | Allocation ${money(allocationTotal)}`,
        rows: filtered,
        columns: [
          { header: "Code", value: (row) => row.code || "—" },
          { header: "Subhead", value: (row) => row.name },
          { header: "Parent Head", value: (row) => getParentLabel(row, byCode) },
          { header: "Department", value: (row) => (row.dept_id ? departmentMap.get(row.dept_id) || "—" : "—") },
          { header: "Level", value: (row) => subheadLevel(row.code) },
          { header: "Status", value: (row) => (row.is_active ? "Active" : "Inactive") },
          { header: "Budget", value: (row) => Number(row.approved_allocation || 0) },
          { header: "Balance", value: (row) => Number(row.balance || 0) },
          { header: "Updated", value: (row) => formatDate(row.updated_at) },
        ],
      });
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return <div className={styles.loading}>Loading Finance Subheads…</div>;
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <div className={styles.breadcrumb}>Finance <span>›</span> Finance Subheads</div>
          <h1>Finance Subheads</h1>
          <p>Create, manage and organize all finance subheads and budgeting categories.</p>
        </div>
        <button className={styles.primaryButton} onClick={openCreate} disabled={!canManage}>
          <Plus size={17} /> Create New Subhead
        </button>
      </header>

      {message && (
        <div className={styles.messageBar}>
          <span>{message}</span>
          <button onClick={() => setMessage(null)} aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}

      <section className={styles.kpiGrid}>
        <Kpi icon={<Layers3 size={24} />} tone="blue" label="Total Subheads" value={String(total)} note="All Finance Subheads" />
        <Kpi icon={<ShieldCheck size={24} />} tone="green" label="Active Subheads" value={String(activeCount)} note={`${total ? ((activeCount / total) * 100).toFixed(1) : "0"}% of total subheads`} />
        <Kpi icon={<PauseCircle size={24} />} tone="orange" label="Inactive Subheads" value={String(inactiveCount)} note={`${total ? ((inactiveCount / total) * 100).toFixed(1) : "0"}% of total subheads`} />
        <Kpi icon={<GitBranch size={24} />} tone="purple" label="Under Subheads" value={String(childCount)} note="Subheads with parent items" />
      </section>

      <section className={styles.filterCard}>
        <FilterField label="Search Subhead" grow>
          <div className={styles.searchBox}><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, code or description…" /></div>
        </FilterField>
        <FilterField label="Parent Head">
          <select value={parent} onChange={(e) => setParent(e.target.value)}>
            <option value="all">All Parent Heads</option>
            {parentOptions.map((item) => <option key={item.id} value={item.code || ""}>{item.code} — {item.name}</option>)}
          </select>
        </FilterField>
        <FilterField label="Status"><select value={status} onChange={(e) => setStatus(e.target.value as FilterStatus)}><option value="all">All Statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></FilterField>
        <FilterField label="Level"><select value={level} onChange={(e) => setLevel(e.target.value as FilterLevel)}><option value="all">All Levels</option><option value="1">Level 1</option><option value="2">Level 2</option><option value="3+">Level 3+</option></select></FilterField>
        <FilterField label="Department"><select value={department} onChange={(e) => setDepartment(e.target.value)}><option value="all">All Departments</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></FilterField>
        <button className={styles.moreFilters} onClick={() => { setSearch(""); setStatus("all"); setLevel("all"); setParent("all"); setDepartment("all"); }}><Filter size={15} /> Reset</button>
      </section>

      <section className={styles.contentGrid}>
        <div className={styles.tableCard}>
          <div className={styles.cardHeader}>
            <div><h2>Finance Subheads ({filtered.length})</h2></div>
            <div className={styles.cardActions}>
              <button onClick={exportCsv} disabled={exporting}><Download size={15} /> {exporting ? "Exporting…" : "Export CSV"}</button>
              <button className={styles.iconButton} onClick={() => load(true)} disabled={refreshing} title="Refresh"><RefreshCw size={16} className={refreshing ? styles.spin : ""} /></button>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>#</th><th>Code</th><th>Subhead Name</th><th>Parent Head</th><th>Level</th><th>Type</th><th>Status</th><th>Budget (₦)</th><th>Actions</th></tr></thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr><td colSpan={9}><div className={styles.empty}>No finance subheads match the selected filters.</div></td></tr>
                ) : paged.map((item, index) => (
                  <tr key={item.id}>
                    <td>{(page - 1) * pageSize + index + 1}</td>
                    <td className={styles.codeCell}>{item.code || "—"}</td>
                    <td><div className={styles.nameCell}><strong>{item.name}</strong><small>{item.dept_id ? departmentMap.get(item.dept_id) || "" : "Institution-wide"}</small></div></td>
                    <td className={styles.parentCell}>{getParentLabel(item, byCode)}</td>
                    <td>{subheadLevel(item.code)}</td>
                    <td>Operating</td>
                    <td><span className={`${styles.statusPill} ${item.is_active ? styles.active : styles.inactive}`}>{item.is_active ? "Active" : "Inactive"}</span></td>
                    <td className={styles.amountCell}>{Number(item.approved_allocation || 0).toLocaleString("en-NG")}</td>
                    <td><div className={styles.rowActions}>
                      <button onClick={() => setSelected(item)} title="View"><Eye size={15} /></button>
                      <button onClick={() => openEdit(item)} disabled={!canManage} title="Edit"><Pencil size={15} /></button>
                      <div className={styles.moreMenu}>
                        <button title="More actions"><MoreVertical size={15} /></button>
                        <div className={styles.moreMenuPanel}>
                          <button onClick={() => toggleActive(item)} disabled={!canManage}><Power size={14} /> {item.is_active ? "Deactivate" : "Activate"}</button>
                          <button onClick={() => removeUnused(item)} disabled={!canManage}><Trash2 size={14} /> Delete unused</button>
                        </div>
                      </div>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.pagination}>
            <span>Showing {filtered.length ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, filtered.length)} of {filtered.length} subheads</span>
            <div>
              <button onClick={() => setPage(1)} disabled={page === 1}>«</button>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => idx + 1).map((n) => <button key={n} className={page === n ? styles.currentPage : ""} onClick={() => setPage(n)}>{n}</button>)}
              {totalPages > 5 && <span>…</span>}
              {totalPages > 5 && <button onClick={() => setPage(totalPages)}>{totalPages}</button>}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
            </div>
          </div>
        </div>

        <aside className={styles.sideColumn}>
          <section className={styles.sideCard}>
            <h3>Subhead Overview</h3>
            <div className={styles.donutRow}>
              <div className={styles.donut} style={{ background: `conic-gradient(${donutStops || "#e2e8f0 0 100%"})` }}><div><strong>{total}</strong><span>Total</span></div></div>
              <div className={styles.legend}>
                {categoryData.map((item, index) => {
                  const colors = ["#1677ff", "#16a36a", "#f59e0b", "#7c3aed", "#94a3b8"];
                  return <div key={item.label}><span style={{ background: colors[index] }} /><b>{item.label}</b><small>{item.value} ({total ? ((item.value / total) * 100).toFixed(1) : 0}%)</small></div>;
                })}
              </div>
            </div>
          </section>

          <section className={styles.sideCard}>
            <h3>Quick Actions</h3>
            <QuickAction icon={<Plus size={16} />} tone="blue" title="Create New Subhead" note="Add a new finance subhead" onClick={openCreate} />
            <QuickAction icon={<FolderKanban size={16} />} tone="green" title="Manage Parent Heads" note="Review top-level budget heads" onClick={() => { setLevel("1"); setParent("all"); }} />
            <QuickAction icon={<Network size={16} />} tone="purple" title="View Subhead Hierarchy" note="Browse subheads by parent" onClick={() => { setLevel("all"); setParent(parentOptions[0]?.code || "all"); }} />
            <QuickAction icon={<WalletCards size={16} />} tone="orange" title="Budget Allocation" note="Allocate budgets to subheads" onClick={() => router.push("/finance/account-ledger")} />
            <QuickAction icon={<Download size={16} />} tone="green" title="Export Subhead List" note="Download finance subheads report" onClick={exportCsv} />
          </section>

          <section className={styles.noteCard}>
            <div className={styles.noteTitle}><AlertCircle size={18} /> Important Note</div>
            <p>Subheads are used for budgeting, reporting and financial control.</p>
            <p>Changes may affect existing budgets and transactions.</p>
          </section>
        </aside>
      </section>

      {selected && (
        <div className={styles.modalBackdrop} onMouseDown={() => setSelected(null)}>
          <div className={styles.detailsModal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}><div><small>FINANCE SUBHEAD</small><h2>{selected.code ? `${selected.code} — ` : ""}{selected.name}</h2></div><button onClick={() => setSelected(null)}><X size={18} /></button></div>
            <div className={styles.detailGrid}>
              <Detail label="Parent Head" value={getParentLabel(selected, byCode)} />
              <Detail label="Department" value={selected.dept_id ? departmentMap.get(selected.dept_id) || "—" : "Institution-wide"} />
              <Detail label="IET Bank" value={selected.bank_account_id ? bankMap.get(selected.bank_account_id)?.name || "—" : "Not linked"} />
              <Detail label="Level" value={String(subheadLevel(selected.code))} />
              <Detail label="Approved Allocation" value={money(selected.approved_allocation)} />
              <Detail label="Reserved" value={money(selected.reserved_amount)} />
              <Detail label="Expenditure" value={money(selected.expenditure)} />
              <Detail label="Available Balance" value={money(selected.balance)} />
              <Detail label="Linked Requests" value={String(selected.request_count || 0)} />
              <Detail label="Last Updated" value={formatDate(selected.updated_at)} />
            </div>
            {selected.allocation_note && <div className={styles.noteBox}><b>Allocation Note</b><p>{selected.allocation_note}</p></div>}
            <div className={styles.modalFooter}><button onClick={() => setSelected(null)}>Close</button>{canManage && <button className={styles.primaryButton} onClick={() => { setSelected(null); openEdit(selected); }}><Pencil size={15} /> Edit Subhead</button>}</div>
          </div>
        </div>
      )}

      {formOpen && (
        <div className={styles.modalBackdrop} onMouseDown={() => !saving && setFormOpen(false)}>
          <div className={styles.formModal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}><div><small>{editId ? "EDIT FINANCE SUBHEAD" : "NEW FINANCE SUBHEAD"}</small><h2>{editId ? "Update Subhead" : "Create New Subhead"}</h2></div><button onClick={() => !saving && setFormOpen(false)}><X size={18} /></button></div>
            <div className={styles.formGrid}>
              <label><span>Subhead Code</span><input value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="e.g. 1001.01" /></label>
              <label><span>Subhead Name</span><input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Subhead name" /></label>
              <label><span>Department</span><select value={formDept} onChange={(e) => setFormDept(e.target.value)}><option value="">Institution-wide</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label><span>Funding Bank</span><select value={formBank} onChange={(e) => setFormBank(e.target.value)}><option value="">Select IET bank</option>{banks.filter((item) => item.is_active !== false).map((item) => <option key={item.id} value={item.id}>{item.code ? `${item.code} — ` : ""}{item.name}</option>)}</select></label>
              <label><span>Approved Allocation (₦)</span><input type="number" min="0" value={formAllocation} onChange={(e) => setFormAllocation(Number(e.target.value || 0))} /></label>
              <label><span>Status</span><select value={formActive ? "active" : "inactive"} onChange={(e) => setFormActive(e.target.value === "active")}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
              <label className={styles.fullField}><span>Allocation Note</span><textarea value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="Purpose or allocation note" rows={3} /></label>
            </div>
            <div className={styles.modalFooter}><button onClick={() => setFormOpen(false)} disabled={saving}>Cancel</button><button className={styles.primaryButton} onClick={saveSubhead} disabled={saving}><Save size={15} /> {saving ? "Saving…" : editId ? "Update Subhead" : "Create Subhead"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon, tone, label, value, note }: { icon: React.ReactNode; tone: "blue" | "green" | "orange" | "purple"; label: string; value: string; note: string }) {
  return <article className={styles.kpi}><div className={`${styles.kpiIcon} ${styles[tone]}`}>{icon}</div><div><span>{label}</span><strong className={styles[`${tone}Text`]}>{value}</strong><small>{note}</small></div></article>;
}

function FilterField({ label, children, grow = false }: { label: string; children: React.ReactNode; grow?: boolean }) {
  return <label className={`${styles.filterField} ${grow ? styles.grow : ""}`}><span>{label}</span>{children}</label>;
}

function QuickAction({ icon, tone, title, note, onClick }: { icon: React.ReactNode; tone: "blue" | "green" | "purple" | "orange"; title: string; note: string; onClick: () => void }) {
  return <button className={styles.quickAction} onClick={onClick}><span className={`${styles.quickIcon} ${styles[tone]}`}>{icon}</span><span><b>{title}</b><small>{note}</small></span><span className={styles.chevron}>›</span></button>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className={styles.detail}><span>{label}</span><strong>{value}</strong></div>;
}
