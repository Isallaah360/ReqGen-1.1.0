"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

function getAppOrigin() {
    if (typeof window === "undefined") return "";
    return window.location.origin;
}

function cleanEmail(email: string) {
    return email.trim().toLowerCase();
}

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);

    const validEmail = useMemo(() => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail(email));
    }, [email]);

    async function submit(e: FormEvent) {
        e.preventDefault();

        setMsg(null);
        setErr(null);

        const finalEmail = cleanEmail(email);

        if (!finalEmail) {
            setErr("Please enter your registered email address.");
            return;
        }

        if (!validEmail) {
            setErr("Please enter a valid email address.");
            return;
        }

        setSending(true);

        const redirectTo = `${getAppOrigin()}/reset-password`;

        const { error } = await supabase.auth.resetPasswordForEmail(finalEmail, {
            redirectTo,
        });

        setSending(false);

        if (error) {
            setErr(error.message);
            return;
        }

        setSent(true);
        setMsg(
            "Password reset email sent. Please open your email, click the secure reset link, verify 2FA where required, and set a new password."
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 px-4">
            <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center py-10">
                <div className="w-full rounded-3xl border bg-white p-6 shadow-sm">
                    <div className="text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-xl font-black text-white">
                            RG
                        </div>

                        <h1 className="mt-4 text-2xl font-extrabold text-slate-900">
                            Forgot Password
                        </h1>

                        <p className="mt-2 text-sm leading-6 text-slate-600">
                            Enter your registered ReqGen email address. We will send a secure reset link to your
                            email. After opening the link, you will confirm your new password and complete 2FA
                            verification where required.
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

                    {!sent ? (
                        <form onSubmit={submit} className="mt-6 space-y-4">
                            <div>
                                <label className="text-sm font-bold text-slate-800">Email Address</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@example.com"
                                    autoComplete="email"
                                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={sending || !validEmail}
                                className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {sending ? "Sending Reset Link..." : "Send Password Reset Link"}
                            </button>
                        </form>
                    ) : (
                        <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                            <div className="font-black">Next Step</div>
                            <p className="mt-1">
                                Check your inbox and spam folder. Open the reset link using the same browser if
                                possible. The link will take you to the secure password reset page.
                            </p>

                            <button
                                type="button"
                                onClick={() => {
                                    setSent(false);
                                    setMsg(null);
                                    setErr(null);
                                }}
                                className="mt-4 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50"
                            >
                                Send Again
                            </button>
                        </div>
                    )}

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
                        <Link href="/login" className="font-bold text-blue-700 hover:underline">
                            Back to Login
                        </Link>

                        <Link href="/" className="font-bold text-slate-600 hover:text-slate-900">
                            Homepage
                        </Link>
                    </div>

                    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                        Security note: ReqGen will never ask you to share your password, reset link, or
                        authenticator code with anyone.
                    </div>
                </div>
            </div>
        </main>
    );
}