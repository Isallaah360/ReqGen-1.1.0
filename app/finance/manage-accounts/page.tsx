"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Eye,
  FileDown,
  Link2,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserRoundCog,
  WalletCards,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import styles from "./bank-accounts.module.css";

type Account = {
  id: string;
  code: string | null;
  name: string;
  bank_name: string | null;
  is_active: boolean | null;
  updated_at: string | null;
  total_fund: number | null;
  allocated_amount: number | null;
  reserved_amount: number | null;
  expenditure: number | null;
  unallocated_balance: number | null;
  available_balance: number | null;
  last_recalculated_at: string | null;
};

type ProfileMini = { id: string; role: string | null };
type Assignment = { account_id: string | null };
type ModalMode = "create" | "edit" | "fund" | "view" | null;

const STANDARD_IET_ACCOUNTS = [
  { code: "IET001", name: "Donations", bank_name: "Zenith Bank" },
  { code: "IET002", name: "Admin", bank_name: "Zenith Bank" },
  { code: "IET003", name: "Welfare", bank_name: "Zenith Bank" },
  { code: "IET004", name: "USD", bank_name: "Zenith Bank" },
  { code: "IET005", name: "GBP", bank_name: "Zenith Bank" },
  { code: "IET006", name: "Zakat & Donations", bank_name: "GT-Bank" },
  { code: "IET007", name: "Schools & Investment", bank_name: "GT-Bank" },
  { code: "IET008", name: "Project", bank_name: "GT-Bank" },
  { code: "IET009", name: "USD", bank_name: "GT-Bank" },
  { code: "IET010", name: "GBP", bank_name: "GT-Bank" },
  { code: "IET011", name: "EURO", bank_name: "GT-Bank" },
  { code: "IET012", name: "DIN", bank_name: "UBA Bank" },
  { code: "IET013", name: "Programme", bank_name: "UBA Bank" },
  { code: "IET014", name: "ALLI", bank_name: "Zenith Bank" },
  { code: "IET015", name: "ALLI", bank_name: "Lotus Bank" },
  { code: "IET016", name: "ALLI MAUK", bank_name: "Lotus Bank" },
  { code: "IET017", name: "POS", bank_name: "Lotus Bank" },
  { code: "IET018", name: "Lotus Account", bank_name: "Lotus Bank" },
  { code: "IET019", name: "Jaiz Account", bank_name: "Jaiz Bank" },
  { code: "IET020", name: "Providus Account", bank_name: "Providus Bank" },
] as const;

function roleKey(role: string | null | undefined) {
  return (role || "").trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, "");
}

