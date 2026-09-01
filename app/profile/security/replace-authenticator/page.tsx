"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ProfileNavigation from "@/app/components/profile/ProfileNavigation";

type TotpFactor = {
  id: string;
  friendly_name?: string | null;
  status: string;
};

type EnrollData = {
  id: string;
  type: string;
  totp: {
    qr_code: string;
    secret: string;
    uri: string;
  };
};

export default function ReplaceAuthenticatorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [oldFactors, setOldFactors] = useState<TotpFactor[]>([]);
  const [currentLevel, setCurrentLevel] = useState<string | null>(null);
  const [oldCode, setOldCode] = useState("");
  const [oldVerified, setOldVerified] = useState(false);

  const [newFactorId, setNewFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [newCode, setNewCode] = useState("");
  const [completed, setCompleted] = useState(false);

  const primaryOldFactor = oldFactors[0] || null;
  const identityVerified = currentLevel === "aal2" || oldVerified || oldFactors.length === 0;
  const step = completed ? 4 : !identityVerified ? 1 : !newFactorId ? 2 : 3;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      router.push("/login");
      return;
    }

    const [factorRes, aalRes] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);

    if (factorRes.error) {
      setError(factorRes.error.message);
      setLoading(false);
      return;
    }

    const verified = (factorRes.data.totp || []).filter(
      (factor) => factor.status === "verified"
    ) as TotpFactor[];

    setOldFactors(verified);
    setCurrentLevel(aalRes.data?.currentLevel || null);
    setOldVerified(aalRes.data?.currentLevel === "aal2");
    setLoading(false);
  }, [router]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function verifyExistingFactor() {
    if (!primaryOldFactor) {
      setOldVerified(true);
      return;
    }

    const code = oldCode.replace(/\D/g, "").slice(0, 6);
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from the currently linked authenticator.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: primaryOldFactor.id,
      code,
    });

    setBusy(false);

    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    setOldVerified(true);
    setCurrentLevel("aal2");
    setOldCode("");
    setMessage("Existing authenticator verified. You can now link the user's own authenticator app.");
  }

  async function beginReplacement() {
    if (!identityVerified) {
      setError("Verify the existing authenticator first.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    const friendlyName = `ReqGen Authenticator ${new Date().toISOString().slice(0, 10)}`;
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName,
    });

    setBusy(false);

    if (enrollError) {
      setError(enrollError.message);
      return;
    }

    const enrollment = data as EnrollData;
    setNewFactorId(enrollment.id);
    setQrCode(enrollment.totp.qr_code);
    setSecret(enrollment.totp.secret);
    setMessage("Scan this QR code with the user's own authenticator app, then enter the new 6-digit code.");
  }

  async function verifyAndReplace() {
    const code = newCode.replace(/\D/g, "").slice(0, 6);
    if (!newFactorId) {
      setError("Start the replacement first.");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from the NEW authenticator app.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: newFactorId,
    });

    if (challengeError) {
      setBusy(false);
      setError(challengeError.message);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: newFactorId,
      challengeId: challenge.id,
      code,
    });

    if (verifyError) {
      setBusy(false);
      setError(verifyError.message);
      return;
    }

    const failures: string[] = [];
    for (const factor of oldFactors) {
      if (factor.id === newFactorId) continue;
      const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (removeError) failures.push(removeError.message);
    }

    setBusy(false);

    if (failures.length > 0) {
      setError(
        "The new authenticator is active, but an older factor could not be removed automatically. Please contact an administrator. " +
          failures.join(" ")
      );
      return;
    }

    setCompleted(true);
    setNewCode("");
    setMessage("Authenticator replaced successfully. The old authenticator can no longer generate valid ReqGen codes.");
  }

  async function cancelNewFactor() {
    if (!newFactorId || completed) return;
    setBusy(true);
    setError(null);
    const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: newFactorId });
    setBusy(false);
    if (removeError) {
      setError(removeError.message);
      return;
    }
    setNewFactorId("");
    setQrCode("");
    setSecret("");
    setNewCode("");
    setMessage("Replacement cancelled. The existing authenticator remains active.");
  }

  const steps = useMemo(
    () => [
      "Verify existing 2FA",
      "Link new authenticator",
      "Verify new code",
      "Replacement complete",
    ],
    []
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-5xl text-slate-600">Loading account security...</div>
      </main>
    );
  }

  return (
    <main data-rmb-page="profile" className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <ProfileNavigation />

        <div className="mt-6 flex flex-col gap-3 rounded-3xl border border-blue-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Profile / Security</p>
            <h1 className="mt-2 text-2xl font-black text-slate-950">Replace Authenticator App</h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
              Move this ReqGen account from the currently linked authenticator to the user's own phone without creating a new account.
            </p>
          </div>
          <Link href="/profile/security" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">
            Back to Security
          </Link>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((label, index) => {
            const n = index + 1;
            const active = step === n;
            const done = step > n;
            return (
              <div key={label} className={`rounded-2xl border p-4 ${active ? "border-blue-400 bg-blue-50" : done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                <div className="text-xs font-black uppercase tracking-wide text-slate-500">Step {n}</div>
                <div className="mt-1 text-sm font-black text-slate-900">{label}</div>
              </div>
            );
          })}
        </div>

        {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</div>}
        {message && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{message}</div>}

        {!identityVerified && primaryOldFactor && (
          <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <h2 className="text-lg font-black text-amber-950">1. Verify the currently linked authenticator</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-amber-900">
              Enter one valid code from <strong>{primaryOldFactor.friendly_name || "the existing authenticator"}</strong>. This proves account ownership before the old factor is replaced.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input value={oldCode} onChange={(e) => setOldCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="000000" className="w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-center text-xl font-black tracking-[0.3em] outline-none sm:max-w-[220px]" />
              <button type="button" onClick={verifyExistingFactor} disabled={busy || oldCode.length !== 6} className="rounded-2xl bg-amber-600 px-5 py-3 text-sm font-black text-white disabled:opacity-60">
                {busy ? "Verifying..." : "Verify Existing 2FA"}
              </button>
            </div>
          </section>
        )}

        {identityVerified && !newFactorId && !completed && (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">2. Link the user's own authenticator</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              The current factor stays active until the new one has been scanned and successfully verified.
            </p>
            <button type="button" onClick={beginReplacement} disabled={busy} className="mt-5 rounded-2xl bg-blue-700 px-5 py-3 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-60">
              {busy ? "Preparing..." : oldFactors.length ? "Generate New QR Code" : "Set Up Authenticator"}
            </button>
          </section>
        )}

        {newFactorId && !completed && (
          <section className="mt-6 grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">Scan New QR Code</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Open Google Authenticator, Microsoft Authenticator, Authy or 2FAS on the user's phone and scan this code.</p>
              <div className="mt-5 flex justify-center rounded-2xl border border-slate-200 bg-white p-4">
                {qrCode ? <div className="max-w-[260px]" dangerouslySetInnerHTML={{ __html: qrCode }} /> : null}
              </div>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">Manual setup key</p>
                <code className="mt-2 block break-all text-sm font-black text-slate-900">{secret}</code>
              </div>
            </div>

            <div className="rounded-3xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
              <h2 className="text-lg font-black text-blue-950">3. Verify the NEW authenticator</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-blue-900">
                Enter the 6-digit code shown on the user's phone. Only after this succeeds will ReqGen remove the previous authenticator factor.
              </p>
              <input value={newCode} onChange={(e) => setNewCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="000000" className="mt-5 w-full rounded-2xl border border-blue-200 bg-white px-4 py-4 text-center text-2xl font-black tracking-[0.35em] outline-none sm:max-w-[260px]" />
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={verifyAndReplace} disabled={busy || newCode.length !== 6} className="rounded-2xl bg-blue-700 px-5 py-3 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-60">
                  {busy ? "Replacing..." : "Verify & Replace Authenticator"}
                </button>
                <button type="button" onClick={cancelNewFactor} disabled={busy} className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-700 disabled:opacity-60">
                  Cancel Replacement
                </button>
              </div>
            </div>
          </section>
        )}

        {completed && (
          <section className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
            <h2 className="text-xl font-black text-emerald-950">Authenticator replacement complete</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-emerald-900">
              This account now uses the user's new authenticator app. Next, let the user change the temporary/current password to a private password known only to them.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/change-password" className="rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white hover:bg-emerald-800">Change Password Now</Link>
              <Link href="/profile/security" className="rounded-2xl border border-emerald-300 bg-white px-5 py-3 text-sm font-black text-emerald-800">Return to Security</Link>
            </div>
          </section>
        )}

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-xs font-semibold leading-5 text-slate-600">
          Safe order for migrated accounts: <strong>login with the existing credentials → replace authenticator → change password → login again using the user's new password and new authenticator.</strong>
        </div>
      </div>
    </main>
  );
}
