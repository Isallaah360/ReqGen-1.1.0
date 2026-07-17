"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Account = {
  id: string;
  code: string | null;
  name: string;
  bank_name: string | null;
  account_number: string | null;
  is_active: boolean | null;
  opening_balance: number | null;
  balance: number | null;
  total_income: number | null;
  total_expenditure: number | null;
  balance_last_updated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type LedgerRow = {
  id: string;
  account_id: string;
  transaction_type: "Opening Balance" | "Credit" | "Debit" | "Adjustment";
  amount: number;
  balance_before: number;
  balance_after: number;
  reference_type: string | null;
  reference_no: string | null;
  narration: string | null;
  actor_name: string | null;
  created_at: string;
};

type ProfileMini = { id: string; role: string | null };
type Tab = "overview" | "active" | "inactive" | "form" | "balance" | "ledger";

const roleKey = (v?: string | null) =>
  (v || "").trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, "");

const naira = (v?: number | null) =>
  `₦${Math.round(Number(v || 0)).toLocaleString()}`;

const dateTime = (v?: string | null) => (v ? new Date(v).toLocaleString() : "—");

const mask = (v?: string | null) => {
  const s = (v || "").trim();
  if (!s) return "—";
  return s.length <= 4 ? s : `${"*".repeat(s.length - 4)}${s.slice(-4)}`;
};

const cleanNumber = (v: string) => v.replace(/[^\d]/g, "").slice(0, 20);
const cleanAmount = (v: string) => v.replace(/[^\d.]/g, "");
const accountLabel = (a?: Account | null) =>
  a ? `${a.code ? `${a.code} — ` : ""}${a.name}` : "—";

