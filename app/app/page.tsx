import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Icon from "@/app/components/v4/Icon";
import { PublicFoot } from "@/app/components/PublicAuthShell";
import AppDownload from "./AppDownload";

export const metadata: Metadata = { title: "Get the ReqGen app", description: "Download the ReqGen Android app for the Islamic Education Trust." };

/** ReqGen v4.6.11 — Get the Android app (website only; the app sends this address to Home). */
export default function GetAppPage() {
  return (
    <main className="v4-ui v4-public v4-get-app">
      <section className="v4-auth-card" aria-labelledby="app-title" style={{ paddingTop: 36 }}>
        <div className="v4-auth-logo" style={{ width: 120, height: 120 }}>
          <Image src="/v4/iet-logo.png" alt="Islamic Education Trust logo" width={104} height={104} priority style={{ width: 104, height: 104 }} />
        </div>
        <h1 id="app-title" className="v4-auth-title" style={{ marginTop: 14 }}>ReqGen for Android</h1>
        <p style={{ margin: "0 0 18px", color: "var(--v4-ink-2)", fontSize: 15, lineHeight: 1.55 }}>
          The ReqGen app for IET staff. Sign in with your fingerprint, lock it with an app PIN, and share or save requests and vouchers as PDF.
        </p>
        <AppDownload />
        <h2 style={{ fontSize: 16, margin: "22px 0 10px", textAlign: "left" }}>Install it in 3 steps</h2>
        <ol className="v4-steps">
          <li><span>Tap <b>Download</b> above on your Android phone.</span></li>
          <li><span>Open the downloaded file. If Android asks, allow <b>Install unknown apps</b>, then tap <b>Install</b>.</span></li>
          <li><span>Open <b>ReqGen</b> and sign in with your password and 2FA code.</span></li>
        </ol>
        <p className="v4-muted" style={{ fontSize: 13, margin: "16px 0 0", textAlign: "left" }}>
          Download ReqGen only from this page. The phone and the laptop sign in separately.
        </p>
        <div style={{ marginTop: 18 }}><Link className="v4-btn v4-btn-secondary v4-btn-block" href="/login"><Icon name="lock" />Use ReqGen on the website</Link></div>
        <PublicFoot />
      </section>
    </main>
  );
}
