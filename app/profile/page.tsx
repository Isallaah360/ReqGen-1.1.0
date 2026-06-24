"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Dept = { id: string; name: string };

type SecurityStatus = {
  hasVerifiedTotp: boolean;
  currentLevel: string | null;
  nextLevel: string | null;
  factorCount: number;
};

function getPublicSignatureUrl(path: string | null | undefined) {
  const raw = (path || "").trim();
  if (!raw) return null;

  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("data:image/") ||
    raw.startsWith("blob:")
  ) {
    return raw;
  }

  const cleaned = raw.replace(/^signatures\//, "").replace(/^\/+/, "");
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!base) return null;

  return `${base}/storage/v1/object/public/signatures/${cleaned}?t=${Date.now()}`;
}

function securityBadgeClass(ok: boolean) {
  return ok
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-red-200 bg-red-50 text-red-700";
}

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<string>("");

  const [deptId, setDeptId] = useState<string | null>(null);
  const [deptName, setDeptName] = useState<string>("");
  const [role, setRole] = useState<string>("Staff");

  const [email, setEmail] = useState<string>("");
  const [newEmail, setNewEmail] = useState<string>("");

  const [sigPath, setSigPath] = useState<string | null>(null);
  const [sigPreview, setSigPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadingSig, setUploadingSig] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [security, setSecurity] = useState<SecurityStatus>({
    hasVerifiedTotp: false,
    currentLevel: null,
    nextLevel: null,
    factorCount: 0,
  });

  const canSaveProfile = useMemo(() => {
    return fullName.trim().length >= 3 && !!gender;
  }, [fullName, gender]);

  const isSessionMfaVerified = security.currentLevel === "aal2";
  const isMfaSetupComplete = security.hasVerifiedTotp;

  const loadSecurityStatus = useCallback(async () => {
    const [factorsRes, aalRes] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);

    if (factorsRes.error) {
      setSecurity({
        hasVerifiedTotp: false,
        currentLevel: aalRes.data?.currentLevel || null,
        nextLevel: aalRes.data?.nextLevel || null,
        factorCount: 0,
      });
      return;
    }

    const verifiedTotpFactors = factorsRes.data.totp.filter(
      (factor) => factor.status === "verified"
    );

    setSecurity({
      hasVerifiedTotp: verifiedTotpFactors.length > 0,
      currentLevel: aalRes.data?.currentLevel || null,
      nextLevel: aalRes.data?.nextLevel || null,
      factorCount: verifiedTotpFactors.length,
    });
  }, []);

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (options?.silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMsg(null);

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!user) {
        router.push("/login");
        return;
      }

      setEmail(user.email || "");
      setNewEmail(user.email || "");

      const [profileRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, phone, gender, dept_id, role, signature_url")
          .eq("id", user.id)
          .single(),
        loadSecurityStatus(),
      ]);

      if (profileRes.error) {
        setMsg("Failed to load profile: " + profileRes.error.message);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const prof = profileRes.data;

      setFullName(prof?.full_name || "");
      setPhone(prof?.phone || "");
      setGender(prof?.gender || "");
      setDeptId(prof?.dept_id || null);
      setRole(prof?.role || "Staff");

      const savedSigPath = prof?.signature_url || null;
      setSigPath(savedSigPath);
      setSigPreview(getPublicSignatureUrl(savedSigPath));

      setDeptName("");

      if (prof?.dept_id) {
        const { data: dept, error: deptErr } = await supabase
          .from("departments")
          .select("id,name")
          .eq("id", prof.dept_id)
          .single();

        if (deptErr) {
          setDeptName("—");
        } else if (dept) {
          setDeptName((dept as Dept).name);
        }
      }

      setLoading(false);
      setRefreshing(false);
    },
    [router, loadSecurityStatus]
  );

  useEffect(() => {
    load();

    const refreshOnFocus = () => {
      load({ silent: true });
    };

    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") {
        load({ silent: true });
      }
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisible);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, [load]);

  async function saveProfile() {
    setMsg(null);

    if (!canSaveProfile) {
      setMsg("❌ Please enter a valid full name and select gender.");
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) {
      router.push("/login");
      return;
    }

    setSavingProfile(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          gender,
        })
        .eq("id", user.id);

      if (error) throw new Error(error.message);

      setMsg("✅ Profile saved successfully.");
      await load({ silent: true });
      router.refresh();
    } catch (e: any) {
      setMsg("❌ Save failed: " + (e?.message || "Unknown error"));
    } finally {
      setSavingProfile(false);
    }
  }

  async function uploadSignature() {
    setMsg(null);

    if (!file) {
      setMsg("❌ Please select a signature image first.");
      return;
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setMsg("❌ Signature must be PNG, JPG, JPEG or WEBP.");
      return;
    }

    if (file.size > 500 * 1024) {
      setMsg("❌ Signature file too large (max 500KB).");
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) {
      router.push("/login");
      return;
    }

    try {
      setUploadingSig(true);
      setMsg("Uploading signature...");

      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const safeExt = ["png", "jpg", "jpeg", "webp"].includes(ext) ? ext : "jpg";
      const path = `${user.id}/signature-${Date.now()}.${safeExt}`;

      const { error: upErr } = await supabase.storage
        .from("signatures")
        .upload(path, file, {
          upsert: false,
          contentType: file.type || "image/jpeg",
        });

      if (upErr) throw new Error(upErr.message);

      const { error: profErr } = await supabase
        .from("profiles")
        .update({ signature_url: path })
        .eq("id", user.id);

      if (profErr) throw new Error(profErr.message);

      setSigPath(path);
      setSigPreview(getPublicSignatureUrl(path));
      setFile(null);
      setMsg("✅ Signature saved successfully.");

      await load({ silent: true });
      router.refresh();
    } catch (e: any) {
      setMsg("❌ Signature upload failed: " + (e?.message || "Unknown error"));
    } finally {
      setUploadingSig(false);
    }
  }

  async function changeEmail() {
    setMsg(null);

    const clean = newEmail.trim().toLowerCase();

    if (!clean.includes("@")) {
      setMsg("❌ Please enter a valid email.");
      return;
    }

    if (clean === email.trim().toLowerCase()) {
      setMsg("ℹ️ This is already your current email.");
      return;
    }

    setSavingEmail(true);

    try {
      const { error } = await supabase.auth.updateUser({ email: clean });
      if (error) throw new Error(error.message);

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (user) {
        await supabase.from("profiles").update({ email: clean }).eq("id", user.id);
      }

      setMsg("✅ Email update started. Check email if confirmation is required.");
      await load({ silent: true });
      router.refresh();
    } catch (e: any) {
      setMsg("❌ Email change failed: " + (e?.message || "Unknown error"));
    } finally {
      setSavingEmail(false);
    }
  }

  async function changePassword() {
    setMsg(null);

    if (newPassword.length < 6) {
      setMsg("❌ Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setMsg("❌ Passwords do not match.");
      return;
    }

    setSavingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);

      setNewPassword("");
      setConfirmNewPassword("");
      setMsg("✅ Password updated successfully.");
      await loadSecurityStatus();
      router.refresh();
    } catch (e: any) {
      setMsg("❌ Password change failed: " + (e?.message || "Unknown error"));
    } finally {
      setSavingPassword(false);
    }
  }

  function goDashboard() {
    router.push(`/dashboard?updated=${Date.now()}`);
    router.refresh();
  }

  function goMfaSetup() {
    router.push(`/mfa/setup?updated=${Date.now()}`);
    router.refresh();
  }

  function goMfaVerify() {
    router.push(`/mfa?updated=${Date.now()}`);
    router.refresh();
  }

  async function refreshSecurity() {
    setRefreshing(true);
    setMsg(null);

    try {
      await loadSecurityStatus();
      setMsg("✅ Security status refreshed.");
    } catch (e: any) {
      setMsg("❌ Failed to refresh security status: " + (e?.message || "Unknown error"));
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-5xl py-10 text-slate-600">Loading profile...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-5xl py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              My Profile
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Update your details, signature and security information. Department and role are
              managed by Admin.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => load({ silent: true })}
              disabled={refreshing || savingProfile || savingEmail || savingPassword || uploadingSig}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              onClick={goDashboard}
              disabled={refreshing || savingProfile || savingEmail || savingPassword || uploadingSig}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
            >
              Back
            </button>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm">
            {msg}
          </div>
        )}

        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-900">
          This profile page refreshes automatically when you return to it. Signature and 2FA changes are reloaded immediately.
        </div>

        <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">
                Security & 2FA Status
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                ReqGen uses authenticator app 2FA to protect logins and sensitive actions.
              </p>
            </div>

            <span
              className={`rounded-full border px-3 py-1 text-xs font-bold ${securityBadgeClass(
                isSessionMfaVerified
              )}`}
            >
              {isSessionMfaVerified ? "Secure Session" : "2FA Action Required"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SecurityLine
              label="2FA Setup"
              value={isMfaSetupComplete ? "Completed" : "Required"}
              ok={isMfaSetupComplete}
            />

            <SecurityLine
              label="Current Session"
              value={isSessionMfaVerified ? "MFA Verified" : "Password Only"}
              ok={isSessionMfaVerified}
            />

            <SecurityLine
              label="Assurance Level"
              value={`${security.currentLevel || "unknown"} → ${security.nextLevel || "unknown"}`}
              ok={isSessionMfaVerified}
            />

            <SecurityLine
              label="Authenticator Factors"
              value={String(security.factorCount)}
              ok={security.factorCount > 0}
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {!isMfaSetupComplete && (
              <button
                onClick={goMfaSetup}
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
              >
                Set Up 2FA
              </button>
            )}

            {isMfaSetupComplete && !isSessionMfaVerified && (
              <button
                onClick={goMfaVerify}
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
              >
                Verify 2FA
              </button>
            )}

            <button
              onClick={refreshSecurity}
              disabled={refreshing}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh Security Status"}
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            <b>Important:</b> Do not share your password or authenticator code. Request submission,
            approval, voucher actions and finance changes will require a verified 2FA session.
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Profile Details</h2>

            <div className="mt-4">
              <label className="text-sm font-semibold text-slate-800">Full Name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={savingProfile}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
              />
            </div>

            <div className="mt-4">
              <label className="text-sm font-semibold text-slate-800">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={savingProfile}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
              />
            </div>

            <div className="mt-4">
              <label className="text-sm font-semibold text-slate-800">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                disabled={savingProfile}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
              >
                <option value="">-- Select --</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            <div className="mt-4">
              <label className="text-sm font-semibold text-slate-800">Department (Admin)</label>
              <input
                value={deptName || "—"}
                readOnly
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900"
              />
            </div>

            <div className="mt-4">
              <label className="text-sm font-semibold text-slate-800">Role (Admin)</label>
              <input
                value={role || "—"}
                readOnly
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900"
              />
            </div>

            <button
              onClick={saveProfile}
              disabled={!canSaveProfile || savingProfile}
              className="mt-5 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
            >
              {savingProfile ? "Saving..." : "Save Profile"}
            </button>
          </div>

          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Signature</h2>
            <p className="mt-1 text-sm text-slate-600">
              Required for request submission and approvals.
            </p>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-800">Current Signature</div>

              {sigPreview ? (
                <img
                  src={sigPreview}
                  alt="Signature"
                  className="mt-3 h-24 w-auto rounded-xl border bg-white p-2"
                />
              ) : (
                <div className="mt-3 text-sm text-slate-700">No signature uploaded yet.</div>
              )}
            </div>

            <div className="mt-4">
              <label className="text-sm font-semibold text-slate-800">
                Upload/Replace (PNG/JPG/JPEG/WEBP)
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                disabled={uploadingSig}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 disabled:bg-slate-50"
              />
            </div>

            <button
              onClick={uploadSignature}
              disabled={uploadingSig}
              className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
            >
              {uploadingSig ? "Saving Signature..." : "Save Signature"}
            </button>

            {!sigPath && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                You must upload a signature before submitting any request.
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Email</h2>
            <p className="mt-1 text-sm text-slate-600">
              Current: <b className="text-slate-900">{email || "—"}</b>
            </p>

            <div className="mt-4">
              <label className="text-sm font-semibold text-slate-800">New Email</label>
              <input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                disabled={savingEmail}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
              />
            </div>

            <button
              onClick={changeEmail}
              disabled={savingEmail}
              className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
            >
              {savingEmail ? "Updating Email..." : "Update Email"}
            </button>

            <p className="mt-3 text-xs text-slate-500">
              If email confirmation is enabled, you must confirm via email.
            </p>
          </div>

          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Password</h2>

            <div className="mt-4">
              <label className="text-sm font-semibold text-slate-800">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={savingPassword}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
              />
            </div>

            <div className="mt-4">
              <label className="text-sm font-semibold text-slate-800">Confirm New Password</label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                disabled={savingPassword}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
              />
            </div>

            <button
              onClick={changePassword}
              disabled={savingPassword}
              className="mt-4 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {savingPassword ? "Changing Password..." : "Change Password"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function SecurityLine({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </div>
          <div className="mt-1 text-sm font-bold text-slate-900">{value}</div>
        </div>

        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${securityBadgeClass(
            ok
          )}`}
        >
          {ok ? "OK" : "Action"}
        </span>
      </div>
    </div>
  );
}