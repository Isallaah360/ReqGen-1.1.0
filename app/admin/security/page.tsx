"use client";

import { useEffect, useMemo, useState } from "react";
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
};

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
  const [msg, setMsg] = useState<string | null>(null);

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

  async function load() {
    setLoading(true);
    setMsg(null);

    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      router.push("/login");
      return;
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
      return;
    }

    setMe(profileRes.data as ProfileMini);

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
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checklist = useMemo<ChecklistItem[]>(() => {
    return [
      {
        title: "Authenticator App 2FA Enabled",
        description:
          "All staff should complete authenticator app 2FA setup before using ReqGen modules.",
        status: isMfaSetupComplete ? "Done" : "Pending",
        priority: "High",
      },
      {
        title: "Current Admin/Auditor Session Is MFA Verified",
        description:
          "Admin and Auditor users should only perform security or finance actions from an aal2 verified session.",
        status: isSessionMfaVerified ? "Done" : "Pending",
        priority: "High",
      },
      {
        title: "Inactivity Logout Active",
        description:
          "The app automatically logs out inactive users. Current configured timeout is 3 minutes.",
        status: "Done",
        priority: "High",
      },
      {
        title: "Navigation Locked Before 2FA",
        description:
          "Full navigation menu is hidden until the user completes 2FA verification.",
        status: "Done",
        priority: "High",
      },
      {
        title: "Sensitive Actions Require MFA",
        description:
          "Request submission, approvals, finance changes, PV generation, signing and delete actions should check MFA before execution.",
        status: "Review",
        priority: "High",
      },
      {
        title: "Daily Database Backup",
        description:
          "A daily backup/export should be kept outside the app environment. Manual backup is required before major updates.",
        status: "Review",
        priority: "High",
      },
      {
        title: "Weekly Off-site Backup",
        description:
          "Weekly database and storage backups should be copied to secure institutional storage.",
        status: "Review",
        priority: "High",
      },
      {
        title: "Supabase Storage Backup",
        description:
          "Signature files and future request attachments should be included in the backup plan.",
        status: "Review",
        priority: "High",
      },
      {
        title: "RLS Enabled on Sensitive Tables",
        description:
          "Profiles, requests, request history, vouchers, subheads, bank accounts, notifications and attachments must be protected with RLS policies.",
        status: "Review",
        priority: "High",
      },
      {
        title: "RPC / Database Function Review",
        description:
          "Security-definer functions must validate user role and ownership before changing records.",
        status: "Review",
        priority: "High",
      },
      {
        title: "Environment Variables Protected",
        description:
          "Service-role keys must never be exposed in client-side code. Only public anon keys should be in NEXT_PUBLIC variables.",
        status: "Review",
        priority: "High",
      },
      {
        title: "Account Officer and Finance Access Review",
        description:
          "Finance, account officer, auditor and admin role checks should use normalized role names consistently.",
        status: "Review",
        priority: "Medium",
      },
      {
        title: "SMS Alerts Separated from Login 2FA",
        description:
          "SMS should be used for workflow alerts later; authenticator app 2FA should remain the login security method.",
        status: "Done",
        priority: "Medium",
      },
      {
        title: "User Training",
        description:
          "Staff should be trained not to share passwords, 2FA codes, screenshots of QR codes, or leave ReqGen open.",
        status: "Review",
        priority: "Medium",
      },
    ];
  }, [isMfaSetupComplete, isSessionMfaVerified]);

  const stats = useMemo(() => {
    const total = checklist.length;
    const done = checklist.filter((x) => x.status === "Done").length;
    const review = checklist.filter((x) => x.status === "Review").length;
    const pending = checklist.filter((x) => x.status === "Pending").length;
    const high = checklist.filter((x) => x.priority === "High").length;

    return { total, done, review, pending, high };
  }, [checklist]);

  function printChecklist() {
    window.print();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-6xl py-10 text-slate-600">
          Loading security checklist...
        </div>
      </main>
    );
  }

  if (!canAccess) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-3xl py-10">
          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <h1 className="text-xl font-extrabold text-slate-900">Security Checklist Access</h1>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {msg || "Access denied. Only Admin and Auditor can view this security checklist."}
            </div>

            <button
              onClick={() => router.push("/dashboard")}
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
          body {
            background: white !important;
          }

          .no-print {
            display: none !important;
          }

          .print-sheet {
            border: none !important;
            box-shadow: none !important;
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
          </div>

          <div className="no-print flex flex-wrap gap-2">
            <button
              onClick={load}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-900 hover:bg-slate-100"
            >
              Refresh
            </button>

            <button
              onClick={printChecklist}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
            >
              Print Checklist
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-900 hover:bg-slate-100"
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

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard title="Checklist Items" value={String(stats.total)} tone="blue" />
          <StatCard title="Completed" value={String(stats.done)} tone="emerald" />
          <StatCard title="Needs Review" value={String(stats.review)} tone="amber" />
          <StatCard title="Pending" value={String(stats.pending)} tone="red" />
          <StatCard title="High Priority" value={String(stats.high)} tone="purple" />
        </div>

        <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
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
        </div>

        <div className="mt-6 rounded-3xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-slate-50 px-6 py-4">
            <h2 className="text-xl font-extrabold text-slate-900">Security Checklist</h2>
            <p className="mt-1 text-sm text-slate-600">
              Review each item before major deployments, database migrations or live institutional use.
            </p>
          </div>

          <div className="divide-y">
            {checklist.map((item) => (
              <div key={item.title} className="px-6 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-3xl">
                    <h3 className="text-base font-extrabold text-slate-900">{item.title}</h3>
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
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-extrabold text-slate-900">Backup Standard</h2>

            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <p>
                <b>Daily:</b> Export database backup and keep it outside the application hosting
                environment.
              </p>
              <p>
                <b>Weekly:</b> Copy database backup and storage files to secure institutional/off-site
                storage.
              </p>
              <p>
                <b>Before major update:</b> Run manual backup before deploying new database SQL or
                workflow updates.
              </p>
              <p>
                <b>Before migration:</b> Export schema and data, then test the SQL on staging or a
                backup project first.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-extrabold text-slate-900">Sensitive Action Policy</h2>

            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <p>
                MFA should be checked before request submission, approval, rejection, forwarding and
                editing.
              </p>
              <p>
                MFA should be checked before PV generation, cheque counter-signing, cheque signing,
                payment and deletion.
              </p>
              <p>
                MFA should be checked before finance account, allocation, subhead or account officer
                assignment changes.
              </p>
              <p>
                Admin/Auditor actions should leave history records so sensitive changes are auditable.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm leading-6 text-blue-900">
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
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
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