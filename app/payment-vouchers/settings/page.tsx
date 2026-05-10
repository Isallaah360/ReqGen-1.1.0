"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type CounterSignatory = {
  id: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function roleKey(role: string | null | undefined) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function shortDateTime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

export default function PaymentVoucherSettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [myRole, setMyRole] = useState("Staff");
  const rk = roleKey(myRole);
  const canAccess = ["admin", "auditor"].includes(rk);

  const [rows, setRows] = useState<CounterSignatory[]>([]);

  const [editId, setEditId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [active, setActive] = useState(true);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      router.push("/login");
      return;
    }

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (profErr) {
      setMsg("Failed to load your profile: " + profErr.message);
      setLoading(false);
      return;
    }

    const role = (prof?.role || "Staff") as string;
    setMyRole(role);

    if (!["admin", "auditor"].includes(roleKey(role))) {
      setMsg("Access denied. Only Admin and Auditor can manage PV settings.");
      setRows([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("payment_voucher_counter_signatories")
      .select("id,full_name,is_active,created_at,updated_at")
      .order("full_name", { ascending: true });

    if (error) {
      setMsg("Failed to load counter signatories: " + error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data || []) as CounterSignatory[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRows = useMemo(() => {
    const s = search.trim().toLowerCase();

    return rows.filter((r) => {
      if (!s) return true;
      return r.full_name.toLowerCase().includes(s);
    });
  }, [rows, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const activeCount = rows.filter((r) => r.is_active).length;
    const inactiveCount = total - activeCount;

    return { total, activeCount, inactiveCount };
  }, [rows]);

  function resetForm() {
    setEditId(null);
    setFullName("");
    setActive(true);
  }

  async function save() {
    if (!canAccess) {
      setMsg("Not allowed.");
      return;
    }

    const name = fullName.trim();

    if (name.length < 2) {
      setMsg("Counter signatory name is too short.");
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      const { data: auth } = await supabase.auth.getUser();

      if (!auth.user) {
        router.push("/login");
        return;
      }

      if (!editId) {
        const { error } = await supabase
          .from("payment_voucher_counter_signatories")
          .insert({
            full_name: name,
            is_active: active,
            created_by: auth.user.id,
          });

        if (error) throw new Error(error.message);

        setMsg("✅ Counter signatory added.");
      } else {
        const { error } = await supabase
          .from("payment_voucher_counter_signatories")
          .update({
            full_name: name,
            is_active: active,
          })
          .eq("id", editId);

        if (error) throw new Error(error.message);

        setMsg("✅ Counter signatory updated.");
      }

      resetForm();
      await load();
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Failed to save."));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: CounterSignatory) {
    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase
        .from("payment_voucher_counter_signatories")
        .update({
          is_active: !row.is_active,
        })
        .eq("id", row.id);

      if (error) throw new Error(error.message);

      setMsg(row.is_active ? "✅ Deactivated." : "✅ Activated.");
      await load();
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Failed to update."));
    } finally {
      setSaving(false);
    }
  }

  async function del(row: CounterSignatory) {
    const ok = confirm(`Delete "${row.full_name}" permanently?`);
    if (!ok) return;

    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase
        .from("payment_voucher_counter_signatories")
        .delete()
        .eq("id", row.id);

      if (error) throw new Error(error.message);

      setMsg("✅ Deleted.");
      await load();
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Failed to delete."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-6xl py-10 text-slate-600">
          Loading PV settings...
        </div>
      </main>
    );
  }

  if (!canAccess) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-3xl py-10">
          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <h1 className="text-xl font-extrabold text-slate-900">
              PV Settings Access
            </h1>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {msg || "Access denied. Only Admin and Auditor can manage PV settings."}
            </div>

            <button
              onClick={() => router.push("/payment-vouchers")}
              className="mt-5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Back to Vouchers
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-6xl py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Payment Voucher Settings
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Add, edit, activate, deactivate or delete cheque counter signatories.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={load}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
            >
              Refresh
            </button>

            <button
              onClick={() => router.push("/payment-vouchers")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
            >
              Back to Vouchers
            </button>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-2xl border bg-white px-4 py-3 text-sm text-slate-800 shadow-sm">
            {msg}
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <StatCard title="Total Names" value={String(stats.total)} tone="blue" />
          <StatCard title="Active" value={String(stats.activeCount)} tone="emerald" />
          <StatCard title="Inactive" value={String(stats.inactiveCount)} tone="red" />
        </div>

        <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {editId ? "Edit Counter Signatory" : "Add Counter Signatory"}
              </h2>
            </div>

            {editId && (
              <button
                onClick={resetForm}
                disabled={saving}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="md:col-span-3">
              <label className="text-sm font-semibold text-slate-800">
                Full Name
              </label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Alhaji Abdurrahim Sulaiman"
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-end gap-3">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                Active
              </label>

              <button
                onClick={save}
                disabled={saving}
                className="ml-auto rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : editId ? "Update" : "Add"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border bg-white p-5 shadow-sm">
          <label className="text-sm font-semibold text-slate-800">Search</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search counter signatory..."
            className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
          />
        </div>

        <div className="mt-6 rounded-3xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-slate-50 px-6 py-4">
            <h2 className="text-lg font-bold text-slate-900">
              Counter Signatories Register
            </h2>
          </div>

          {filteredRows.length === 0 ? (
            <div className="p-6 text-sm text-slate-700">No counter signatory found.</div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                <div className="grid grid-cols-12 bg-slate-100 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <div className="col-span-5">Full Name</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-3">Updated</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>

                {filteredRows.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-12 items-center border-t px-6 py-4 text-sm hover:bg-slate-50"
                  >
                    <div className="col-span-5 font-extrabold text-slate-900">
                      {row.full_name}
                    </div>

                    <div className="col-span-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          row.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {row.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="col-span-3 text-slate-600">
                      {shortDateTime(row.updated_at)}
                    </div>

                    <div className="col-span-2 flex justify-end gap-2">
                      <button
                        disabled={saving}
                        onClick={() => {
                          setEditId(row.id);
                          setFullName(row.full_name);
                          setActive(row.is_active);
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-50"
                      >
                        Edit
                      </button>

                      <button
                        disabled={saving}
                        onClick={() => toggleActive(row)}
                        className={`rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 ${
                          row.is_active
                            ? "bg-amber-600 hover:bg-amber-700"
                            : "bg-emerald-600 hover:bg-emerald-700"
                        }`}
                      >
                        {row.is_active ? "Off" : "On"}
                      </button>

                      <button
                        disabled={saving}
                        onClick={() => del(row)}
                        className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
          <div className="font-bold">PV Settings Note</div>
          <p className="mt-1">
            Only active names will appear when generating a cheque payment voucher.
          </p>
        </div>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "blue" | "emerald" | "red";
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "red"
      ? "bg-red-50 text-red-700"
      : "bg-blue-50 text-blue-700";

  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-500">{title}</div>
      <div className={`mt-3 inline-flex rounded-2xl px-3 py-2 text-2xl font-extrabold ${cls}`}>
        {value}
      </div>
    </div>
  );
}