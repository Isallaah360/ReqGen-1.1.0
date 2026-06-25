"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ProfileMini = {
  id: string;
  role: string | null;
  full_name: string | null;
};

type SecurityStatus = {
  hasVerifiedTotp: boolean;
  currentLevel: string | null;
  nextLevel: string | null;
  factorCount: number;
};

type ChecklistItem = {
  title: string;
  description: string;
  status: "Done" | "Pending" | "Review";
  priority: "High" | "Medium" | "Low";
  group: "2FA" | "Access" | "Backup" | "RLS" | "Training";
};

type TabKey = "overview" | "checklist" | "backup" | "policy";

function roleKey(role: string | null | undefined) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function statusBadgeClass(status: ChecklistItem["status"]) {
  if (status === "Done") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Review") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-red-200 bg-red-50 text-red-700";
}

function priorityBadgeClass(priority: ChecklistItem["priority"]) {
  if (priority === "High") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "Medium") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function securityBadgeClass(ok: boolean) {
  return ok
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-red-200 bg-red-50 text-red-700";
}

export default function AdminSecurityPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ChecklistItem["status"]>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | ChecklistItem["priority"]>("ALL");
  const [groupFilter, setGroupFilter] = useState<"ALL" | ChecklistItem["group"]>("ALL");

  const [me, setMe] = useState<ProfileMini | null>(null);
  const [security, setSecurity] = useState<SecurityStatus>({
    hasVerifiedTotp: false,
    currentLevel: null,
    nextLevel: null,
    factorCount: 0,
  });

  const rk = roleKey(me?.role);
  const canAccess = ["admin", "auditor"].includes(rk);

  const isSessionMfaVerified = security.currentLevel === "aal2";
  const isMfaSetupComplete = security.hasVerifiedTotp;

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (options?.silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMsg(null);

      const { data: authData } = await supabase.auth.getUser();

      if (!authData.user) {
        router.push("/login");
        return null;
      }

      const [profileRes, factorsRes, aalRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,role,full_name")
          .eq("id", authData.user.id)
          .maybeSingle(),
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);

      if (profileRes.error || !profileRes.data) {
        setMsg("Failed to load profile: " + (profileRes.error?.message || "Profile not found."));
        setLoading(false);
        setRefreshing(false);
        return null;
      }

      const profile = profileRes.data as ProfileMini;
      setMe(profile);

      if (!["admin", "auditor"].includes(roleKey(profile.role))) {
        setLoading(false);
        setRefreshing(false);
        return null;
      }

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

      setLoading(false);
      setRefreshing(false);

      return true;
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

  const checklist = useMemo<ChecklistItem[]>(() => {
    return [
      {
        title: "Authenticator App 2FA Enabled",
        description:
          "All staff should complete authenticator app 2FA setup before using ReqGen modules.",
        status: isMfaSetupComplete ? "Done" : "Pending",
        priority: "High",
        group: "2FA",
      },
      {
        title: "Current Admin/Auditor Session Is MFA Verified",
        description:
          "Admin and Auditor users should only perform security or finance actions from an AAL2 verified session.",
        status: isSessionMfaVerified ? "Done" : "Pending",
        priority: "High",
        group: "2FA",
      },
      {
        title: "Inactivity Logout Active",
        description:
          "The app automatically logs out inactive users. Current configured timeout is 3 minutes.",
        status: "Done",
        priority: "High",
        group: "Access",
      },
      {
        title: "Navigation Locked Before 2FA",
        description:
          "Full navigation menu is hidden until the user completes 2FA verification.",
        status: "Done",
        priority: "High",
        group: "Access",
      },
      {
        title: "Sensitive Actions Require MFA",
        description:
          "Request submission, approvals, finance changes, PV generation, signing and delete actions should check MFA before execution.",
        status: "Review",
        priority: "High",
        group: "Access",
      },
      {
        title: "Daily Database Backup",
        description:
          "A daily backup/export should be kept outside the app environment. Manual backup is required before major updates.",
        status: "Review",
        priority: "High",
        group: "Backup",
      },
      {
        title: "Weekly Off-site Backup",
        description:
          "Weekly database and storage backups should be copied to secure institutional storage.",
        status: "Review",
        priority: "High",
        group: "Backup",
      },
      {
        title: "Supabase Storage Backup",
        description:
          "Signature files and future request attachments should be included in the backup plan.",
        status: "Review",
        priority: "High",
        group: "Backup",
      },
      {
        title: "RLS Enabled on Sensitive Tables",
        description:
          "Profiles, requests, request history, vouchers, subheads, bank accounts, notifications and attachments must be protected with RLS policies.",
        status: "Review",
        priority: "High",
        group: "RLS",
      },
      {
        title: "RPC / Database Function Review",
        description:
          "Security-definer functions must validate user role and ownership before changing records.",
        status: "Review",
        priority: "High",
        group: "RLS",
      },
      {
        title: "Environment Variables Protected",
        description:
          "Service-role keys must never be exposed in client-side code. Only public anon keys should be in NEXT_PUBLIC variables.",
        status: "Review",
        priority: "High",
        group: "Access",
      },
      {
        title: "Account Officer and Finance Access Review",
        description:
          "Finance, account officer, auditor and admin role checks should use normalized role names consistently.",
        status: "Review",
        priority: "Medium",
        group: "Access",
      },
      {
        title: "SMS Alerts Separated from Login 2FA",
        description:
          "SMS should be used for workflow alerts later; authenticator app 2FA should remain the login security method.",
        status: "Done",
        priority: "Medium",
        group: "2FA",
      },
      {
        title: "User Training",
        description:
          "Staff should be trained not to share passwords, 2FA codes, screenshots of QR codes, or leave ReqGen open.",
        status: "Review",
        priority: "Medium",
        group: "Training",
      },
    ];
  }, [isMfaSetupComplete, isSessionMfaVerified]);

  const filteredChecklist = useMemo(() => {
    return checklist.filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (priorityFilter !== "ALL" && item.priority !== priorityFilter) return false;
      if (groupFilter !== "ALL" && item.group !== groupFilter) return false;
      return true;
    });
  }, [checklist, statusFilter, priorityFilter, groupFilter]);

  const stats = useMemo(() => {
    const total = checklist.length;
    const done = checklist.filter((x) => x.status === "Done").length;
    const review = checklist.filter((x) => x.status === "Review").length;
    const pending = checklist.filter((x) => x.status === "Pending").length;
    const high = checklist.filter((x) => x.priority === "High").length;

    const score = total > 0 ? Math.round((done / total) * 100) : 0;

    return { total, done, review, pending, high, score };
  }, [checklist]);

  async function printChecklist() {
    setPrinting(true);
    await load({ silent: true });

    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 250);
  }

  function resetFilters() {
    setStatusFilter("ALL");
    setPriorityFilter("ALL");
    setGroupFilter("ALL");
  }

  function goDashboard() {
    router.push(`/dashboard?updated=${Date.now()}`);
    router.refresh();
  }

  function goAdmin() {
    router.push(`/admin?updated=${Date.now()}`);
    router.refresh();
  }

  function goMfa() {
    router.push(`/mfa?updated=${Date.now()}`);
    router.refresh();
  }

  function goMfaSetup() {
    router.push(`/mfa/setup?updated=${Date.now()}`);
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-6xl py-10 text-slate-600">
          Loading Security Checklist...
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
              Security Checklist Access
            </h1>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {msg || "Access denied. Only Admin and Auditor can view this security checklist."}
            </div>

            <button
              onClick={goDashboard}
              className="mt-5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
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
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }

          body {
            background: white !important;
          }

          .no-print {
            display: none !important;
          }

          .print-sheet {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
          }

          .print-card {
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="print-sheet mx-auto max-w-6xl py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-wide text-blue-700">
              ReqGen 1.1.0 Security Governance
            </div>

            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
              Security, Backup & RLS Checklist
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Admin/Auditor control page for reviewing 2FA, inactivity logout, backup discipline,
              storage safety, RLS readiness and sensitive finance workflow controls.
            </p>

            <p className="mt-1 text-xs font-semibold text-slate-500">
              User: {me?.full_name || "—"} • Role: {me?.role || "—"} • Generated:{" "}
              {new Date().toLocaleString()}
            </p>
          </div>

          <div className="no-print flex flex-wrap gap-2">
            <button
              onClick={() => load({ silent: true })}
              disabled={refreshing || printing}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              onClick={printChecklist}
              disabled={refreshing || printing}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {printing ? "Preparing..." : "Print Checklist"}
            </button>

            <button
              onClick={goAdmin}
              disabled={refreshing || printing}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
            >
              Admin
            </button>

            <button
              onClick={goDashboard}
              disabled={refreshing || printing}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
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

        <div className="no-print mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-900">
          This page refreshes automatically when you return to it. Print reloads the latest MFA/session status before printing.
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard title="Security Score" value={`${stats.score}%`} tone="blue" />
          <StatCard title="Checklist Items" value={String(stats.total)} tone="blue" />
          <StatCard title="Completed" value={String(stats.done)} tone="emerald" />
          <StatCard title="Needs Review" value={String(stats.review)} tone="amber" />
          <StatCard title="Pending" value={String(stats.pending)} tone="red" />
          <StatCard title="High Priority" value={String(stats.high)} tone="purple" />
        </div>

        <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm print-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">Current User Security</h2>
              <p className="mt-1 text-sm text-slate-600">
                Logged in as {me?.full_name || "User"} • Role: {me?.role || "—"}
              </p>
            </div>

            <span
              className={`rounded-full border px-3 py-1 text-xs font-bold ${securityBadgeClass(
                isSessionMfaVerified
              )}`}
            >
              {isSessionMfaVerified ? "AAL2 Verified" : "AAL2 Required"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
              value={`${security.currentLevel || "unknown"} → ${security.nextLevel || "unknown"}`}
              ok={isSessionMfaVerified}
            />

            <SecurityLine
              label="Authenticator Factors"
              value={String(security.factorCount)}
              ok={security.factorCount > 0}
            />
          </div>

          <div className="no-print mt-5 flex flex-wrap gap-2">
            {!isMfaSetupComplete && (
              <button
                onClick={goMfaSetup}
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
              >
                Set Up 2FA
              </button>
            )}

            {isMfaSetupComplete && !isSessionMfaVerified && (
              <button
                onClick={goMfa}
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
              >
                Verify 2FA
              </button>
            )}
          </div>
        </div>

        <div className="no-print mt-6 rounded-3xl border bg-white p-2 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <TabButton label="Overview" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
            <TabButton label="Checklist" active={activeTab === "checklist"} onClick={() => setActiveTab("checklist")} />
            <TabButton label="Backup Standard" active={activeTab === "backup"} onClick={() => setActiveTab("backup")} />
            <TabButton label="Sensitive Policy" active={activeTab === "policy"} onClick={() => setActiveTab("policy")} />
          </div>
        </div>

        {(activeTab === "overview" || activeTab === "checklist") && (
          <>
            <div className="no-print mt-6 rounded-3xl border bg-white p-5 shadow-sm">
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <label className="text-sm font-semibold text-slate-800">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="Done">Done</option>
                    <option value="Review">Review</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-800">Priority</label>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)}
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
                  >
                    <option value="ALL">All Priorities</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-800">Group</label>
                  <select
                    value={groupFilter}
                    onChange={(e) => setGroupFilter(e.target.value as typeof groupFilter)}
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
                  >
                    <option value="ALL">All Groups</option>
                    <option value="2FA">2FA</option>
                    <option value="Access">Access</option>
                    <option value="Backup">Backup</option>
                    <option value="RLS">RLS</option>
                    <option value="Training">Training</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={resetFilters}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            </div>

            <ChecklistPanel checklist={filteredChecklist} />
          </>
        )}

        {(activeTab === "overview" || activeTab === "backup") && <BackupPanel />}

        {(activeTab === "overview" || activeTab === "policy") && <SensitivePolicyPanel />}

        <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm leading-6 text-blue-900 print:border-black print:bg-white print:text-black">
          <div className="font-extrabold">Security Note</div>
          <p className="mt-1">
            This page is a governance checklist. It does not replace database RLS policies, Supabase
            dashboard backups or server-side validation. It gives Admin/Auditor users a structured
            way to confirm that ReqGen remains secure before and after upgrades.
          </p>
        </div>
      </div>
    </main>
  );
}

