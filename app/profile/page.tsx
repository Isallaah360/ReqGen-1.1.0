"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Dept = { id: string; name: string };

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  // profile fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<string>("");

  const [deptId, setDeptId] = useState<string | null>(null);
  const [deptName, setDeptName] = useState<string>("");
  const [role, setRole] = useState<string>("Staff");

  const [email, setEmail] = useState<string>(""); // current auth email
  const [newEmail, setNewEmail] = useState<string>("");

  // signature
  const [sigPath, setSigPath] = useState<string | null>(null);
  const [sigPreview, setSigPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  // password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const canSaveProfile = useMemo(() => {
    return fullName.trim().length >= 3 && !!gender;
  }, [fullName, gender]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg(null);

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        router.push("/login");
        return;
      }

      setEmail(user.email || "");
      setNewEmail(user.email || "");

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("full_name, phone, gender, dept_id, role, signature_url")
        .eq("id", user.id)
        .single();

      if (profErr) {
        setMsg("Failed to load profile: " + profErr.message);
        setLoading(false);
        return;
      }

      setFullName(prof?.full_name || "");
      setPhone(prof?.phone || "");
      setGender(prof?.gender || "");
      setDeptId(prof?.dept_id || null);
      setRole(prof?.role || "Staff");
      setSigPath(prof?.signature_url || null);

      if (prof?.dept_id) {
        const { data: dept } = await supabase
          .from("departments")
          .select("id,name")
          .eq("id", prof.dept_id)
          .single();

        if (dept) setDeptName((dept as Dept).name);
      }

      if (prof?.signature_url) {
        const { data: signed } = await supabase.storage
          .from("signatures")
          .createSignedUrl(prof.signature_url, 60 * 10);

        if (signed?.signedUrl) setSigPreview(signed.signedUrl);
      }

      setLoading(false);
    }

    load();
  }, [router]);

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

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        gender,
      })
      .eq("id", user.id);

    if (error) setMsg("❌ Save failed: " + error.message);
    else setMsg("✅ Profile saved successfully.");
  }

  async function uploadSignature() {
    setMsg(null);

    if (!file) return setMsg("❌ Please select a signature image first.");

    const ok = file.type === "image/png" || file.type === "image/jpeg";
    if (!ok) return setMsg("❌ Signature must be PNG or JPG.");

    // Optional (but good): limit size to 300KB
    if (file.size > 300 * 1024) return setMsg("❌ Signature file too large (max 300KB).");

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      router.push("/login");
      return;
    }

    try {
      setMsg("Uploading signature...");

      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/signature.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("signatures")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (upErr) throw new Error(upErr.message);

      const { error: profErr } = await supabase
        .from("profiles")
        .update({ signature_url: path })
        .eq("id", user.id);

      if (profErr) throw new Error(profErr.message);

      setSigPath(path);

      const { data: signed } = await supabase.storage
        .from("signatures")
        .createSignedUrl(path, 60 * 10);

      if (signed?.signedUrl) setSigPreview(signed.signedUrl);

      setFile(null);
      setMsg("✅ Signature saved successfully.");
    } catch (e: any) {
      setMsg("❌ Signature upload failed: " + (e?.message || "Unknown error"));
    }
  }

  async function changeEmail() {
    setMsg(null);

    const clean = newEmail.trim().toLowerCase();
    if (!clean.includes("@")) return setMsg("❌ Please enter a valid email.");

    try {
      const { error } = await supabase.auth.updateUser({ email: clean });
      if (error) throw new Error(error.message);

      // Keep profiles.email in sync
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (user) await supabase.from("profiles").update({ email: clean }).eq("id", user.id);

      setMsg("✅ Email update started. Check email if confirmation is required.");
    } catch (e: any) {
      setMsg("❌ Email change failed: " + (e?.message || "Unknown error"));
    }
  }

  async function changePassword() {
    setMsg(null);

    if (newPassword.length < 6) return setMsg("❌ Password must be at least 6 characters.");
    if (newPassword !== confirmNewPassword) return setMsg("❌ Passwords do not match.");

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);

      setNewPassword("");
      setConfirmNewPassword("");
      setMsg("✅ Password updated successfully.");
    } catch (e: any) {
      setMsg("❌ Password change failed: " + (e?.message || "Unknown error"));
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-4xl py-10 text-slate-600">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-4xl py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">My Profile</h1>
            <p className="mt-2 text-sm text-slate-600">
              Update your details. Department & Role are managed by Admin.
            </p>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Back
          </button>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">
            {msg}
          </div>
        )}

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Profile Details */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Profile Details</h2>

            <div className="mt-4">
              <label className="text-sm font-semibold text-slate-800">Full Name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div className="mt-4">
              <label className="text-sm font-semibold text-slate-800">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div className="mt-4">
              <label className="text-sm font-semibold text-slate-800">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
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
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900"
              />
            </div>

            <div className="mt-4">
              <label className="text-sm font-semibold text-slate-800">Role (Admin)</label>
              <input
                value={role || "—"}
                readOnly
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900"
              />
            </div>

            <button
              onClick={saveProfile}
              disabled={!canSaveProfile}
              className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
            >
              Save Profile
            </button>
          </div>

          {/* Signature */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
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
                  className="mt-3 h-20 w-auto rounded-xl border bg-white p-2"
                />
              ) : (
                <div className="mt-3 text-sm text-slate-700">No signature uploaded yet.</div>
              )}
            </div>

            <div className="mt-4">
              <label className="text-sm font-semibold text-slate-800">Upload/Replace (PNG/JPG)</label>
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900"
              />
            </div>

            <button
              onClick={uploadSignature}
              className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Save Signature
            </button>

            {!sigPath && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                You must upload a signature before submitting any request.
              </div>
            )}
          </div>
        </div>

        {/* Security section */}
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Email */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Email</h2>
            <p className="mt-1 text-sm text-slate-600">
              Current: <b className="text-slate-900">{email || "—"}</b>
            </p>

            <div className="mt-4">
              <label className="text-sm font-semibold text-slate-800">New Email</label>
              <input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={changeEmail}
              className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Update Email
            </button>

            <p className="mt-3 text-xs text-slate-500">
              If email confirmation is enabled, you must confirm via email.
            </p>
          </div>

          {/* Password */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Password</h2>

            <div className="mt-4">
              <label className="text-sm font-semibold text-slate-800">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div className="mt-4">
              <label className="text-sm font-semibold text-slate-800">Confirm New Password</label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={changePassword}
              className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Change Password
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}