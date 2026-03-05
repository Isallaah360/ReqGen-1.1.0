"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Dept = { id: string; name: string; created_at: string };

function roleKey(role: string) {
  return (role || "").trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, "");
}

export default function DepartmentsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [myRole, setMyRole] = useState("staff");
  const rk = roleKey(myRole);
  const canManage = rk === "admin" || rk === "auditor";

  const [rows, setRows] = useState<Dept[]>([]);
  const [name, setName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return router.push("/login");

    const { data: prof } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
    setMyRole((prof?.role || "Staff") as string);

    const { data, error } = await supabase.from("departments").select("id,name,created_at").order("name");
    if (error) setMsg(error.message);
    setRows((data || []) as any);

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!canManage) return setMsg("Not allowed.");
    if (name.trim().length < 2) return setMsg("Department name too short.");

    setSaving(true);
    setMsg(null);

    try {
      if (!editId) {
        const { error } = await supabase.from("departments").insert({ name: name.trim() });
        if (error) throw new Error(error.message);
        setMsg("✅ Department created.");
      } else {
        const { error } = await supabase.from("departments").update({ name: name.trim() }).eq("id", editId);
        if (error) throw new Error(error.message);
        setMsg("✅ Department updated.");
      }
      setName("");
      setEditId(null);
      await load();
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Failed"));
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    if (!canManage) return setMsg("Not allowed.");
    if (!confirm("Delete this department?")) return;

    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setMsg("✅ Deleted.");
      await load();
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Failed"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-5xl py-10 text-slate-600">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-5xl py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Departments</h1>
            <p className="mt-2 text-sm text-slate-600">Admin/Auditor can manage departments.</p>
          </div>

          <button
            onClick={() => router.push("/finance")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            ← Back to Finance
          </button>
        </div>

        {msg && <div className="mt-4 rounded-xl bg-white border px-4 py-3 text-sm text-slate-800">{msg}</div>}

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-lg font-bold text-slate-900">{editId ? "Edit Department" : "Create Department"}</div>

          {!canManage && (
            <div className="mt-3 rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
              View only (Admin/Auditor can edit).
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Department name (e.g. General Admin)"
              className="md:col-span-2 rounded-xl border border-slate-200 px-3 py-2"
              disabled={!canManage}
            />
            <button
              onClick={save}
              disabled={!canManage || saving}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : editId ? "Update" : "Create"}
            </button>
          </div>

          {editId && (
            <button
              onClick={() => {
                setEditId(null);
                setName("");
              }}
              className="mt-3 text-sm font-semibold text-slate-700 hover:underline"
            >
              Cancel edit
            </button>
          )}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="grid grid-cols-12 bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-600">
            <div className="col-span-8">Department</div>
            <div className="col-span-4 text-right">Actions</div>
          </div>

          {rows.length === 0 ? (
            <div className="p-4 text-sm text-slate-700">No departments yet.</div>
          ) : (
            rows.map((d) => (
              <div key={d.id} className="grid grid-cols-12 border-t px-4 py-3 text-sm">
                <div className="col-span-8 font-semibold text-slate-900">{d.name}</div>
                <div className="col-span-4 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setEditId(d.id);
                      setName(d.name);
                    }}
                    disabled={!canManage}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => del(d.id)}
                    disabled={!canManage || saving}
                    className="rounded-lg bg-red-600 px-3 py-1 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}