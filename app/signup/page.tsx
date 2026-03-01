"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Dept = { id: string; name: string };

export default function SignupPage() {
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [deptId, setDeptId] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [signatureFile, setSignatureFile] = useState<File | null>(null);

  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadDepts() {
      setLoadingDepts(true);
      const { data, error } = await supabase
        .from("departments")
        .select("id,name")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) setMsg("Failed to load departments: " + error.message);
      else setDepartments((data || []) as Dept[]);

      setLoadingDepts(false);
    }

    loadDepts();
  }, []);

  function validate() {
    if (fullName.trim().length < 3) return "Please enter your full name.";
    if (!gender) return "Please select gender.";
    if (!deptId) return "Please select department.";
    if (!email.trim().includes("@")) return "Please enter a valid email.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    if (!signatureFile) return "Please upload your signature image.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const err = validate();
    if (err) {
      setMsg(err);
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    try {
      setMsg("Creating account...");

      // 1) Create Auth user
      const { error: signUpErr } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });

      if (signUpErr) throw new Error("Auth signup failed: " + signUpErr.message);

      // 1b) Ensure we are authenticated (important for Storage RLS)
      const { data: signInData, error: signInErr } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (signInErr) throw new Error("Auto login failed: " + signInErr.message);

      const userId = signInData.user.id;

      // 2) Upload signature
      setMsg("Uploading signature...");

      const fileExt =
        signatureFile!.name.split(".").pop()?.toLowerCase() || "png";

      const objectPath = `${userId}/signature.${fileExt}`;

      const { error: uploadErr } = await supabase.storage
        .from("signatures")
        .upload(objectPath, signatureFile!, {
          upsert: true,
          contentType: signatureFile!.type,
        });

      if (uploadErr)
        throw new Error("Signature upload failed: " + uploadErr.message);

      // 3) Insert into profiles table (NOW includes email)
      setMsg("Saving profile...");

      const { error: profileErr } = await supabase.from("profiles").insert({
        id: userId,
        email: cleanEmail, // ✅ IMPORTANT
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        dept_id: deptId,
        role: "Staff",
        gender,
        signature_url: objectPath,
        is_active: true,
      });

      if (profileErr)
        throw new Error("Saving profile failed: " + profileErr.message);

      setMsg("✅ Account created successfully! You can now login.");
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Unknown error"));
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>ReqGen 1.1.0 — Sign Up</h1>
      <p style={{ marginTop: 8, color: "#555" }}>
        Create your IET staff account.
      </p>

      <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <label>Full Name</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
          placeholder="e.g., Isah Usman Barde"
        />

        <label>Phone</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
          placeholder="e.g., 0803..."
        />

        <label>Gender</label>
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
        >
          <option value="">-- Select --</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>

        <label>Department</label>
        <select
          value={deptId}
          onChange={(e) => setDeptId(e.target.value)}
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
          disabled={loadingDepts}
        >
          <option value="">
            {loadingDepts ? "Loading..." : "-- Select Department --"}
          </option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <label>Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
          placeholder="name@domain.com"
        />

        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
          placeholder="Minimum 6 characters"
        />

        <label>Signature (PNG/JPG)</label>
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={(e) => setSignatureFile(e.target.files?.[0] || null)}
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
        />

        <button
          type="submit"
          style={{
            width: "100%",
            padding: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Create Account
        </button>

        {msg && (
          <div style={{ marginTop: 12, padding: 10, background: "#f5f5f5" }}>
            {msg}
          </div>
        )}
      </form>
    </div>
  );
}