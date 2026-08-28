import Link from "next/link";
import { LockKeyhole, UserPlus } from "lucide-react";

export default function HomePage() {
  return (
    <main className="gov-public-page gov-home-page">
      <div className="gov-public-watermark" aria-hidden="true"><img src="/iet-logo.png" alt="" /></div>
      <section className="gov-home-card">
        <div className="gov-home-logo-ring">
          <img src="/iet-logo.png" alt="Islamic Education Trust logo" className="gov-home-logo" />
        </div>
        <p className="gov-home-org">Islamic Education Trust</p>
        <h1><span>Welcome to</span> ReqGen</h1>
        <div className="gov-home-divider" aria-hidden="true"><span /></div>
        <p className="gov-home-copy">A secure and unified request management system for Islamic Education Trust, supporting transparent workflows, accountable approvals and efficient institutional service delivery.</p>
        <div className="gov-home-actions">
          <Link href="/login" className="gov-home-primary"><LockKeyhole size={20} />Login to Your Account</Link>
          <Link href="/signup" className="gov-home-secondary"><UserPlus size={20} />Create New Account</Link>
        </div>
        <footer className="gov-home-footer">
          <div className="gov-home-developer">
            <span>Powered by</span>
            <div><img src="/be-logo.png" alt="Barderian Enterprises" /><strong>Barderian Enterprises</strong></div>
          </div>
          <div className="gov-home-contact"><a href="https://barderians.com.ng" target="_blank" rel="noreferrer">barderians.com.ng</a><span>•</span><a href="mailto:info@barderians.com.ng">info@barderians.com.ng</a></div>
          <small>© 2026 Islamic Education Trust. All rights reserved.</small>
        </footer>
      </section>
    </main>
  );
}
