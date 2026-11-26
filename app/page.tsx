import Image from "next/image";
import Link from "next/link";
import Icon from "./components/v4/Icon";

/**
 * ReqGen 6.3.1 home page: the big IET logo is back (owner's request, 26 Nov 2026), with ReqGen under it,
 * sign in or create an account, the app, and a moving strip of short notices with links.
 * IET brand only; the developer appears in the footer. The strip stops when the device asks for less motion.
 */
const NOTES = (
  <>
    <span><b>New:</b> the ReqGen app for Android. <Link href="/app">Download it</Link></span>
    <span>Requests, approvals and payment vouchers in one place</span>
    <span><b>Backups:</b> a request that waits 25 working minutes moves to the officer&apos;s backup</span>
    <span>Sign in with your 2FA code, then use your fingerprint in the app</span>
    <span>Need help? <Link href="/docs">Read the guide</Link></span>
  </>
);

export default function HomePage() {
  return (
    <div className="s6-home-wrap">
      <div className="s6-home-strip" role="region" aria-label="ReqGen notices">
        <div className="s6-run">
          <span>{NOTES}</span>
          <span aria-hidden="true" inert>{NOTES}</span>
        </div>
      </div>
      <main className="s6-home" aria-labelledby="home-title">
        <div className="s6-home-logo">
          <span className="s6-home-halo" aria-hidden="true" />
          <span className="s6-home-halo g" aria-hidden="true" />
          <Image src="/v4/iet-logo.png" alt="Islamic Education Trust logo" width={226} height={226} priority />
        </div>
        <p className="s6-home-welcome">Welcome to</p>
        <h1 id="home-title" className="s6-home-name">Req<span>Gen</span></h1>
        <p className="s6-home-text">The Islamic Education Trust request and payment system: transparent workflows, accountable approvals and efficient service.</p>
        <div className="s6-home-actions">
          <Link className="v4-btn v4-btn-primary" href="/login"><Icon name="lock" />Sign in to your account</Link>
          <Link className="v4-btn v4-btn-secondary" href="/signup"><Icon name="user" />Create an account</Link>
        </div>
        <Link className="s6-home-app" href="/app"><i aria-hidden="true"><Icon name="smartphone" /></i><span><b>The ReqGen app is here</b><small>Download it for your Android phone</small></span></Link>
      </main>
    </div>
  );
}
