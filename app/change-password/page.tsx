"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

export default function ChangePasswordPage() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [sessionEmail, setSessionEmail] = useState<string | null>(null);

    const [needsMfa, setNeedsMfa] = useState(false);
    const [mfaVerified, setMfaVerified] = useState(false);
    const [factorId, setFactorId] = useState<string | null>(null);
    const [factorName, setFactorName] = useState("Authenticator App");

    const [currentPassword, setCurrentPassword] = useState("");
    const [mfaCode, setMfaCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [verifyingCurrentPassword, setVerifyingCurrentPassword] = useState(false);
    const [currentPasswordVerified, setCurrentPasswordVerified] = useState(false);
    const [verifyingMfa, setVerifyingMfa] = useState(false);
    const [saving, setSaving] = useState(false);

    const [msg, setMsg] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);

    const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
    const passwordStrongEnough = passwordScore(newPassword) >= 3 && newPassword.length >= 8;

    const canSubmit =
        currentPasswordVerified &&
        passwordStrongEnough &&
        passwordsMatch &&
        (!needsMfa || mfaVerified) &&
        !saving;

    async function load() {
        setLoading(true);
        setErr(null);
        setMsg(null);

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !sessionData.session?.user) {
            router.push("/login");
            return;
        }

        const email = sessionData.session.user.email || null;
        setSessionEmail(email);

        const aalRes = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        if (!aalRes.error && aalRes.data.currentLevel === "aal2") {
            setMfaVerified(true);
        } else {
            setMfaVerified(false);
        }

        const factorsRes = await supabase.auth.mfa.listFactors();

        if (!factorsRes.error) {
            const verifiedTotp = (factorsRes.data.totp || []).filter(
                (factor: MfaFactor) => factor.status === "verified"
            );

            if (verifiedTotp.length > 0) {
                const primary = verifiedTotp[0];

                setNeedsMfa(true);
                setFactorId(primary.id);
                setFactorName(primary.friendly_name || "Authenticator App");
            } else {
                setNeedsMfa(false);
                setFactorId(null);
            }
        }

        setLoading(false);
    }

    async function verifyCurrentPassword() {
        setErr(null);
        setMsg(null);

        if (!sessionEmail) {
            setErr("Your session email could not be confirmed. Please login again.");
            return;
        }

        if (!currentPassword) {
            setErr("Please enter your current password.");
            return;
        }

        setVerifyingCurrentPassword(true);

        const { error } = await supabase.auth.signInWithPassword({
            email: sessionEmail,
            password: currentPassword,
        });

        setVerifyingCurrentPassword(false);

        if (error) {
            setCurrentPasswordVerified(false);
            setErr("Current password is incorrect.");
            return;
        }

        setCurrentPasswordVerified(true);
        setMsg("Current password confirmed.");
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
        setMsg("2FA verified.");
    }

    async function changePassword(e: FormEvent) {
        e.preventDefault();

        setErr(null);
        setMsg(null);

        if (!currentPasswordVerified) {
            setErr("Please confirm your current password first.");
            return;
        }

        if (needsMfa && !mfaVerified) {
            setErr("Please verify 2FA before changing your password.");
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

        if (currentPassword === newPassword) {
            setErr("New password must be different from the current password.");
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

        setCurrentPassword("");
        setCurrentPasswordVerified(false);
        setMfaCode("");
        setNewPassword("");
        setConfirmPassword("");
        setMsg("Password changed successfully. Please login again with your new password.");

        await supabase.auth.signOut();

        setTimeout(() => {
            router.push("/login?password_changed=success");
            router.refresh();
        }, 1200);
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-50 px-4">
                <div className="mx-auto max-w-3xl py-10 text-slate-600">
                    Loading password security...
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 px-4">
            <div className="mx-auto max-w-3xl py-8">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                            Change Password
                        </h1>
                        <p className="mt-2 text-sm text-slate-600">
                            Confirm your current password, verify 2FA where required, and set a new secure
                            password.
                        </p>
                    </div>

                    <Link
                        href="/dashboard"
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow-sm hover:bg-slate-100"
                    >
                        Dashboard
                    </Link>
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

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <StatusBox
                        label="Current Password"
                        value={currentPasswordVerified ? "Confirmed" : "Required"}
                        ok={currentPasswordVerified}
                    />

                    <StatusBox
                        label="2FA Status"
                        value={needsMfa ? (mfaVerified ? "Verified" : "Required") : "No verified 2FA"}
                        ok={!needsMfa || mfaVerified}
                    />
                </div>

                <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
                    <div className="font-extrabold text-slate-900">Step 1 — Confirm Current Password</div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                        This confirms that the logged-in user is truly the account owner before a password
                        change.
                    </p>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => {
                                setCurrentPassword(e.target.value);
                                setCurrentPasswordVerified(false);
                            }}
                            placeholder="Current password"
                            autoComplete="current-password"
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
                        />

                        <button
                            type="button"
                            onClick={verifyCurrentPassword}
                            disabled={verifyingCurrentPassword || !currentPassword}
                            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                            {verifyingCurrentPassword ? "Checking..." : "Confirm"}
                        </button>
                    </div>
                </div>

                {needsMfa && !mfaVerified && (
                    <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
                        <div className="font-extrabold text-amber-950">Step 2 — Verify 2FA</div>
                        <p className="mt-1 text-sm leading-6 text-amber-900">
                            Enter the 6-digit code from your {factorName}.
                        </p>

                        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                            <input
                                value={mfaCode}
                                onChange={(e) => setMfaCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
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
                        No verified 2FA factor was found on this account. You can change your password, but you
                        should set up 2FA afterwards from the security page.
                    </div>
                )}

                <form onSubmit={changePassword} className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
                    <div className="font-extrabold text-slate-900">Step 3 — Set New Password</div>

                    <div className="mt-4 space-y-4">
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
                            <label className="text-sm font-bold text-slate-800">Confirm New Password</label>
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
                    </div>
                </form>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                    Security note: after a successful password change, ReqGen signs you out so you can log in
                    again with the new password.
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