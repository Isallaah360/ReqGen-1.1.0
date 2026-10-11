"use client";

import Image from "next/image";
import Link from "next/link";
import Icon from "@/app/components/v4/Icon";

/**
 * ReqGen v4 public card (home, sign-in, 2FA, create account, reset): IET logo,
 * title, the form, and the footer with "Powered by" Barderian Enterprises.
 */
export default function PublicAuthShell({
  title,
  subtitle,
  children,
  showHomeLink = true,
  steps,
  wide = false,
}: {
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
  showHomeLink?: boolean;
  steps?: { total: number; current: number };
  wide?: boolean;
}) {
  return (
    <main className="v4-ui v4-public">
      <Image className="v4-public-watermark" src="/v4/iet-logo.png" alt="" aria-hidden="true" width={720} height={720} priority />
      <section className={`v4-auth-card ${wide ? "v4-wide" : ""}`}>
        <div className="v4-auth-logo v4-small"><Image src="/v4/iet-logo.png" alt="Islamic Education Trust logo" width={92} height={92} priority /></div>
        <h1 className="v4-auth-title">{title}</h1>
        <p className="v4-auth-sub">{subtitle}</p>
        {steps ? (
          <div className="v4-steps-dots" aria-label={`Step ${steps.current} of ${steps.total}`}>
            {Array.from({ length: steps.total }, (_, i) => <span key={i} className={i < steps.current ? "v4-on" : undefined} />)}
          </div>
        ) : null}
        <div className="v4-auth-form auth-body">{children}</div>
        {showHomeLink ? <Link href="/" className="v4-back-home"><Icon name="left" size="sm" /> Back to Homepage</Link> : null}
        <PublicFoot />
      </section>
    </main>
  );
}

export function PublicFoot() {
  return (
    <div className="v4-auth-foot">
      <div className="v4-auth-values"><span>Secure</span><i /><span>Reliable</span><i /><span>Accountable</span></div>
      <div className="v4-powered">
        <Image src="/v4/be-logo.png" alt="Barderian Enterprises logo" width={40} height={40} />
        <div><small>Powered by</small><strong>BARDERIAN <em>ENTERPRISES</em></strong></div>
      </div>
      <div className="v4-contact-row">
        <a href="https://barderians.com.ng" target="_blank" rel="noreferrer"><Icon name="info" size="sm" />barderians.com.ng</a>
        <a href="mailto:info@barderians.com.ng"><Icon name="mail" size="sm" />info@barderians.com.ng</a>
      </div>
      <span>© {new Date().getFullYear()} Islamic Education Trust. All rights reserved.</span>
    </div>
  );
}
