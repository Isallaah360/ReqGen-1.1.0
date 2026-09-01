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

function passwordValid(password: string) {
  return password.length >= 8;
}

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
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [oldRemoved, setOldRemoved] = useState(false);

  const primaryOldFactor = oldFactors[0] || null;
  const identityVerified = currentLevel === "aal2" || oldVerified || oldFactors.length === 0;
  const step = !identityVerified ? 1 : !newFactorId ? 2 : 3;

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
    setMessage("Identity verified. You can now replace the authenticator.");
  }

  async function beginReplacement() {
    if (!identityVerified) {
      setError("Verify the existing authenticator first.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    // Supabase projects commonly allow only one verified TOTP factor per user.
    // Remove the existing verified factor first, then enroll the replacement.
    for (const factor of oldFactors) {
      const { error: removeError } = await supabase.auth.mfa.unenroll({
        factorId: factor.id,
      });
      if (removeError) {
        setBusy(false);
        setError(`Could not unlink the old authenticator: ${removeError.message}`);
        return;
      }
    }

    if (oldFactors.length > 0) {
      setOldRemoved(true);
      setOldFactors([]);
    }

    const friendlyName = `ReqGen Authenticator ${new Date().toISOString().slice(0, 10)}`;
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName,
    });

    setBusy(false);

    if (enrollError) {
      setError(
        `Old authenticator was unlinked, but the new QR code could not be created. Click Generate New QR Code again. ${enrollError.message}`
      );
      return;
    }

    const enrollment = data as EnrollData;
    setNewFactorId(enrollment.id);
    setQrCode(enrollment.totp.qr_code);
    setSecret(enrollment.totp.secret);
    setMessage("Old authenticator unlinked. Scan the new QR code and save the new password below.");
  }

  async function saveSecurityChanges() {
    const code = newCode.replace(/\D/g, "").slice(0, 6);

    if (!newFactorId) {
      setError("Generate the new QR code first.");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from the NEW authenticator app.");
      return;
    }
    if (!passwordValid(newPassword)) {
      setError("New password must contain at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
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

    const { error: passwordError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (passwordError) {
      setBusy(false);
      setError(
        `New authenticator is active, but the password could not be changed: ${passwordError.message}`
      );
      return;
    }

    setMessage("2FA and password changed successfully. Redirecting to login...");
    await supabase.auth.signOut();
    setBusy(false);

    setTimeout(() => {
      router.push("/login?security_updated=success");
      router.refresh();
    }, 900);
  }

  async function restartQrCode() {
    if (newFactorId) {
      setBusy(true);
      const { error: removeError } = await supabase.auth.mfa.unenroll({
        factorId: newFactorId,
      });
      setBusy(false);
      if (removeError) {
        setError(removeError.message);
        return;
      }
    }

    setNewFactorId("");
    setQrCode("");
    setSecret("");
    setNewCode("");
    setError(null);
    setMessage("QR code cleared. Generate a fresh one to continue.");
  }

  const steps = useMemo(
    () => ["Authorize change", "Generate new QR", "Save 2FA + password"],
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
            <h1 className="mt-2 text-2xl font-black text-slate-950">Change 2FA &amp; Password</h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
              Unlink the old authenticator, connect the user&apos;s own phone and set a private password in one short process.
            </p>
          </div>
          <Link href="/profile/security" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">
            Back to Security
          </Link>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
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
            <h2 className="text-lg font-black text-amber-950">Confirm the current authenticator once</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-amber-900">
              Enter one valid code from the old authenticator. This is required only when the current session has not already completed 2FA.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input value={oldCode} onChange={(e) => setOldCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="000000" className="w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-center text-xl font-black tracking-[0.3em] outline-none sm:max-w-[220px]" />
              <button type="button" onClick={verifyExistingFactor} disabled={busy || oldCode.length !== 6} className="rounded-2xl bg-amber-600 px-5 py-3 text-sm font-black text-white disabled:opacity-60">
                {busy ? "Verifying..." : "Confirm & Continue"}
              </button>
            </div>
          </section>
        )}

        {identityVerified && !newFactorId && (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Replace the authenticator</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              This button unlinks the existing ReqGen authenticator first, then immediately creates a fresh QR code for the user&apos;s phone.
            </p>
            {oldRemoved && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
                The old authenticator is already unlinked. Generate a new QR code to finish setup.
              </div>
            )}
            <button type="button" onClick={beginReplacement} disabled={busy} className="mt-5 rounded-2xl bg-blue-700 px-5 py-3 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-60">
              {busy ? "Preparing..." : "Unlink Old & Generate New QR"}
            </button>
          </section>
        )}

        {newFactorId && (
          <section className="mt-6 grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">Scan New QR Code</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                Scan this code with Google Authenticator, Microsoft Authenticator, Authy or 2FAS on the user&apos;s phone.
              </p>
              <div className="mt-5 flex justify-center rounded-2xl border border-slate-200 bg-white p-4">
                {qrCode ? <div className="max-w-[260px]" dangerouslySetInnerHTML={{ __html: qrCode }} /> : null}
              </div>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">Manual setup key</p>
                <code className="mt-2 block break-all text-sm font-black text-slate-900">{secret}</code>
              </div>
              <button type="button" onClick={restartQrCode} disabled={busy} className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 disabled:opacity-60">
                Generate Different QR
              </button>
            </div>

            <div className="rounded-3xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
              <h2 className="text-lg font-black text-blue-950">Save New 2FA &amp; Password</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-blue-900">
                Enter the 6-digit code from the newly scanned authenticator, then choose the user&apos;s private password.
              </p>

              <label className="mt-5 block text-xs font-black uppercase tracking-wide text-blue-900">New 2FA code</label>
              <input value={newCode} onChange={(e) => setNewCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="000000" className="mt-2 w-full rounded-2xl border border-blue-200 bg-white px-4 py-4 text-center text-2xl font-black tracking-[0.35em] outline-none sm:max-w-[260px]" />

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-bold text-slate-800">
                  New Password
                  <input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-4 py-3 outline-none focus:border-blue-500" />
                </label>
                <label className="block text-sm font-bold text-slate-800">
                  Confirm Password
                  <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat password" className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-4 py-3 outline-none focus:border-blue-500" />
                </label>
              </div>

              <button type="button" onClick={saveSecurityChanges} disabled={busy || newCode.length !== 6 || !passwordValid(newPassword) || newPassword !== confirmPassword} className="mt-6 rounded-2xl bg-blue-700 px-6 py-3 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-60">
                {busy ? "Saving..." : "Save New 2FA & Password"}
              </button>

              <p className="mt-4 text-xs font-semibold leading-5 text-blue-900">
                After saving, ReqGen signs the user out once. They then log in with the new password and the new authenticator code.
              </p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
