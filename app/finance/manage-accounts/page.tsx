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
  updated_at: string | null;
};

type ProfileMini = {
  id: string;
  role: string | null;
};

type TabKey = "overview" | "active" | "inactive" | "form";

function roleKey(role: string | null | undefined) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function shortDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

function maskAccountNumber(value: string | null | undefined) {
  const raw = (value || "").trim();

  if (!raw) return "—";
  if (raw.length <= 4) return raw;

  return `${"*".repeat(Math.max(raw.length - 4, 0))}${raw.slice(-4)}`;
}

function cleanAccountNumber(value: string) {
  return value.replace(/[^\d]/g, "").slice(0, 20);
}

export default function ManageAccountsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [me, setMe] = useState<ProfileMini | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [acctNo, setAcctNo] = useState("");
  const [active, setActive] = useState(true);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [search, setSearch] = useState("");

  const rk = roleKey(me?.role);
  const canManage = rk === "admin" || rk === "auditor";

  const loadAll = useCallback(
    async (options?: { silent?: boolean }) => {
      if (options?.silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMsg(null);

      const { data: auth } = await supabase.auth.getUser();

      if (!auth.user) {
        router.push("/login");
        return null;
      }

      const { data: prof, error: profileErr } = await supabase
        .from("profiles")
        .select("id,role")
        .eq("id", auth.user.id)
        .maybeSingle();

      if (profileErr) {
        setMsg("Failed to load profile: " + profileErr.message);
        setLoading(false);
        setRefreshing(false);
        return null;
      }

      const myProfile = (prof as ProfileMini | null) || null;
      setMe(myProfile);

      const role = roleKey(myProfile?.role);

      if (!(role === "admin" || role === "auditor")) {
        router.push(`/dashboard?updated=${Date.now()}`);
        router.refresh();
        return null;
      }

      const { data, error } = await supabase
        .from("iet_accounts")
        .select("id,code,name,bank_name,account_number,is_active,updated_at")
        .order("updated_at", { ascending: false });

      if (error) {
        setMsg("Failed to load accounts: " + error.message);
        setAccounts([]);
        setLoading(false);
        setRefreshing(false);
        return null;
      }

      const freshAccounts = ((data || []) as Account[]).map((a) => ({
        ...a,
        is_active: a.is_active !== false,
      }));

      setAccounts(freshAccounts);
      setLoading(false);
      setRefreshing(false);

      return freshAccounts;
    },
    [router]
  );

  useEffect(() => {
    loadAll();

    const refreshOnFocus = () => {
      loadAll({ silent: true });
    };

    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") {
        loadAll({ silent: true });
      }
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisible);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, [loadAll]);

  const stats = useMemo(() => {
    const total = accounts.length;
    const activeCount = accounts.filter((a) => a.is_active !== false).length;
    const inactiveCount = accounts.filter((a) => a.is_active === false).length;
    const bankCount = new Set(
      accounts
        .map((a) => (a.bank_name || "").trim().toLowerCase())
        .filter(Boolean)
    ).size;

    return {
      total,
      activeCount,
      inactiveCount,
      bankCount,
    };
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const s = search.trim().toLowerCase();

    return accounts.filter((a) => {
      if (activeTab === "active" && a.is_active === false) return false;
      if (activeTab === "inactive" && a.is_active !== false) return false;

      if (!s) return true;

      const haystack = [
        a.code,
        a.name,
        a.bank_name,
        a.account_number,
        a.is_active === false ? "inactive" : "active",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(s);
    });
  }, [accounts, search, activeTab]);

  function resetForm() {
    setEditId(null);
    setCode("");
    setName("");
    setBankName("");
    setAcctNo("");
    setActive(true);
  }

  function startCreate() {
    resetForm();
    setActiveTab("form");
  }

  function startEdit(account: Account) {
    setEditId(account.id);
    setCode(account.code || "");
    setName(account.name || "");
    setBankName(account.bank_name || "");
    setAcctNo(account.account_number || "");
    setActive(account.is_active !== false);
    setMsg(null);
    setActiveTab("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveAccount() {
    if (!canManage) {
      setMsg("Not allowed.");
      return;
    }

    const c = code.trim().toUpperCase();
    const n = name.trim();
    const b = bankName.trim();
    const a = cleanAccountNumber(acctNo);

    if (!c || c.length < 2) {
      setMsg("❌ Code is required, for example GENADMIN.");
      return;
    }

    if (!n || n.length < 2) {
      setMsg("❌ Account name is required.");
      return;
    }

    if (!b || b.length < 2) {
      setMsg("❌ Bank name is required.");
      return;
    }

    if (!a || a.length < 6) {
      setMsg("❌ Enter a valid account number.");
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      const payload = {
        code: c,
        name: n,
        bank_name: b,
        account_number: a,
        is_active: active,
      };

      if (!editId) {
        const { error } = await supabase.from("iet_accounts").insert(payload);

        if (error) throw new Error(error.message);

        setMsg("✅ Account created successfully.");
      } else {
        const { error } = await supabase
          .from("iet_accounts")
          .update(payload)
          .eq("id", editId);

        if (error) throw new Error(error.message);

        setMsg("✅ Account updated successfully.");
      }

      resetForm();
      setActiveTab(active ? "active" : "inactive");
      await loadAll({ silent: true });
      router.refresh();
    } catch (e: any) {
      setMsg("❌ Save failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(account: Account, nextActive: boolean) {
    if (!canManage) {
      setMsg("Not allowed.");
      return;
    }

    const ok = confirm(`Set "${account.name}" to ${nextActive ? "Active" : "Inactive"}?`);

    if (!ok) return;

    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase
        .from("iet_accounts")
        .update({ is_active: nextActive })
        .eq("id", account.id);

      if (error) throw new Error(error.message);

      setMsg(nextActive ? "✅ Account activated." : "✅ Account deactivated.");
      await loadAll({ silent: true });
      router.refresh();
    } catch (e: any) {
      setMsg("❌ Failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteOrDeactivate(account: Account) {
    if (!canManage) {
      setMsg("Not allowed.");
      return;
    }

    const ok = confirm(
      `Delete bank account "${account.name}"?\n\nIf this account is linked to assignments or records, it will be deactivated instead.`
    );

    if (!ok) return;

    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase.from("iet_accounts").delete().eq("id", account.id);

      if (error) throw new Error(error.message);

      setMsg("✅ Unused account deleted.");

      if (editId === account.id) {
        resetForm();
      }

      await loadAll({ silent: true });
      router.refresh();
    } catch (e: any) {
      const text = e?.message || "Unknown error";

      if (
        text.toLowerCase().includes("foreign key") ||
        text.toLowerCase().includes("violates foreign key")
      ) {
        const { error } = await supabase
          .from("iet_accounts")
          .update({ is_active: false })
          .eq("id", account.id);

        if (error) {
          setMsg("❌ Delete failed and deactivate also failed: " + error.message);
        } else {
          setMsg("✅ Account is linked to records, so it has been deactivated instead of deleted.");
          await loadAll({ silent: true });
          router.refresh();
        }
      } else {
        setMsg("❌ Delete failed: " + text);
      }
    } finally {
      setSaving(false);
    }
  }

  function backToFinance() {
    router.push(`/finance?updated=${Date.now()}`);
    router.refresh();
  }

  function openAssignPage() {
    router.push(`/finance/manage-accounts/assign?updated=${Date.now()}`);
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-6xl py-10 text-slate-600">Loading Accounts...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-6xl py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Finance • Bank Accounts
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Create, edit, activate, deactivate and safely manage IET bank accounts.
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Role: {me?.role || "—"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => loadAll({ silent: true })}
              disabled={refreshing || saving}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              onClick={startCreate}
              disabled={!canManage || refreshing || saving}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              Add Account
            </button>

            <button
              onClick={openAssignPage}
              disabled={refreshing || saving}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Assign to Officer
            </button>

            <button
              onClick={backToFinance}
              disabled={refreshing || saving}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
            >
              Back to Finance
            </button>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm">
            {msg}
          </div>
        )}

        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-900">
          Accounts linked to assignments or finance records should be deactivated instead of hard-deleted.
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Accounts" value={String(stats.total)} tone="blue" />
          <StatCard title="Active" value={String(stats.activeCount)} tone="emerald" />
          <StatCard title="Inactive" value={String(stats.inactiveCount)} tone="amber" />
          <StatCard title="Banks" value={String(stats.bankCount)} tone="purple" />
        </div>

        <div className="mt-6 rounded-3xl border bg-white p-2 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <TabButton label="Overview" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
            <TabButton label="Active Accounts" active={activeTab === "active"} onClick={() => setActiveTab("active")} />
            <TabButton label="Inactive Accounts" active={activeTab === "inactive"} onClick={() => setActiveTab("inactive")} />
            <TabButton label={editId ? "Edit Account" : "Add Account"} active={activeTab === "form"} onClick={() => setActiveTab("form")} />
          </div>
        </div>

        {(activeTab === "overview" || activeTab === "active" || activeTab === "inactive") && (
          <div className="mt-6 rounded-3xl border bg-white p-5 shadow-sm">
            <label className="text-sm font-semibold text-slate-800">Search Accounts</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code, account name, bank or account number..."
              className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
            />
          </div>
        )}

        {activeTab === "form" && (
          <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editId ? "Edit Bank Account" : "Add New Bank Account"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Enter account code, title, bank name, account number and active status.
                </p>
              </div>

              {editId && (
                <button
                  onClick={resetForm}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            {!canManage && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                View only. Only Admin and Auditor can create, edit, activate, deactivate or delete accounts.
              </div>
            )}

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-slate-800">Code</label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={!canManage || saving}
                  placeholder="e.g. GENADMIN"
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-800">Account Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!canManage || saving}
                  placeholder="e.g. General Admin Account"
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-800">Bank Name</label>
                <input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  disabled={!canManage || saving}
                  placeholder="e.g. Jaiz Bank"
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-800">Account Number</label>
                <input
                  value={acctNo}
                  onChange={(e) => setAcctNo(cleanAccountNumber(e.target.value))}
                  disabled={!canManage || saving}
                  placeholder="e.g. 0123456789"
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <input
                id="active"
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                disabled={!canManage || saving}
              />
              <label htmlFor="active" className="text-sm font-semibold text-slate-800">
                Active
              </label>
            </div>

            <button
              onClick={saveAccount}
              disabled={!canManage || saving}
              className="mt-5 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : editId ? "Update Account" : "Create Account"}
            </button>
          </div>
        )}

        {(activeTab === "overview" || activeTab === "active" || activeTab === "inactive") && (
          <div className="mt-6 overflow-hidden rounded-3xl border bg-white shadow-sm">
            <div className="border-b bg-slate-50 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">Bank Accounts Register</h2>
              <p className="mt-1 text-sm text-slate-600">
                IET bank accounts, account numbers, active status and management actions.
              </p>
            </div>

            {filteredAccounts.length === 0 ? (
              <div className="p-6 text-sm text-slate-700">No bank accounts found.</div>
            ) : (
              <>
                <div className="grid gap-4 p-4 xl:hidden">
                  {filteredAccounts.map((account) => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      canManage={canManage}
                      saving={saving}
                      onEdit={() => startEdit(account)}
                      onToggle={() => toggleActive(account, account.is_active === false)}
                      onDelete={() => deleteOrDeactivate(account)}
                    />
                  ))}
                </div>

                <div className="hidden overflow-x-auto xl:block">
                  <table className="min-w-[1100px] w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                        <th className="px-4 py-3 text-left">Code</th>
                        <th className="px-4 py-3 text-left">Account Name</th>
                        <th className="px-4 py-3 text-left">Bank</th>
                        <th className="px-4 py-3 text-left">Account No</th>
                        <th className="px-4 py-3 text-left">Updated</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredAccounts.map((account) => (
                        <tr key={account.id} className="border-t hover:bg-slate-50">
                          <td className="px-4 py-4 font-extrabold text-slate-900">
                            {account.code || "—"}
                          </td>

                          <td className="px-4 py-4">
                            <div className="font-semibold text-slate-900">{account.name}</div>
                          </td>

                          <td className="px-4 py-4 text-slate-800">
                            {account.bank_name || "—"}
                          </td>

                          <td className="px-4 py-4 font-semibold text-slate-800">
                            {maskAccountNumber(account.account_number)}
                          </td>

                          <td className="px-4 py-4 text-slate-600">
                            {shortDate(account.updated_at)}
                          </td>

                          <td className="px-4 py-4">
                            <StatusBadge active={account.is_active !== false} />
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => startEdit(account)}
                                disabled={!canManage || saving}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-50"
                              >
                                Edit
                              </button>

                              <button
                                onClick={() => toggleActive(account, account.is_active === false)}
                                disabled={!canManage || saving}
                                className={`rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 ${
                                  account.is_active === false
                                    ? "bg-emerald-600 hover:bg-emerald-700"
                                    : "bg-amber-600 hover:bg-amber-700"
                                }`}
                              >
                                {account.is_active === false ? "Activate" : "Deactivate"}
                              </button>

                              <button
                                onClick={() => deleteOrDeactivate(account)}
                                disabled={!canManage || saving}
                                className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
          <div className="font-bold">Bank Accounts Management Note</div>
          <p className="mt-1">
            Deactivate old or unused operational accounts when they should no longer be selected.
            Permanent deletion should only be used for accounts that have not been linked to any assignment or finance record.
          </p>
        </div>
      </div>
    </main>
  );
}

function AccountCard({
  account,
  canManage,
  saving,
  onEdit,
  onToggle,
  onDelete,
}: {
  account: Account;
  canManage: boolean;
  saving: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-extrabold text-slate-900">
            {account.code || "—"}
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-800">
            {account.name}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Updated {shortDate(account.updated_at)}
          </div>
        </div>

        <StatusBadge active={account.is_active !== false} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <InfoMetric title="Bank" value={account.bank_name || "—"} />
        <InfoMetric title="Account No" value={maskAccountNumber(account.account_number)} />
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          onClick={onEdit}
          disabled={!canManage || saving}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-50"
        >
          Edit
        </button>

        <button
          onClick={onToggle}
          disabled={!canManage || saving}
          className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
            account.is_active === false
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-amber-600 hover:bg-amber-700"
          }`}
        >
          {account.is_active === false ? "Activate" : "Deactivate"}
        </button>

        <button
          onClick={onDelete}
          disabled={!canManage || saving}
          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-bold ${
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${
        active ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-700 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );
}

function StatCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "blue" | "emerald" | "amber" | "purple";
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "amber"
      ? "bg-amber-50 text-amber-700"
      : tone === "purple"
      ? "bg-purple-50 text-purple-700"
      : "bg-blue-50 text-blue-700";

  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-500">{title}</div>
      <div className={`mt-3 inline-flex rounded-2xl px-3 py-2 text-xl font-extrabold ${cls}`}>
        {value}
      </div>
    </div>
  );
}

function InfoMetric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <div className="mt-2 text-sm font-extrabold text-slate-900">{value}</div>
    </div>
  );
}