export default function ManageAccountsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [balanceSaving, setBalanceSaving] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [me, setMe] = useState<ProfileMini | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [search, setSearch] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [active, setActive] = useState(true);

  const [balanceAccountId, setBalanceAccountId] = useState("");
  const [newBalance, setNewBalance] = useState("");
  const [balanceReason, setBalanceReason] = useState("");

  const [ledgerAccountId, setLedgerAccountId] = useState("");

  const canManage = ["admin", "auditor"].includes(roleKey(me?.role));
  const selectedBalanceAccount = accounts.find((a) => a.id === balanceAccountId) || null;
  const selectedLedgerAccount = accounts.find((a) => a.id === ledgerAccountId) || null;

  const loadAccounts = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setMsg(null);

    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      router.push("/login");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id,role")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (profileError) {
      setMsg(`❌ Failed to load profile: ${profileError.message}`);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const p = (profile as ProfileMini | null) || null;
    setMe(p);

    if (!["admin", "auditor"].includes(roleKey(p?.role))) {
      router.push(`/dashboard?updated=${Date.now()}`);
      router.refresh();
      return;
    }

    const { data, error } = await supabase
      .from("iet_accounts")
      .select("id,code,name,bank_name,account_number,is_active,opening_balance,balance,total_income,total_expenditure,balance_last_updated_at,created_at,updated_at")
      .order("name");

    if (error) {
      setAccounts([]);
      setMsg(`❌ Failed to load accounts: ${error.message}`);
    } else {
      setAccounts(
        ((data || []) as Account[]).map((a) => ({
          ...a,
          is_active: a.is_active !== false,
          opening_balance: Number(a.opening_balance || 0),
          balance: Number(a.balance || 0),
          total_income: Number(a.total_income || 0),
          total_expenditure: Number(a.total_expenditure || 0),
        }))
      );
    }

    setLoading(false);
    setRefreshing(false);
  }, [router]);

  const loadLedger = useCallback(async (accountId: string) => {
    if (!accountId) {
      setLedger([]);
      return;
    }

    setLedgerLoading(true);
    const { data, error } = await supabase
      .from("iet_account_transactions")
      .select("id,account_id,transaction_type,amount,balance_before,balance_after,reference_type,reference_no,narration,actor_name,created_at")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });

    if (error) {
      setLedger([]);
      setMsg(`❌ Failed to load ledger: ${error.message}`);
    } else {
      setLedger((data || []) as LedgerRow[]);
    }
    setLedgerLoading(false);
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (tab === "ledger" && ledgerAccountId) loadLedger(ledgerAccountId);
  }, [tab, ledgerAccountId, loadLedger]);

  const stats = useMemo(() => ({
    opening: accounts.reduce((s, a) => s + Number(a.opening_balance || 0), 0),
    balance: accounts.reduce((s, a) => s + Number(a.balance || 0), 0),
    income: accounts.reduce((s, a) => s + Number(a.total_income || 0), 0),
    expenditure: accounts.reduce((s, a) => s + Number(a.total_expenditure || 0), 0),
    active: accounts.filter((a) => a.is_active !== false).length,
    inactive: accounts.filter((a) => a.is_active === false).length,
  }), [accounts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((a) => {
      if (tab === "active" && a.is_active === false) return false;
      if (tab === "inactive" && a.is_active !== false) return false;
      if (!q) return true;
      return [a.code, a.name, a.bank_name, a.account_number, a.balance, a.total_income, a.total_expenditure]
        .join(" ").toLowerCase().includes(q);
    });
  }, [accounts, search, tab]);

  function resetForm() {
    setEditId(null);
    setCode("");
    setName("");
    setBankName("");
    setAccountNumber("");
    setActive(true);
  }

  function startEdit(a: Account) {
    setEditId(a.id);
    setCode(a.code || "");
    setName(a.name);
    setBankName(a.bank_name || "");
    setAccountNumber(a.account_number || "");
    setActive(a.is_active !== false);
    setTab("form");
    setMsg(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startBalance(a: Account) {
    setBalanceAccountId(a.id);
    setNewBalance(String(Number(a.balance || 0)));
    setBalanceReason("");
    setTab("balance");
    setMsg(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startLedger(a: Account) {
    setLedgerAccountId(a.id);
    setTab("ledger");
    setMsg(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveAccount() {
    if (!canManage) return setMsg("❌ Not allowed.");

    const payload = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      bank_name: bankName.trim(),
      account_number: cleanNumber(accountNumber),
      is_active: active,
    };

    if (payload.code.length < 2) return setMsg("❌ Account code is required.");
    if (payload.name.length < 2) return setMsg("❌ Account name is required.");
    if (payload.bank_name.length < 2) return setMsg("❌ Bank name is required.");
    if (payload.account_number.length < 6) return setMsg("❌ Enter a valid account number.");

    setSaving(true);
    setMsg(null);

    const result = editId
      ? await supabase.from("iet_accounts").update(payload).eq("id", editId)
      : await supabase.from("iet_accounts").insert(payload);

    if (result.error) {
      setMsg(`❌ Save failed: ${result.error.message}`);
    } else {
      setMsg(editId ? "✅ Account updated." : "✅ Account created. Set its opening balance next.");
      resetForm();
      setTab(active ? "active" : "inactive");
      await loadAccounts(true);
      router.refresh();
    }
    setSaving(false);
  }

  async function saveBalance() {
    if (!canManage) return setMsg("❌ Not allowed.");
    if (!balanceAccountId) return setMsg("❌ Select an account.");

    const amount = Number(newBalance || 0);
    if (!Number.isFinite(amount) || amount < 0) return setMsg("❌ Enter a valid non-negative balance.");
    if (balanceReason.trim().length < 5) return setMsg("❌ Enter a clear reason.");

    const ok = confirm(
      `Update "${accountLabel(selectedBalanceAccount)}" from ${naira(selectedBalanceAccount?.balance)} to ${naira(amount)}?\n\nA permanent ledger entry will be created.`
    );
    if (!ok) return;

    setBalanceSaving(true);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.rpc("set_iet_account_balance", {
      p_account_id: balanceAccountId,
      p_new_balance: amount,
      p_reason: balanceReason.trim(),
      p_actor_id: auth.user?.id || null,
    });

    if (error) {
      setMsg(`❌ Balance update failed: ${error.message}`);
    } else {
      const id = balanceAccountId;
      setMsg("✅ Balance updated and ledger entry recorded.");
      await loadAccounts(true);
      setLedgerAccountId(id);
      setTab("ledger");
      await loadLedger(id);
      router.refresh();
    }
    setBalanceSaving(false);
  }

  async function toggleActive(a: Account) {
    if (!canManage) return;
    const next = a.is_active === false;
    if (!confirm(`Set "${a.name}" to ${next ? "Active" : "Inactive"}?`)) return;

    setSaving(true);
    const { error } = await supabase.from("iet_accounts").update({ is_active: next }).eq("id", a.id);
    setMsg(error ? `❌ Status update failed: ${error.message}` : next ? "✅ Account activated." : "✅ Account deactivated.");
    await loadAccounts(true);
    setSaving(false);
  }

  async function deleteOrDeactivate(a: Account) {
    const hasActivity =
      Number(a.opening_balance || 0) > 0 ||
      Number(a.total_income || 0) > 0 ||
      Number(a.total_expenditure || 0) > 0;

    if (hasActivity) {
      if (confirm("This account has financial activity. Deactivate it instead?")) await toggleActive(a);
      return;
    }

    if (!confirm(`Delete unused account "${a.name}"?`)) return;

    setSaving(true);
    const { error } = await supabase.from("iet_accounts").delete().eq("id", a.id);

    if (!error) {
      setMsg("✅ Account deleted.");
    } else {
      const { error: deactivationError } = await supabase
        .from("iet_accounts")
        .update({ is_active: false })
        .eq("id", a.id);

      setMsg(deactivationError
        ? `❌ Delete failed: ${error.message}`
        : "✅ Linked account was deactivated instead.");
    }

    await loadAccounts(true);
    setSaving(false);
  }

  if (loading) {
    return <main className="min-h-screen bg-slate-50 p-10 text-slate-600">Loading IET Bank Accounts...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-7xl py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">Finance • IET Bank Accounts</h1>
            <p className="mt-2 text-sm text-slate-600">Real balances, income, expenditure and permanent transaction ledgers.</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">Role: {me?.role || "—"}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => loadAccounts(true)} disabled={refreshing || saving || balanceSaving}>
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
            <Button primary onClick={() => { resetForm(); setTab("form"); }}>Add Account</Button>
            <Button onClick={() => router.push("/finance/manage-accounts/assign")}>Assign to Officer</Button>
            <Button onClick={() => router.push("/finance/subheads")}>Subheads</Button>
            <Button onClick={() => router.push("/finance/audit")}>Audit</Button>
            <Button onClick={() => router.push("/finance")}>Back to Finance</Button>
          </div>
        </div>

        {msg && <div className="mt-4 rounded-2xl border bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm">{msg}</div>}

        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-900">
          Phase 18B uses real account balances. Manual Payment Vouchers now debit the selected IET account automatically.
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat title="Current Balance" value={naira(stats.balance)} tone="emerald" />
          <Stat title="Opening Balance" value={naira(stats.opening)} tone="blue" />
          <Stat title="Total Income" value={naira(stats.income)} tone="purple" />
          <Stat title="Total Expenditure" value={naira(stats.expenditure)} tone="red" />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Stat title="Active Accounts" value={String(stats.active)} tone="emerald" />
          <Stat title="Inactive Accounts" value={String(stats.inactive)} tone="amber" />
        </div>

        <div className="mt-6 flex flex-wrap gap-2 rounded-3xl border bg-white p-2 shadow-sm">
          {(["overview", "active", "inactive", "form", "balance", "ledger"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-2xl px-4 py-3 text-sm font-bold ${tab === t ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100"}`}>
              {t === "form" ? (editId ? "Edit Account" : "Add Account") :
                t === "balance" ? "Set Balance" :
                  t === "ledger" ? "Account Ledger" :
                    t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {["overview", "active", "inactive"].includes(tab) && (
          <>
            <div className="mt-6 rounded-3xl border bg-white p-5 shadow-sm">
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search accounts..."
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" />
            </div>

            <div className="mt-6 grid gap-4">
              {filtered.map((a) => (
                <div key={a.id} className="rounded-3xl border bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-extrabold text-slate-900">{a.code || "—"} — {a.name}</div>
                      <div className="mt-1 text-sm text-slate-600">{a.bank_name || "—"} • {mask(a.account_number)}</div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${a.is_active !== false ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                      {a.is_active !== false ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Metric title="Opening" value={naira(a.opening_balance)} />
                    <Metric title="Income" value={naira(a.total_income)} />
                    <Metric title="Expenditure" value={naira(a.total_expenditure)} />
                    <Metric title="Current Balance" value={naira(a.balance)} />
                  </div>

                  <div className="mt-3 text-xs text-slate-500">Last balance update: {dateTime(a.balance_last_updated_at || a.updated_at)}</div>

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <Button primary onClick={() => startBalance(a)}>Balance</Button>
                    <Button onClick={() => startLedger(a)}>Ledger</Button>
                    <Button onClick={() => startEdit(a)}>Edit</Button>
                    <Button onClick={() => toggleActive(a)}>{a.is_active === false ? "Activate" : "Deactivate"}</Button>
                    <button onClick={() => deleteOrDeactivate(a)} disabled={saving}
                      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                      {Number(a.opening_balance || 0) > 0 || Number(a.total_income || 0) > 0 || Number(a.total_expenditure || 0) > 0 ? "Deactivate" : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && <div className="rounded-3xl border bg-white p-6 text-sm text-slate-600">No accounts found.</div>}
            </div>
          </>
        )}

        {tab === "form" && (
          <Panel title={editId ? "Edit IET Bank Account" : "Add IET Bank Account"}>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Account Code" value={code} onChange={setCode} placeholder="GENADMIN" />
              <Input label="Account Name" value={name} onChange={setName} placeholder="General Administration Account" />
              <Input label="Bank Name" value={bankName} onChange={setBankName} placeholder="Jaiz Bank" />
              <Input label="Account Number" value={accountNumber} onChange={(v) => setAccountNumber(cleanNumber(v))} placeholder="0123456789" />
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
            </label>
            <button onClick={saveAccount} disabled={saving} className="mt-5 w-full rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-60">
              {saving ? "Saving..." : editId ? "Update Account" : "Create Account"}
            </button>
          </Panel>
        )}

        {tab === "balance" && (
          <Panel title="Set Opening or Current Balance">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold text-slate-800">
                IET Bank Account
                <select value={balanceAccountId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const a = accounts.find((x) => x.id === id);
                    setBalanceAccountId(id);
                    setNewBalance(a ? String(Number(a.balance || 0)) : "");
                    setBalanceReason("");
                  }}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3">
                  <option value="">-- Select Account --</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{accountLabel(a)} • {naira(a.balance)}</option>)}
                </select>
              </label>
              <Input label="New Balance" value={newBalance} onChange={(v) => setNewBalance(cleanAmount(v))} placeholder="50000000" />
            </div>

            <label className="mt-4 block text-sm font-semibold text-slate-800">
              Reason
              <textarea value={balanceReason} onChange={(e) => setBalanceReason(e.target.value)}
                placeholder="Opening balance confirmed from bank statement."
                className="mt-1 h-28 w-full rounded-2xl border border-slate-200 px-4 py-3" />
            </label>

            {selectedBalanceAccount && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric title="Opening" value={naira(selectedBalanceAccount.opening_balance)} />
                <Metric title="Current" value={naira(selectedBalanceAccount.balance)} />
                <Metric title="Income" value={naira(selectedBalanceAccount.total_income)} />
                <Metric title="Expenditure" value={naira(selectedBalanceAccount.total_expenditure)} />
              </div>
            )}

            <button onClick={saveBalance} disabled={balanceSaving}
              className="mt-5 w-full rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-60">
              {balanceSaving ? "Updating..." : "Update Account Balance"}
            </button>
          </Panel>
        )}

        {tab === "ledger" && (
          <Panel title="IET Account Transaction Ledger">
            <select value={ledgerAccountId} onChange={(e) => setLedgerAccountId(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3">
              <option value="">-- Select Account --</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{accountLabel(a)} • {naira(a.balance)}</option>)}
            </select>

            {selectedLedgerAccount && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric title="Account" value={accountLabel(selectedLedgerAccount)} />
                <Metric title="Balance" value={naira(selectedLedgerAccount.balance)} />
                <Metric title="Income" value={naira(selectedLedgerAccount.total_income)} />
                <Metric title="Expenditure" value={naira(selectedLedgerAccount.total_expenditure)} />
              </div>
            )}

            <div className="mt-6 grid gap-3">
              {ledgerLoading && <div className="text-sm text-slate-600">Loading ledger...</div>}
              {!ledgerLoading && ledgerAccountId && ledger.length === 0 && <div className="text-sm text-slate-600">No ledger entries found.</div>}
              {ledger.map((r) => (
                <div key={r.id} className="rounded-2xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${r.transaction_type === "Debit" ? "bg-red-50 text-red-700" :
                          r.transaction_type === "Credit" ? "bg-emerald-50 text-emerald-700" :
                            r.transaction_type === "Opening Balance" ? "bg-blue-50 text-blue-700" :
                              "bg-amber-50 text-amber-700"
                        }`}>{r.transaction_type}</span>
                      <div className="mt-2 text-xs text-slate-500">{dateTime(r.created_at)}</div>
                    </div>
                    <div className="text-lg font-black">{naira(r.amount)}</div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Metric title="Before" value={naira(r.balance_before)} />
                    <Metric title="After" value={naira(r.balance_after)} />
                  </div>
                  <div className="mt-3 text-sm text-slate-700">{r.reference_type || "—"} {r.reference_no ? `• ${r.reference_no}` : ""}</div>
                  <div className="mt-1 text-sm text-slate-600">{r.narration || "—"}</div>
                  <div className="mt-2 text-xs text-slate-500">Actor: {r.actor_name || "System"}</div>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
    <h2 className="text-lg font-bold text-slate-900">{title}</h2>
    <div className="mt-5">{children}</div>
  </div>;
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <label className="text-sm font-semibold text-slate-800">{label}
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" />
  </label>;
}

function Button({ children, onClick, disabled, primary }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return <button onClick={onClick} disabled={disabled}
    className={`rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60 ${primary ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-slate-200 bg-white text-slate-900 hover:bg-slate-100"
      }`}>{children}</button>;
}

function Stat({ title, value, tone }: { title: string; value: string; tone: "blue" | "emerald" | "amber" | "purple" | "red" }) {
  const cls = tone === "emerald" ? "bg-emerald-50 text-emerald-700" :
    tone === "amber" ? "bg-amber-50 text-amber-700" :
      tone === "purple" ? "bg-purple-50 text-purple-700" :
        tone === "red" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700";
  return <div className="rounded-3xl border bg-white p-5 shadow-sm">
    <div className="text-sm font-semibold text-slate-500">{title}</div>
    <div className={`mt-3 inline-flex rounded-2xl px-3 py-2 text-xl font-extrabold ${cls}`}>{value}</div>
  </div>;
}

function Metric({ title, value }: { title: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-3">
    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
    <div className="mt-2 text-sm font-extrabold text-slate-900">{value}</div>
  </div>;
}
