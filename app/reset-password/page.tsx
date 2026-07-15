"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type MfaFactor = {
  id: string;
  friendly_name?: string | null;
  factor_type?: string;
  status?: string;
};

function passwordScore(password: string) {
  let score = 0;

  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  return score;
}

function passwordAdvice(password: string) {
  if (!password) return "Use at least 8 characters.";

  const score = passwordScore(password);

  if (score <= 2) return "Weak password. Add uppercase, number and symbol.";
  if (score <= 4) return "Good password. Longer is better.";
  return "Strong password.";
}

function getPasswordTone(password: string) {
  const score = passwordScore(password);

  if (!password) return "text-slate-500";
  if (score <= 2) return "text-red-700";
  if (score <= 4) return "text-amber-700";
  return "text-emerald-700";
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [initializing, setInitializing] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);

  const [checkingMfa, setCheckingMfa] = useState(false);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [mfaVerified, setMfaVerified] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [factorName, setFactorName] = useState<string>("Authenticator App");

  const [mfaCode, setMfaCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [verifyingMfa, setVerifyingMfa] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const passwordStrongEnough = passwordScore(newPassword) >= 3 && newPassword.length >= 8;

  const canSubmit =
    sessionReady &&
    passwordStrongEnough &&
    passwordsMatch &&
    (!needsMfa || mfaVerified) &&
    !saving;

  const codeFromUrl = useMemo(() => searchParams.get("code"), [searchParams]);

  async function bootstrapRecoverySession() {
    setInitializing(true);
    setErr(null);
    setMsg(null);

    try {
      if (codeFromUrl) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(codeFromUrl);

        if (exchangeError) {
          setErr(
            "The reset link could not be confirmed. Please request a fresh password reset link."
          );
          setSessionReady(false);
          setInitializing(false);
          return;
        }
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !sessionData.session?.user) {
        setErr(
          "No active password reset session was found. Please open the reset link from your email again or request a new link."
        );
        setSessionReady(false);
        setInitializing(false);
        return;
      }

      setSessionReady(true);

      await inspectMfaRequirement();

      setInitializing(false);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to prepare password reset.");
      setSessionReady(false);
      setInitializing(false);
    }
  }

  async function inspectMfaRequirement() {
    setCheckingMfa(true);

    const factorsRes = await supabase.auth.mfa.listFactors();

    if (factorsRes.error) {
      setNeedsMfa(false);
      setMfaVerified(false);
      setCheckingMfa(false);
      return;
    }

    const verifiedTotp = (factorsRes.data.totp || []).filter(
      (factor: MfaFactor) => factor.status === "verified"
    );

    if (verifiedTotp.length === 0) {
      setNeedsMfa(false);
      setMfaVerified(false);
      setFactorId(null);
      setCheckingMfa(false);
      return;
    }

    const primary = verifiedTotp[0];

    setNeedsMfa(true);
    setFactorId(primary.id);
    setFactorName(primary.friendly_name || "Authenticator App");

    const aalRes = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (!aalRes.error && aalRes.data.currentLevel === "aal2") {
      setMfaVerified(true);
    } else {
      setMfaVerified(false);
    }

    setCheckingMfa(false);
  }

  async function verifyMfa() {
    setErr(null);
    setMsg(null);

    if (!factorId) {
      setErr("No verified 2FA factor was found for this account.");
      return;
    }

    const code = mfaCode.trim().replace(/\s+/g, "");

    if (!/^\d{6}$/.test(code)) {
      setErr("Please enter the 6-digit authenticator code.");
      return;
    }

    setVerifyingMfa(true);

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });

    setVerifyingMfa(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setMfaVerified(true);
    setMfaCode("");
    setMsg("2FA verified. You can now set your new password.");
  }

  async function updatePassword(e: FormEvent) {
    e.preventDefault();

    setErr(null);
    setMsg(null);

    if (!sessionReady) {
      setErr("Password reset session is not ready. Please open the reset link again.");
      return;
    }

    if (!passwordStrongEnough) {
      setErr("Please use a stronger password with at least 8 characters.");
      return;
    }

    if (!passwordsMatch) {
      setErr("New password and confirmation do not match.");
      return;
    }

    if (needsMfa && !mfaVerified) {
      setErr("Please verify your 2FA code before changing the password.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setSaving(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setMsg("Password changed successfully. Please login again with your new password.");

    await supabase.auth.signOut();

    setTimeout(() => {
      router.push("/login?password_reset=success");
      router.refresh();
    }, 1200);
  }

  useEffect(() => {
    bootstrapRecoverySession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeFromUrl]);

  if (initializing) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center py-10">
          <div className="w-full rounded-3xl border bg-white p-6 text-center text-sm font-semibold text-slate-600 shadow-sm">
            Preparing secure password reset...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center py-10">
        <div className="w-full rounded-3xl border bg-white p-6 shadow-sm">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-xl font-black text-white">
              RG
            </div>

            <h1 className="mt-4 text-2xl font-extrabold text-slate-900">
              Reset Password
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Confirm your recovery session, verify 2FA where required, and set a new secure
              password.
            </p>
          </div>

          {err && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
              {err}
            </div>
          )}

          {msg && (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              {msg}
            </div>
          )}

          {!sessionReady ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                Your reset session is not active. Please request a fresh reset link and open it from
                your email.
              </div>

              <Link
                href="/forgot-password"
                className="block rounded-2xl bg-blue-600 px-4 py-3 text-center text-sm font-black text-white hover:bg-blue-700"
              >
                Request New Reset Link
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <StatusBox label="Recovery Session" value="Confirmed" ok />

                <StatusBox
                  label="2FA Requirement"
                  value={
                    checkingMfa
                      ? "Checking..."
                      : needsMfa
                        ? mfaVerified
                          ? "Verified"
                          : "Required"
                        : "No verified 2FA on account"
                  }
                  ok={!needsMfa || mfaVerified}
                />
              </div>

              {needsMfa && !mfaVerified && (
                <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-4">
                  <div className="font-extrabold text-amber-950">
                    2FA Verification Required
                  </div>

                  <p className="mt-1 text-sm leading-6 text-amber-900">
                    Enter the 6-digit code from your {factorName}. This protects the password reset
                    from unauthorized access.
                  </p>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <input
                      value={mfaCode}
                      onChange={(e) =>
                        setMfaCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))
                      }
                      placeholder="123456"
                      inputMode="numeric"
                      maxLength={6}
                      className="w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-center text-xl font-black tracking-[0.35em] text-slate-900 outline-none focus:border-amber-500 sm:max-w-[210px]"
                    />

                    <button
                      type="button"
                      onClick={verifyMfa}
                      disabled={verifyingMfa || mfaCode.trim().length !== 6}
                      className="rounded-2xl bg-amber-600 px-5 py-3 text-sm font-black text-white hover:bg-amber-700 disabled:opacity-60"
                    >
                      {verifyingMfa ? "Verifying..." : "Verify 2FA"}
                    </button>
                  </div>
                </div>
              )}

              {!needsMfa && (
                <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
                  No verified 2FA factor was found on this account. Password reset can continue,
                  but the user should set up 2FA immediately after login.
                </div>
              )}

              <form onSubmit={updatePassword} className="mt-6 space-y-4">
                <div>
                  <label className="text-sm font-bold text-slate-800">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
                  />
                  <div className={`mt-1 text-xs font-bold ${getPasswordTone(newPassword)}`}>
                    {passwordAdvice(newPassword)}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-bold text-slate-800">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
                  />
                  {confirmPassword && (
                    <div
                      className={`mt-1 text-xs font-bold ${passwordsMatch ? "text-emerald-700" : "text-red-700"
                        }`}
                    >
                      {passwordsMatch ? "Passwords match." : "Passwords do not match."}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Changing Password..." : "Change Password"}
                </button>
              </form>
            </>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
            <Link href="/login" className="font-bold text-blue-700 hover:underline">
              Back to Login
            </Link>

            <Link href="/forgot-password" className="font-bold text-slate-600 hover:text-slate-900">
              Request Another Link
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatusBox({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-200 bg-amber-50 text-amber-900"
        }`}
    >
      <div className="text-xs font-black uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-1 text-sm font-black">{value}</div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 px-4">
          <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center py-10">
            <div className="w-full rounded-3xl border bg-white p-6 text-center text-sm font-semibold text-slate-600 shadow-sm">
              Loading reset page...
            </div>
          </div>
        </main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}