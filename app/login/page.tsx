"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import PublicAuthShell from "../components/PublicAuthShell";

export default function LoginPage() { return <Suspense fallback={<PublicAuthShell title="Welcome Back!" subtitle="Sign in to your ReqGen account to continue"><p className="auth-loading">Loading secure login...</p></PublicAuthShell>}><LoginPageContent /></Suspense>; }

function LoginPageContent() {
  const router = useRouter(); const searchParams = useSearchParams();
  const timeoutReason = searchParams.get("reason") === "session-timeout";
  const passwordResetSuccess = searchParams.get("password_reset") === "success";
  const passwordChangedSuccess = searchParams.get("password_changed") === "success";
  const initialMessage = useMemo(() => timeoutReason ? "For security reasons, your session timed out. Please login again." : passwordResetSuccess ? "Password reset successful. Please login with your new password." : passwordChangedSuccess ? "Password changed successfully. Please login again with your new password." : null, [timeoutReason,passwordResetSuccess,passwordChangedSuccess]);
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [showPassword,setShowPassword]=useState(false); const [msg,setMsg]=useState<string|null>(initialMessage); const [saving,setSaving]=useState(false);
  async function decideNextSecurityStep(){ const {data:factorsData,error:factorsErr}=await supabase.auth.mfa.listFactors(); if(factorsErr) throw new Error(factorsErr.message); const verified=factorsData.totp.filter(f=>f.status==="verified"); if(!verified.length){router.push("/mfa/setup");router.refresh();return;} const {data:aalData,error:aalErr}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel(); if(aalErr) throw new Error(aalErr.message); if(aalData.nextLevel==="aal2"&&aalData.currentLevel!=="aal2"){router.push("/mfa");router.refresh();return;} router.push("/dashboard");router.refresh(); }
  async function login(){ setMsg(null); const clean=email.trim().toLowerCase(); if(!clean) return setMsg("Enter your email address."); if(!password) return setMsg("Enter your password."); setSaving(true); try { const {error}=await supabase.auth.signInWithPassword({email:clean,password}); if(error) throw new Error(error.message); setMsg("Password accepted. Checking 2FA security..."); await decideNextSecurityStep(); } catch(e:unknown){setMsg("Login failed: "+(e instanceof Error?e.message:"Unknown error"));} finally {setSaving(false);} }
  function forgot(){ const clean=email.trim().toLowerCase(); router.push(clean?`/forgot-password?email=${encodeURIComponent(clean)}`:"/forgot-password"); }
  return <PublicAuthShell title="Welcome Back!" subtitle="Sign in to your ReqGen account to continue">
    <div className="auth-tabs"><span className="is-active">Login</span><Link href="/signup">Create Account</Link></div>
    {msg?<div className="auth-message">{msg}</div>:null}
    <div className="auth-field"><label>Email Address</label><div><Mail size={18}/><input value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} type="email" placeholder="Enter your email address" autoComplete="email"/></div></div>
    <div className="auth-field"><label>Password</label><div><LockKeyhole size={18}/><input value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} type={showPassword?"text":"password"} placeholder="Enter your password" autoComplete="current-password"/><button type="button" className="auth-eye" onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></div>
    <div className="auth-inline"><span></span><button type="button" onClick={forgot}>Forgot Password?</button></div>
    <button type="button" className="auth-primary" onClick={login} disabled={saving}>{saving?"Signing in...":"Login"}</button>
  </PublicAuthShell>;
}
