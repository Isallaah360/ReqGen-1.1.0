"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Dept = {
  id: string;
  name: string;
};

type IetAccount = {
  id: string;
  code: string | null;
  name: string;
  account_number: string | null;
  bank_name: string | null;
  is_active: boolean | null;
};

type Officer = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
};

type RouteRow = {
  id: string;
  dept_id: string;
  iet_account_id: string;
  officer_user_id: string;
  is_active: boolean;
};

function roleKey(role: string) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function officerLabel(o: Officer) {
  const name = o.full_name?.trim() || "Unnamed User";
  const email = o.email?.trim() || o.id;
  return `${name} • ${email}`;
}

function accountLabel(a: IetAccount) {
  const code = a.code?.trim() || "NO-CODE";
  const bank = a.bank_name?.trim() || "Bank";
  const num = a.account_number?.trim() || "";
  return `${code} • ${a.name}${num ? ` • ${num}` : ""} • ${bank}`;
}

export default function AccountRoutingPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [myRole, setMyRole] = useState<string>("");

  const [depts, setDepts] = useState<Dept[]>([]);
  const [accounts, setAccounts] = useState<IetAccount[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);

  const canManage = useMemo(() => {
    const rk = roleKey(myRole);
    return rk === "admin" || rk === "auditor";
  }, [myRole]);

  async function loadAll() {
    setLoading(true);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }

    const { data: me, error: meErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .single();

    if (meErr) {
      setMsg("Failed to verify access: " + meErr.message);
      setLoading(false);
      return;
    }

    const role = (me?.role || "Staff") as string;
    setMyRole(role);

    if (!["admin", "auditor"].includes(roleKey(role))) {
      router.push("/dashboard");
      return;
    }

    const [deptRes, accountRes, officerRes, routeRes] = await Promise.all([
      supabase.from("departments").select("id,name").order("name", { ascending: true }),
      supabase
        .from("iet_accounts")
        .select("id,code,name,account_number,bank_name,is_active")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase
        .from("profiles")
        .select("id,full_name,email,role")
        .eq("role", "AccountOfficer")
        .order("full_name", { ascending: true }),
      supabase
        .from("department_account_routing")
        .select("id,dept_id,iet_account_id,officer_user_id,is_active")
        .order("created_at", { ascending: true }),
    ]);

    if (deptRes.error) setMsg("Failed to load departments: " + deptRes.error.message);
    else setDepts((deptRes.data || []) as Dept[]);

    if (accountRes.error) setMsg("Failed to load accounts: " + accountRes.error.message);
    else setAccounts((accountRes.data || []) as IetAccount[]);

    if (officerRes.error) setMsg("Failed to load account officers: " + officerRes.error.message);
    else setOfficers((officerRes.data || []) as Officer[]);

    if (routeRes.error) setMsg("Failed to load routing: " + routeRes.error.message);
    else setRoutes((routeRes.data || []) as RouteRow[]);

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveRoute(deptId: string, ietAccountId: string, officerUserId: string, existingId?: string) {
    setSaving(true);
    setMsg(null);

    try {
      if (!deptId) throw new Error("Select department.");
      if (!ietAccountId) throw new Error("Select IET account.");
      if (!officerUserId) throw new Error("Select Account Officer.");

      if (existingId) {
        const { error } = await supabase
          .from("department_account_routing")
          .update({
            iet_account_id: ietAccountId,
            officer_user_id: officerUserId,
            is_active: true,
          })
          .eq("id", existingId);

        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("department_account_routing")
          .insert({
            dept_id: deptId,
            iet_account_id: ietAccountId,
            officer_user_id: officerUserId,
            is_active: true,
          });

        if (error) throw new Error(error.message);
      }

      setMsg("✅ Department account routing saved.");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Save failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteRoute(routeId: string) {
    const ok = confirm("Delete this routing?");
    if (!ok) return;

    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase
        .from("department_account_routing")
        .delete()
        .eq("id", routeId);

      if (error) throw new Error(error.message);

      setMsg("✅ Routing deleted.");
      await loadAll();
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

  if (!canManage) return null;

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-6xl py-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Department Account Routing
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Assign each department to an IET account and its responsible Account Officer.
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

        <div className="mt-6 space-y-4">
          {depts.map((dept) => {
            const route = routes.find((r) => r.dept_id === dept.id);

            return (
              <RoutingCard
                key={dept.id}
                dept={dept}
                route={route}
                accounts={accounts}
                officers={officers}
                onSave={saveRoute}
                onDelete={deleteRoute}
                saving={saving}
              />
            );
          })}
        </div>
      </div>
    </main>
  );
}

function RoutingCard({
  dept,
  route,
  accounts,
  officers,
  onSave,
  onDelete,
  saving,
}: {
  dept: Dept;
  route?: RouteRow;
  accounts: IetAccount[];
  officers: Officer[];
  onSave: (deptId: string, ietAccountId: string, officerUserId: string, existingId?: string) => Promise<void>;
  onDelete: (routeId: string) => Promise<void>;
  saving: boolean;
}) {
  const [ietAccountId, setIetAccountId] = useState(route?.iet_account_id || "");
  const [officerUserId, setOfficerUserId] = useState(route?.officer_user_id || "");

  useEffect(() => {
    setIetAccountId(route?.iet_account_id || "");
    setOfficerUserId(route?.officer_user_id || "");
  }, [route?.iet_account_id, route?.officer_user_id]);

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="font-bold text-slate-900">{dept.name}</div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-semibold text-slate-800">IET Account</label>
          <select
            value={ietAccountId}
            onChange={(e) => setIetAccountId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900"
          >
            <option value="">-- Select account --</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {accountLabel(a)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-800">Account Officer</label>
          <select
            value={officerUserId}
            onChange={(e) => setOfficerUserId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900"
          >
            <option value="">-- Select officer --</option>
            {officers.map((o) => (
              <option key={o.id} value={o.id}>
                {officerLabel(o)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onSave(dept.id, ietAccountId, officerUserId, route?.id)}
          disabled={saving}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Routing"}
        </button>

        {route?.id && (
          <button
            onClick={() => onDelete(route.id)}
            disabled={saving}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}