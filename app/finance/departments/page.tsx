"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Dept = {
  id: string;
  name: string;
  created_at?: string | null;
};

export default function FinanceDepartmentsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [myRole, setMyRole] = useState<string>("Staff");
  const canManage = useMemo(() => ["Admin", "Auditor"].includes(myRole), [myRole]);

  const [rows, setRows] = useState<Dept[]>([]);

  // create
  const [name, setName] = useState("");

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string>("");
  const [editName, setEditName] = useState<string>("");

  async function loadAll() {
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
      setMsg("Failed to load role: " + profErr.message);
      setLoading(false);
      return;
    }

    const role = (prof?.role || "Staff") as string;
    setMyRole(role);

    if (!["Admin", "Auditor"].includes(role)) {
      router.push("/dashboard");
      return;
    }

    const { data: d, error } = await supabase
      .from("departments")
      .select("id,name,created_at")
      .order("name", { ascending: true });

    if (error) {
      setMsg("Failed to load departments: " + error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((d || []) as Dept[]);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function createDept() {
    if (!canManage) return;

    const n = name.trim();
    if (n.length < 2) {
      setMsg("❌ Department name too short.");
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      // prevent duplicates by name (soft check)
      const exists = rows.some((x) => (x.name || "").toLowerCase() === n.toLowerCase());
      if (exists) throw new Error("Department already exists.");

      const { error } = await supabase.from("departments").insert({ name: n });
      if (error) throw new Error(error.message);

      setName("");
      setMsg("✅ Department created.");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Create failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  function openEdit(d: Dept) {
    setEditId(d.id);
    setEditName(d.name || "");
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
    setEditId("");
    setEditName("");
  }

  async function saveEdit() {
    if (!canManage) return;
    if (!editId) return;

    const n = editName.trim();
    if (n.length < 2) {
      setMsg("❌ Department name too short.");
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase
        .from("departments")
        .update({ name: n })
        .eq("id", editId);

      if (error) throw new Error(error.message);

      setMsg("✅ Department updated.");
      closeEdit();
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Update failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteDept(id: string) {
    if (!canManage) return;

    const dept = rows.find((x) => x.id === id);
    const ok = confirm(
      `Delete department "${dept?.name || ""}"?\n\nNOTE: If subheads/requests still reference it, delete will fail until those are moved/removed.`
    );
    if (!ok) return;

    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw new Error(error.message);

      setMsg("✅ Department deleted.");
      await loadAll();
    } catch (e: any) {
      setMsg(
        "❌ Delete failed: " +
          (e?.message || "Unknown error") +
          " — If this department has subheads/requests, you must reassign or delete them first."
      );
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Finance • Departments
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Create, edit and delete departments (Admin/Auditor only).
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => router.push("/finance/manage-accounts")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Manage Accounts
            </button>

            <button
              onClick={() => router.push("/finance/subheads")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Subheads
            </button>

            <button
              onClick={() => router.push("/finance/reports")}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Reports
            </button>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">
            {msg}
          </div>
        )}

        {!canManage ? (
          <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm text-slate-700">
            You don’t have permission to manage departments.
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Create Department</h2>

            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
              <div className="w-full md:max-w-md">
                <label className="text-sm font-semibold text-slate-800">Department Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500"
                  placeholder="e.g. Directorate of Finance"
                />
              </div>

              <button
                onClick={createDept}
                disabled={saving}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Create"}
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Departments List</h2>

          {rows.length === 0 ? (
            <div className="mt-4 text-sm text-slate-700">No departments yet.</div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-12 bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-600">
                <div className="col-span-8">Department</div>
                <div className="col-span-4 text-right">Actions</div>
              </div>

              {rows.map((d) => (
                <div
                  key={d.id}
                  className="grid grid-cols-12 border-t px-4 py-3 text-sm items-center"
                >
                  <div className="col-span-8 font-semibold text-slate-900">{d.name}</div>

                  <div className="col-span-4 flex justify-end gap-2">
                    {canManage && (
                      <>
                        <button
                          onClick={() => openEdit(d)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-900 hover:bg-slate-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteDept(d.id)}
                          className="rounded-lg bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* EDIT MODAL */}
        {editOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border">
              <div className="p-5 border-b flex items-start justify-between">
                <div>
                  <div className="text-lg font-extrabold text-slate-900">Edit Department</div>
                  <div className="text-xs text-slate-500">Rename this department.</div>
                </div>
                <button
                  onClick={closeEdit}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 grid gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-800">Department Name</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={closeEdit}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}