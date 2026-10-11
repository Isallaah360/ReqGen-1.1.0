"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getAvailableRoles } from "@/lib/activeRole";
import { normalizeRole } from "@/lib/roles";
import { easyPasscode } from "@/lib/v4/passcodeRules";
import { deviceName, readTrustedDevice, setupPasscode } from "@/lib/v4/deviceSignIn";
import { positionName } from "@/app/components/v4/RoleSelect";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import PasscodePad from "@/app/components/v4/PasscodePad";
import { Btn, Card, Chip, Notice, PageHead, V4Page } from "@/app/components/v4/ui";

/** My Account › Security & Devices › Passcode (v4.0.0). */
export default function PasscodeSetupPage() {
  const router = useRouter();
  const me = useIdentity();
  const [step, setStep] = useState<"enter" | "confirm" | "done">("enter");
  const [first, setFirst] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "red" | "green" | "amber"; text: string } | null>(null);
  const [label, setLabel] = useState("This device");
  const [hasOne, setHasOne] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setLabel(deviceName());
      const d = readTrustedDevice();
      setHasOne(!!d && d.userId === me.userId);
    });
  }, [me.userId]);

  async function onComplete(code: string) {
    setMsg(null);
    if (step === "enter") {
      const problem = easyPasscode(code);
      if (problem) { setMsg({ tone: "red", text: problem }); setPin(""); return; }
      setFirst(code); setPin(""); setStep("confirm");
      return;
    }
    if (code !== first) { setMsg({ tone: "red", text: "The two passcodes do not match. Start again." }); setPin(""); setFirst(""); setStep("enter"); return; }
    setBusy(true);
    try {
      const roles = await getAvailableRoles(me.userId);
      const sys = await supabase.from("profiles").select("system_account").eq("id", me.userId).maybeSingle();
      const sa = sys.error ? null : ((sys.data as { system_account?: string | null } | null)?.system_account || null);
      const seen = new Set<string>();
      const positions = roles.map((r) => positionName(r.key, r.name, sa)).filter((n) => { const k = normalizeRole(n); if (seen.has(k)) return false; seen.add(k); return true; }).join(" · ");
      await setupPasscode(code, { email: me.email, name: me.name, positions, userId: me.userId });
      setStep("done");
      setMsg({ tone: "green", text: "Passcode saved. Next time on this device, sign in with it. Other devices were signed out." });
    } catch (e) {
      const err = e as Error & { needCode?: boolean };
      if (err.needCode) { router.push(`/mfa?next=${encodeURIComponent("/profile/passcode")}`); return; }
      setMsg({ tone: "red", text: err.message });
      setPin(""); setFirst(""); setStep("enter");
    } finally {
      setBusy(false);
    }
  }

  return (
    <V4Page>
      <PageHead title="Passcode for this device" sub="A 6-digit passcode for faster sign-in. It works only on this device." />
      <div className="v4-cols">
        <section className="v4-card v4-card-pad" style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center", textAlign: "center" }}>
          <Chip tone="blue"><Icon name="laptop" size="sm" />{label}</Chip>
          {step === "done" ? (
            <>
              <span className="v4-ico v4-t-green" style={{ width: 64, height: 64, borderRadius: 20, display: "grid", placeItems: "center" }}><Icon name="check" size="lg" /></span>
              <h2 className="v4-h2">Passcode is on</h2>
              {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
              <Btn a={{ href: "/profile/security", label: "Back to Security & Devices", kind: "primary" }} />
            </>
          ) : (
            <>
              <h2 className="v4-h2">{step === "enter" ? (hasOne ? "Enter a new passcode" : "Choose a 6-digit passcode") : "Type it again to confirm"}</h2>
              <PasscodePad value={pin} onChange={setPin} onComplete={(c) => void onComplete(c)} disabled={busy || !me.ready} />
              {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
              <p className="v4-muted" style={{ margin: 0, fontSize: 12.5 }}>{step === "enter" ? "Next: type it again to confirm. Easy codes like 123456 or 111111 are refused." : busy ? "Saving…" : "If you were not asked recently, ReqGen asks for your fingerprint or 2FA code once."}</p>
            </>
          )}
        </section>
        <Card title="Why it is safe" pad>
          <ul className="v4-can v4-yes">
            <li><Icon name="check" /><span>The passcode is joined to <b>this device</b>. On any other phone or laptop it does nothing — someone who learns it still can’t get in.</span></li>
            <li><Icon name="check" /><span>Someone who takes this device still needs the passcode.</span></li>
            <li><Icon name="check" /><span>5 wrong tries removes the passcode from the device. You then sign in with password + 2FA.</span></li>
            <li><Icon name="check" /><span>ReqGen stores only a scrambled copy, never the passcode itself.</span></li>
            <li><Icon name="check" /><span>Lost the device? Remove it in <b>My Account › Security &amp; Devices</b>, or ask the Super Admin.</span></li>
          </ul>
          <div style={{ marginTop: 14 }}><Notice tone="blue">Signing, stamping and paying still ask for your fingerprint or 2FA code.</Notice></div>
        </Card>
      </div>
    </V4Page>
  );
}
