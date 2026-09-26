"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Building2,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { REQGEN_VERSION } from "@/lib/version";
import { roleDisplayName } from "@/lib/roles";
import { Donut as SharedDonut } from "@/app/components/ui/Donut";

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  dept_id: string | null;
  created_at: string | null;
};

type DepartmentRow = {
  id: string;
  name: string;
  is_active: boolean | null;
};

type RoleRow = {
  id: string;
  role_key: string;
  role_name: string;
  is_active: boolean;
};

type ProfileRoleRow = {
  profile_id: string;
  role_key: string;
  role_name: string;
  is_primary: boolean;
  is_active: boolean;
};

type AuditRow = Record<string, unknown>;

type DailyPoint = { label: string; count: number };

const ROLE_COLORS = ["var(--color-chart-1)", "var(--color-chart-4)", "var(--color-chart-6)", "var(--color-warning-600)", "var(--color-success-600)", "var(--color-danger-600)", "var(--color-chart-8)", "var(--color-chart-7)"];

function roleKey(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function auditTimestamp(row: AuditRow) {
  const candidates = [row.created_at, row.event_at, row.updated_at, row.timestamp, row.occurred_at];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && !Number.isNaN(new Date(candidate).getTime())) return candidate;
  }
  return null;
}

function buildActivity(rows: AuditRow[]): DailyPoint[] {
  const today = new Date();
  const points: DailyPoint[] = [];
  const counter = new Map<string, number>();

  for (const row of rows) {
    const ts = auditTimestamp(row);
    if (!ts) continue;
    const date = new Date(ts);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    counter.set(key, (counter.get(key) || 0) + 1);
  }

  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(today.getDate() - offset);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    points.push({
      label: date.toLocaleDateString("en-NG", { day: "2-digit", month: "short" }),
      count: counter.get(key) || 0,
    });
  }

  return points;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [profileRoles, setProfileRoles] = useState<ProfileRoleRow[]>([]);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.replace("/login");
      return;
    }

    const me = await supabase
      .from("profiles")
      .select("id,full_name,email,role")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (me.error) {
      setError(`Unable to verify Admin access: ${me.error.message}`);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (roleKey(me.data?.role) !== "admin") {
      router.replace("/unauthorized");
      return;
    }

    const [profileRes, deptRes, roleRes, profileRoleRes, auditRes] = await Promise.all([
      supabase.from("profiles").select("id,email,full_name,role,dept_id,created_at").order("full_name", { ascending: true }),
      supabase.from("departments").select("id,name,is_active").order("name", { ascending: true }),
      supabase.from("reqgen_roles").select("id,role_key,role_name,is_active").order("sort_order", { ascending: true }),
      supabase.from("profile_roles").select("profile_id,role_key,role_name,is_primary,is_active"),
      supabase.from("audit_logs").select("*").limit(500),
    ]);

    const failures = [profileRes, deptRes, roleRes, profileRoleRes]
      .map((res) => res.error?.message)
      .filter(Boolean);

    if (failures.length) setError(failures.join(" • "));

    setProfiles((profileRes.data || []) as ProfileRow[]);
    setDepartments((deptRes.data || []) as DepartmentRow[]);
    setRoles((roleRes.data || []) as RoleRow[]);
    setProfileRoles((profileRoleRes.data || []) as ProfileRoleRow[]);
    setAuditRows(auditRes.error ? [] : ((auditRes.data || []) as AuditRow[]));
    setLoading(false);
    setRefreshing(false);
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  const departmentMap = useMemo(() => new Map(departments.map((dept) => [dept.id, dept.name])), [departments]);

  const activeRoleCount = useMemo(() => roles.filter((role) => role.is_active).length, [roles]);
  const activeDepartments = useMemo(() => departments.filter((dept) => dept.is_active !== false).length, [departments]);

  const primaryRoleByProfile = useMemo(() => {
    const map = new Map<string, string>();
    const sorted = [...profileRoles].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
    for (const row of sorted) {
      if (row.is_active && !map.has(row.profile_id)) map.set(row.profile_id, roleDisplayName(row.role_name || row.role_key));
    }
    return map;
  }, [profileRoles]);

  const roleDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const profile of profiles) {
      const label = roleDisplayName(primaryRoleByProfile.get(profile.id) || profile.role || "Staff");
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [profiles, primaryRoleByProfile]);

  const roleSegments = useMemo(
    () => roleDistribution.map((item, index) => ({ label: item.label, value: item.count, color: ROLE_COLORS[index % ROLE_COLORS.length] })),
    [roleDistribution]
  );

  const activity = useMemo(() => buildActivity(auditRows), [auditRows]);
  const maxActivity = Math.max(1, ...activity.map((point) => point.count));

  const recentUsers = useMemo(
    () => [...profiles]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 8),
    [profiles]
  );

  if (loading) {
    return <main className="admin-v3-page"><div className="admin-v3-loading">Loading live administration data…</div></main>;
  }

  return (
    <main className="admin-v3-page">
      <header className="admin-v3-header">
        <div>
          <h1>Administration Overview</h1>
          <p>Live users, roles, departments and administrative health in one controlled workspace.</p>
        </div>
        <button className="admin-v3-secondary" type="button" onClick={() => void load(true)} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? "admin-v3-spin" : ""} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {error ? <div className="admin-v3-alert" role="alert">{error}</div> : null}

      <section className="admin-v3-kpis" aria-label="Administration KPIs">
        <KpiCard label="Total Users" value={profiles.length} note={`${profiles.length} registered profiles`} icon={<UserRound size={22} />} />
        <KpiCard label="Departments" value={departments.length} note={`${activeDepartments} active`} icon={<Building2 size={22} />} />
        <KpiCard label="Roles" value={activeRoleCount} note={`${roles.length} configured roles`} icon={<ShieldCheck size={22} />} />
        <KpiCard label="System Health" value={error ? "Review" : "Online"} note={error ? "One or more sources need attention" : "Core admin sources operational"} icon={<Activity size={22} />} tone={error ? "amber" : "green"} />
      </section>

      <section className="admin-v3-grid admin-v3-grid-3">
        <article className="admin-v3-card">
          <div className="admin-v3-card-head"><div><h2>Users by Role</h2><p>Live primary-role distribution</p></div></div>
          <div className="admin-v3-donut-wrap">
            <SharedDonut segments={roleSegments} size={116} strokeWidth={22} centerLabel="Users" />
            <div className="admin-v3-legend">
              {roleDistribution.length ? roleDistribution.map((item, index) => (
                <div key={item.label}><i style={{ background: ROLE_COLORS[index % ROLE_COLORS.length] }} /><span>{item.label}</span><strong>{item.count}</strong></div>
              )) : <p className="admin-v3-empty">No user-role data available.</p>}
            </div>
          </div>
        </article>

        <article className="admin-v3-card">
          <div className="admin-v3-card-head"><div><h2>User Activity</h2><p>Live audit events - last 14 days</p></div></div>
          {auditRows.length ? (
            <div className="admin-v3-bars" aria-label="Audit events by day">
              {activity.map((point, index) => (
                <div className="admin-v3-bar-col" key={`${point.label}-${index}`} title={`${point.label}: ${point.count} events`}>
                  <div className="admin-v3-bar-value">{point.count || ""}</div>
                  <div className="admin-v3-bar" style={{ height: `${Math.max(point.count ? 10 : 2, (point.count / maxActivity) * 100)}%` }} />
                  <span>{index % 2 === 0 ? point.label : ""}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="admin-v3-empty-state"><Activity size={26} /><strong>Audit activity unavailable</strong><span>No readable audit-log dataset was returned. ReqGen will not fabricate chart values.</span></div>
          )}
        </article>

        <article className="admin-v3-card">
          <div className="admin-v3-card-head"><div><h2>Departments</h2><p>Live organisational structure</p></div><Link href="/admin/departments">View all</Link></div>
          <div className="admin-v3-dept-ring"><div><strong>{departments.length}</strong><span>Departments</span></div></div>
          <div className="admin-v3-dept-list">
            {departments.map((dept) => <div key={dept.id}><span>{dept.name}</span><b className={dept.is_active === false ? "is-inactive" : "is-active"}>{dept.is_active === false ? "Inactive" : "Active"}</b></div>)}
            {!departments.length ? <p className="admin-v3-empty">No departments found.</p> : null}
          </div>
        </article>
      </section>

      <section className="admin-v3-card admin-v3-recent">
        <div className="admin-v3-card-head">
          <div><h2>Recent Users</h2><p>Newest user profiles in ReqGen</p></div>
          <Link href="/admin/users">View All Users</Link>
        </div>
        <div className="admin-v3-table-scroll">
          <table className="admin-v3-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>
              {recentUsers.map((user) => (
                <tr key={user.id}>
                  <td><strong>{user.full_name || "Unnamed user"}</strong></td>
                  <td>{user.email || "—"}</td>
                  <td>{primaryRoleByProfile.get(user.id) || user.role || "Staff"}</td>
                  <td>{user.dept_id ? departmentMap.get(user.dept_id) || "Unknown department" : "—"}</td>
                  <td><span className="admin-v3-status is-active">Active</span></td>
                  <td>{formatDate(user.created_at)}</td>
                </tr>
              ))}
              {!recentUsers.length ? <tr><td colSpan={6} className="admin-v3-empty">No users found.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="admin-v3-inline-release">ReqGen administration workspace • Version {REQGEN_VERSION}</footer>
    </main>
  );
}

function KpiCard({ label, value, note, icon, tone = "blue" }: { label: string; value: string | number; note: string; icon: ReactNode; tone?: "blue" | "green" | "amber" }) {
  return (
    <article className={`admin-v3-kpi is-${tone}`}>
      <div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
      <div className="admin-v3-kpi-icon">{icon}</div>
    </article>
  );
}
