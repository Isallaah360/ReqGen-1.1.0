"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { passwordStrength } from "@/lib/v4/passwordStrength";
import PublicAuthShell from "../components/PublicAuthShell";
import Icon from "../components/v4/Icon";
import { Select } from "../components/v4/Select";
import { Notice } from "../components/v4/ui";

type Dept = { id: string; name: string };

/** Create account (mock-up 05): for IET staff, interns and volunteers. Next: the authenticator, photo and signature. */
export default function SignupPage() {
  const router = useRouter();
  const [depts, setDepts] = useState<Dept[] | null>(null);
  const [f, setF] = useState({ fullName: "", email: "", phone: "", gender: "", deptId: "", password: "", again: "" });
  const [show, setShow] = useState(false);
  const [promise, setPromise] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(async () => {
      const { data, error } = await supabase.from("departments").select("id,name").eq("is_active", true).order("name");
      if (error) setMsg(`Departments could not be loaded: ${error.message}`);
      setDepts((data || []) as Dept[]);
    });
  }, []);

  const set = (k: keyof typeof f) => (v: string) => setF((cur) => ({ ...cur, [k]: v }));
  const s = passwordStrength(f.password);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const email = f.email.trim().toLowerCase();
    if (f.fullName.trim().length < 3) return setMsg("Write your full name as it should appear on documents.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setMsg("Write a valid email address.");
    if (!f.gender) return setMsg("Choose your gender.");
    if (!f.deptId) return setMsg("Choose your department.");
    if (!s.ok) return setMsg("Use a stronger password: at least 8 characters with letters and numbers.");
    if (f.again !== f.password) return setMsg("The two passwords are different.");
    if (!promise) return setMsg("Tick the box to keep your password and authenticator to yourself.");
    setBusy(true);
    try {
      const up = await supabase.auth.signUp({ email, password: f.password });
      if (up.error) throw new Error(up.error.message);
      const signIn = await supabase.auth.signInWithPassword({ email, password: f.password });
      if (signIn.error) throw new Error(/confirm/i.test(signIn.error.message) ? "Check your email and open the confirmation link, then sign in." : signIn.error.message);
      const { error } = await supabase.from("profiles").insert({ id: signIn.data.user.id, email, full_name: f.fullName.trim(), phone: f.phone.trim() || null, dept_id: f.deptId, role: "Staff", gender: f.gender, signature_url: null, is_active: true });
      if (error) throw new Error(error.message);
      router.push("/mfa/setup");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "The account could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicAuthShell title="Create your account" subtitle="For Islamic Education Trust staff, interns and volunteers" wide>
      <nav className="v4-tabs-auth" aria-label="Account"><Link href="/login">Login</Link><Link href="/signup" aria-current="page">Create Account</Link></nav>
      <form className="v4-auth-form" onSubmit={(e) => void submit(e)} noValidate>
        <div className="v4-form-grid">
          <label className="v4-field v4-span-2"><span className="v4-flabel">Full name <span className="v4-req">*</span></span><input className="v4-input" autoComplete="name" placeholder="As it should appear on documents" value={f.fullName} onChange={(e) => set("fullName")(e.target.value)} /><span className="v4-help">Printed on requests and vouchers you sign.</span></label>
          <label className="v4-field"><span className="v4-flabel">Email address <span className="v4-req">*</span></span><input className="v4-input" type="email" autoComplete="email" value={f.email} onChange={(e) => set("email")(e.target.value)} /></label>
          <label className="v4-field"><span className="v4-flabel">Phone number</span><input className="v4-input" type="tel" autoComplete="tel" placeholder="080…" value={f.phone} onChange={(e) => set("phone")(e.target.value)} /><span className="v4-help">For SMS reminders. Optional.</span></label>
          <div className="v4-field"><span className="v4-flabel">Gender <span className="v4-req">*</span></span><Select ariaLabel="Gender" value={f.gender} placeholder="Choose" onChange={set("gender")} options={[{ value: "Female", label: "Female" }, { value: "Male", label: "Male" }]} /></div>
          <div className="v4-field"><span className="v4-flabel">Department <span className="v4-req">*</span></span><Select ariaLabel="Department" searchable value={f.deptId} placeholder={depts ? "Choose your department" : "Loading…"} onChange={set("deptId")} options={(depts || []).map((d) => ({ value: d.id, label: d.name }))} /></div>
          <label className="v4-field"><span className="v4-flabel">Password <span className="v4-req">*</span></span>
            <span className="v4-control"><input className="v4-input" type={show ? "text" : "password"} autoComplete="new-password" value={f.password} onChange={(e) => set("password")(e.target.value)} />
              <span className="v4-trail"><button className="v4-icon-btn" type="button" aria-label="Show or hide password" style={{ border: 0, width: 40, height: 40 }} onClick={() => setShow(!show)}><Icon name={show ? "eyeoff" : "eye"} /></button></span></span>
            <span className="v4-strength" aria-label={s.text}>{[1, 2, 3, 4].map((i) => <span key={i} className={s.score >= i + 1 ? "v4-on" : ""} />)}</span>
            <span className="v4-help" style={{ color: s.tone }}>{s.text}</span></label>
          <label className="v4-field"><span className="v4-flabel">Confirm password <span className="v4-req">*</span></span><input className="v4-input" type={show ? "text" : "password"} autoComplete="new-password" value={f.again} onChange={(e) => set("again")(e.target.value)} />
            {f.again ? <span className="v4-help" style={{ color: f.again === f.password ? "var(--v4-green)" : "var(--v4-red)", fontWeight: 600 }}>{f.again === f.password ? "Passwords match" : "The two passwords are different"}</span> : null}</label>
        </div>
        <label className="v4-check"><input type="checkbox" checked={promise} onChange={(e) => setPromise(e.target.checked)} /> I will keep my password and authenticator to myself.</label>
        {msg ? <Notice tone="red">{msg}</Notice> : null}
        <button className="v4-btn v4-btn-primary v4-btn-lg v4-btn-block" type="submit" disabled={busy}>{busy ? "Creating your account…" : "Create account"}</button>
        <p className="v4-help" style={{ textAlign: "center", margin: 0 }}>Next: connect your authenticator app (and fingerprint), then add your photo and signature.</p>
      </form>
    </PublicAuthShell>
  );
}
