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

function roleKey(role: string | null | undefined) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [deptName, setDeptName] = useState<string>("");

  const rk = roleKey(profile?.role);

  const isAdmin = ["admin", "auditor"].includes(rk);
  const canFinance = ["admin", "auditor", "account", "accounts", "accountofficer"].includes(rk);
  const canHR = ["admin", "auditor", "hr"].includes(rk);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg(null);

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id,full_name,role,gender,phone,dept_id,signature_url")
        .eq("id", user.id)
        .single();

      if (profErr) {
        setMsg("Failed to load profile: " + profErr.message);
        setLoading(false);
        return;
      }

      const profileRow = prof as Profile;
      setProfile(profileRow);

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

    load();
  }, [router]);

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

          <button
            onClick={() => router.push("/profile")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            My Profile
          </button>
        </div>

        {msg && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm">
            {msg}
          </div>
        )}

        {profile && (
          <>
            <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
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
                ReqGen 1.2.0 now supports official requests, personal fund requests, personal
                non-fund requests, HR filing, payment vouchers, cheque signing workflow, combined
                vouchers and PV audit reports.
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