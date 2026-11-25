import { useEffect, useState } from "react";
import { Copy, ExternalLink, ShieldCheck } from "lucide-react";
import { db, plainError } from "../lib/core";
import { Body, Head, Note, toast, useNav } from "../ui";

/**
 * App 4.0.0: setting up the authenticator app (2FA) inside the app.
 * On a phone, "Open the authenticator app" adds ReqGen to Google or Microsoft Authenticator directly;
 * the QR code is for scanning from another phone, the key for typing in by hand.
 */
export default function Setup2fa({ onDone }: { onDone: () => Promise<void> }) {
  const { pop } = useNav();
  const [f, setF] = useState<{ id: string; qr: string; secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const c = await db();
        // an earlier set-up that was never finished is removed first
        const list = await c.auth.mfa.listFactors();
        for (const old of (list.data?.all || []).filter((x) => x.factor_type === "totp" && x.status !== "verified")) await c.auth.mfa.unenroll({ factorId: old.id });
        const { data, error } = await c.auth.mfa.enroll({ factorType: "totp", friendlyName: `ReqGen app ${new Date().toISOString().slice(0, 16)}`, issuer: "IET ReqGen" });
        if (error || !data) throw error || new Error("2FA could not be started.");
        setF({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri });
      } catch (e) { setMsg(plainError(e)); }
    })();
  }, []);

  async function check(v: string) {
    if (!f || v.length !== 6) return;
    setBusy(true); setMsg(null);
    const { error } = await (await db()).auth.mfa.challengeAndVerify({ factorId: f.id, code: v });
    setBusy(false);
    if (error) { setCode(""); setMsg("That code is not right. Type the newest code shown for IET ReqGen."); return; }
    toast("2FA is set up.");
    pop();
    await onDone();
  }

  return (
    <>
      <Head title="Set up 2FA" />
      <Body>
        <Note tone="in" icon={<ShieldCheck size={16} />}>Every ReqGen account uses an authenticator app (Google Authenticator or Microsoft Authenticator). Install one from the Play Store first.</Note>
        {f ? (
          <>
            <button type="button" className="btn bp block" onClick={() => { window.location.href = f.uri; }}><ExternalLink size={18} />Open the authenticator app</button>
            <div className="card" style={{ alignItems: "center", display: "flex", flexDirection: "column", gap: 10 }}>
              <img src={f.qr} alt="QR code for the authenticator app" style={{ width: 200, height: 200, background: "#fff", borderRadius: 12, padding: 8 }} />
              <span className="mu" style={{ fontSize: 13 }}>Or type this key in the authenticator app:</span>
              <b style={{ fontFamily: "monospace", fontSize: 15, letterSpacing: 1, overflowWrap: "anywhere", textAlign: "center" }}>{f.secret}</b>
              <button type="button" className="btn bs" onClick={() => { void navigator.clipboard?.writeText(f.secret).then(() => toast("Key copied.")).catch(() => null); }}><Copy size={16} />Copy the key</button>
            </div>
            <p className="h">Then type the 6-digit code it shows for IET ReqGen</p>
            <label className={`otp${msg ? " bad" : ""}`} aria-label="6-digit code from your authenticator app">
              {Array.from({ length: 6 }).map((_, i) => <i key={i} className={i === code.length ? "on" : ""}>{code[i] || ""}</i>)}
              <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} disabled={busy}
                onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setCode(v); if (v.length === 6) void check(v); }} />
            </label>
          </>
        ) : !msg ? <p className="mu">Preparing…</p> : null}
        {msg ? <Note tone="er">{msg}</Note> : null}
      </Body>
    </>
  );
}
