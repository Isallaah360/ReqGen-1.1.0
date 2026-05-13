"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type EnrollData = {
  id: string;
  type: string;
  totp: {
    qr_code: string;
    secret: string;
    uri: string;
  };
};

export default function MfaSetupPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
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

    const { data: factorsData, error: factorsErr } = await supabase.auth.mfa.listFactors();

    if (factorsErr) {
      setMsg("Failed to check 2FA status: " + factorsErr.message);
      setLoading(false);
      return;
    }

    const verifiedFactors = factorsData.totp.filter((f) => f.status === "verified");

    if (verifiedFactors.length > 0) {
      router.push("/mfa");
      return;
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startEnrollment() {
    setEnrolling(true);
    setMsg(null);

    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "ReqGen Authenticator",
      });

      if (error) throw new Error(error.message);

      const enrollData = data as EnrollData;

      setFactorId(enrollData.id);
      setQrCode(enrollData.totp.qr_code);
      setSecret(enrollData.totp.secret);
      setMsg("Scan the QR code with your authenticator app, then enter the 6-digit code.");
    } catch (e: any) {
      setMsg("❌ Failed to start 2FA setup: " + (e?.message || "Unknown error"));
    } finally {
      setEnrolling(false);
    }
  }

  async function verifyEnrollment() {
    if (!factorId) {
      setMsg("❌ Start 2FA setup first.");
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
        factorId,
      });

      if (challengeErr) throw new Error(challengeErr.message);

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: cleanCode,
      });

      if (verifyErr) throw new Error(verifyErr.message);

      setMsg("✅ 2FA setup completed successfully.");
      router.push("/dashboard");
      router.refresh();
    } catch (e: any) {
      setMsg("❌ 2FA setup verification failed: " + (e?.message || "Unknown error"));
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
        <div className="mx-auto max-w-lg py-16 text-slate-600">
          Loading 2FA setup...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-lg py-16">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="rounded-2xl bg-blue-50 px-4 py-3">
            <div className="text-xs font-black uppercase tracking-wide text-blue-700">
              ReqGen Required Security Setup
            </div>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900">
              Set Up 2FA
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              ReqGen requires an authenticator app for secure login. This helps protect requests,
              approvals, vouchers and finance records.
            </p>
          </div>

          {msg && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
              {msg}
            </div>
          )}

          {!factorId ? (
            <div className="mt-5">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                Install one of these apps on your phone:
                <div className="mt-2 font-bold">
                  Google Authenticator, Microsoft Authenticator, Authy, or 2FAS.
                </div>
              </div>

              <button
                onClick={startEnrollment}
                disabled={enrolling}
                className="mt-5 w-full rounded-2xl bg-blue-600 px-4 py-3 text-base font-bold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {enrolling ? "Preparing 2FA..." : "Start 2FA Setup"}
              </button>
            </div>
          ) : (
            <div className="mt-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
                <div className="text-sm font-bold text-slate-800">
                  Scan this QR code
                </div>

                {qrCode ? (
                  <div
                    className="mx-auto mt-4 flex justify-center rounded-2xl bg-white p-3"
                    dangerouslySetInnerHTML={{ __html: qrCode }}
                  />
                ) : (
                  <div className="mt-4 text-sm text-slate-600">
                    QR code unavailable. Use the setup key below.
                  </div>
                )}

                <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-left">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Manual Setup Key
                  </div>
                  <div className="mt-1 break-all font-mono text-sm font-bold text-slate-900">
                    {secret}
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <label className="text-sm font-bold text-slate-800">
                  Enter 6-digit code from your authenticator app
                </label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") verifyEnrollment();
                  }}
                  inputMode="numeric"
                  maxLength={6}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-4 text-center text-2xl font-black tracking-[0.35em] text-slate-900 outline-none focus:border-blue-500"
                  placeholder="000000"
                  autoFocus
                />
              </div>

              <button
                onClick={verifyEnrollment}
                disabled={verifying}
                className="mt-5 w-full rounded-2xl bg-blue-600 px-4 py-3 text-base font-bold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {verifying ? "Verifying..." : "Complete 2FA Setup"}
              </button>
            </div>
          )}

          <button
            onClick={logout}
            disabled={enrolling || verifying}
            className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
          >
            Logout
          </button>
        </div>
      </div>
    </main>
  );
}