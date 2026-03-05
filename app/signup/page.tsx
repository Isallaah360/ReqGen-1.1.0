"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Dept = { id: string; name: string };

export default function SignupPage() {
  const router = useRouter();

  const [departments, setDepartments] = useState<Dept[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [deptId, setDeptId] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadDepts() {
      setLoadingDepts(true);
      setMsg(null);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const cleanEmail = email.trim().toLowerCase();

    if (fullName.trim().length < 3) return setMsg("Please enter your full name.");
    if (!gender) return setMsg("Please select gender.");
    if (!deptId) return setMsg("Please select department.");
    if (!cleanEmail.includes("@")) return setMsg("Please enter a valid email.");
    if (password.length < 6) return setMsg("Password must be at least 6 characters.");
    if (confirmPassword !== password) return setMsg("Passwords do not match.");

    try {
      setLoading(true);
      setMsg("Creating account...");

      const { error: signUpErr } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });

      if (signUpErr) throw new Error("Auth signup failed: " + signUpErr.message);

      // Auto login so we can create profile row
      const { data: signInData, error: signInErr } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (signInErr) throw new Error("Auto login failed: " + signInErr.message);

      const userId = signInData.user.id;

      setMsg("Saving profile...");

      const { error: profileErr } = await supabase.from("profiles").insert({
        id: userId,
        email: cleanEmail,
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        dept_id: deptId,
        role: "Staff",
        gender,
        signature_url: null, // ✅ uploaded after signup in /profile
        is_active: true,
      });

      if (profileErr) throw new Error("Saving profile failed: " + profileErr.message);

      setMsg("✅ Account created. Please upload your signature next.");
      router.push("/profile");
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-xl py-10">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            ReqGen <span className="text-slate-400">Sign Up</span>
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Create your IET staff account. Signature upload comes after registration.
          </p>

          {msg && (
            <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">
              {msg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-800">Full Name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g., Isah Usman Barde"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g., 0803..."
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
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

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-800">Department</label>
              <select
                value={deptId}
                onChange={(e) => setDeptId(e.target.value)}
                disabled={loadingDepts}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500 disabled:opacity-60"
              >
                <option value="">
                  {loadingDepts ? "Loading departments..." : "-- Select Department --"}
                </option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-800">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@domain.com"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type password"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? "Creating..." : "Create Account"}
              </button>
              <div className="mt-3 text-center text-sm text-slate-600">
                Already have an account?{" "}
                <a className="font-semibold text-blue-700 hover:underline" href="/login">
                  Login
                </a>
              </div>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}