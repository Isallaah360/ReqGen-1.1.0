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

function roleKey(role: string | null | undefined) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function securityBadgeClass(ok: boolean) {
  return ok
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-red-200 bg-red-50 text-red-700";
}

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [deptName, setDeptName] = useState<string>("");
  const [security, setSecurity] = useState<SecurityStatus>({
    hasVerifiedTotp: false,
    currentLevel: null,
    nextLevel: null,
    factorCount: 0,
  });

  const rk = roleKey(profile?.role);

  const isAdmin = ["admin", "auditor"].includes(rk);
  const canFinance = ["admin", "auditor", "account", "accounts", "accountofficer"].includes(rk);
  const canHR = ["admin", "auditor", "hr"].includes(rk);

  const isSessionMfaVerified = security.currentLevel === "aal2";
  const isMfaSetupComplete = security.hasVerifiedTotp;

  async function load() {
    setLoading(true);
    setMsg(null);

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) {
      router.push("/login");
      return;
    }

    const [profRes, factorsRes, aalRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,full_name,role,gender,phone,dept_id,signature_url")
        .eq("id", user.id)
        .single(),
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);

    if (profRes.error) {
      setMsg("Failed to load profile: " + profRes.error.message);
      setLoading(false);
      return;
    }

    const profileRow = profRes.data as Profile;
    setProfile(profileRow);

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

      if (dept?.name) setDeptName(dept.name);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quickCards = useMemo<QuickCard[]>(() => {
    const cards: QuickCard[] = [
      {
        title: "Create New Request",
        description: "Start an official, personal fund, or personal non-fund request.",
        href: "/requests/new",
        tone: "blue",
      },
      {
        title: "My Requests",
        description: "Track requests you have submitted and review their progress.",
        href: "/requests",
        tone: "slate",
      },
      {
        title: "Approvals",
        description: "Review requests currently assigned to you for action.",
        href: "/approvals",
        tone: "emerald",
      },
    ];

    if (canFinance) {
      cards.push(
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

    if (isAdmin) {
      cards.push(
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
        },
        {
          title: "Admin",
          description: "Manage users, departments and system administration.",
          href: "/admin",
          tone: "red",
        }
      );
    }

    if (canHR) {
      cards.push({
        title: "HR Filing",
        description: "Handle personal request records, filing and HR finalization.",
        href: "/hr/filing",
        tone: "emerald",
      });
    }

    return cards;
  }, [canFinance, canHR, isAdmin]);

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
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Welcome back. Use your role-based shortcuts to continue work quickly.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <button
                onClick={() => router.push("/admin/security")}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
              >
                Security Checklist
              </button>
            )}

            <button
              onClick={() => router.push("/profile")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
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
            <div className="mt-6 grid gap-4 xl:grid-cols-3">
              <div className="rounded-3xl border bg-white p-6 shadow-sm xl:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900">
                      Profile Summary
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Your account, department and signature status.
                    </p>
                  </div>

                  <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                    {profile.role || "Staff"}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Info label="Name" value={profile.full_name} />
                  <Info label="Role" value={profile.role} />
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
                    <h2 className="text-xl font-extrabold text-slate-900">
                      Security Status
                    </h2>
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
                    value={`${security.currentLevel || "unknown"} → ${security.nextLevel || "unknown"}`}
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
                    onClick={() => router.push("/mfa/setup")}
                    className="mt-5 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
                  >
                    Set Up 2FA
                  </button>
                )}

                {isMfaSetupComplete && !isSessionMfaVerified && (
                  <button
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
                  <h2 className="text-xl font-extrabold text-slate-900">
                    Quick Access
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Shortcuts are shown based on your assigned role.
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
                ReqGen 1.1.0 supports request workflow, role-based approvals, HR filing, finance
                subheads, payment vouchers, cheque signing workflow, combined vouchers, audit reports,
                2FA login protection and inactivity logout.
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
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
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
      <div className="mt-2 text-sm font-semibold leading-relaxed opacity-90">
        {description}
      </div>
    </button>
  );
}