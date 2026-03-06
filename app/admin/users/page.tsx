"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Dept = { id: string; name: string };

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  dept_id: string | null; // optional routing
  created_at?: string | null;
};

const ROLES = [
  "Staff",
  "Admin",
  "Auditor",
  "AccountOfficer",
  "Director",
  "HOD",
  "HR",
  "Registry",
  "DG",
] as const;

function roleKey(role: string) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

export default function AdminUsersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [meRole, setMeRole] = useState<string>("Staff");
  const canAdmin = useMemo(() => {
    const rk = roleKey(meRole);
    return rk === "admin" || rk === "auditor";
  }, [meRole]);

  const [depts, setDepts] = useState<Dept[]>([]);
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [q, setQ] = useState("");

  // edit state
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg(null);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }

      // load my role
      const { data: me, error: meErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", auth.user.id)
        .maybeSingle();

      if (meErr) {
        setMsg("Failed to load your profile: " + meErr.message);
        setLoading(false);
        return;
      }

      setMeRole((me?.role as string) || "Staff");

      // load departments (for routing)
      const { data: d, error: dErr } = await supabase
        .from("departments")
        .select("id,name")
        .order("name", { ascending: true });

      if (!dErr) setDepts((d || []) as Dept[]);

      // load users
      const { data: p, error: pErr } = await supabase
        .from("profiles")
        .select("id,full_name,email,role,dept_id,created_at")
        .order("created_at", { ascending: false });

      if (pErr) {
        setMsg("Failed to load users: " + pErr.message);
        setLoading(false);
        return;
      }

      setRows((p || []) as ProfileRow[]);
      setLoading(false);
    }

    load();
  }, [router]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      return (
        (r.full_name || "").toLowerCase().includes(s) ||
        (r.email || "").toLowerCase().includes(s) ||
        (r.role || "").toLowerCase().includes(s)
      );
    });
  }, [rows, q]);

  async function updateUser(id: string, patch: Partial<ProfileRow>) {
    if (!canAdmin) {
      setMsg("❌ Only Admin/Auditor can update roles.");
      return;
    }

    setSavingId(id);
    setMsg(null);

    try {
      const { error } = await supabase.from("profiles").update(patch).eq("id", id);
      if (error) throw new Error(error.message);

      // update local state
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
      );

      setMsg("✅ Updated.");
    } catch (e: any) {
      setMsg("❌ Update failed: " + (e?.message || "Unknown error"));
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-6xl py-10 text-slate-600">Loading...</div>
      </main>
    );
  }

  if (!canAdmin) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-6xl py-10">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="text-lg font-bold text-slate-900">Access denied</div>
            <div className="mt-1 text-sm text-slate-600">
              Only Admin/Auditor can manage users & roles.
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-6xl py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Users & Roles
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Assign global roles (Admin, Auditor, AccountOfficer, Director, HOD, HR, Registry, DG, Staff)
              and optional department routing.
            </p>
          </div>

          <button
            onClick={() => router.push("/admin")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Back
          </button>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">
            {msg}
          </div>
        )}

        <div className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
          <label className="text-sm font-semibold text-slate-800">Search</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
            placeholder="Search name, email, role..."
          />
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="grid grid-cols-12 bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-600">
            <div className="col-span-3">Name</div>
            <div className="col-span-3">Email</div>
            <div className="col-span-2">Role</div>
            <div className="col-span-3">Dept Routing (optional)</div>
            <div className="col-span-1 text-right">Save</div>
          </div>

          {filtered.length === 0 ? (
            <div className="p-4 text-sm text-slate-600">No users found.</div>
          ) : (
            filtered.map((u) => (
              <UserRow
                key={u.id}
                u={u}
                depts={depts}
                saving={savingId === u.id}
                onSave={updateUser}
              />
            ))
          )}
        </div>
      </div>
    </main>
  );
}

function UserRow({
  u,
  depts,
  saving,
  onSave,
}: {
  u: ProfileRow;
  depts: Dept[];
  saving: boolean;
  onSave: (id: string, patch: Partial<ProfileRow>) => Promise<void>;
}) {
  const [role, setRole] = useState<string>(u.role || "Staff");
  const [deptId, setDeptId] = useState<string>(u.dept_id || "");

  useEffect(() => {
    setRole(u.role || "Staff");
    setDeptId(u.dept_id || "");
  }, [u.id, u.role, u.dept_id]);

  const changed = role !== (u.role || "Staff") || deptId !== (u.dept_id || "");

  return (
    <div className="grid grid-cols-12 items-center gap-3 border-t px-4 py-3 text-sm">
      <div className="col-span-3 font-semibold text-slate-900">
        {u.full_name || "—"}
      </div>
      <div className="col-span-3 text-slate-700">{u.email || "—"}</div>

      <div className="col-span-2">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="col-span-3">
        <select
          value={deptId}
          onChange={(e) => setDeptId(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
        >
          <option value="">— None —</option>
          {depts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <div className="mt-1 text-[11px] text-slate-500">
          Use for HOD/Director routing (optional).
        </div>
      </div>

      <div className="col-span-1 flex justify-end">
        <button
          disabled={!changed || saving}
          onClick={() => onSave(u.id, { role, dept_id: deptId || null })}
          className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "..." : "Save"}
        </button>
      </div>
    </div>
  );
}