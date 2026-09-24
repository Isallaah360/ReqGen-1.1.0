"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
};

type ProfileRoleRow = {
  profile_id: string;
  role_key: string;
  is_active: boolean | null;
};

type AppSettingRow = { key: string; value: string | null };

type OfficerSetting = {
  key: string;
  label: string;
  description: string;
  roleKeys: string[];
};

const OFFICER_SETTINGS: OfficerSetting[] = [
  { key: "REGISTRY_USER_ID", label: "Registry Officer", description: "Primary Registry operational officer.", roleKeys: ["registry"] },
  { key: "REGISTRAR_USER_ID", label: "Registrar", description: "Canonical Registrar workflow officer.", roleKeys: ["registrar"] },
  { key: "DIN_ADMIN_USER_ID", label: "DIN Admin", description: "Canonical DIN Administration workflow officer.", roleKeys: ["dinadmin", "deanadmin"] },
  { key: "DG_USER_ID", label: "Director General (DG)", description: "Director General workflow approver.", roleKeys: ["dg"] },
  { key: "HR_USER_ID", label: "Human Resources (HR)", description: "Primary HR workflow officer.", roleKeys: ["hr", "hrboss", "hrofficer", "hrofficer1", "hrofficer2", "hrofficer3"] },
  { key: "GENSEC_USER_ID", label: "General Secretary", description: "General Secretary workflow officer.", roleKeys: ["gensec", "generalsecretary"] },
  { key: "ACCOUNT_USER_ID_1", label: "Account Officer 1", description: "First authorised Account Officer assignment.", roleKeys: ["account", "accounts", "accountofficer"] },
  { key: "ACCOUNT_USER_ID_2", label: "Account Officer 2", description: "Second authorised Account Officer assignment.", roleKeys: ["account", "accounts", "accountofficer"] },
  { key: "ACCOUNT_USER_ID_3", label: "Account Officer 3", description: "Third authorised Account Officer assignment.", roleKeys: ["account", "accounts", "accountofficer"] },
];

