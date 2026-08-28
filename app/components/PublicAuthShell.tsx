"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PublicAuthShell({
  title,
  subtitle,
  children,
  showHomeLink = true,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  showHomeLink?: boolean;
}) {
  return (
    <main className="auth-shell">
      <div className="auth-watermark" aria-hidden="true"><Image src="/iet-logo.png" alt="" width={720} height={720} /></div>
      <section className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo-float"><Image src="/iet-logo.png" alt="Islamic Education Trust" width={188} height={188} priority /></div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="auth-body">{children}</div>
        {showHomeLink ? <Link href="/" className="auth-home-link"><ArrowLeft size={16} /> Back to Homepage</Link> : null}
        <div className="auth-trust">Secure <i>•</i> Reliable <i>•</i> Accountable</div>
        <footer className="auth-footer">
          <Image src="/be-logo.png" alt="Barderian Enterprises" width={58} height={44} />
          <div><span>Powered by</span><strong>Barderian Enterprises</strong><p><a href="https://barderians.com.ng" target="_blank" rel="noreferrer">barderians.com.ng</a> <i>•</i> <a href="mailto:info@barderians.com.ng">info@barderians.com.ng</a></p></div>
        </footer>
        <small className="auth-copyright">© {new Date().getFullYear()} Islamic Education Trust. All rights reserved.</small>
      </section>
    </main>
  );
}
