"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, LockKeyhole, Mail, ShieldCheck, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage(){return <Suspense fallback={<main className="mock-public-shell"><section className="mock-login-card">Loading secure login...</section></main>}><LoginPageContent/></Suspense>}

function LoginPageContent(){
  const router=useRouter(); const searchParams=useSearchParams();
  const initialMessage=useMemo(()=>{ if(searchParams.get("reason")==="session-timeout") return "For security reasons, your session timed out. Please login again."; if(searchParams.get("password_reset")==="success") return "Password reset successful. Please login with your new password."; if(searchParams.get("password_changed")==="success") return "Password changed successfully. Please login again with your new password."; return null; },[searchParams]);
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [msg,setMsg]=useState<string|null>(initialMessage); const [saving,setSaving]=useState(false); const [show,setShow]=useState(false);
  async function decideNextSecurityStep(){ const {data:factorsData,error:factorsErr}=await supabase.auth.mfa.listFactors(); if(factorsErr) throw new Error(factorsErr.message); const verified=factorsData.totp.filter(f=>f.status==="verified"); if(!verified.length){router.push("/mfa/setup");router.refresh();return;} const {data:aalData,error:aalErr}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel(); if(aalErr) throw new Error(aalErr.message); if(aalData.nextLevel==="aal2"&&aalData.currentLevel!=="aal2"){router.push("/mfa");router.refresh();return;} router.push("/dashboard");router.refresh(); }
  async function login(){ setMsg(null); const clean=email.trim().toLowerCase(); if(!clean){setMsg("Enter your email address.");return;} if(!password){setMsg("Enter your password.");return;} setSaving(true); try{const {error}=await supabase.auth.signInWithPassword({email:clean,password}); if(error) throw new Error(error.message); await decideNextSecurityStep();}catch(e:unknown){setMsg(e instanceof Error?e.message:"Login failed.");}finally{setSaving(false);} }
  function forgot(){const clean=email.trim().toLowerCase(); router.push(clean?`/forgot-password?email=${encodeURIComponent(clean)}`:"/forgot-password");}
  return <main className="mock-public-shell"><section className="mock-login-card">
    <img src="/iet-logo.png" alt="Islamic Education Trust logo" className="mock-login-logo"/>
    <h1>Welcome Back!</h1><p className="mock-login-sub">Sign in to your ReqGen account to continue</p>
    <div className="mock-login-tabs"><button className="is-active">Login</button><Link href="/signup"><UserPlus size={17}/>Create Account</Link></div>
    {msg?<div className="mock-login-message">{msg}</div>:null}
    <label>Email Address</label><div className="mock-login-field"><Mail size={18}/><input value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void login();}} type="email" placeholder="Enter your email address" autoComplete="email"/></div>
    <label>Password</label><div className="mock-login-field"><LockKeyhole size={18}/><input value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void login();}} type={show?"text":"password"} placeholder="Enter your password" autoComplete="current-password"/><button type="button" onClick={()=>setShow(v=>!v)} aria-label="Show password"><Eye size={18}/></button></div>
    <div className="mock-login-meta"><label><input type="checkbox"/> Remember me</label><button type="button" onClick={forgot}>Forgot Password?</button></div>
    <button type="button" onClick={()=>void login()} disabled={saving} className="mock-login-submit"><LockKeyhole size={18}/>{saving?"Signing in...":"Login"}</button>
    <div className="mock-login-secure"><ShieldCheck size={17}/> Secure <span>•</span> Reliable <span>•</span> Accountable</div>
    <div className="mock-login-footer"><div className="mock-login-dev"><span>Powered by</span><div><img src="/be-logo.png" alt="Barderian Enterprises logo"/><strong>BARDERIAN <em>ENTERPRISES</em></strong></div></div><div><a href="https://barderians.com.ng" target="_blank" rel="noreferrer">https://barderians.com.ng</a><span>|</span><a href="mailto:info@barderians.com.ng">info@barderians.com.ng</a></div><small>© {new Date().getFullYear()} Islamic Education Trust. All rights reserved.</small></div>
  </section></main>;
}
