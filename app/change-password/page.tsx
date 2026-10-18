"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { passwordStrength } from "@/lib/v4/passwordStrength";
import Icon from "@/app/components/v4/Icon";
import { Notice, PageHead, Skeleton, V4Page } from "@/app/components/v4/ui";

/**
 * My Account › Change Password (v4): confirm the current password, then the 2FA code,
 * then the new password. ReqGen signs you out so you sign in again with it.
 */
export default function ChangePasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [mfaOk, setMfaOk] = useState(false);
  const [current, setCurrent] = useState("");
  const [currentOk, setCurrentOk] = useState(false);
  const [code, setCode] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);

  useEffect(() => {
    queueMicrotask(async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) { router.push("/login"); return; }
      setEmail(data.session.user.email || null);
      const [aal, factors] = await Promise.all([supabase.auth.mfa.getAuthenticatorAssuranceLevel(), supabase.auth.mfa.listFactors()]);
      setMfaOk(!aal.error && aal.data.currentLevel === "aal2");
      setFactorId((factors.data?.totp || []).find((f) => f.status === "verified")?.id || null);
      setLoading(false);
    });
  }, [router]);

  const s = passwordStrength(next);
  const needsMfa = !!factorId;
  const canSave = currentOk && (!needsMfa || mfaOk) && s.ok && next === again && next !== current && !busy;

  async function checkCurrent() {
    setMsg(null);
    if (!email || !current) { setMsg({ tone: "red", text: "Type your current password." }); return; }
    setBusy("current");
    const { error } = await supabase.auth.signInWithPassword({ email, password: current });
    setBusy(null);
    if (error) { setCurrentOk(false); setMsg({ tone: "red", text: "The current password is not correct." }); return; }
    setCurrentOk(true);
    // signing in again starts a new session: the 2FA code is asked again
    const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setMfaOk(!aal.error && aal.data.currentLevel === "aal2");
  }

  async function checkCode() {
    setMsg(null);
    const clean = code.replace(/\D/g, "");
    if (!factorId || clean.length !== 6) { setMsg({ tone: "red", text: "Type the 6-number code from your authenticator app." }); return; }
    setBusy("code");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: clean });
    setBusy(null);
    if (error) { setMsg({ tone: "red", text: `The code is not correct: ${error.message}` }); return; }
    setMfaOk(true); setCode("");
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setBusy("save"); setMsg(null);
    const { error } = await supabase.auth.updateUser({ password: next, data: { password_changed_at: new Date().toISOString(), temporary_password: false } });
    setBusy(null);
    if (error) { setMsg({ tone: "red", text: error.message }); return; }
    setMsg({ tone: "green", text: "Your password is changed. Sign in again with the new password." });
    await supabase.auth.signOut();
    window.setTimeout(() => { router.push("/login?password_changed=success"); router.refresh(); }, 1200);
  }

  const field = (label: string, value: string, set: (v: string) => void, opts: { auto: string; disabled?: boolean; help?: React.ReactNode }) => (
    <label className="v4-field"><span className="v4-flabel">{label} <span className="v4-req">*</span></span>
      <span className="v4-control"><Icon name="lock" /><input className="v4-input" type={show ? "text" : "password"} value={value} autoComplete={opts.auto} disabled={opts.disabled} onChange={(e) => set(e.target.value)} /></span>
      {opts.help ? <span className="v4-help">{opts.help}</span> : null}
    </label>
  );

  return (
    <V4Page>
      <PageHead title="Change Password" sub="Confirm it is you, then choose a new password. ReqGen signs you out so you sign in again with it." />
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {loading ? <section className="v4-card v4-card-pad"><Skeleton lines={6} /></section> : (
        <div className="v4-split">
          <form className="v4-card v4-card-pad" style={{ display: "flex", flexDirection: "column", gap: 24 }} onSubmit={(e) => void save(e)}>
            <section>
              <div className="v4-section-title"><span className="v4-no">{currentOk ? <Icon name="tick" size="sm" /> : 1}</span><h2 className="v4-h2">Your current password</h2></div>
              <div className="v4-form-grid">
                {field("Current password", current, (v) => { setCurrent(v); setCurrentOk(false); }, { auto: "current-password", disabled: currentOk })}
                <div className="v4-field" style={{ justifyContent: "flex-end" }}>
                  {currentOk ? <span className="v4-chip v4-chip-green">Confirmed</span> : <button className="v4-btn v4-btn-secondary" type="button" disabled={!current || busy === "current"} onClick={() => void checkCurrent()}>{busy === "current" ? "Checking…" : "Confirm"}</button>}
                </div>
              </div>
            </section>
            {needsMfa ? (
              <section>
                <div className="v4-section-title"><span className="v4-no">{mfaOk ? <Icon name="tick" size="sm" /> : 2}</span><h2 className="v4-h2">Your 2FA code</h2></div>
                {mfaOk ? <Notice tone="green">2FA confirmed for this session.</Notice> : (
                  <div className="v4-form-grid">
                    <label className="v4-field"><span className="v4-flabel">6-number code</span><input className="v4-input" inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="123456" value={code} disabled={!currentOk} onChange={(e) => setCode(e.target.value)} /></label>
                    <div className="v4-field" style={{ justifyContent: "flex-end" }}><button className="v4-btn v4-btn-secondary" type="button" disabled={!currentOk || busy === "code"} onClick={() => void checkCode()}>{busy === "code" ? "Checking…" : "Confirm code"}</button></div>
                  </div>
                )}
              </section>
            ) : null}
            <section>
              <div className="v4-section-title"><span className="v4-no">{needsMfa ? 3 : 2}</span><h2 className="v4-h2">New password</h2></div>
              <div className="v4-form-grid">
                {field("New password", next, setNext, { auto: "new-password", disabled: !currentOk || (needsMfa && !mfaOk), help: <span style={{ color: s.tone }}>{s.text}</span> })}
                {field("Type it again", again, setAgain, { auto: "new-password", disabled: !currentOk || (needsMfa && !mfaOk), help: again && again !== next ? <span style={{ color: "var(--v4-red)" }}>The two passwords are different.</span> : undefined })}
              </div>
              <label className="v4-check" style={{ marginTop: 12 }}><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show the passwords</label>
            </section>
            <div className="v4-form-actions">
              <Link className="v4-btn v4-btn-ghost" href="/profile">Cancel</Link>
              <button className="v4-btn v4-btn-primary" type="submit" disabled={!canSave}><Icon name="key" />{busy === "save" ? "Saving…" : "Change password"}</button>
            </div>
          </form>
          <aside className="v4-side-stack">
            <section className="v4-card v4-card-pad">
              <h2 className="v4-h3" style={{ marginBottom: 10 }}>A good password</h2>
              <ul style={{ margin: 0, paddingLeft: 18, color: "var(--v4-ink-2)", lineHeight: 1.8, fontSize: 13.5 }}>
                <li>At least 8 characters — 12 or more is better.</li>
                <li>Mix capital and small letters, numbers and a symbol.</li>
                <li>Not used on any other website.</li>
                <li>Never shared — the Super Admin will never ask for it.</li>
              </ul>
            </section>
            <Notice tone="blue">Forgot your current password? Sign out and use “Forgot password?” on the sign-in page.</Notice>
          </aside>
        </div>
      )}
    </V4Page>
  );
}
