"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ProfileMini = {
  id: string;
  role: string | null;
};

type ProfileRole = {
  id: string;
  profile_id: string;
  role_key: string;
  role_name: string;
  is_primary: boolean;
  is_active: boolean;
};

type FinanceCounts = {
  departments: number;
  activeDepartments: number;
  subheads: number;
  activeSubheads: number;
  allocationTotal: number;
  reservedTotal: number;
  expenditureTotal: number;
  balanceTotal: number;
  accounts: number;
  activeAccounts: number;
  accountStageTotal: number;
  accountStageAssignedToMe: number;
  paidRequests: number;
  pendingHrFiling: number;
};

type TabKey = "overview" | "setup" | "budget" | "payments" | "reports";

function roleKey(role: string | null | undefined) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function stageKey(stage: string | null | undefined) {
  return (stage || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function naira(n: number | null | undefined) {
  return "₦" + Math.round(Number(n || 0)).toLocaleString();
}

function hasAnyRole(roleSet: Set<string>, roles: string[]) {
  return roles.some((r) => roleSet.has(roleKey(r)));
}

function roleSummary(fallbackRole: string | null | undefined, roles: ProfileRole[]) {
  const active = roles.filter((r) => r.is_active);

  if (active.length === 0) return fallbackRole || "Staff";

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

function emptyCounts(): FinanceCounts {
  return {
    departments: 0,
    activeDepartments: 0,
    subheads: 0,
    activeSubheads: 0,
    allocationTotal: 0,
    reservedTotal: 0,
    expenditureTotal: 0,
    balanceTotal: 0,
    accounts: 0,
    activeAccounts: 0,
    accountStageTotal: 0,
    accountStageAssignedToMe: 0,
    paidRequests: 0,
    pendingHrFiling: 0,
  };
}

export default function FinanceHome() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const [me, setMe] = useState<ProfileMini | null>(null);
  const [myRoles, setMyRoles] = useState<ProfileRole[]>([]);
  const [counts, setCounts] = useState<FinanceCounts>(emptyCounts());

  const roleSet = useMemo(() => {
    const set = new Set<string>();

    if (me?.role) set.add(roleKey(me.role));

    myRoles.forEach((r) => {
      if (r.is_active) set.add(roleKey(r.role_key));
    });

    return set;
  }, [me?.role, myRoles]);

  const hasAccess = useMemo(() => {
    return hasAnyRole(roleSet, [
      "admin",
      "auditor",
      "account",
      "accounts",
      "accountofficer",
      "pvsigner",
      "pvcountersigner",
    ]);
  }, [roleSet]);

  const canManageFinance = useMemo(() => {
    return hasAnyRole(roleSet, ["admin", "auditor"]);
  }, [roleSet]);

  const isAccountOfficer = useMemo(() => {
    return hasAnyRole(roleSet, ["account", "accounts", "accountofficer"]);
  }, [roleSet]);

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
        return;
      }

      const [profileRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("id,role").eq("id", auth.user.id).maybeSingle(),

        supabase
          .from("profile_roles")
          .select("id,profile_id,role_key,role_name,is_primary,is_active")
          .eq("profile_id", auth.user.id)
          .eq("is_active", true),
      ]);

      if (profileRes.error || !profileRes.data) {
        setMsg("Failed to load your profile: " + (profileRes.error?.message || "Profile not found."));
        setMe(null);
        setMyRoles([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (rolesRes.error) {
        setMsg("Failed to load your active roles: " + rolesRes.error.message);
        setMe(profileRes.data as ProfileMini);
        setMyRoles([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const myProfile = profileRes.data as ProfileMini;
      const activeRoles = (rolesRes.data || []) as ProfileRole[];

      setMe(myProfile);
      setMyRoles(activeRoles);

      const nextRoleSet = new Set<string>();

      if (myProfile.role) nextRoleSet.add(roleKey(myProfile.role));

      activeRoles.forEach((r) => {
        if (r.is_active) nextRoleSet.add(roleKey(r.role_key));
      });

      const allowed = hasAnyRole(nextRoleSet, [
        "admin",
        "auditor",
        "account",
        "accounts",
        "accountofficer",
        "pvsigner",
        "pvcountersigner",
      ]);

      if (!allowed) {
        setMsg("Access denied. Only Admin, Auditor and Finance/Account roles can access Finance.");
        setCounts(emptyCounts());
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const [deptRes, subheadRes, accountRes, requestRes] = await Promise.all([
        supabase.from("departments").select("id,is_active").order("created_at", { ascending: false }),

        supabase
          .from("subheads")
          .select("id,is_active,approved_allocation,reserved_amount,expenditure,balance")
          .order("name", { ascending: true }),

        supabase.from("accounts").select("id,is_active").order("created_at", { ascending: false }),

        supabase
          .from("requests")
          .select(
            "id,current_stage,current_owner,status,request_type,personal_category,assigned_account_officer_id"
          )
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

      const errors = [deptRes.error, subheadRes.error, accountRes.error, requestRes.error].filter(Boolean);

      if (errors.length > 0) {
        setMsg(errors.map((e) => e?.message).join(" | "));
      }

      const departments = deptRes.data || [];
      const subheads = subheadRes.data || [];
      const accounts = accountRes.data || [];
      const requests = requestRes.data || [];

      const accountStageRows = requests.filter((r: any) => stageKey(r.current_stage) === "ACCOUNT");
      const assignedToMeRows = accountStageRows.filter((r: any) => r.current_owner === auth.user.id);
      const paidRows = requests.filter((r: any) => String(r.status || "").toLowerCase().includes("paid"));
      const pendingHrFilingRows = requests.filter((r: any) => stageKey(r.current_stage) === "HRFILING");

      setCounts({
        departments: departments.length,
        activeDepartments: departments.filter((d: any) => d.is_active !== false).length,

        subheads: subheads.length,
        activeSubheads: subheads.filter((s: any) => s.is_active !== false).length,

        allocationTotal: subheads.reduce(
          (a: number, s: any) => a + Number(s.approved_allocation || 0),
          0
        ),
        reservedTotal: subheads.reduce(
          (a: number, s: any) => a + Number(s.reserved_amount || 0),
          0
        ),
        expenditureTotal: subheads.reduce(
          (a: number, s: any) => a + Number(s.expenditure || 0),
          0
        ),
        balanceTotal: subheads.reduce((a: number, s: any) => a + Number(s.balance || 0), 0),

        accounts: accounts.length,
        activeAccounts: accounts.filter((a: any) => a.is_active !== false).length,

        accountStageTotal: accountStageRows.length,
        accountStageAssignedToMe: assignedToMeRows.length,
        paidRequests: paidRows.length,
        pendingHrFiling: pendingHrFilingRows.length,
      });

      setLoading(false);
      setRefreshing(false);
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

  const visibleCards = useMemo(() => {
    const setupCards = [
      {
        title: "Departments",
        desc: "Create, edit and manage IET departments, HOD, DOD and PO routing.",
        href: "/finance/departments",
        stat: `${counts.activeDepartments}/${counts.departments} active`,
        tone: "blue" as const,
        adminOnly: true,
      },
      {
        title: "Manage Accounts",
        desc: "Create IET bank accounts and assign them to Accounting Officers.",
        href: "/finance/manage-accounts",
        stat: `${counts.activeAccounts}/${counts.accounts} active`,
        tone: "amber" as const,
        adminOnly: true,
      },
    ];

    const budgetCards = [
      {
        title: "Subheads",
        desc: "Create subheads, assign to departments, allocate budgets and monitor balances.",
        href: "/finance/subheads",
        stat: `${counts.activeSubheads}/${counts.subheads} active`,
        tone: "emerald" as const,
        adminOnly: false,
      },
    ];

    const paymentCards = [
      {
        title: "Assigned Payments",
        desc: "Open requests currently assigned to you at AccountOfficer stage.",
        href: "/approvals?stage=ACCOUNT",
        stat: `${counts.accountStageAssignedToMe} assigned`,
        tone: "blue" as const,
        adminOnly: false,
      },
      {
        title: "All Account Stage Requests",
        desc: "Monitor financial requests waiting at AccountOfficer stage.",
        href: "/requests?stage=ACCOUNT",
        stat: `${counts.accountStageTotal} pending`,
        tone: "amber" as const,
        adminOnly: false,
      },
      {
        title: "Payment Vouchers",
        desc: "Generate, manage, print and monitor payment vouchers for eligible requests.",
        href: "/payment-vouchers",
        stat: "PV register",
        tone: "slate" as const,
        adminOnly: false,
      },
    ];

    const reportCards = [
      {
        title: "Reports",
        desc: "Finance dashboard for budget, expenditure, reserved commitments and balances.",
        href: "/finance/reports",
        stat: naira(counts.balanceTotal),
        tone: "purple" as const,
        adminOnly: false,
      },
      {
        title: "Audit & Reconciliation",
        desc: "Review payment vouchers, subhead exceptions, pending payments and audit risks.",
        href: "/finance/audit",
        stat: "Control room",
        tone: "red" as const,
        adminOnly: false,
      },
      {
        title: "PV Reports",
        desc: "Detailed payment voucher reports, paid vouchers, pending vouchers and export tools.",
        href: "/payment-vouchers/reports",
        stat: "PV reports",
        tone: "blue" as const,
        adminOnly: false,
      },
    ];

    const allCards = [...setupCards, ...budgetCards, ...paymentCards, ...reportCards];

    if (activeTab === "setup") return setupCards.filter((c) => !c.adminOnly || canManageFinance);
    if (activeTab === "budget") return budgetCards.filter((c) => !c.adminOnly || canManageFinance);
    if (activeTab === "payments") return paymentCards.filter((c) => !c.adminOnly || canManageFinance);
    if (activeTab === "reports") return reportCards.filter((c) => !c.adminOnly || canManageFinance);

    return allCards.filter((c) => !c.adminOnly || canManageFinance);
  }, [activeTab, canManageFinance, counts]);

  function openPage(href: string) {
    router.push(`${href}${href.includes("?") ? "&" : "?"}updated=${Date.now()}`);
    router.refresh();
  }

  function goDashboard() {
    router.push(`/dashboard?updated=${Date.now()}`);
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-6xl py-10 text-slate-600">Loading Finance...</div>
      </main>
    );
  }

  if (!hasAccess) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-3xl py-10">
          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <h1 className="text-xl font-extrabold text-slate-900">Finance Access</h1>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {msg || "Access denied. Only Admin, Auditor and Finance/Account roles can access Finance."}
            </div>

            <button
              type="button"
              onClick={goDashboard}
              className="mt-5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
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
              Finance Control Center
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Manage budget structure, subheads, accounts, payment vouchers, reports and reconciliation.
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Active capacity: <b className="text-slate-800">{roleSummary(me?.role, myRoles)}</b>
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

            <button
              type="button"
              onClick={goDashboard}
              disabled={refreshing}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100 disabled:opacity-60"
            >
              Dashboard
            </button>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm">
            {msg}
          </div>
        )}

        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-900">
          DG-approved financial requests now move to the selected AccountOfficer. Use Assigned Payments to treat requests assigned to you.
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Approved Allocation" value={naira(counts.allocationTotal)} tone="blue" />
          <StatCard title="Reserved" value={naira(counts.reservedTotal)} tone="amber" />
          <StatCard title="Expenditure" value={naira(counts.expenditureTotal)} tone="red" />
          <StatCard title="Balance" value={naira(counts.balanceTotal)} tone="emerald" />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <SmallStat title="Departments" value={`${counts.activeDepartments}/${counts.departments} active`} />
          <SmallStat title="Subheads" value={`${counts.activeSubheads}/${counts.subheads} active`} />
          <SmallStat title="Accounts" value={`${counts.activeAccounts}/${counts.accounts} active`} />
          <SmallStat title="Assigned to Me" value={String(counts.accountStageAssignedToMe)} />
          <SmallStat title="Account Stage" value={String(counts.accountStageTotal)} />
          <SmallStat title="Pending HR Filing" value={String(counts.pendingHrFiling)} />
        </div>

        <div className="mt-6 overflow-x-auto rounded-3xl border bg-white p-2 shadow-sm">
          <div className="flex min-w-max gap-2">
            <TabButton label="Overview" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />

            {canManageFinance && (
              <TabButton label="Setup" active={activeTab === "setup"} onClick={() => setActiveTab("setup")} />
            )}

            <TabButton label="Budget & Subheads" active={activeTab === "budget"} onClick={() => setActiveTab("budget")} />
            <TabButton label="Payments" active={activeTab === "payments"} onClick={() => setActiveTab("payments")} />
            <TabButton label="Reports & Audit" active={activeTab === "reports"} onClick={() => setActiveTab("reports")} />
          </div>
        </div>

        {isAccountOfficer && counts.accountStageAssignedToMe > 0 && (
          <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
            <div className="font-bold">AccountOfficer Action Required</div>
            <p className="mt-1">
              You have {counts.accountStageAssignedToMe} request(s) assigned to you for AccountOfficer treatment.
            </p>
            <button
              type="button"
              onClick={() => openPage("/approvals?stage=ACCOUNT")}
              className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
            >
              Open Assigned Payments
            </button>
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {visibleCards.map((card) => (
            <Card
              key={card.href}
              title={card.title}
              desc={card.desc}
              stat={card.stat}
              tone={card.tone}
              onOpen={() => openPage(card.href)}
            />
          ))}
        </div>

        {!canManageFinance && (
          <div className="mt-6 rounded-3xl border border-amber-100 bg-amber-50 p-5 text-sm text-amber-900">
            <div className="font-bold">Finance Access Note</div>
            <p className="mt-1">
              Your role can view finance reports, subheads, audit information, assigned payments and payment voucher areas.
              Department, account and structural setup remain limited to Admin and Auditor roles.
            </p>
          </div>
        )}

        {canManageFinance && (
          <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
            <div className="font-bold">Finance Management Note</div>
            <p className="mt-1">
              Keep departments, DOD/HOD/PO routing, subheads and account setup accurate because they directly affect request routing,
              fund reservation, AccountOfficer assignment, payment vouchers, reports and audit reconciliation.
            </p>
          </div>
        )}
      </div>
    </main>
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
      className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${active ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-700 hover:bg-slate-100"
        }`}
    >
      {label}
    </button>
  );
}

function Card({
  title,
  desc,
  stat,
  tone,
  onOpen,
}: {
  title: string;
  desc: string;
  stat: string;
  tone: "blue" | "emerald" | "amber" | "purple" | "red" | "slate";
  onOpen: () => void;
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "border-amber-100 bg-amber-50 text-amber-700"
        : tone === "purple"
          ? "border-purple-100 bg-purple-50 text-purple-700"
          : tone === "red"
            ? "border-red-100 bg-red-50 text-red-700"
            : tone === "slate"
              ? "border-slate-100 bg-slate-50 text-slate-700"
              : "border-blue-100 bg-blue-50 text-blue-700";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-3xl border bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-extrabold text-slate-900">{title}</div>
          <div className="mt-2 text-sm leading-6 text-slate-600">{desc}</div>
        </div>

        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${cls}`}>{stat}</span>
      </div>

      <div className="mt-4 text-sm font-bold text-blue-700">Open →</div>
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
  tone: "blue" | "emerald" | "amber" | "red";
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700"
        : tone === "red"
          ? "bg-red-50 text-red-700"
          : "bg-blue-50 text-blue-700";

  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-500">{title}</div>
      <div className={`mt-3 inline-flex rounded-2xl px-3 py-2 text-xl font-extrabold ${cls}`}>
        {value}
      </div>
    </div>
  );
}

function SmallStat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-2 text-lg font-extrabold text-slate-900">{value}</div>
    </div>
  );
}