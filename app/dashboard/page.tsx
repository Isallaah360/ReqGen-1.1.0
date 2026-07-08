"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  full_name: string;
  role: string;
  gender: string | null;
  phone: string | null;
  dept_id: string | null;
  signature_url: string | null;
};

type ProfileRole = {
  id: string;
  profile_id: string;
  role_key: string;
  role_name: string;
  is_primary: boolean;
  is_active: boolean;
};

type QuickCard = {
  title: string;
  description: string;
  href: string;
  tone: "blue" | "emerald" | "purple" | "amber" | "red" | "slate";
};

type SecurityStatus = {
  hasVerifiedTotp: boolean;
  currentLevel: string | null;
  nextLevel: string | null;
  factorCount: number;
};

type DashboardCounts = {
  pendingMyApproval: number;
  mySubmittedRequests: number;
  myCompletedRequests: number;
  myRejectedRequests: number;

  poAssignedToMe: number;
  dodAssignedToMe: number;
  dinAdminAssignedToMe: number;
  registrarAssignedToMe: number;
  hodAssignedToMe: number;
  hrAssignedToMe: number;
  dgAssignedToMe: number;
  accountStageAssignedToMe: number;
  hrFilingAssignedToMe: number;

  paymentPrintReady: number;
  unreadNotifications: number;
};

function roleKey(role: string | null | undefined) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function countValue(value: number | null | undefined) {
  return Number(value || 0).toLocaleString();
}

function securityBadgeClass(ok: boolean) {
  return ok
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-red-200 bg-red-50 text-red-700";
}

function hasAnyRole(roleSet: Set<string>, keys: string[]) {
  return keys.some((key) => roleSet.has(roleKey(key)));
}

function roleSummary(profileRole: string | null | undefined, profileRoles: ProfileRole[]) {
  const active = profileRoles.filter((r) => r.is_active);

  if (active.length === 0) return profileRole || "Staff";

  return active
    .slice()
    .sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return a.role_name.localeCompare(b.role_name);
    })
    .map((r) => r.role_name)
    .join(", ");
}

