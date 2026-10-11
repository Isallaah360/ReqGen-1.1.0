import Image from "next/image";
import Link from "next/link";
import Icon from "./components/v4/Icon";
import { PublicFoot } from "./components/PublicAuthShell";

/** ReqGen v4 home page — IET brand; the developer appears only in the footer. */
export default function HomePage() {
  return (
    <main className="v4-ui v4-public">
      <Image className="v4-public-watermark" src="/v4/iet-logo.png" alt="" aria-hidden="true" width={720} height={720} priority />
      <section className="v4-auth-card" aria-labelledby="home-title" style={{ paddingTop: 44 }}>
        <div className="v4-auth-logo" style={{ width: 180, height: 180 }}>
          <Image src="/v4/iet-logo.png" alt="Islamic Education Trust logo" width={156} height={156} priority style={{ width: 156, height: 156 }} />
        </div>
        <p style={{ margin: "18px 0 0", fontSize: 24, fontWeight: 700 }}>Welcome to</p>
        <h1 id="home-title" className="v4-auth-title" style={{ fontSize: 46, marginTop: 0 }}>ReqGen</h1>
        <div className="v4-or" style={{ margin: "6px 40px 16px", color: "var(--v4-brand)" }}><Icon name="shield" /></div>
        <p style={{ margin: "0 0 24px", color: "var(--v4-ink-2)", fontSize: 15.5, lineHeight: 1.6 }}>
          A secure and unified Request Management System for Islamic Education Trust (IET), supporting transparent workflows, accountable approvals and efficient service delivery.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Link className="v4-btn v4-btn-primary v4-btn-lg v4-btn-block" href="/login"><Icon name="lock" />Login to Your Account</Link>
          <Link className="v4-btn v4-btn-secondary v4-btn-lg v4-btn-block" href="/signup" style={{ color: "var(--v4-brand)" }}><Icon name="user" />Create New Account</Link>
        </div>
        <PublicFoot />
      </section>
    </main>
  );
}
