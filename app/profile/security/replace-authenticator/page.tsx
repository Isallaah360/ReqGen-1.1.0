"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabaseClient";
import { endMfaWindow } from "@/lib/mfaTrust";
import { passwordStrength } from "@/lib/v4/passwordStrength";
import Icon from "@/app/components/v4/Icon";
import OtpBoxes from "@/app/components/v4/OtpBoxes";
import { Notice, PageHead, Skeleton, V4Page } from "@/app/components/v4/ui";

type Factor = { id: string; status: string };
type Enrolment = { id: string; qr: string; uri: string; secret: string };

/**
 * My Account › Security & Devices › New phone (v4): confirm the old authenticator, connect the
 * new phone and set a private password in one go. Every session of the account is then signed out.
 */
export default function ReplaceAuthenticatorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [old, setOld] = useState<Factor[]>([]);
  const [verified, setVerified] = useState(false);
  const [oldCode, setOldCode] = useState("");
  const [enrol, setEnrol] = useState<Enrolment | null>(null);
  const [newCode, setNewCode] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "green" | "red" | "blue"; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) { router.push("/login"); return; }
    const [factors, aal] = await Promise.all([supabase.auth.mfa.listFactors(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
    if (factors.error) setMsg({ tone: "red", text: factors.error.message });
    const list = ((factors.data?.totp || []) as Factor[]).filter((f) => f.status === "verified");
    setOld(list);
    setVerified(aal.data?.currentLevel === "aal2" || list.length === 0);
    setLoading(false);
  }, [router]);
  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  const step = !verified ? 1 : !enrol ? 2 : 3;
  const s = passwordStrength(pw);

  async function confirmOld(code = oldCode) {
    const clean = code.replace(/\D/g, "").slice(0, 6);
    if (!old[0] || clean.length !== 6) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: old[0].id, code: clean });
    setBusy(false);
    if (error) { setMsg({ tone: "red", text: `The code is not correct: ${error.message}` }); setOldCode(""); return; }
    setVerified(true); setOldCode("");
  }

  async function start() {
    setBusy(true); setMsg(null);
    // only one authenticator per account: the old one is removed first
    for (const f of old) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
      if (error) { setBusy(false); setMsg({ tone: "red", text: `The old authenticator could not be removed: ${error.message}` }); return; }
    }
    setOld([]);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `ReqGen ${new Date().toISOString().slice(0, 10)}` });
    if (error || !data) { setBusy(false); setMsg({ tone: "red", text: `The old authenticator was removed, but a new QR code could not be made. Try again. ${error?.message || ""}` }); return; }
    const qr = await QRCode.toDataURL(data.totp.uri, { errorCorrectionLevel: "M", margin: 4, width: 360, color: { dark: "#000000", light: "#ffffff" } });
    setEnrol({ id: data.id, qr, uri: data.totp.uri, secret: data.totp.secret });
    setBusy(false);
  }

  async function restart() {
    if (enrol) await supabase.auth.mfa.unenroll({ factorId: enrol.id });
    setEnrol(null); setNewCode("");
    await start();
  }

  async function save() {
    const code = newCode.replace(/\D/g, "").slice(0, 6);
    if (!enrol || code.length !== 6) { setMsg({ tone: "red", text: "Type the 6-number code from the NEW authenticator app." }); return; }
    if (!s.ok) { setMsg({ tone: "red", text: "Use a stronger password: at least 8 characters with letters and numbers." }); return; }
    if (pw !== pw2) { setMsg({ tone: "red", text: "The two passwords are different." }); return; }
    setBusy(true); setMsg(null);
    const ch = await supabase.auth.mfa.challenge({ factorId: enrol.id });
    if (ch.error) { setBusy(false); setMsg({ tone: "red", text: ch.error.message }); return; }
    const v = await supabase.auth.mfa.verify({ factorId: enrol.id, challengeId: ch.data.id, code });
    if (v.error) { setBusy(false); setMsg({ tone: "red", text: `The code is not correct: ${v.error.message}` }); return; }
    const up = await supabase.auth.updateUser({ password: pw, data: { password_changed_at: new Date().toISOString(), temporary_password: false } });
    if (up.error) { setBusy(false); setMsg({ tone: "red", text: `The new authenticator is connected, but the password was not changed: ${up.error.message}` }); return; }
    setMsg({ tone: "green", text: "Done. Every device that used the old details is signed out. Sign in again with the new password and the new phone." });
    await endMfaWindow();
    await supabase.auth.signOut({ scope: "global" });
    window.setTimeout(() => { router.push("/login?security_updated=success"); router.refresh(); }, 900);
  }

  const grouped = (enrol?.secret || "").replace(/(.{4})/g, "$1 ").trim();
  return (
    <V4Page>
      <PageHead title="New phone for 2FA" sub="Connect your authenticator on a new phone and set a private password in one short process. Every device is signed out afterwards."
        actions={[{ label: "Back to Security", icon: "left", kind: "secondary", href: "/profile/security" }]} />
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {loading ? <section className="v4-card v4-card-pad"><Skeleton lines={6} /></section> : (
        <div className="v4-split">
          <section className="v4-card v4-card-pad" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <section>
              <div className="v4-section-title"><span className="v4-no">{step > 1 ? <Icon name="tick" size="sm" /> : 1}</span><h2 className="v4-h2">Confirm it is you</h2></div>
              {verified ? <Notice tone="green">Confirmed.</Notice> : (
                <>
                  <p className="v4-help" style={{ margin: "0 0 10px" }}>Type the code from the authenticator app you use now.</p>
                  <OtpBoxes value={oldCode} onChange={setOldCode} onComplete={(c) => void confirmOld(c)} disabled={busy} align="start" />
                  <p className="v4-help" style={{ margin: "10px 0 0" }}>Lost the old phone? Ask the Super Admin to reset your 2FA in Administration › Staff &amp; Positions.</p>
                </>
              )}
            </section>
            <section>
              <div className="v4-section-title"><span className="v4-no">{step > 2 ? <Icon name="tick" size="sm" /> : 2}</span><h2 className="v4-h2">Connect the new phone</h2></div>
              {!enrol ? (
                <button className="v4-btn v4-btn-primary" type="button" disabled={!verified || busy} onClick={() => void start()}><Icon name="qr" />{busy && verified ? "Preparing…" : "Make a new QR code"}</button>
              ) : (
                <>
                  <div className="v4-qr-box">
                    <div style={{ background: "#fff", borderRadius: 12, padding: 6, border: "1px solid var(--v4-line)", width: 180, height: 180, display: "grid", placeItems: "center" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- generated QR data URL */}
                      <img src={enrol.qr} alt="QR code to add ReqGen to your authenticator app" width={168} height={168} />
                    </div>
                    <ol className="v4-numbered">
                      <li>On the <b>new</b> phone, install Google Authenticator or Microsoft Authenticator.</li>
                      <li>Tap <b>+</b>, then <b>Scan a QR code</b>, and point the camera at this code.</li>
                      <li>Type the 6-number code the app shows for <b>ReqGen</b> below.</li>
                    </ol>
                  </div>
                  <p className="v4-help" style={{ margin: "14px 0 6px" }}>Can’t scan? Type this key into the app, or on this phone <a href={enrol.uri}>open it in the authenticator app</a>:</p>
                  <span className="v4-code-line">{grouped}</span>
                  <p className="v4-flabel" style={{ margin: "16px 0 8px", fontWeight: 700 }}>Code from the new app <span className="v4-req">*</span></p>
                  <OtpBoxes value={newCode} onChange={setNewCode} disabled={busy} align="start" />
                  <button className="v4-btn v4-btn-ghost" type="button" style={{ marginTop: 10 }} disabled={busy} onClick={() => void restart()}><Icon name="returned" />Make a fresh QR code</button>
                </>
              )}
            </section>
            <section>
              <div className="v4-section-title"><span className="v4-no">3</span><h2 className="v4-h2">Set a private password</h2></div>
              <div className="v4-form-grid">
                <label className="v4-field"><span className="v4-flabel">New password <span className="v4-req">*</span></span><input className="v4-input" type="password" autoComplete="new-password" value={pw} disabled={!enrol} onChange={(e) => setPw(e.target.value)} /><span className="v4-help" style={{ color: s.tone }}>{s.text}</span></label>
                <label className="v4-field"><span className="v4-flabel">Type it again <span className="v4-req">*</span></span><input className="v4-input" type="password" autoComplete="new-password" value={pw2} disabled={!enrol} onChange={(e) => setPw2(e.target.value)} />{pw2 && pw2 !== pw ? <span className="v4-help" style={{ color: "var(--v4-red)" }}>The two passwords are different.</span> : null}</label>
              </div>
            </section>
            <div className="v4-form-actions">
              <Link className="v4-btn v4-btn-ghost" href="/profile/security">Cancel</Link>
              <button className="v4-btn v4-btn-primary" type="button" disabled={!enrol || busy} onClick={() => void save()}><Icon name="shield" />{busy && enrol ? "Saving…" : "Save the new phone and password"}</button>
            </div>
          </section>
          <aside className="v4-side-stack">
            <Notice tone="amber" title="After saving">Every device using the old phone or password is signed out, including this one. Fingerprints and passcodes on your devices keep working only after you sign in again.</Notice>
          </aside>
        </div>
      )}
    </V4Page>
  );
}
