import Link from "next/link";

export default function HomePage() {
  return (
    <main className="reqgen-home">
      <div className="reqgen-home-watermark" aria-hidden="true">
        <img src="/iet-logo.png" alt="" />
      </div>

      <section className="reqgen-home-card">
        <div className="reqgen-home-logo-wrap">
          <img src="/iet-logo.png" alt="Islamic Education Trust logo" className="reqgen-home-logo" />
        </div>

        <p className="reqgen-home-org">Islamic Education Trust</p>
        <h1>Welcome to ReqGen</h1>
        <p className="reqgen-home-copy">
          A secure and simple request management system for IET staff, supporting transparent workflows, accountable approvals and efficient institutional service delivery.
        </p>

        <div className="reqgen-home-actions">
          <Link href="/login" className="reqgen-home-primary">Login to Your Account</Link>
          <Link href="/signup" className="reqgen-home-secondary">Create New Account</Link>
        </div>

        <div className="reqgen-home-trust">Secure <span>•</span> Reliable <span>•</span> Accountable</div>

        <footer className="reqgen-home-footer">
          <div className="reqgen-home-developer">
            <img src="/be-logo.png" alt="Barderian Enterprises logo" />
            <div>
              <span>Developed by</span>
              <strong>Barderian Enterprises</strong>
            </div>
          </div>
          <div className="reqgen-home-contact">
            <a href="https://barderians.com.ng" target="_blank" rel="noreferrer">barderians.com.ng</a>
            <span>•</span>
            <a href="mailto:info@barderians.com.ng">info@barderians.com.ng</a>
          </div>
          <small>© 2026 Islamic Education Trust. All rights reserved.</small>
        </footer>
      </section>
    </main>
  );
}
