import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mock-public-shell">
      <section className="mock-home-card">
        <div className="mock-home-watermark"><img src="/iet-logo.png" alt="" /></div>
        <div className="mock-home-logo-orbit"><img src="/iet-logo.png" alt="Islamic Education Trust logo" /></div>
        <p className="mock-home-welcome">Welcome to</p>
        <h1>ReqGen</h1>
        <div className="mock-home-rule"><span></span><b>✓</b><span></span></div>
        <p className="mock-home-copy">A secure and unified Request Management System for Islamic Education Trust (IET), supporting transparent workflows, accountable approvals and efficient service delivery.</p>
        <div className="mock-home-actions"><Link href="/login" className="mock-home-primary">Login to Your Account</Link><Link href="/signup" className="mock-home-secondary">Create New Account</Link></div>
        <div className="mock-home-dev"><img src="/be-logo.png" alt="Barderian Enterprises logo"/><div><span>Powered by</span><strong>BARDERIAN <em>ENTERPRISES</em></strong><small>Innovate. Build. Empower.</small></div></div>
        <div className="mock-home-contact"><a href="https://barderians.com.ng" target="_blank" rel="noreferrer">https://barderians.com.ng</a><span>|</span><a href="mailto:info@barderians.com.ng">info@barderians.com.ng</a></div>
        <small className="mock-home-copywrite">© {new Date().getFullYear()} Islamic Education Trust. All rights reserved.</small>
      </section>
    </main>
  );
}