function ChecklistPanel({ checklist }: { checklist: ChecklistItem[] }) {
  return (
    <div className="mt-6 rounded-3xl border bg-white shadow-sm overflow-hidden print-card">
      <div className="border-b bg-slate-50 px-6 py-4 print:bg-white">
        <h2 className="text-xl font-extrabold text-slate-900">Security Checklist</h2>
        <p className="mt-1 text-sm text-slate-600">
          Review each item before major deployments, database migrations or live institutional use.
        </p>
      </div>

      {checklist.length === 0 ? (
        <div className="p-6 text-sm text-slate-700">No checklist item matches the selected filters.</div>
      ) : (
        <div className="divide-y">
          {checklist.map((item) => (
            <div key={item.title} className="px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-3xl">
                  <div className="text-xs font-black uppercase tracking-wide text-slate-500">
                    {item.group}
                  </div>
                  <h3 className="mt-1 text-base font-extrabold text-slate-900">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${priorityBadgeClass(
                      item.priority
                    )}`}
                  >
                    {item.priority}
                  </span>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${statusBadgeClass(
                      item.status
                    )}`}
                  >
                    {item.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BackupPanel() {
  return (
    <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm print-card">
      <h2 className="text-xl font-extrabold text-slate-900">Backup Standard</h2>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <PolicyBox
          title="Daily Backup"
          text="Export database backup daily and keep it outside the application hosting environment."
        />
        <PolicyBox
          title="Weekly Off-site Copy"
          text="Copy database backup and storage files to secure institutional/off-site storage every week."
        />
        <PolicyBox
          title="Before Major Updates"
          text="Run a manual backup before deploying new SQL, workflow changes, RLS changes or production updates."
        />
        <PolicyBox
          title="Before Migration"
          text="Export schema and data, then test migration SQL on staging or backup project before production use."
        />
        <PolicyBox
          title="Storage Backup"
          text="Include signatures, attachments and other Supabase Storage buckets in the backup plan."
        />
        <PolicyBox
          title="Recovery Test"
          text="Periodically test whether backup files can be restored successfully, not just downloaded."
        />
      </div>
    </div>
  );
}

function SensitivePolicyPanel() {
  return (
    <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm print-card">
      <h2 className="text-xl font-extrabold text-slate-900">Sensitive Action Policy</h2>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <PolicyBox
          title="Request Actions"
          text="MFA should be checked before request submission, approval, rejection, forwarding, editing and deletion."
        />
        <PolicyBox
          title="Payment Voucher Actions"
          text="MFA should be checked before PV generation, cheque signing, counter-signing, payment and cancellation."
        />
        <PolicyBox
          title="Finance Changes"
          text="MFA should be checked before account, allocation, subhead, department or account-officer assignment changes."
        />
        <PolicyBox
          title="Admin Changes"
          text="Admin/Auditor role changes, routing changes and security settings should leave audit history where possible."
        />
        <PolicyBox
          title="Environment Safety"
          text="Service-role keys must never be used in client code. Only public anon keys should use NEXT_PUBLIC variables."
        />
        <PolicyBox
          title="Staff Training"
          text="Staff must not share passwords, OTPs, authenticator codes, QR-code screenshots, or leave ReqGen open unattended."
        />
      </div>
    </div>
  );
}

function PolicyBox({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="font-extrabold text-slate-900">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-700">{text}</p>
    </div>
  );
}

function StatCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "blue" | "emerald" | "purple" | "amber" | "red";
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "purple"
      ? "bg-purple-50 text-purple-700"
      : tone === "amber"
      ? "bg-amber-50 text-amber-800"
      : tone === "red"
      ? "bg-red-50 text-red-700"
      : "bg-blue-50 text-blue-700";

  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm print-card">
      <div className="text-sm font-semibold text-slate-500">{title}</div>
      <div className={`mt-3 inline-flex rounded-2xl px-3 py-2 text-xl font-extrabold ${cls}`}>
        {value}
      </div>
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