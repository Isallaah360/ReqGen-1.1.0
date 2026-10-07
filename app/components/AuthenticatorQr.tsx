"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Smartphone } from "lucide-react";

/**
 * ReqGen v3.1.11 — the ONE authenticator QR code.
 *
 * Supabase returns `totp.qr_code` as a data URI ("data:image/svg+xml;utf-8,…").
 * Earlier screens injected that string as HTML, so the browser showed text,
 * not a picture — only the manual key worked. ReqGen now draws the QR itself
 * from the `otpauth://` URI: pure black on white with a full quiet zone,
 * error-correction level M, 240 px, unaffected by dark mode — every
 * authenticator app (Google, Microsoft, Authy, 2FAS) can scan it.
 * On a phone, "Open in authenticator app" adds the account without scanning.
 */
export default function AuthenticatorQr({ uri, secret }: { uri: string; secret: string }) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!uri) return;
    QRCode.toDataURL(uri, { errorCorrectionLevel: "M", margin: 4, width: 480, color: { dark: "#000000", light: "#ffffff" } })
      .then((url) => { if (alive) { setSrc(url); setFailed(false); } })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [uri]);

  const groupedSecret = secret.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(secret.replace(/\s+/g, ""));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rg-authqr">
      <div className="rg-authqr-frame">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- generated data URL
          <img src={src} alt="QR code to add ReqGen to your authenticator app" width={240} height={240} />
        ) : (
          <span className="rg-authqr-wait">{failed ? "The QR code could not be drawn. Use the setup key below." : "Preparing QR code..."}</span>
        )}
      </div>
      <ol className="rg-authqr-steps">
        <li>Open your authenticator app and tap <b>+</b>.</li>
        <li>Choose <b>Scan a QR code</b> and point the camera at the square above.</li>
        <li>Type the 6-digit code the app shows into ReqGen.</li>
      </ol>
      <a className="rg-authqr-open" href={uri}><Smartphone size={15} /> On this phone? Open in authenticator app</a>
      <div className="rg-authqr-key">
        <small>Cannot scan? Enter this setup key instead</small>
        <code>{groupedSecret}</code>
        <button type="button" onClick={() => void copySecret()}><Copy size={14} /> {copied ? "Copied" : "Copy key"}</button>
      </div>
    </div>
  );
}
