"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Account = {
  id: string;
  code: string | null;
  name: string;
  bank_name: string | null;
  account_number: string | null;
  is_active: boolean | null;
  updated_at: string | null;
};

type ProfileMini = { id: string; role: string | null };

function roleKey(role: string) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

export default function ManageAccountsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [me, setMe] = useState<ProfileMini | null>(null);

  // form
  const [editId, setEditId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [acctNo, setAcctNo] = useState("");
  const [active, setActive] = useState(true);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const canManage = useMemo(() => {
    const rk = roleKey(me?.role || "");
    return rk === "admin" || rk === "auditor";
  }, [me]);

  async function loadAll() {
    setLoading(true);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }

    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      .select("id,role")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (pErr) {
      setMsg("Failed to load profile: " + pErr.message);
      setLoading(false);
      return;
    }
    setMe((prof as any) || null);

    // only Admin/Auditor
    const rk = roleKey((prof as any)?.role || "");
    if (!(rk === "admin" || rk === "auditor")) {
      router.push("/dashboard");
      return;
    }

    const { data, error } = await supabase
      .from("iet_accounts")
      .select("id,code,name,bank_name,account_number,is_active,updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      setMsg("Failed to load accounts: " + error.message);
      setAccounts([]);
    } else {
      setAccounts((data || []) as Account[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setEditId(null);
    setCode("");
    setName("");
    setBankName("");
    setAcctNo("");
    setActive(true);
  }

  async function saveAccount() {
    if (!canManage) return;

    const c = code.trim();
    const n = name.trim();
    const b = bankName.trim();
    const a = acctNo.trim();

    if (!c || c.length < 2) {
      setMsg("❌ Code is required (e.g. GENADMIN).");
      return;
    }
    if (!n || n.length < 2) {
      setMsg("❌ Name is required.");
      return;
    }
    if (!b) {
      setMsg("❌ Bank name is required.");
      return;
    }
    if (!a) {
      setMsg("❌ Account number is required.");
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      if (!editId) {
        // create
        const { error } = await supabase.from("iet_accounts").insert({
          code: c.toUpperCase(),
          name: n,
          bank_name: b,
          account_number: a,
          is_active: active,
        });

        if (error) throw new Error(error.message);
        setMsg("✅ Account created.");
      } else {
        // update
        const { error } = await supabase
          .from("iet_accounts")
          .update({
            code: c.toUpperCase(),
            name: n,
            bank_name: b,
            account_number: a,
            is_active: active,
          })
          .eq("id", editId);

        if (error) throw new Error(error.message);
        setMsg("✅ Account updated.");
      }

      resetForm();
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Save failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function startEdit(a: Account) {
    setEditId(a.id);
    setCode(a.code || "");
    setName(a.name || "");
    setBankName(a.bank_name || "");
    setAcctNo(a.account_number || "");
    setActive(Boolean(a.is_active));
    setMsg(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleActive(a: Account) {
    if (!canManage) return;
    const ok = confirm(`Set "${a.name}" to ${a.is_active ? "Inactive" : "Active"}?`);
    if (!ok) return;

    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase
        .from("iet_accounts")
        .update({ is_active: !a.is_active })
        .eq("id", a.id);

      if (error) throw new Error(error.message);
      await loadAll();
      setMsg("✅ Updated status.");
    } catch (e: any) {
      setMsg("❌ Failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount(a: Account) {
    if (!canManage) return;

    const ok = confirm(
      `Delete bank account "${a.name}"?\n\nNOTE: Any assignment to officers will also be removed (if DB has cascade).`
    );
    if (!ok) return;

    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase.from("iet_accounts").delete().eq("id", a.id);
      if (error) throw new Error(error.message);

      await loadAll();
      setMsg("✅ Deleted.");
    } catch (e: any) {
      setMsg("❌ Delete failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-6xl py-10 text-slate-600">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-6xl py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Manage IET Bank Accounts
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Admin/Auditor can create, edit, delete, activate and assign bank accounts.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/finance"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              ← Back to Finance
            </Link>

            <Link
              href="/finance/manage-accounts/assign"
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Assign to Officer
            </Link>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">
            {msg}
          </div>
        )}

        {/* FORM */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-900">
              {editId ? "Edit Account" : "Create Account"}
            </h2>

            {editId && (
              <button
                onClick={resetForm}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-800">Code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. GENADMIN"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. General Admin Account"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Bank Name</label>
              <input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. Jaiz Bank"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Account Number</label>
              <input
                value={acctNo}
                onChange={(e) => setAcctNo(e.target.value)}
                placeholder="e.g. 0123456789"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <input
              id="active"
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            <label htmlFor="active" className="text-sm font-semibold text-slate-800">
              Active
            </label>
          </div>

          <div className="mt-5">
            <button
              onClick={saveAccount}
              disabled={saving}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : editId ? "Update Account" : "Create Account"}
            </button>
          </div>
        </div>

        {/* LIST */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Existing Accounts</h2>

          {accounts.length === 0 ? (
            <div className="mt-4 text-sm text-slate-700">No bank accounts yet.</div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-12 bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-600">
                <div className="col-span-2">Code</div>
                <div className="col-span-3">Name</div>
                <div className="col-span-3">Bank</div>
                <div className="col-span-2">Account No</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>

              {accounts.map((a) => (
                <div key={a.id} className="grid grid-cols-12 border-t px-4 py-3 text-sm">
                  <div className="col-span-2 font-semibold text-slate-900">
                    {a.code || "—"}
                    {!a.is_active && (
                      <span className="ml-2 rounded-md bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">
                        Inactive
                      </span>
                    )}
                  </div>

                  <div className="col-span-3 text-slate-900">{a.name}</div>
                  <div className="col-span-3 text-slate-800">{a.bank_name || "—"}</div>
                  <div className="col-span-2 text-slate-800">{a.account_number || "—"}</div>

                  <div className="col-span-2 flex justify-end gap-2">
                    <button
                      onClick={() => startEdit(a)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => toggleActive(a)}
                      disabled={saving}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
                    >
                      {a.is_active ? "Deactivate" : "Activate"}
                    </button>

                    <button
                      onClick={() => deleteAccount(a)}
                      disabled={saving}
                      className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 text-xs text-slate-500">
            Tip: If you just added columns in Supabase, run schema reload or wait 1–2 mins.
          </div>
        </div>
      </div>
    </main>
  );
}