function roleKey(role: string | null | undefined) {
  const normalized = String(role || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  return normalized === "deanadmin" ? "dinadmin" : normalized;
}

function canonicalRoleLabel(role: string | null | undefined) {
  const key = roleKey(role);
  if (key === "dinadmin") return "DIN Admin";
  if (key === "gensec" || key === "generalsecretary") return "General Secretary";
  if (["account", "accounts", "accountofficer"].includes(key)) return "Account Officer";
  if (["hr", "hrboss", "hrofficer", "hrofficer1", "hrofficer2", "hrofficer3"].includes(key)) return "HR";
  if (key === "registrar") return "Registrar";
  if (key === "registry") return "Registry";
  if (key === "dg") return "DG";
  return String(role || "Staff").trim() || "Staff";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [profileRoles, setProfileRoles] = useState<ProfileRoleRow[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});

  async function loadAll() {
    setMsg(null);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      router.replace("/login");
      return;
    }

    const me = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (me.error || roleKey(me.data?.role) !== "admin") {
      router.replace("/unauthorized");
      return;
    }

    const keys = [...OFFICER_SETTINGS.map((item) => item.key), "ACCOUNT_USER_ID"];
    const [profilesRes, rolesRes, settingsRes] = await Promise.all([
      supabase.from("profiles").select("id,email,full_name,role").order("full_name", { ascending: true }),
      supabase.from("profile_roles").select("profile_id,role_key,is_active").eq("is_active", true),
      supabase.from("app_settings").select("key,value").in("key", keys),
    ]);

    if (profilesRes.error) setMsg("Unable to load users: " + profilesRes.error.message);
    else setUsers((profilesRes.data || []) as UserRow[]);

    if (!rolesRes.error) setProfileRoles((rolesRes.data || []) as ProfileRoleRow[]);

    if (settingsRes.error) {
      setMsg((current) => current || "Unable to load workflow settings: " + settingsRes.error.message);
    } else {
      const next: Record<string, string> = {};
      ((settingsRes.data || []) as AppSettingRow[]).forEach((row) => { next[row.key] = row.value || ""; });
      // Backward compatibility: older releases used ACCOUNT_USER_ID only.
      if (!next.ACCOUNT_USER_ID_1 && next.ACCOUNT_USER_ID) next.ACCOUNT_USER_ID_1 = next.ACCOUNT_USER_ID;
      setSettings(next);
    }

    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAll(); }, 0);
    return () => window.clearTimeout(timer);
    // loadAll is intentionally invoked once for the authenticated settings workspace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roleMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    users.forEach((user) => map.set(user.id, new Set([roleKey(user.role)])));
    profileRoles.forEach((assignment) => {
      const current = map.get(assignment.profile_id) || new Set<string>();
      current.add(roleKey(assignment.role_key));
      map.set(assignment.profile_id, current);
    });
    return map;
  }, [users, profileRoles]);

  function eligibleUsers(item: OfficerSetting) {
    const allowed = new Set(item.roleKeys.map(roleKey));
    return users.filter((user) => {
      const roles = roleMap.get(user.id) || new Set<string>();
      return [...roles].some((role) => allowed.has(role));
    });
  }

  function userLabel(user: UserRow) {
    const name = user.full_name?.trim() || "Unnamed User";
    const email = user.email?.trim() || user.id;
    const roles = [...(roleMap.get(user.id) || new Set<string>())].filter(Boolean).map(canonicalRoleLabel);
    return `${name} · ${email}${roles.length ? ` · ${[...new Set(roles)].join(" / ")}` : ""}`;
  }

  async function saveSetting(item: OfficerSetting) {
    const value = settings[item.key] || "";
    setSavingKey(item.key);
    setMsg(null);
    try {
      const payloads = [{ key: item.key, value }];
      // Preserve the legacy key for existing workflow/database functions.
      if (item.key === "ACCOUNT_USER_ID_1") payloads.push({ key: "ACCOUNT_USER_ID", value });
      const { error } = await supabase.from("app_settings").upsert(payloads);
      if (error) throw new Error(error.message);
      setMsg(`✅ ${item.label} saved successfully and will be used by global workflow routing.`);
    } catch (error: unknown) {
      setMsg("❌ Save failed: " + errorMessage(error));
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) {
    return <main className="admin-v4-page"><div className="admin-v3-loading">Loading system settings…</div></main>;
  }

  const accountSettings = OFFICER_SETTINGS.filter((item) => item.key.startsWith("ACCOUNT_USER_ID_"));
  const workflowSettings = OFFICER_SETTINGS.filter((item) => !item.key.startsWith("ACCOUNT_USER_ID_"));

  return (
    <main className="admin-v4-page">
      <header className="admin-v4-page-header">
        <div>
          <h1>System Settings</h1>
          <p>Configure canonical workflow officers once and reuse the assignments across authorised ReqGen routes.</p>
        </div>
        <button type="button" className="reqgen-btn reqgen-btn-slate" onClick={() => router.push("/admin")}>Back to Admin</button>
      </header>

      {msg ? <div className="admin-v4-feedback" role="status">{msg}</div> : null}

      <section className="admin-v4-settings-grid">
        <div className="admin-v4-settings-card">
          <div className="admin-v4-card-title">
            <div><h2>Global Workflow Officers</h2><p>Assignments used by institutional request-routing and approval workflows.</p></div>
            <span>{workflowSettings.length} positions</span>
          </div>
          <div className="admin-v4-setting-list">
            {workflowSettings.map((item) => {
              const eligible = eligibleUsers(item);
              return (
                <div className="admin-v4-setting-row" key={item.key}>
                  <div className="admin-v4-setting-copy"><strong>{item.label}</strong><span>{item.description}</span></div>
                  <select value={settings[item.key] || ""} onChange={(event) => setSettings((current) => ({ ...current, [item.key]: event.target.value }))}>
                    <option value="">Select authorised user</option>
                    {eligible.map((user) => <option key={user.id} value={user.id}>{userLabel(user)}</option>)}
                  </select>
                  <button type="button" className="reqgen-btn reqgen-btn-blue" disabled={savingKey === item.key} onClick={() => void saveSetting(item)}>{savingKey === item.key ? "Saving…" : "Save"}</button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="admin-v4-settings-card">
          <div className="admin-v4-card-title">
            <div><h2>Account Officers</h2><p>Assign the three authorised accounting officers used by Finance and Payment Voucher workflows.</p></div>
            <span>3 officers</span>
          </div>
          <div className="admin-v4-setting-list">
            {accountSettings.map((item) => {
              const eligible = eligibleUsers(item);
              return (
                <div className="admin-v4-setting-row" key={item.key}>
                  <div className="admin-v4-setting-copy"><strong>{item.label}</strong><span>{item.description}</span></div>
                  <select value={settings[item.key] || ""} onChange={(event) => setSettings((current) => ({ ...current, [item.key]: event.target.value }))}>
                    <option value="">Select Account Officer</option>
                    {eligible.map((user) => <option key={user.id} value={user.id}>{userLabel(user)}</option>)}
                  </select>
                  <button type="button" className="reqgen-btn reqgen-btn-emerald" disabled={savingKey === item.key} onClick={() => void saveSetting(item)}>{savingKey === item.key ? "Saving…" : "Save"}</button>
                </div>
              );
            })}
          </div>
          <div className="admin-v4-note">Account Officer 1 is also mirrored to the legacy <code>ACCOUNT_USER_ID</code> setting so existing workflow/database functions remain compatible.</div>
        </div>
      </section>
    </main>
  );
}
