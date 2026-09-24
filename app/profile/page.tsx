"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ActiveRoleSwitcher } from "@/app/components/ActiveRoleSwitcher";
import ProfileNavigation from "@/app/components/profile/ProfileNavigation";

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


function displayRoleName(value: string | null | undefined) {
  const raw = String(value || "Staff").trim();
  const key = raw.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (key === "deanadmin" || key === "dinadmin") return "DIN Admin";
  return raw || "Staff";
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
  const [msg, setMsg] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<string>("");

  const [deptName, setDeptName] = useState<string>("");
  const [role, setRole] = useState<string>("Staff");

  const [email, setEmail] = useState<string>("");
  const [newEmail, setNewEmail] = useState<string>("");

  const [sigPath, setSigPath] = useState<string | null>(null);
  const [sigPreview, setSigPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadingSig, setUploadingSig] = useState(false);

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

  const busy = refreshing || savingProfile || savingEmail || uploadingSig;

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
    queueMicrotask(() => { void load(); });

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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setMsg("❌ Save failed: " + message);
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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setMsg("❌ Signature upload failed: " + message);
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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setMsg("❌ Email change failed: " + message);
    } finally {
      setSavingEmail(false);
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

  function goChangePassword() {
    router.push(`/change-password?updated=${Date.now()}`);
    router.refresh();
  }

  async function refreshSecurity() {
    setRefreshing(true);
    setMsg(null);

    try {
      await loadSecurityStatus();
      setMsg("✅ Security status refreshed.");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setMsg("❌ Failed to refresh security status: " + message);
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <main className="rg-profile-page">
        <div className="rg-profile-loading">Loading profile...</div>
      </main>
    );
  }

  const profileInitials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "RG";

  const canonicalRole = displayRoleName(role);

  return (
    <main className="rg-profile-page">
      <section className="rg-profile-hero" aria-labelledby="profile-page-title">
        <div className="rg-profile-avatar-large" aria-hidden="true">{profileInitials}</div>
        <div className="rg-profile-identity">
          <div className="rg-profile-title-line">
            <h1 id="profile-page-title">{fullName || "My Profile"}</h1>
            <span className="rg-profile-role-badge">{canonicalRole}</span>
          </div>
          <div className="rg-profile-meta">
            <span>{email || "Email not available"}</span>
            <span>Department: {deptName || "Not assigned"}</span>
          </div>
        </div>
        <div className="rg-profile-hero-actions">
          <ActiveRoleSwitcher />
          <button type="button" onClick={() => load({ silent: true })} disabled={busy} className="rg-action-button">
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </section>

      <ProfileNavigation />

      {msg && <div className="rg-profile-message">{msg}</div>}

      <section className="rg-profile-grid">
        <article className="rg-profile-card rg-profile-card-wide">
          <div className="rg-profile-card-head">
            <div>
              <h2>Personal Information</h2>
              <p>Maintain your ReqGen identity and contact information.</p>
            </div>
            <button type="button" onClick={goDashboard} className="rg-action-button rg-action-secondary">Dashboard</button>
          </div>

          <div className="rg-profile-form-grid">
            <label>Full Name
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={savingProfile} />
            </label>
            <label>Email Address
              <input value={email || "—"} readOnly />
            </label>
            <label>Phone
              <input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={savingProfile} />
            </label>
            <label>Gender
              <select value={gender} onChange={(e) => setGender(e.target.value)} disabled={savingProfile}>
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </label>
            <label>Department
              <input value={deptName || "—"} readOnly />
            </label>
            <label>Role
              <input value={canonicalRole} readOnly />
            </label>
          </div>

          <div className="rg-profile-card-actions">
            <button type="button" onClick={saveProfile} disabled={!canSaveProfile || savingProfile} className="rg-primary-button">
              {savingProfile ? "Saving..." : "Update Profile"}
            </button>
          </div>
        </article>

        <article className="rg-profile-card">
          <div className="rg-profile-card-head">
            <div><h2>Institutional Signature</h2><p>Used for authorised request and approval actions.</p></div>
          </div>
          <div className="rg-signature-preview">
            {sigPreview ? (
              <Image src={sigPreview} alt="Saved signature" width={320} height={96} unoptimized />
            ) : <span>No signature uploaded</span>}
          </div>
          <label className="rg-profile-file-label">Upload or replace signature
            <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" disabled={uploadingSig} onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          <button type="button" onClick={uploadSignature} disabled={uploadingSig || !file} className="rg-secondary-button">
            {uploadingSig ? "Saving Signature..." : "Save Signature"}
          </button>
          {!sigPath ? <div className="rg-profile-warning">A saved signature is required for protected request and approval actions.</div> : null}
        </article>

        <article className="rg-profile-card">
          <div className="rg-profile-card-head"><div><h2>Email & Password</h2><p>Securely maintain your sign-in credentials.</p></div></div>
          <label>New Email Address
            <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} disabled={savingEmail} />
          </label>
          <div className="rg-profile-card-actions rg-profile-stack-actions">
            <button type="button" onClick={changeEmail} disabled={savingEmail} className="rg-secondary-button">{savingEmail ? "Updating Email..." : "Update Email"}</button>
            <button type="button" onClick={goChangePassword} className="rg-primary-button">Change Password</button>
          </div>
        </article>

        <article className="rg-profile-card rg-profile-card-wide">
          <div className="rg-profile-card-head">
            <div><h2>Security & 2FA Status</h2><p>Current authenticator and session assurance state.</p></div>
            <span className={`rg-profile-security-badge ${isSessionMfaVerified ? "is-ok" : "is-action"}`}>
              {isSessionMfaVerified ? "Secure Session" : "Action Required"}
            </span>
          </div>
          <div className="rg-security-grid">
            <SecurityLine label="2FA Setup" value={isMfaSetupComplete ? "Completed" : "Required"} ok={isMfaSetupComplete} />
            <SecurityLine label="Current Session" value={isSessionMfaVerified ? "MFA Verified" : "Password Only"} ok={isSessionMfaVerified} />
            <SecurityLine label="Assurance Level" value={`${security.currentLevel || "unknown"} → ${security.nextLevel || "unknown"}`} ok={isSessionMfaVerified} />
            <SecurityLine label="Authenticator Factors" value={String(security.factorCount)} ok={security.factorCount > 0} />
          </div>
          <div className="rg-profile-card-actions">
            {!isMfaSetupComplete ? <button type="button" onClick={goMfaSetup} className="rg-primary-button">Set Up 2FA</button> : null}
            {isMfaSetupComplete && !isSessionMfaVerified ? <button type="button" onClick={goMfaVerify} className="rg-primary-button">Verify 2FA</button> : null}
            <button type="button" onClick={refreshSecurity} disabled={refreshing} className="rg-secondary-button">{refreshing ? "Refreshing..." : "Refresh Security"}</button>
          </div>
        </article>
      </section>
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