function roleBadgeClass(role: string | null | undefined) {
  const rk = roleKey(role);

  if (rk === "admin") return "border-red-200 bg-red-50 text-red-700";
  if (rk === "auditor") return "border-purple-200 bg-purple-50 text-purple-700";

  if (["account", "accounts", "accountofficer", "pvsigner", "pvcountersigner"].includes(rk)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    [
      "po",
      "dod",
      "director",
      "hod",
      "dg",
      "registrar",
      "dinadmin",
      "dinadmin1",
      "dinadmin2",
      "dinadmin3",
      "gensec",
    ].includes(rk)
  ) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (["hr", "hrofficer1", "hrofficer2", "hrofficer3", "registry"].includes(rk)) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileRoles, setProfileRoles] = useState<ProfileRole[]>([]);
  const [deptName, setDeptName] = useState<string>("");

  const [security, setSecurity] = useState<SecurityStatus>({
    hasVerifiedTotp: false,
    currentLevel: null,
    nextLevel: null,
    factorCount: 0,
  });

  const [counts, setCounts] = useState<DashboardCounts>({
    pendingMyApproval: 0,
    mySubmittedRequests: 0,
    myCompletedRequests: 0,
    myRejectedRequests: 0,

    poAssignedToMe: 0,
    dodAssignedToMe: 0,
    dinAdminAssignedToMe: 0,
    registrarAssignedToMe: 0,
    hodAssignedToMe: 0,
    hrAssignedToMe: 0,
    dgAssignedToMe: 0,
    accountStageAssignedToMe: 0,
    hrFilingAssignedToMe: 0,

    paymentPrintReady: 0,
    unreadNotifications: 0,
  });

  const roleSet = useMemo(() => {
    const set = new Set<string>();

    if (profile?.role) set.add(roleKey(profile.role));

    profileRoles.forEach((r) => {
      if (r.is_active) set.add(roleKey(r.role_key));
    });

    return set;
  }, [profile?.role, profileRoles]);

  const isAdmin = hasAnyRole(roleSet, ["admin", "auditor"]);

  const canFinance = hasAnyRole(roleSet, [
    "admin",
    "auditor",
    "account",
    "accounts",
    "accountofficer",
    "pvsigner",
    "pvcountersigner",
  ]);

  const canHR = hasAnyRole(roleSet, [
    "admin",
    "auditor",
    "hr",
    "hrofficer1",
    "hrofficer2",
    "hrofficer3",
  ]);

  const canRegistry = hasAnyRole(roleSet, ["admin", "auditor", "registry"]);

  const isAccountRole = hasAnyRole(roleSet, ["account", "accounts", "accountofficer"]);
  const isDinAdminRole = hasAnyRole(roleSet, ["dinadmin", "dinadmin1", "dinadmin2", "dinadmin3"]);
  const isHrRole = hasAnyRole(roleSet, ["hr", "hrofficer1", "hrofficer2", "hrofficer3"]);
  const isPoRole = hasAnyRole(roleSet, ["po"]);
  const isDodRole = hasAnyRole(roleSet, ["dod", "director"]);
  const isRegistrarRole = hasAnyRole(roleSet, ["registrar"]);
  const isHodRole = hasAnyRole(roleSet, ["hod"]);
  const isDgRole = hasAnyRole(roleSet, ["dg"]);

  const isSessionMfaVerified = security.currentLevel === "aal2";
  const isMfaSetupComplete = security.hasVerifiedTotp;

  async function countAssignedStage(userId: string, stage: string) {
    const { count } = await supabase
      .from("requests")
      .select("*", { count: "exact", head: true })
      .eq("current_owner", userId)
      .eq("current_stage", stage)
      .not("status", "in", '("Rejected","Deleted","Cancelled","Paid","Closed","Completed")');

    return Number(count || 0);
  }

  async function loadCounts(userId: string, activeRoles: Set<string>) {
    const financeRole = hasAnyRole(activeRoles, [
      "admin",
      "auditor",
      "account",
      "accounts",
      "accountofficer",
      "pvsigner",
      "pvcountersigner",
    ]);

    const [
      pendingApprovalRes,
      submittedRes,
      completedRes,
      rejectedRes,
      poCount,
      dodCount,
      dinAdminCount,
      registrarCount,
      hodCount,
      hrCount,
      dgCount,
      accountCount,
      hrFilingCount,
      unreadNotifRes,
    ] = await Promise.all([
      supabase
        .from("requests")
        .select("*", { count: "exact", head: true })
        .eq("current_owner", userId)
        .not("status", "in", '("Rejected","Deleted","Cancelled","Paid","Closed","Completed")'),

      supabase
        .from("requests")
        .select("*", { count: "exact", head: true })
        .eq("created_by", userId),

      supabase
        .from("requests")
        .select("*", { count: "exact", head: true })
        .eq("created_by", userId)
        .in("status", ["Completed", "Paid"]),

      supabase
        .from("requests")
        .select("*", { count: "exact", head: true })
        .eq("created_by", userId)
        .in("status", ["Rejected", "Deleted", "Cancelled"]),

      countAssignedStage(userId, "PO"),
      countAssignedStage(userId, "DOD"),
      countAssignedStage(userId, "DIN Admin"),
      countAssignedStage(userId, "Registrar"),
      countAssignedStage(userId, "HOD"),
      countAssignedStage(userId, "HR"),
      countAssignedStage(userId, "DG"),
      countAssignedStage(userId, "Account"),
      countAssignedStage(userId, "HR Filing"),

      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false),
    ]);

    let paymentPrintReady = 0;

    if (financeRole) {
      const { count } = await supabase
        .from("requests")
        .select("*", { count: "exact", head: true })
        .in("status", ["Paid", "Completed"])
        .or("request_type.eq.Official,personal_category.eq.Fund");

      paymentPrintReady = Number(count || 0);
    }

    setCounts({
      pendingMyApproval: Number(pendingApprovalRes.count || 0),
      mySubmittedRequests: Number(submittedRes.count || 0),
      myCompletedRequests: Number(completedRes.count || 0),
      myRejectedRequests: Number(rejectedRes.count || 0),

      poAssignedToMe: poCount,
      dodAssignedToMe: dodCount,
      dinAdminAssignedToMe: dinAdminCount,
      registrarAssignedToMe: registrarCount,
      hodAssignedToMe: hodCount,
      hrAssignedToMe: hrCount,
      dgAssignedToMe: dgCount,
      accountStageAssignedToMe: accountCount,
      hrFilingAssignedToMe: hrFilingCount,

      paymentPrintReady,
      unreadNotifications: Number(unreadNotifRes.count || 0),
    });
  }

  async function load(options?: { silent?: boolean }) {
    if (options?.silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setMsg(null);

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) {
      router.push("/login");
      return;
    }

    const [profRes, profileRolesRes, factorsRes, aalRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,full_name,role,gender,phone,dept_id,signature_url")
        .eq("id", user.id)
        .single(),

      supabase
        .from("profile_roles")
        .select("id,profile_id,role_key,role_name,is_primary,is_active")
        .eq("profile_id", user.id)
        .eq("is_active", true),

      supabase.auth.mfa.listFactors(),

      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);

    if (profRes.error) {
      setMsg("Failed to load profile: " + profRes.error.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const profileRow = profRes.data as Profile;
    const activeProfileRoles = (profileRolesRes.data || []) as ProfileRole[];

    setProfile(profileRow);
    setProfileRoles(activeProfileRoles);

    const nextRoleSet = new Set<string>();

    if (profileRow.role) nextRoleSet.add(roleKey(profileRow.role));

    activeProfileRoles.forEach((r) => {
      if (r.is_active) nextRoleSet.add(roleKey(r.role_key));
    });

    if (factorsRes.error) {
      setSecurity({
        hasVerifiedTotp: false,
        currentLevel: aalRes.data?.currentLevel || null,
        nextLevel: aalRes.data?.nextLevel || null,
        factorCount: 0,
      });
    } else {
      const verifiedTotpFactors = factorsRes.data.totp.filter(
        (factor) => factor.status === "verified"
      );

      setSecurity({
        hasVerifiedTotp: verifiedTotpFactors.length > 0,
        currentLevel: aalRes.data?.currentLevel || null,
        nextLevel: aalRes.data?.nextLevel || null,
        factorCount: verifiedTotpFactors.length,
      });
    }

    if (profileRow.dept_id) {
      const { data: dept } = await supabase
        .from("departments")
        .select("name")
        .eq("id", profileRow.dept_id)
        .single();

      setDeptName(dept?.name || "");
    } else {
      setDeptName("");
    }

    await loadCounts(user.id, nextRoleSet);

    setLoading(false);
    setRefreshing(false);
  }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quickCards = useMemo<QuickCard[]>(() => {
    const cards: QuickCard[] = [
      {
        title: "Create New Request",
        description:
          "Start an Official request or a Personal request such as Fund, Leave, Contract Renewal, Resignation or Others.",
        href: "/requests/new",
        tone: "blue",
      },
      {
        title: "My Requests",
        description: "Track all requests you have submitted and review their workflow progress.",
        href: "/requests",
        tone: "slate",
      },
      {
        title: "Approvals",
        description:
          "Review requests currently assigned to you as PO, DOD, Registrar, HOD, HR, DG, AccountOfficer or HR Filing officer.",
        href: "/approvals",
        tone: counts.pendingMyApproval > 0 ? "red" : "emerald",
      },
    ];

    if (canFinance) {
      cards.push(
        {
          title: "Finance Control Center",
          description: "Open the central finance dashboard for setup, subheads, vouchers and reports.",
          href: "/finance",
          tone: "blue",
        },
        {
          title: "Departments",
          description: "Open department records and finance structure.",
          href: "/finance/departments",
          tone: "slate",
        },
        {
          title: "Manage Accounts",
          description: "Manage IET bank accounts, account officers and balances.",
          href: "/finance/manage-accounts",
          tone: "emerald",
        },
        {
          title: "Subheads / Finance",
          description: "Manage subheads, allocations, reserves, expenditure and balances.",
          href: "/finance/subheads",
          tone: "blue",
        },
        {
          title: "Payment Vouchers",
          description: "Generate, manage, sign, print and track payment vouchers.",
          href: "/payment-vouchers",
          tone: "purple",
        },
        {
          title: "PV Reports",
          description: "View payment voucher audit reports by date, status, mode and scope.",
          href: "/payment-vouchers/reports",
          tone: "amber",
        }
      );
    }

    if (canHR) {
      cards.push({
        title: "HR Filing",
        description:
          "Handle final HR filing for Personal Fund, Leave, Contract Renewal, Resignation and Others.",
        href: "/hr/filing",
        tone: counts.hrFilingAssignedToMe > 0 ? "red" : "emerald",
      });
    }

    if (canRegistry) {
      cards.push({
        title: "Registry Desk",
        description:
          "Monitor department submissions, DG pending requests and reminder activity. Registry is not an approval stage.",
        href: "/registry",
        tone: "amber",
      });
    }

    if (isAdmin) {
      cards.push(
        {
          title: "Users & Multiple Roles",
          description: "Manage users, signatures, multiple role assignment and access control.",
          href: "/admin/users",
          tone: "red",
        },
        {
          title: "Roles & Permissions",
          description:
            "Manage system roles including PO, DOD, Registrar, HR, DG and AccountOfficer roles.",
          href: "/admin/roles",
          tone: "purple",
        },
        {
          title: "Admin Routing Panel",
          description: "Manage global officers, department DOD/HOD/PO routing and system settings.",
          href: "/admin",
          tone: "red",
        },
        {
          title: "PV Settings",
          description: "Manage authorized cheque signers and counter signers.",
          href: "/payment-vouchers/settings",
          tone: "red",
        },
        {
          title: "Audit & Reconciliation",
          description: "Review finance records and reconciliation activities.",
          href: "/finance/audit",
          tone: "slate",
        },
        {
          title: "Security Checklist",
          description: "Review MFA, backup, RLS and production security controls.",
          href: "/admin/security",
          tone: "red",
        }
      );
    }

    return cards;
  }, [
    canFinance,
    canHR,
    canRegistry,
    isAdmin,
    counts.pendingMyApproval,
    counts.hrFilingAssignedToMe,
  ]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-7xl py-10 text-slate-600">Loading dashboard...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-7xl py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Dashboard</h1>
            <p className="mt-2 text-sm text-slate-600">
              Welcome back. Your live request counts and role-based shortcuts are shown below.
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Final workflow supports PO, DOD, DIN Admin, Registrar, HOD, HR, DG, AccountOfficer
              and HR Filing stages.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => load({ silent: true })}
              disabled={refreshing}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100 disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => router.push("/admin/security")}
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
              >
                Security Checklist
              </button>
            )}

            <button
              type="button"
              onClick={() => router.push("/profile")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
            >
              My Profile
            </button>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm">
            {msg}
          </div>
        )}

        {profile && (
          <>
            <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">Live Request Counts</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    These numbers update from live workflow records. Click Pending My Approval to
                    take action.
                  </p>
                </div>

                <span
                  className={`rounded-full border px-3 py-1 text-xs font-bold ${roleBadgeClass(
                    profile.role || "Staff"
                  )}`}
                >
                  {roleSummary(profile.role, profileRoles)}
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <NumberCountCard
                  label="Pending My Approval"
                  value={counts.pendingMyApproval}
                  helper="Assigned to you now"
                  tone={counts.pendingMyApproval > 0 ? "red" : "emerald"}
                  onClick={() => router.push("/approvals")}
                />

                <NumberCountCard
                  label="My Submitted Requests"
                  value={counts.mySubmittedRequests}
                  helper="Total created by you"
                  tone="blue"
                  onClick={() => router.push("/requests")}
                />

                <NumberCountCard
                  label="Completed / Paid"
                  value={counts.myCompletedRequests}
                  helper="Your successful requests"
                  tone="emerald"
                  onClick={() => router.push("/requests")}
                />

                <NumberCountCard
                  label="Unread Notifications"
                  value={counts.unreadNotifications}
                  helper="Unread workflow alerts"
                  tone={counts.unreadNotifications > 0 ? "amber" : "slate"}
                  onClick={() => router.push("/approvals")}
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {(isPoRole || counts.poAssignedToMe > 0) && (
                  <NumberCountCard
                    label="PO Stage"
                    value={counts.poAssignedToMe}
                    helper="Awaiting Programme Officer review"
                    tone={counts.poAssignedToMe > 0 ? "red" : "slate"}
                    onClick={() => router.push("/approvals")}
                  />
                )}

                {(isDodRole || counts.dodAssignedToMe > 0) && (
                  <NumberCountCard
                    label="DOD Stage"
                    value={counts.dodAssignedToMe}
                    helper="Awaiting Director of Department review"
                    tone={counts.dodAssignedToMe > 0 ? "red" : "slate"}
                    onClick={() => router.push("/approvals")}
                  />
                )}

                {(isDinAdminRole || counts.dinAdminAssignedToMe > 0) && (
                  <NumberCountCard
                    label="DIN Admin Stage"
                    value={counts.dinAdminAssignedToMe}
                    helper="Official DIN requests awaiting review"
                    tone={counts.dinAdminAssignedToMe > 0 ? "red" : "slate"}
                    onClick={() => router.push("/approvals")}
                  />
                )}

                {(isRegistrarRole || counts.registrarAssignedToMe > 0) && (
                  <NumberCountCard
                    label="Registrar Stage"
                    value={counts.registrarAssignedToMe}
                    helper="DIN Official requests awaiting Registrar"
                    tone={counts.registrarAssignedToMe > 0 ? "red" : "slate"}
                    onClick={() => router.push("/approvals")}
                  />
                )}

                {(isHodRole || counts.hodAssignedToMe > 0) && (
                  <NumberCountCard
                    label="HOD Stage"
                    value={counts.hodAssignedToMe}
                    helper="Awaiting HOD review"
                    tone={counts.hodAssignedToMe > 0 ? "red" : "slate"}
                    onClick={() => router.push("/approvals")}
                  />
                )}

                {(isHrRole || counts.hrAssignedToMe > 0) && (
                  <NumberCountCard
                    label="HR Stage"
                    value={counts.hrAssignedToMe}
                    helper="Awaiting HR review"
                    tone={counts.hrAssignedToMe > 0 ? "red" : "slate"}
                    onClick={() => router.push("/approvals")}
                  />
                )}

                {(isDgRole || counts.dgAssignedToMe > 0) && (
                  <NumberCountCard
                    label="DG Stage"
                    value={counts.dgAssignedToMe}
                    helper="Awaiting DG approval"
                    tone={counts.dgAssignedToMe > 0 ? "red" : "slate"}
                    onClick={() => router.push("/approvals")}
                  />
                )}

                {(isAccountRole || counts.accountStageAssignedToMe > 0) && (
                  <NumberCountCard
                    label="Account Stage"
                    value={counts.accountStageAssignedToMe}
                    helper="Awaiting treatment/payment"
                    tone={counts.accountStageAssignedToMe > 0 ? "red" : "slate"}
                    onClick={() => router.push("/approvals")}
                  />
                )}

                {(isHrRole || counts.hrFilingAssignedToMe > 0) && (
                  <NumberCountCard
                    label="HR Filing Stage"
                    value={counts.hrFilingAssignedToMe}
                    helper="Awaiting final HR filing"
                    tone={counts.hrFilingAssignedToMe > 0 ? "red" : "slate"}
                    onClick={() => router.push("/approvals")}
                  />
                )}

                {isAccountRole && (
                  <NumberCountCard
                    label="Payment / PV Ready"
                    value={counts.paymentPrintReady}
                    helper="Paid/completed payment records"
                    tone="purple"
                    onClick={() => router.push("/payment-vouchers")}
                  />
                )}
              </div>

              {counts.pendingMyApproval > 0 && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                  You have {countValue(counts.pendingMyApproval)} request(s) waiting for your
                  action. Open Approvals to treat them.
                </div>
              )}
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-3">
              <div className="rounded-3xl border bg-white p-6 shadow-sm xl:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900">Profile Summary</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Your account, department, active roles and signature status.
                    </p>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${roleBadgeClass(
                      profile.role || "Staff"
                    )}`}
                  >
                    {profile.role || "Staff"}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Info label="Name" value={profile.full_name} />
                  <Info label="Primary Fallback Role" value={profile.role} />
                  <Info label="Active Roles" value={roleSummary(profile.role, profileRoles)} />
                  <Info label="Department" value={deptName || "—"} />
                  <Info label="Gender" value={profile.gender || "—"} />
                  <Info label="Phone" value={profile.phone || "—"} />
                  <Info
                    label="Signature"
                    value={profile.signature_url ? "Uploaded ✅" : "Not uploaded ❌"}
                  />
                </div>

                {!profile.signature_url && (
                  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    You must upload your signature in <b>My Profile</b> before submitting or treating
                    requests that require signatures.
                  </div>
                )}
              </div>

              <div className="rounded-3xl border bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900">Security Status</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Your current login and 2FA protection status.
                    </p>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${securityBadgeClass(
                      isSessionMfaVerified
                    )}`}
                  >
                    {isSessionMfaVerified ? "Secure Session" : "Not Verified"}
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  <SecurityLine
                    label="2FA Setup"
                    value={isMfaSetupComplete ? "Completed" : "Required"}
                    ok={isMfaSetupComplete}
                  />

                  <SecurityLine
                    label="Current Session"
                    value={isSessionMfaVerified ? "MFA Verified" : "Password Only"}
                    ok={isSessionMfaVerified}
                  />

                  <SecurityLine
                    label="Assurance Level"
                    value={`${security.currentLevel || "unknown"} → ${security.nextLevel || "unknown"
                      }`}
                    ok={isSessionMfaVerified}
                  />

                  <SecurityLine
                    label="Authenticator Factors"
                    value={String(security.factorCount)}
                    ok={security.factorCount > 0}
                  />
                </div>

                {!isMfaSetupComplete && (
                  <button
                    type="button"
                    onClick={() => router.push("/mfa/setup")}
                    className="mt-5 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
                  >
                    Set Up 2FA
                  </button>
                )}

                {isMfaSetupComplete && !isSessionMfaVerified && (
                  <button
                    type="button"
                    onClick={() => router.push("/mfa")}
                    className="mt-5 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
                  >
                    Verify 2FA
                  </button>
                )}

                {isMfaSetupComplete && isSessionMfaVerified && (
                  <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                    Your account is protected with authenticator app 2FA.
                  </div>
                )}

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-700">
                  Do not share your password or authenticator code. ReqGen will automatically log
                  out inactive users.
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">Quick Access</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Shortcuts are shown based on your active multiple roles.
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  {quickCards.length} shortcuts
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {quickCards.map((card) => (
                  <QuickAccessCard
                    key={card.href}
                    title={card.title}
                    description={card.description}
                    tone={card.tone}
                    onClick={() => router.push(card.href)}
                  />
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
              <div className="font-bold">Dashboard Note</div>
              <p className="mt-1">
                ReqGen now supports final routing for Official DIN, General Admin, ASAP-ALLI,
                Welfare, Liaison, Personal Fund and Personal Other requests, with multiple-role
                users, exact actor role tracking, finance subheads, payment vouchers, SMS/Email OTP,
                2FA approval protection and audit-ready request history.
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function SecurityLine({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </div>
          <div className="mt-1 text-sm font-bold text-slate-900">{value}</div>
        </div>

        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${securityBadgeClass(
            ok
          )}`}
        >
          {ok ? "OK" : "Action"}
        </span>
      </div>
    </div>
  );
}

function NumberCountCard({
  label,
  value,
  helper,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  helper: string;
  tone: "blue" | "emerald" | "purple" | "amber" | "red" | "slate";
  onClick?: () => void;
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "purple"
        ? "border-purple-200 bg-purple-50 text-purple-800"
        : tone === "amber"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : tone === "red"
            ? "border-red-200 bg-red-50 text-red-800"
            : tone === "slate"
              ? "border-slate-200 bg-slate-50 text-slate-800"
              : "border-blue-200 bg-blue-50 text-blue-800";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border p-5 text-left shadow-sm transition hover:shadow-md ${toneClass}`}
    >
      <div className="text-xs font-black uppercase tracking-wide opacity-75">{label}</div>
      <div className="mt-3 text-4xl font-black leading-none">{countValue(value)}</div>
      <div className="mt-2 text-sm font-semibold opacity-90">{helper}</div>
    </button>
  );
}

function QuickAccessCard({
  title,
  description,
  tone,
  onClick,
}: {
  title: string;
  description: string;
  tone: "blue" | "emerald" | "purple" | "amber" | "red" | "slate";
  onClick: () => void;
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-100 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
      : tone === "purple"
        ? "border-purple-100 bg-purple-50 text-purple-800 hover:bg-purple-100"
        : tone === "amber"
          ? "border-amber-100 bg-amber-50 text-amber-900 hover:bg-amber-100"
          : tone === "red"
            ? "border-red-100 bg-red-50 text-red-800 hover:bg-red-100"
            : tone === "slate"
              ? "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100"
              : "border-blue-100 bg-blue-50 text-blue-800 hover:bg-blue-100";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border p-5 text-left shadow-sm transition ${toneClass}`}
    >
      <div className="text-base font-extrabold">{title}</div>
      <div className="mt-2 text-sm font-semibold leading-relaxed opacity-90">{description}</div>
    </button>
  );
}