"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { storedWindowEnd } from "@/lib/mfaTrust";
import { confirmDialog } from "@/lib/dialog";
import { fingerprintAvailable, readTrustedDevice, registerFingerprint, removeFingerprint, removeTrustedDevice } from "@/lib/v4/deviceSignIn";
import { shortDate } from "@/lib/v4/requestText";
import Icon from "@/app/components/v4/Icon";
import { Btn, Card, Chip, Notice, PageHead, Stats, V4Page, type StatItem } from "@/app/components/v4/ui";

type Cred = { id: string; device_name: string | null; created_at: string; last_used_at: string | null };
type Dev = { id: string; device_name: string | null; created_at: string; last_used_at: string | null };

function clock(ms: number) {
  return new Date(ms).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
}

function lastUsed(iso: string | null) {
  if (!iso) return "not used yet";
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (d.getTime() >= today.getTime()) return `last used today ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  return `last used ${shortDate(iso)}`;
}

/** My Account › Security & Devices (v4.0.0). */
export default function SecurityDevicesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasTotp, setHasTotp] = useState(false);
  const [aal2, setAal2] = useState(false);
  const [creds, setCreds] = useState<Cred[] | null>(null);
  const [devices, setDevices] = useState<Dev[] | null>(null);
  const [thisDevice, setThisDevice] = useState<string | null>(null);
  const [canFp, setCanFp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "green" | "red" | "amber" | "blue"; text: string } | null>(null);
  const [now, setNow] = useState(0);
  const [windowEnd, setWindowEnd] = useState<number | null>(null);
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.push("/login"); return; }
    setLastSignIn(auth.user.last_sign_in_at || null);
    const [factors, aal, c, d] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.from("reqgen_webauthn_credentials").select("id,device_name,created_at,last_used_at").eq("user_id", auth.user.id).order("created_at"),
      supabase.from("reqgen_trusted_devices").select("id,device_name,created_at,last_used_at").eq("user_id", auth.user.id).is("revoked_at", null).order("created_at"),
    ]);
    setHasTotp((factors.data?.totp || []).some((f) => f.status === "verified"));
    setAal2(aal.data?.currentLevel === "aal2");
    setCreds(c.error ? null : (c.data || []) as Cred[]);
    setDevices(d.error ? null : (d.data || []) as Dev[]);
    setThisDevice(readTrustedDevice()?.deviceId || null);
    setNow(Date.now());
    setWindowEnd(storedWindowEnd());
    setLoading(false);
  }, [router]);

  useEffect(() => {
    queueMicrotask(() => { void load(); });
    void fingerprintAvailable().then(setCanFp);
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, [load]);

  async function addFingerprint() {
    setBusy(true); setNote(null);
    try {
      await registerFingerprint();
      setNote({ tone: "green", text: "Fingerprint added for this device." });
      await load();
    } catch (e) {
      const err = e as Error & { needCode?: boolean };
      if (err.needCode) {
        setNote({ tone: "amber", text: "Enter your 2FA code once more, then add the fingerprint." });
        router.push(`/mfa?next=${encodeURIComponent("/profile/security")}`);
      } else setNote({ tone: "red", text: err.message });
    } finally { setBusy(false); }
  }

  async function dropFingerprint(c: Cred) {
    if (!(await confirmDialog({ title: "Remove this fingerprint?", message: `${c.device_name || "This device"} will no longer sign you in with a fingerprint.`, confirmLabel: "Remove", tone: "danger" }))) return;
    setBusy(true);
    try { await removeFingerprint(c.id); await load(); setNote({ tone: "green", text: "Fingerprint removed." }); }
    catch (e) { setNote({ tone: "red", text: e instanceof Error ? e.message : "Could not remove it." }); }
    finally { setBusy(false); }
  }

  async function dropDevice(d: Dev) {
    if (!(await confirmDialog({ title: "Remove this trusted device?", message: `The passcode on ${d.device_name || "that device"} stops working at once.`, confirmLabel: "Remove", tone: "danger" }))) return;
    setBusy(true);
    try { await removeTrustedDevice(d.id); await load(); setNote({ tone: "green", text: "Trusted device removed." }); }
    catch (e) { setNote({ tone: "red", text: e instanceof Error ? e.message : "Could not remove it." }); }
    finally { setBusy(false); }
  }

  async function signOutOthers() {
    if (!(await confirmDialog({ title: "Sign out all other devices?", message: "Every other phone, laptop and browser signed in to your account is signed out now. This device stays signed in.", confirmLabel: "Sign them out", tone: "danger" }))) return;
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setNote(error ? { tone: "red", text: error.message } : { tone: "green", text: "All other devices were signed out." });
  }

  const remaining = windowEnd && now ? Math.max(0, windowEnd - now) : 0;
  const started = windowEnd ? windowEnd - 12 * 3600_000 : 0;
  const used = windowEnd && now ? Math.min(100, Math.max(0, ((now - started) / (12 * 3600_000)) * 100)) : 0;
  const hours = Math.floor(remaining / 3600_000);
  const mins = Math.round((remaining % 3600_000) / 60_000);
  const notReady = creds === null || devices === null;

  const stats: StatItem[] = [
    { label: "Two-factor (2FA)", value: loading ? "…" : hasTotp ? "On" : "Off", note: hasTotp ? "Authenticator app" : "Set it up now", icon: "shield", tone: hasTotp ? "green" : "red" },
    { label: "Fingerprint", value: creds === null ? "—" : creds.length ? `${creds.length} device${creds.length === 1 ? "" : "s"}` : "Not set", note: creds?.length ? "One-touch sign-in" : "Add this device", icon: "fingerprint", tone: "brand" },
    { label: "This session", value: windowEnd ? clock(windowEnd) : "—", note: windowEnd ? `Ends in ${hours} h ${mins} min` : "2FA window", icon: "clock", tone: "blue" },
    { label: "Passcode", value: thisDevice ? "On" : "Not set", note: thisDevice ? "On this device" : "For faster sign-in", icon: "key", tone: "amber", href: "/profile/passcode" },
  ];

  return (
    <V4Page>
      <PageHead
        title="Security & Devices"
        sub="How you sign in, and every device trusted to sign in to your account."
        actions={[{ label: "Sign out all other devices", icon: "logout", kind: "secondary", onClick: () => void signOutOthers() }]}
      />
      {note ? <Notice tone={note.tone}>{note.text}</Notice> : null}
      {notReady && !loading ? <Notice tone="amber">Fingerprint and passcode sign-in switch on after the Super Admin runs the v4.0.0 database step.</Notice> : null}
      <Stats items={stats} />
      <div className="v4-cols">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card title="12-hour 2FA window" pad>
            {windowEnd ? (
              <>
                <p style={{ margin: "0 0 12px", color: "var(--v4-ink-2)" }}>You confirmed it was you at <b>{clock(started)}</b>. ReqGen signs you out at <b>{clock(windowEnd)}</b> and asks again.</p>
                <div className="v4-meter" aria-label={`${Math.round(used)}% of the window used`}><span style={{ width: `${used}%` }} /></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--v4-muted)", marginTop: 6 }}><span>{clock(started)}</span><span>Now {clock(now || Date.now())}</span><span>{clock(windowEnd)}</span></div>
              </>
            ) : <p style={{ margin: 0, color: "var(--v4-ink-2)" }}>One fingerprint or 2FA check keeps you signed in on a device for 12 hours.</p>}
          </Card>

          <Card title="Fingerprint sign-in" pad>
            {(creds || []).map((c) => (
              <div key={c.id} className="v4-device">
                <span className="v4-di"><Icon name="fingerprint" /></span>
                <span className="v4-dt"><strong>{c.device_name || "Device"}</strong><span>Added {shortDate(c.created_at)} · {lastUsed(c.last_used_at)}</span></span>
                <button className="v4-btn v4-btn-ghost" type="button" style={{ color: "var(--v4-red)" }} onClick={() => void dropFingerprint(c)} disabled={busy}>Remove</button>
              </div>
            ))}
            {creds && !creds.length ? <p className="v4-muted" style={{ margin: "0 0 12px" }}>No fingerprint yet. Add this device to sign in with one touch.</p> : null}
            {canFp ? <button className="v4-btn v4-btn-secondary" type="button" onClick={() => void addFingerprint()} disabled={busy || creds === null} style={{ marginTop: 12 }}><Icon name="plus" />Add this device</button>
              : <Notice tone="blue">This browser cannot use a fingerprint sensor. Add it from a phone or laptop that has one.</Notice>}
          </Card>

          <section className="v4-card v4-card-pad" data-guide="twofa">
            <h2 className="v4-h2" style={{ marginBottom: 4 }}>Authenticator app and password</h2>
            <div className="v4-device">
              <span className="v4-di"><Icon name="smartphone" /></span>
              <span className="v4-dt"><strong>Authenticator app</strong><span>{hasTotp ? "Connected · used for 6-digit codes" : "Not connected"}</span></span>
              {hasTotp ? <Link className="v4-btn v4-btn-secondary" href="/profile/security/replace-authenticator">Replace</Link> : <Link className="v4-btn v4-btn-primary" href="/mfa/setup">Set up</Link>}
            </div>
            <div className="v4-device">
              <span className="v4-di"><Icon name="lock" /></span>
              <span className="v4-dt"><strong>Password</strong><span>{lastSignIn ? `Last sign-in ${shortDate(lastSignIn)}` : "Used with 2FA on any device"}</span></span>
              <Link className="v4-btn v4-btn-secondary" href="/change-password">Change</Link>
            </div>
            {hasTotp && !aal2 ? <div style={{ marginTop: 12 }}><Btn a={{ href: "/mfa?next=/profile/security", label: "Confirm with 2FA code", kind: "ghost", icon: "shield" }} /></div> : null}
            <div className="v4-notice v4-notice-amber" style={{ marginTop: 12 }}><Icon name="alert" /><span>Replacing the authenticator or changing the password <b>signs out every device</b> — including anyone using a stolen password.</span></div>
          </section>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card title="Trusted devices (passcode)" pad>
            {(devices || []).map((d) => (
              <div key={d.id} className="v4-device">
                <span className="v4-di"><Icon name={/phone|android|iphone/i.test(d.device_name || "") ? "smartphone" : "laptop"} /></span>
                <span className="v4-dt"><strong>{d.device_name || "Device"}</strong><span>Added {shortDate(d.created_at)} · {lastUsed(d.last_used_at)}</span></span>
                {d.id === thisDevice ? <Chip tone="green">This device</Chip> : null}
                <button className="v4-btn v4-btn-ghost" type="button" style={{ color: "var(--v4-red)" }} onClick={() => void dropDevice(d)} disabled={busy}>Remove</button>
              </div>
            ))}
            {devices && !devices.length ? <p className="v4-muted" style={{ margin: "0 0 12px" }}>No trusted device yet.</p> : null}
            <div style={{ marginTop: 12 }}><Btn a={{ href: "/profile/passcode", label: thisDevice ? "Change passcode on this device" : "Set a passcode on this device", icon: "key", kind: "secondary" }} /></div>
          </Card>
          <Card title="What each one does" pad>
            <ul className="v4-can v4-yes">
              <li><Icon name="check" /><span><b>Fingerprint</b> signs you in and counts as your 2FA check.</span></li>
              <li><Icon name="check" /><span><b>Passcode</b> replaces your password on one trusted device. 2FA is still asked every 12 hours.</span></li>
              <li><Icon name="check" /><span><b>Password + 2FA code</b> work on any device.</span></li>
              <li><Icon name="check" /><span>Signing, stamping and paying always need your fingerprint or 2FA code — never the passcode alone.</span></li>
            </ul>
          </Card>
        </div>
      </div>
    </V4Page>
  );
}
