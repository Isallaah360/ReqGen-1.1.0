import Link from "next/link";
import Image from "next/image";
import { LockKeyhole, UserPlus, ShieldCheck, Globe2, Mail } from "lucide-react";

export default function HomePage() {
  return (
    <main className="mock-public-shell">
      <div className="mock-public-watermark" aria-hidden="true">
        <Image src="/iet-logo.png" alt="" width={720} height={720} priority />
      </div>

      <section className="mock-home-card" aria-labelledby="reqgen-home-title">
        <div className="mock-home-logo-orbit">
          <Image src="/iet-logo.png" alt="Islamic Education Trust logo" width={260} height={260} priority />
        </div>

        <p className="mock-home-welcome">Welcome to</p>
        <h1 id="reqgen-home-title">ReqGen</h1>

        <div className="mock-home-rule" aria-hidden="true">
          <span />
          <b><ShieldCheck size={23} /></b>
          <span />
        </div>

        <p className="mock-home-copy">
          A secure and unified Request Management System for Islamic Education Trust (IET), supporting transparent workflows,
          accountable approvals and efficient service delivery.
        </p>

        <div className="mock-home-actions">
          <Link href="/login" className="mock-home-primary"><LockKeyhole size={20} />Login to Your Account</Link>
          <Link href="/signup" className="mock-home-secondary"><UserPlus size={20} />Create New Account</Link>
        </div>

        <div className="mock-home-divider" />

        <div className="mock-home-dev">
          <Image src="/be-logo.png" alt="Barderian Enterprises logo" width={78} height={58} />
          <div>
            <span>Powered by</span>
            <strong>BARDERIAN <em>ENTERPRISES</em></strong>
            <small>Innovate. Build. Empower.</small>
          </div>
        </div>

        <div className="mock-home-contact">
          <a href="https://barderians.com.ng" target="_blank" rel="noreferrer"><Globe2 size={15} />barderians.com.ng</a>
          <i aria-hidden="true" />
          <a href="mailto:info@barderians.com.ng"><Mail size={15} />info@barderians.com.ng</a>
        </div>

        <small className="mock-home-copyright">© {new Date().getFullYear()} Islamic Education Trust. All rights reserved.</small>
      </section>
    </main>
  );
}
