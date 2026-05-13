"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type TotpFactor = {
  id: string;
  friendly_name?: string | null;
  status: string;
};

export default function MfaVerifyPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [factor, setFactor] = useState<TotpFactor | null>(null);
  const [code, setCode] = useState("");

  async function load() {
    setLoading(true);
    setMsg(null);

    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      router.push("/login");
      return;
    }

    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalData?.currentLevel === "aal2") {
      router.push("/dashboard");
      return;
    }

    const { data, error } = await supabase.auth.mfa.listFactors();

    if (error) {
      setMsg("Failed to load 2FA factors: " + error.message);
      setLoading(false);
      return;
    }

    const verifiedFactors = data.totp.filter((f) => f.status === "verified");

    if (verifiedFactors.length === 0) {
      router.push("/mfa/setup");
      return;
    }

    setFactor(verifiedFactors[0] as TotpFactor);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verifyCode() {
    if (!factor) {
      setMsg("❌ No verified 2FA factor found.");
      return;
    }

    const cleanCode = code.trim().replace(/\s+/g, "");

    if (!/^\d{6}$/.test(cleanCode)) {
      setMsg("❌ Enter the 6-digit code from your authenticator app.");
      return;
    }

    setVerifying(true);
    setMsg(null);

    try {
      const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId: factor.id,
      });

      if (challengeErr) throw new Error(challengeErr.message);

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challengeData.id,
        code: cleanCode,
      });

      if (verifyErr) throw new Error(verifyErr.message);

      setMsg("✅ 2FA verified successfully.");
      router.push("/dashboard");
      router.refresh();
    } catch (e: any) {
      setMsg("❌ 2FA verification failed: " + (e?.message || "Unknown error"));
    } finally {
      setVerifying(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-md py-16 text-slate-600">
          Loading 2FA verification...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-md py-16">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="rounded-2xl bg-blue-50 px-4 py-3">
            <div className="text-xs font-black uppercase tracking-wide text-blue-700">
              Two-Factor Authentication
            </div>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900">
              Enter 2FA Code
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Open your authenticator app and enter the 6-digit code to continue.
            </p>
          </div>

          {msg && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
              {msg}
            </div>
          )}

          <div className="mt-5">
            <label className="text-sm font-bold text-slate-800">Authenticator Code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") verifyCode();
              }}
              inputMode="numeric"
              maxLength={6}
              className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-4 text-center text-2xl font-black tracking-[0.35em] text-slate-900 outline-none focus:border-blue-500"
              placeholder="000000"
              autoFocus
            />
          </div>

          <button
            onClick={verifyCode}
            disabled={verifying}
            className="mt-5 w-full rounded-2xl bg-blue-600 px-4 py-3 text-base font-bold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {verifying ? "Verifying..." : "Verify and Continue"}
          </button>

          <button
            onClick={logout}
            disabled={verifying}
            className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
          >
            Logout
          </button>
        </div>
      </div>
    </main>
  );
}