function nextIetCode(accounts: Pick<Account, "code">[]) {
  const max = accounts.reduce((highest, account) => {
    const match = /^IET(\d{3,})$/i.exec((account.code || "").trim());
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `IET${String(max + 1).padStart(3, "0")}`;
}

function naira(value: number | null | undefined) {
  return `₦${Math.round(Number(value || 0)).toLocaleString()}`;
}

export default function ManageAccountsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [me, setMe] = useState<ProfileMini | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [bankFilter, setBankFilter] = useState("all");
  const [modal, setModal] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<Account | null>(null);
  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [active, setActive] = useState(true);
  const [fundValue, setFundValue] = useState("");
  const [fundNote, setFundNote] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const canManage = ["admin", "auditor"].includes(roleKey(me?.role));

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
      .select("id,role")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (profileError) {
      setMessage(profileError.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const p = profile as ProfileMini | null;
    setMe(p);
    if (!["admin", "auditor"].includes(roleKey(p?.role))) {
      router.push("/dashboard");
      return;
    }

    const { data: existingCodes } = await supabase.from("iet_accounts").select("code");
    const existing = new Set((existingCodes || []).map((r: { code?: string | null }) => (r.code || "").toUpperCase()));
    const missing = STANDARD_IET_ACCOUNTS.filter((a) => !existing.has(a.code));
    if (missing.length) {
      const { error } = await supabase.from("iet_accounts").insert(missing.map((a) => ({ ...a, is_active: true })));
      if (error) console.warn("IET account sync:", error.message);
    }

    await supabase.rpc("reqgen_recalculate_all_iet_accounts");

    const [accountsRes, assignmentsRes] = await Promise.all([
      supabase
        .from("iet_accounts")
        .select("id,code,name,bank_name,is_active,updated_at,total_fund,allocated_amount,reserved_amount,expenditure,unallocated_balance,available_balance,last_recalculated_at")
        .order("code", { ascending: true }),
      supabase.from("iet_account_officer_assignments").select("account_id"),
    ]);

    if (accountsRes.error) {
      setMessage(accountsRes.error.message);
      setAccounts([]);
    } else {
      setAccounts(((accountsRes.data || []) as Account[]).map((a) => ({
        ...a,
        is_active: a.is_active !== false,
        total_fund: Number(a.total_fund || 0),
        allocated_amount: Number(a.allocated_amount || 0),
        reserved_amount: Number(a.reserved_amount || 0),
        expenditure: Number(a.expenditure || 0),
        unallocated_balance: Number(a.unallocated_balance || 0),
        available_balance: Number(a.available_balance || 0),
      })));
    }
    setAssignments((assignmentsRes.data || []) as Assignment[]);
    setLoading(false);
    setRefreshing(false);
  }, [router]);

  useEffect(() => {
    queueMicrotask(() => void loadAll());
  }, [loadAll]);

  const assignmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    assignments.forEach((a) => {
      if (a.account_id) counts.set(a.account_id, (counts.get(a.account_id) || 0) + 1);
    });
    return counts;
  }, [assignments]);

  const banks = useMemo(() => Array.from(new Set(accounts.map((a) => a.bank_name).filter(Boolean) as string[])).sort(), [accounts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((a) => {
      if (statusFilter === "active" && a.is_active === false) return false;
      if (statusFilter === "inactive" && a.is_active !== false) return false;
      if (bankFilter !== "all" && a.bank_name !== bankFilter) return false;
      if (!q) return true;
      return [a.code, a.name, a.bank_name].join(" ").toLowerCase().includes(q);
    });
  }, [accounts, bankFilter, search, statusFilter]);

  useEffect(() => { queueMicrotask(() => setPage(1)); }, [search, statusFilter, bankFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const activeCount = accounts.filter((a) => a.is_active !== false).length;
  const inactiveCount = accounts.length - activeCount;
  const linkedAccounts = accounts.filter((a) => (assignmentCounts.get(a.id) || 0) > 0).length;
  const bankMix = useMemo(() => {
    const map = new Map<string, { count: number; balance: number }>();
    accounts.forEach((a) => {
      const bank = a.bank_name || "Unspecified";
      const current = map.get(bank) || { count: 0, balance: 0 };
      current.count += 1;
      current.balance += Number(a.available_balance || 0);
      map.set(bank, current);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].balance - a[1].balance || a[0].localeCompare(b[0]));
  }, [accounts]);
  const maxBankBalance = Math.max(...bankMix.map(([, value]) => value.balance), 0);

  function openCreate() {
    setSelected(null);
    setName("");
    setBankName("");
    setActive(true);
    setModal("create");
  }

  function openEdit(account: Account) {
    setSelected(account);
    setName(account.name);
    setBankName(account.bank_name || "");
    setActive(account.is_active !== false);
    setModal("edit");
  }

  function openFund(account: Account) {
    setSelected(account);
    setFundValue(String(Number(account.total_fund || 0) || ""));
    setFundNote("");
    setModal("fund");
  }

  async function saveAccount() {
    if (!canManage) return;
    if (name.trim().length < 2 || bankName.trim().length < 2) {
      setMessage("Account name and bank name are required.");
      return;
    }
    setSaving(true);
    const payload = { name: name.trim(), bank_name: bankName.trim(), is_active: active };
    let error = null;
    if (modal === "edit" && selected) {
      ({ error } = await supabase.from("iet_accounts").update(payload).eq("id", selected.id));
    } else {
      const code = nextIetCode(accounts);
      ({ error } = await supabase.from("iet_accounts").insert({ ...payload, code }));
      if (error?.code === "23505") {
        const { data } = await supabase.from("iet_accounts").select("code");
        ({ error } = await supabase.from("iet_accounts").insert({ ...payload, code: nextIetCode((data || []) as Pick<Account, "code">[]) }));
      }
    }
    setSaving(false);
    if (error) {
      setMessage(`Save failed: ${error.message}`);
      return;
    }
    setModal(null);
    setMessage(modal === "edit" ? "Account updated successfully." : "Bank account added successfully.");
    await loadAll(true);
  }

  async function saveFund() {
    if (!selected) return;
    const amount = Number(fundValue || 0);
    if (!Number.isFinite(amount) || amount < 0) {
      setMessage("Enter a valid non-negative total fund.");
      return;
    }
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.rpc("reqgen_set_iet_account_fund", {
      p_bank_account_id: selected.id,
      p_total_fund: amount,
      p_actor_id: auth.user?.id || null,
      p_note: fundNote.trim() || "IET bank total fund updated from Bank Accounts page.",
    });
    setSaving(false);
    if (error) {
      setMessage(`Fund update failed: ${error.message}`);
      return;
    }
    setModal(null);
    setMessage("Bank total fund updated successfully.");
    await loadAll(true);
  }

  async function toggleActive(account: Account) {
    if (!canManage) return;
    const { error } = await supabase.from("iet_accounts").update({ is_active: account.is_active === false }).eq("id", account.id);
    if (error) setMessage(error.message);
    else await loadAll(true);
  }

  function exportCsv() {
    const header = ["Code", "Account Name", "Bank Name", "Status", "Assigned Officers", "Total Fund", "Available Balance"];
    const rows = filtered.map((a) => [
      a.code || "",
      a.name,
      a.bank_name || "",
      a.is_active === false ? "Inactive" : "Active",
      String(assignmentCounts.get(a.id) || 0),
      String(a.total_fund || 0),
      String(a.available_balance || 0),
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "iet-bank-accounts.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <div className={styles.loading}>Loading IET Bank Accounts…</div>;
  }

  return (
    <main className={styles.page}>
      <section className={styles.headingRow}>
        <div>
          <h1>IET Bank Accounts</h1>
          <p>Manage and view approved IET bank names, account labels, funding and officer assignments.</p>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate} disabled={!canManage}>
          <Plus size={17} /> Add New Bank Account
        </button>
      </section>

      {message && <div className={styles.message}>{message}</div>}

      <section className={styles.kpiGrid}>
        <Kpi icon={<Building2 />} tone="blue" label="Total Bank Accounts" value={String(accounts.length)} meta="All Accounts" />
        <Kpi icon={<ShieldCheck />} tone="green" label="Active Accounts" value={String(activeCount)} meta={`${accounts.length ? Math.round((activeCount / accounts.length) * 100) : 0}% of total accounts`} />
        <Kpi icon={<WalletCards />} tone="orange" label="Inactive Accounts" value={String(inactiveCount)} meta={`${accounts.length ? Math.round((inactiveCount / accounts.length) * 100) : 0}% of total accounts`} />
        <Kpi icon={<Link2 />} tone="purple" label="Linked Accounts" value={String(linkedAccounts)} meta="Assigned to finance officers" />
      </section>

      <section className={styles.filterCard}>
        <label className={styles.searchField}>
          <span>Search</span>
          <div><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by bank name, code or account label…" /></div>
        </label>
        <label><span>Account Status</span><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">All Statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        <label><span>Bank</span><select value={bankFilter} onChange={(e) => setBankFilter(e.target.value)}><option value="all">All Banks</option>{banks.map((bank) => <option key={bank} value={bank}>{bank}</option>)}</select></label>
        <button className={styles.filterBtn} onClick={() => { setSearch(""); setStatusFilter("all"); setBankFilter("all"); }}><SlidersHorizontal size={16} /> Reset Filters</button>
      </section>

      <section className={styles.contentGrid}>
        <div className={styles.tableCard}>
          <div className={styles.cardHeader}><h2>Bank Accounts ({filtered.length})</h2><button onClick={() => loadAll(true)} className={styles.iconTextBtn}><RefreshCw size={15} className={refreshing ? styles.spin : ""} /> Refresh</button></div>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>#</th><th>Account</th><th>Bank Name</th><th>Code</th><th>Status</th><th>Assigned Officers</th><th>Available</th><th>Actions</th></tr></thead>
              <tbody>
                {visible.length === 0 ? <tr><td colSpan={8} className={styles.empty}>No bank accounts match the current filters.</td></tr> : visible.map((account, index) => (
                  <tr key={account.id}>
                    <td>{(page - 1) * pageSize + index + 1}</td>
                    <td><strong>{account.name}</strong><small>Total fund: {naira(account.total_fund)}</small></td>
                    <td>{account.bank_name || "—"}</td>
                    <td><span className={styles.codeBadge}>{account.code || "—"}</span></td>
                    <td><span className={account.is_active === false ? styles.inactiveBadge : styles.activeBadge}>{account.is_active === false ? "Inactive" : "Active"}</span></td>
                    <td><span className={styles.linkCount}>{assignmentCounts.get(account.id) || 0}</span></td>
                    <td className={styles.money}>{naira(account.available_balance)}</td>
                    <td>
                      <div className={styles.actions}>
                        <button title="View" onClick={() => { setSelected(account); setModal("view"); }}><Eye size={15} /></button>
                        <details className={styles.moreMenu}><summary title="More actions"><MoreVertical size={15} /></summary><div><button onClick={() => openEdit(account)}>Edit Account</button><button onClick={() => openFund(account)}>Set Total Fund</button><button onClick={() => router.push("/finance/manage-accounts/assign")}>Assign Officer</button><button onClick={() => toggleActive(account)}>{account.is_active === false ? "Activate" : "Deactivate"}</button></div></details>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.pagination}><span>Showing {(page - 1) * pageSize + (visible.length ? 1 : 0)} to {(page - 1) * pageSize + visible.length} of {filtered.length} accounts</span><div><button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>{Array.from({ length: pageCount }, (_, i) => i + 1).slice(0, 5).map((n) => <button key={n} className={page === n ? styles.currentPage : ""} onClick={() => setPage(n)}>{n}</button>)}<button disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>›</button></div></div>
        </div>

        <aside className={styles.sideColumn}>
          <section className={styles.sideCard}>
            <h2>Account Summary</h2>
            <div className={styles.bankDistribution}>{bankMix.map(([bank, value]) => <div key={bank} className={styles.bankDistributionRow}><div><strong>{bank}</strong><span>{value.count} account{value.count === 1 ? "" : "s"} · {naira(value.balance)} available</span></div><div className={styles.bankTrack}><i style={{ width: `${maxBankBalance > 0 ? Math.max(2, (value.balance / maxBankBalance) * 100) : 0}%` }} /></div></div>)}{bankMix.length === 0 && <p className={styles.empty}>No bank records available.</p>}</div>
          </section>

          <section className={styles.sideCard}>
            <h2>Quick Actions</h2>
            <Action icon={<Plus />} title="Add New Bank Account" desc="Register a new approved bank account" onClick={openCreate} />
            <Action icon={<UserRoundCog />} title="Manage Officer Assignments" desc="Connect accounts to finance officers" onClick={() => router.push("/finance/manage-accounts/assign")} />
            <Action icon={<CircleDollarSign />} title="Recalculate Balances" desc="Refresh finance balances and totals" onClick={() => loadAll(true)} />
            <Action icon={<FileDown />} title="Export Accounts List" desc="Download the filtered account register" onClick={exportCsv} />
          </section>

          <section className={styles.noteCard}>
            <div><CheckCircle2 size={17} /><strong>Important Note</strong></div>
            <p>For security reasons, bank account numbers are not stored in ReqGen.</p>
            <p>Only approved bank names, account labels, generated codes and finance balances are maintained.</p>
          </section>
        </aside>
      </section>

      {modal && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <section className={styles.modal} role="dialog" aria-modal="true">
            <button className={styles.modalClose} onClick={() => setModal(null)}><X size={18} /></button>
            {modal === "view" && selected && <><h2>{selected.name}</h2><p>{selected.bank_name || "Bank not specified"} · {selected.code || "No code"}</p><div className={styles.detailGrid}><Detail label="Status" value={selected.is_active === false ? "Inactive" : "Active"} /><Detail label="Assigned Officers" value={String(assignmentCounts.get(selected.id) || 0)} /><Detail label="Total Fund" value={naira(selected.total_fund)} /><Detail label="Allocated" value={naira(selected.allocated_amount)} /><Detail label="Reserved" value={naira(selected.reserved_amount)} /><Detail label="Expenditure" value={naira(selected.expenditure)} /><Detail label="Available Balance" value={naira(selected.available_balance)} /><Detail label="Account Number" value="Not stored" /></div><div className={styles.modalActions}><button className={styles.secondaryBtn} onClick={() => openFund(selected)}>Set Fund</button><button className={styles.primaryBtn} onClick={() => openEdit(selected)}>Edit Account</button></div></>}
            {(modal === "create" || modal === "edit") && <><h2>{modal === "edit" ? "Edit Bank Account" : "Add New Bank Account"}</h2><p>Account numbers are intentionally not collected or stored.</p><div className={styles.formGrid}><label><span>Account Name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Donations" /></label><label><span>Bank Name</span><input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Zenith Bank" /></label><label className={styles.checkLabel}><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active account</label></div><div className={styles.modalActions}><button className={styles.secondaryBtn} onClick={() => setModal(null)}>Cancel</button><button className={styles.primaryBtn} onClick={saveAccount} disabled={saving}>{saving ? "Saving…" : "Save Account"}</button></div></>}
            {modal === "fund" && selected && <><h2>Set Bank Total Fund</h2><p>{selected.code} · {selected.name} · Current total: {naira(selected.total_fund)}</p><div className={styles.formGrid}><label><span>Total Fund (₦)</span><input type="number" min="0" value={fundValue} onChange={(e) => setFundValue(e.target.value)} /></label><label><span>Ledger Note</span><textarea value={fundNote} onChange={(e) => setFundNote(e.target.value)} placeholder="Optional note for the finance ledger" /></label></div><div className={styles.modalActions}><button className={styles.secondaryBtn} onClick={() => setModal(null)}>Cancel</button><button className={styles.primaryBtn} onClick={saveFund} disabled={saving}>{saving ? "Saving…" : "Update Fund"}</button></div></>}
          </section>
        </div>
      )}
    </main>
  );
}

function Kpi({ icon, tone, label, value, meta }: { icon: React.ReactNode; tone: string; label: string; value: string; meta: string }) {
  return <article className={styles.kpi}><div className={styles.kpiIcon} data-tone={tone}>{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{meta}</small></div></article>;
}

function Action({ icon, title, desc, onClick }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return <button className={styles.quickAction} onClick={onClick}><span>{icon}</span><div><strong>{title}</strong><small>{desc}</small></div></button>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}
