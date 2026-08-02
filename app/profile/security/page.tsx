"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ProfileNavigation from "@/app/components/profile/ProfileNavigation";
import { ActiveRoleSwitcher } from "@/app/components/ActiveRoleSwitcher";

type SecurityState = {
  email: string;
  hasTotp: boolean;
  factorCount: number;
  currentLevel: string | null;
  nextLevel: string | null;
  lastSignInAt: string | null;
};

export default function ProfileSecurityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [security, setSecurity] = useState<SecurityState>({
    email: "",
    hasTotp: false,
    factorCount: 0,
    currentLevel: null,
    nextLevel: null,
    lastSignInAt: null,
  });

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        router.push("/login");
        return;
      }

      const [factors, assurance] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);

      const verified = factors.data?.totp?.filter((factor) => factor.status === "verified") ?? [];
      setSecurity({
        email: authData.user.email || "",
        hasTotp: verified.length > 0,
        factorCount: verified.length,
        currentLevel: assurance.data?.currentLevel || null,
        nextLevel: assurance.data?.nextLevel || null,
        lastSignInAt: authData.user.last_sign_in_at || null,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load security status.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const sessionSecure = security.currentLevel === "aal2";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <section className="overflow-hidden rounded-3xl border border-blue-200 bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-900 p-6 text-white shadow-xl sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Personal Security Workspace</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Security Centre</h1>
          <p className="mt-3 max-w-3xl font-semibold leading-7 text-slate-200">Review your authentication strength, active working role and account-protection controls.</p>
          <div className="mt-5"><Link href="/staff" className="inline-flex min-h-11 items-center rounded-xl bg-white/15 px-4 py-2.5 text-sm font-black text-white ring-1 ring-white/25 transition hover:bg-white/25">← Back to Staff Workspace</Link></div>
        </section>

        <ProfileNavigation />

        {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">{error}</div>}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Authenticator App" value={loading ? "…" : security.hasTotp ? "Configured" : "Required"} tone={security.hasTotp ? "emerald" : "rose"} />
          <Stat label="Current Session" value={loading ? "…" : sessionSecure ? "MFA Verified" : "Password Only"} tone={sessionSecure ? "emerald" : "amber"} />
          <Stat label="Assurance Level" value={loading ? "…" : `${security.currentLevel || "unknown"} → ${security.nextLevel || "unknown"}`} tone="blue" />
          <Stat label="Verified Factors" value={loading ? "…" : String(security.factorCount)} tone="violet" />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">Account Protection</h2>
            <div className="mt-5 grid gap-3">
              <Info label="Account email" value={security.email || "Not available"} />
              <Info label="Last sign-in" value={security.lastSignInAt ? new Date(security.lastSignInAt).toLocaleString("en-NG", { hour12: true }) : "Not available"} />
              <Info label="Session assurance" value={sessionSecure ? "AAL2 — MFA verified" : "AAL1 — password only"} />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              {!security.hasTotp && <Link href="/mfa/setup" className="rounded-xl bg-orange-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-orange-700">Set Up 2FA</Link>}
              {security.hasTotp && !sessionSecure && <Link href="/mfa" className="rounded-xl bg-cyan-700 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-800">Verify 2FA</Link>}
              <Link href="/change-password" className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-800">Change Password</Link>
              <button type="button" onClick={() => void load(true)} disabled={refreshing} className="rounded-xl bg-violet-700 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-violet-800 disabled:opacity-60">{refreshing ? "Refreshing…" : "Refresh Security"}</button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">Current Working Role</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Your selected role controls visible modules and the authority recorded against your actions.</p>
            <div className="mt-5"><ActiveRoleSwitcher /></div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "emerald" | "rose" | "amber" | "blue" | "violet" }) {
  const tones = { emerald: "border-emerald-200 bg-emerald-50 text-emerald-900", rose: "border-rose-200 bg-rose-50 text-rose-900", amber: "border-amber-200 bg-amber-50 text-amber-900", blue: "border-blue-200 bg-blue-50 text-blue-900", violet: "border-violet-200 bg-violet-50 text-violet-900" };
  return <div className={`rounded-2xl border p-5 shadow-sm ${tones[tone]}`}><p className="text-xs font-black uppercase tracking-[0.16em]">{label}</p><p className="mt-3 text-xl font-black">{value}</p></div>;
}
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="mt-1 font-black text-slate-900">{value}</p></div>; }
