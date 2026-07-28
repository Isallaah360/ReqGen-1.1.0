"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { BrandLockup, FeatureIcon, PublicPageShell } from "../components/ui/PublicPageShell";

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
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadDepts() {
      setLoadingDepts(true);
      const { data, error } = await supabase.from("departments").select("id,name").eq("is_active", true).order("name", { ascending: true });
      if (error) setMsg("Failed to load departments: " + error.message);
      else setDepartments((data || []) as Dept[]);
      setLoadingDepts(false);
    }
    loadDepts();
  }, []);

  const strength = useMemo(() => {
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
    return score;
  }, [password]);

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
      const { error: signUpErr } = await supabase.auth.signUp({ email: cleanEmail, password });
      if (signUpErr) throw new Error("Auth signup failed: " + signUpErr.message);
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (signInErr) throw new Error("Auto login failed: " + signInErr.message);
      setMsg("Saving profile...");
      const { error: profileErr } = await supabase.from("profiles").insert({ id: signInData.user.id, email: cleanEmail, full_name: fullName.trim(), phone: phone.trim() || null, dept_id: deptId, role: "Staff", gender, signature_url: null, is_active: true });
      if (profileErr) throw new Error("Saving profile failed: " + profileErr.message);
      setMsg("Account created. Redirecting to your profile...");
      router.push("/profile");
    } catch (e: unknown) {
      setMsg("Registration failed: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally { setLoading(false); }
  }

  const inputWrap = "mt-2 flex items-center rounded-2xl border border-slate-200 bg-white px-4 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100";
  const inputClass = "w-full border-0 bg-transparent px-3 py-3 text-base text-slate-950 outline-none";

  return (
    <PublicPageShell>
      <div className="mx-auto grid min-h-screen max-w-7xl items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[.8fr_1.2fr] lg:px-8">
        <section className="reqgen-rise hidden rounded-[2.25rem] border border-white/10 bg-white/5 p-8 text-white backdrop-blur-xl lg:block">
          <BrandLockup />
          <div className="mt-12">
            <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Staff Registration</div>
            <h1 className="mt-6 text-5xl font-black tracking-tight">Join the IET digital workflow.</h1>
            <p className="mt-5 text-base font-medium leading-8 text-slate-300">Create your staff account, complete your profile and begin managing institutional requests securely.</p>
          </div>
          <div className="mt-10 space-y-3">
            {['Verified institutional identity','Department-based access','Signature setup after registration'].map((item, i) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200">{i + 1}</span>{item}</div>
            ))}
          </div>
        </section>

        <section className="reqgen-rise-delay w-full rounded-[2.25rem] border border-white/15 bg-white p-5 shadow-2xl shadow-black/30 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">ReqGen Staff Account</p><h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Create your account</h2><p className="mt-2 text-sm font-medium leading-6 text-slate-600">Complete the details below. Your digital signature will be added from your profile.</p></div>
            <div className="h-16 w-16 rounded-2xl border border-slate-200 bg-slate-50 p-2"><img src="/iet-logo.png" alt="IET logo" className="h-full w-full object-contain" /></div>
          </div>

          {msg && <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-bold ${msg.toLowerCase().includes('failed') || msg.toLowerCase().includes('please') || msg.toLowerCase().includes('do not') ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-blue-200 bg-blue-50 text-blue-800'}`}>{msg}</div>}

          <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-bold text-slate-800 md:col-span-2">Full name<div className={inputWrap}><span className="text-slate-400"><FeatureIcon name="user" /></span><input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} placeholder="e.g. Isah Usman Barde" autoComplete="name" /></div></label>
            <label className="block text-sm font-bold text-slate-800">Phone number<div className={inputWrap}><span className="text-slate-400"><FeatureIcon name="phone" /></span><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="e.g. 0803..." autoComplete="tel" /></div></label>
            <label className="block text-sm font-bold text-slate-800">Gender<select value={gender} onChange={(e) => setGender(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"><option value="">Select gender</option><option value="Male">Male</option><option value="Female">Female</option></select></label>
            <label className="block text-sm font-bold text-slate-800 md:col-span-2">Department<div className={inputWrap}><span className="text-slate-400"><FeatureIcon name="building" /></span><select value={deptId} onChange={(e) => setDeptId(e.target.value)} disabled={loadingDepts} className={`${inputClass} disabled:opacity-60`}><option value="">{loadingDepts ? "Loading departments..." : "Select department"}</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div></label>
            <label className="block text-sm font-bold text-slate-800 md:col-span-2">Email address<div className={inputWrap}><span className="text-slate-400"><FeatureIcon name="mail" /></span><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={inputClass} placeholder="name@domain.com" autoComplete="email" /></div></label>
            <label className="block text-sm font-bold text-slate-800">Password<div className={inputWrap}><span className="text-slate-400"><FeatureIcon name="lock" /></span><input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? 'text' : 'password'} className={inputClass} placeholder="Minimum 6 characters" autoComplete="new-password" /><button type="button" onClick={() => setShowPassword((v) => !v)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label={showPassword ? 'Hide password' : 'Show password'}><FeatureIcon name="eye" /></button></div><div className="mt-2 grid grid-cols-4 gap-1">{[1,2,3,4].map((n) => <span key={n} className={`h-1.5 rounded-full ${strength >= n ? 'bg-blue-600' : 'bg-slate-200'}`} />)}</div></label>
            <label className="block text-sm font-bold text-slate-800">Confirm password<div className={inputWrap}><span className="text-slate-400"><FeatureIcon name="lock" /></span><input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type={showPassword ? 'text' : 'password'} className={inputClass} placeholder="Re-type password" autoComplete="new-password" /></div></label>
            <div className="md:col-span-2"><button type="submit" disabled={loading || loadingDepts} className="w-full rounded-2xl bg-blue-600 px-4 py-4 text-base font-black text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Creating account...' : 'Create Staff Account'}</button><div className="mt-5 flex flex-col items-center gap-3 text-sm font-semibold text-slate-600 sm:flex-row sm:justify-between"><span>Already registered? <Link href="/login" className="font-black text-blue-700 hover:underline">Login</Link></span><Link href="/" className="font-black text-slate-600 hover:text-slate-950">Back home</Link></div></div>
          </form>
        </section>
      </div>
    </PublicPageShell>
  );
}
