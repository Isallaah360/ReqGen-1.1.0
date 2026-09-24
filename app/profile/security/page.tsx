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
    if (silent) { setRefreshing(true); } else { setLoading(true); }
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

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  const sessionSecure = security.currentLevel === "aal2";

  return (
    <main data-rmb-page="profile" className="rg-standard-page rg-profile-security-page">
      <div className="rg-standard-page-inner">
        

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
              {!security.hasTotp && <Link href="/mfa/setup" className="rg-action-button rg-action-warning">Set Up 2FA</Link>}
              {security.hasTotp && !sessionSecure && <Link href="/mfa" className="rg-action-button rg-action-cyan">Verify 2FA</Link>}
              {security.hasTotp && <Link href="/profile/security/replace-authenticator" className="rg-action-button rg-action-violet">Change 2FA &amp; Password</Link>}
              <Link href="/change-password" className="rg-action-button rg-action-primary">Change Password</Link>
              <button type="button" onClick={() => void load(true)} disabled={refreshing} className="rg-action-button rg-action-violet">{refreshing ? "Refreshing…" : "Refresh Security"}</button>
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
