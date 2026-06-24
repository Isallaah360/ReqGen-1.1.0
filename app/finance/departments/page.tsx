"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Dept = {
  id: string;
  name: string;
  created_at: string | null;
  is_active: boolean | null;
  hod_user_id?: string | null;
  director_user_id?: string | null;
  request_count?: number;
  subhead_count?: number;
  profile_count?: number;
};

type ProfileMini = {
  role: string | null;
};

type TabKey = "overview" | "active" | "inactive" | "form";

function roleKey(role: string | null | undefined) {
  return (role || "").trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, "");
}

function shortDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

function linkedTotal(d: Dept) {
  return Number(d.request_count || 0) + Number(d.subhead_count || 0) + Number(d.profile_count || 0);
}

function canHardDeleteDepartment(d: Dept) {
  return linkedTotal(d) === 0;
}

export default function DepartmentsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [myRole, setMyRole] = useState("Staff");
  const rk = roleKey(myRole);
  const canManage = rk === "admin" || rk === "auditor";

  const [rows, setRows] = useState<Dept[]>([]);
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [search, setSearch] = useState("");

  const load = useCallback(
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

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", auth.user.id)
        .maybeSingle();

      if (profErr) {
        setMsg("Failed to load your profile: " + profErr.message);
        setLoading(false);
        setRefreshing(false);
        return null;
      }

      const profile = prof as ProfileMini | null;
      setMyRole(profile?.role || "Staff");

      const { data: deptRows, error: deptErr } = await supabase
        .from("departments")
        .select("id,name,created_at,is_active,hod_user_id,director_user_id")
        .order("name", { ascending: true });

      if (deptErr) {
        setMsg("Failed to load departments: " + deptErr.message);
        setRows([]);
        setLoading(false);
        setRefreshing(false);
        return null;
      }

      const baseDepartments = (deptRows || []) as Dept[];

      let requestCountByDept: Record<string, number> = {};
      let subheadCountByDept: Record<string, number> = {};
      let profileCountByDept: Record<string, number> = {};

      if (baseDepartments.length > 0) {
        const [requestRes, subheadRes, profileRes] = await Promise.all([
          supabase.from("requests").select("dept_id").not("dept_id", "is", null),
          supabase.from("subheads").select("dept_id").not("dept_id", "is", null),
          supabase.from("profiles").select("dept_id").not("dept_id", "is", null),
        ]);

        if (!requestRes.error) {
          (requestRes.data || []).forEach((r: any) => {
            if (r.dept_id) {
              requestCountByDept[r.dept_id] = (requestCountByDept[r.dept_id] || 0) + 1;
            }
          });
        }

        if (!subheadRes.error) {
          (subheadRes.data || []).forEach((s: any) => {
            if (s.dept_id) {
              subheadCountByDept[s.dept_id] = (subheadCountByDept[s.dept_id] || 0) + 1;
            }
          });
        }

        if (!profileRes.error) {
          (profileRes.data || []).forEach((p: any) => {
            if (p.dept_id) {
              profileCountByDept[p.dept_id] = (profileCountByDept[p.dept_id] || 0) + 1;
            }
          });
        }
      }

      const enrichedDepartments = baseDepartments.map((d) => ({
        ...d,
        is_active: d.is_active !== false,
        request_count: requestCountByDept[d.id] || 0,
        subhead_count: subheadCountByDept[d.id] || 0,
        profile_count: profileCountByDept[d.id] || 0,
      }));

      setRows(enrichedDepartments);
      setLoading(false);
      setRefreshing(false);

      return enrichedDepartments;
    },
    [router]
  );

  useEffect(() => {
    load();

    const refreshOnFocus = () => {
      load({ silent: true });
    };

    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") {
        load({ silent: true });
      }
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisible);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, [load]);

  const stats = useMemo(() => {
    const total = rows.length;
    const activeCount = rows.filter((d) => d.is_active !== false).length;
    const inactiveCount = rows.filter((d) => d.is_active === false).length;
    const linkedDepartments = rows.filter((d) => linkedTotal(d) > 0).length;
    const unusedDepartments = rows.filter((d) => linkedTotal(d) === 0).length;
    const routedDepartments = rows.filter((d) => d.hod_user_id || d.director_user_id).length;

    return {
      total,
      activeCount,
      inactiveCount,
      linkedDepartments,
      unusedDepartments,
      routedDepartments,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const s = search.trim().toLowerCase();

    return rows.filter((d) => {
      if (activeTab === "active" && d.is_active === false) return false;
      if (activeTab === "inactive" && d.is_active !== false) return false;

      if (!s) return true;

      const haystack = [
        d.name,
        d.is_active === false ? "inactive" : "active",
        linkedTotal(d) > 0 ? "linked" : "unused",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(s);
    });
  }, [rows, search, activeTab]);

  function resetForm() {
    setName("");
    setActive(true);
    setEditId(null);
  }

  function startCreate() {
    resetForm();
    setActiveTab("form");
  }

  function startEdit(d: Dept) {
    setEditId(d.id);
    setName(d.name);
    setActive(d.is_active !== false);
    setActiveTab("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    if (!canManage) {
      setMsg("Not allowed.");
      return;
    }

    if (name.trim().length < 2) {
      setMsg("Department name too short.");
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      if (!editId) {
        const { error } = await supabase.from("departments").insert({
          name: name.trim(),
          is_active: active,
        });

        if (error) throw new Error(error.message);

        setMsg("✅ Department created successfully.");
      } else {
        const { error } = await supabase
          .from("departments")
          .update({
            name: name.trim(),
            is_active: active,
          })
          .eq("id", editId);

        if (error) throw new Error(error.message);

        setMsg("✅ Department updated successfully.");
      }

      resetForm();
      setActiveTab(active ? "active" : "inactive");
      await load({ silent: true });
      router.refresh();
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Failed"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(d: Dept, nextActive: boolean) {
    if (!canManage) {
      setMsg("Not allowed.");
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase
        .from("departments")
        .update({ is_active: nextActive })
        .eq("id", d.id);

      if (error) throw new Error(error.message);

      setMsg(nextActive ? "✅ Department activated." : "✅ Department deactivated.");
      await load({ silent: true });
      router.refresh();
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Failed"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteOrDeactivate(d: Dept) {
    if (!canManage) {
      setMsg("Not allowed.");
      return;
    }

    if (!canHardDeleteDepartment(d)) {
      if (
        !confirm(
          "This department is linked to users, requests or subheads, so it cannot be safely deleted. Do you want to deactivate it instead?"
        )
      ) {
        return;
      }

      await toggleActive(d, false);
      return;
    }

    if (!confirm("Delete this unused department permanently?")) return;

    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase.from("departments").delete().eq("id", d.id);

      if (error) throw new Error(error.message);

      setMsg("✅ Unused department deleted.");

      if (editId === d.id) {
        resetForm();
      }

      await load({ silent: true });
      router.refresh();
    } catch (e: any) {
      const text = e?.message || "Failed";

      if (
        text.toLowerCase().includes("foreign key") ||
        text.toLowerCase().includes("violates foreign key")
      ) {
        const { error } = await supabase
          .from("departments")
          .update({ is_active: false })
          .eq("id", d.id);

        if (error) {
          setMsg("❌ Delete failed and deactivate also failed: " + error.message);
        } else {
          setMsg("✅ Department was linked to records, so it has been deactivated instead of deleted.");
          await load({ silent: true });
          router.refresh();
        }
      } else {
        setMsg("❌ " + text);
      }
    } finally {
      setSaving(false);
    }
  }

  function backToFinance() {
    router.push(`/finance?updated=${Date.now()}`);
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-6xl py-10 text-slate-600">Loading Departments...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-6xl py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Finance • Departments
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Add, edit, activate, deactivate and safely delete unused departments.
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Role: {myRole || "—"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => load({ silent: true })}
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
              Add Department
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
          Used departments cannot be hard-deleted because users, requests or subheads may depend on them.
          Deactivate used departments instead.
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard title="Total Departments" value={String(stats.total)} tone="slate" />
          <StatCard title="Active" value={String(stats.activeCount)} tone="emerald" />
          <StatCard title="Inactive" value={String(stats.inactiveCount)} tone="amber" />
          <StatCard title="Linked" value={String(stats.linkedDepartments)} tone="blue" />
          <StatCard title="Unused" value={String(stats.unusedDepartments)} tone="purple" />
          <StatCard title="Routed" value={String(stats.routedDepartments)} tone="blue" />
        </div>

        <div className="mt-6 rounded-3xl border bg-white p-2 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <TabButton label="Overview" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
            <TabButton label="Active Departments" active={activeTab === "active"} onClick={() => setActiveTab("active")} />
            <TabButton label="Inactive Departments" active={activeTab === "inactive"} onClick={() => setActiveTab("inactive")} />
            <TabButton label={editId ? "Edit Department" : "Add Department"} active={activeTab === "form"} onClick={() => setActiveTab("form")} />
          </div>
        </div>

        {(activeTab === "overview" || activeTab === "active" || activeTab === "inactive") && (
          <div className="mt-6 rounded-3xl border bg-white p-5 shadow-sm">
            <label className="text-sm font-semibold text-slate-800">Search Departments</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by department name or status..."
              className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
            />
          </div>
        )}

        {activeTab === "form" && (
          <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editId ? "Edit Department" : "Add New Department"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Create or update the department name and active status.
                </p>
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

            {!canManage && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                View only. Only Admin and Auditor can create, edit, activate, deactivate or delete departments.
              </div>
            )}

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-slate-800">Department Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Department name, e.g. General Admin"
                  disabled={!canManage || saving}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
                />
              </div>

              <div className="flex items-end gap-3">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    disabled={!canManage || saving}
                  />
                  Active
                </label>

                <button
                  onClick={save}
                  disabled={!canManage || saving}
                  className="ml-auto rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? "Saving..." : editId ? "Update Department" : "Create Department"}
                </button>
              </div>
            </div>
          </div>
        )}

        {(activeTab === "overview" || activeTab === "active" || activeTab === "inactive") && (
          <div className="mt-6 overflow-hidden rounded-3xl border bg-white shadow-sm">
            <div className="border-b bg-slate-50 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">Departments Register</h2>
              <p className="mt-1 text-sm text-slate-600">
                Department records, linked usage and management actions.
              </p>
            </div>

            {filteredRows.length === 0 ? (
              <div className="p-6 text-sm text-slate-700">No departments found.</div>
            ) : (
              <>
                <div className="grid gap-4 p-4 xl:hidden">
                  {filteredRows.map((d) => (
                    <DepartmentCard
                      key={d.id}
                      d={d}
                      canManage={canManage}
                      saving={saving}
                      onEdit={() => startEdit(d)}
                      onToggle={() => toggleActive(d, d.is_active === false)}
                      onDelete={() => deleteOrDeactivate(d)}
                    />
                  ))}
                </div>

                <div className="hidden overflow-x-auto xl:block">
                  <table className="min-w-[1100px] w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                        <th className="px-4 py-3 text-left">Department</th>
                        <th className="px-4 py-3 text-center">Users</th>
                        <th className="px-4 py-3 text-center">Requests</th>
                        <th className="px-4 py-3 text-center">Subheads</th>
                        <th className="px-4 py-3 text-center">Total Links</th>
                        <th className="px-4 py-3 text-left">Created</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredRows.map((d) => (
                        <tr key={d.id} className="border-t hover:bg-slate-50">
                          <td className="px-4 py-4">
                            <div className="font-extrabold text-slate-900">{d.name}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {canHardDeleteDepartment(d)
                                ? "Unused department"
                                : "Linked department"}
                            </div>
                          </td>

                          <td className="px-4 py-4 text-center font-bold text-slate-800">
                            {Number(d.profile_count || 0)}
                          </td>

                          <td className="px-4 py-4 text-center font-bold text-slate-800">
                            {Number(d.request_count || 0)}
                          </td>

                          <td className="px-4 py-4 text-center font-bold text-slate-800">
                            {Number(d.subhead_count || 0)}
                          </td>

                          <td className="px-4 py-4 text-center font-black text-blue-700">
                            {linkedTotal(d)}
                          </td>

                          <td className="px-4 py-4 text-slate-600">{shortDate(d.created_at)}</td>

                          <td className="px-4 py-4">
                            <StatusBadge active={d.is_active !== false} />
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => startEdit(d)}
                                disabled={!canManage || saving}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-50"
                              >
                                Edit
                              </button>

                              <button
                                onClick={() => toggleActive(d, d.is_active === false)}
                                disabled={!canManage || saving}
                                className={`rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 ${
                                  d.is_active === false
                                    ? "bg-emerald-600 hover:bg-emerald-700"
                                    : "bg-amber-600 hover:bg-amber-700"
                                }`}
                              >
                                {d.is_active === false ? "Activate" : "Deactivate"}
                              </button>

                              <button
                                onClick={() => deleteOrDeactivate(d)}
                                disabled={!canManage || saving}
                                className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                              >
                                {canHardDeleteDepartment(d) ? "Delete" : "Deactivate"}
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
          <div className="font-bold">Department Management Note</div>
          <p className="mt-1">
            Departments linked to users, requests or subheads are preserved for workflow and audit integrity.
            Deactivate old departments instead of deleting them. Permanent deletion is only safe for unused departments.
          </p>
        </div>
      </div>
    </main>
  );
}

function DepartmentCard({
  d,
  canManage,
  saving,
  onEdit,
  onToggle,
  onDelete,
}: {
  d: Dept;
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
          <div className="text-lg font-extrabold text-slate-900">{d.name}</div>
          <div className="mt-1 text-sm text-slate-500">Created {shortDate(d.created_at)}</div>
        </div>

        <StatusBadge active={d.is_active !== false} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <MiniMetric title="Users" value={String(Number(d.profile_count || 0))} />
        <MiniMetric title="Requests" value={String(Number(d.request_count || 0))} />
        <MiniMetric title="Subheads" value={String(Number(d.subhead_count || 0))} />
        <MiniMetric title="Links" value={String(linkedTotal(d))} />
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
            d.is_active === false
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-amber-600 hover:bg-amber-700"
          }`}
        >
          {d.is_active === false ? "Activate" : "Deactivate"}
        </button>

        <button
          onClick={onDelete}
          disabled={!canManage || saving}
          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {canHardDeleteDepartment(d) ? "Delete" : "Deactivate"}
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
  tone: "slate" | "blue" | "emerald" | "amber" | "purple";
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "amber"
      ? "bg-amber-50 text-amber-700"
      : tone === "purple"
      ? "bg-purple-50 text-purple-700"
      : tone === "blue"
      ? "bg-blue-50 text-blue-700"
      : "bg-slate-50 text-slate-700";

  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-500">{title}</div>
      <div className={`mt-3 inline-flex rounded-2xl px-3 py-2 text-xl font-extrabold ${cls}`}>
        {value}
      </div>
    </div>
  );
}

function MiniMetric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <div className="mt-2 text-sm font-extrabold text-slate-900">{value}</div>
    </div>
  );
}