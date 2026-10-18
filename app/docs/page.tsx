"use client";

import Link from "next/link";
import { useState } from "react";
import { REQGEN_VERSION } from "@/lib/version";
import { useSecurityRules } from "@/lib/v4/useSecurityRules";
import Icon from "@/app/components/v4/Icon";
import { V4Page } from "@/app/components/v4/ui";

type Faq = { q: string; a: React.ReactNode; topic: string };

/** Help (mock-up 22): short answers for every part of ReqGen, and who to ask. */
export default function HelpPage() {
  const rules = useSecurityRules();
  const [q, setQ] = useState("");
  const faqs: Faq[] = [
    { topic: "start", q: `Why am I asked for a code only every ${rules.stayHours} hours?`, a: <>One fingerprint or 2FA code keeps you verified on that device for {rules.stayHours} hours. After that ReqGen asks again.</> },
    { topic: "start", q: "What must I do before I can submit or approve?", a: <>Finish the four steps in <Link href="/profile/setup">My Account › Setup Guide</Link>: your own password, the authenticator app, your photo and your signature.</> },
    { topic: "security", q: "I lost my phone. How do I sign in?", a: <>Ask the Super Admin to reset your 2FA. Then connect the app on your new phone from the Setup Guide.</> },
    { topic: "security", q: "What is the passcode, and is it safe?", a: <>A 6-number passcode works only on the device where you set it. {rules.passcodeTries} wrong tries remove it. Signing, stamping and paying still ask for your fingerprint or 2FA code.</> },
    { topic: "requests", q: "My request was returned. What now?", a: <>Open it in <Link href="/requests">Requests</Link>, read the reason, correct it and resubmit. It goes back to the officer who returned it.</> },
    { topic: "approvals", q: "Why can’t I see the Finance module?", a: <>The menu shows only what your position can open. Check <Link href="/profile/access">My Access</Link>, or switch &ldquo;Acting as&rdquo;.</> },
    { topic: "vouchers", q: "Who signs a payment voucher, and in what order?", a: <>The Account Officer prepares → the Auditor checks → the Counter Signer → the Director General signs, stamps and authorises → Account pays.</> },
    { topic: "vouchers", q: "A payment was released by mistake. Can it be undone?", a: <>Yes, with approval: the Account Officer starts a reversal in <b>Finance › Transaction Centre</b>, the Auditor checks it and the DG approves. Nothing is deleted.</> },
    { topic: "vouchers", q: "A subhead shows money spent that nobody can explain.", a: <>Open <b>Finance › Finance Integrity</b>. It compares every stored total with the records behind it; the Auditor can correct a total that has no record, with a reason.</> },
    { topic: "notifications", q: "How do I stop the orange guide strip?", a: <>Finish the missing step, or turn the strip off in <Link href="/profile/setup">My Account › Setup Guide</Link>.</> },
  ];
  const topics = [
    { key: "start", title: "Getting started", sub: "Sign in, 2FA, setup guide", icon: "check", tone: "brand", href: "/profile/setup" },
    { key: "requests", title: "Requests", sub: "Create, correct, print", icon: "file", tone: "blue", href: "/requests" },
    { key: "approvals", title: "Approvals", sub: "Approve, return, sign", icon: "shield", tone: "green", href: "/approvals" },
    { key: "vouchers", title: "Payment vouchers", sub: "Generate, sign, pay, reverse", icon: "pen", tone: "brand", href: "/payment-vouchers" },
    { key: "security", title: "Security", sub: "Fingerprint, devices, password", icon: "lock", tone: "amber", href: "/profile/security" },
    { key: "notifications", title: "Notifications", sub: "In-app and phone alerts", icon: "bell", tone: "blue", href: "/notifications" },
  ];
  const t = q.trim().toLowerCase();
  const shown = faqs.filter((f) => !t || `${f.q} ${typeof f.a === "string" ? f.a : ""}`.toLowerCase().includes(t));

  return (
    <V4Page>
      <section className="v4-help-hero">
        <h1 className="v4-page-title">How can we help?</h1>
        <p className="v4-page-sub">Short answers for every page in ReqGen.</p>
        <label className="v4-search"><span className="v4-sr-only">Search help</span><Icon name="search" /><input type="search" placeholder="e.g. how do I sign a voucher with my fingerprint?" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      </section>
      <section className="v4-topics">
        {topics.map((x) => (
          <Link key={x.key} className="v4-minitile" href={x.href} style={{ minHeight: 120 }}>
            <span className={`v4-ico v4-t-${x.tone}`}><Icon name={x.icon} /></span>
            <span>{x.title}<span className="v4-help" style={{ display: "block", fontWeight: 500, marginTop: 2 }}>{x.sub}</span></span>
          </Link>
        ))}
      </section>
      <div className="v4-cols">
        <section className="v4-card">
          <div className="v4-card-head"><h2 className="v4-h2">Common questions</h2></div>
          {shown.length ? shown.map((f, i) => (
            <details key={f.q} className="v4-faq" open={i === 0 && !t}>
              <summary>{f.q}<Icon name="chevron" /></summary>
              <p style={{ margin: 0, padding: "0 20px 16px", color: "var(--v4-ink-2)", lineHeight: 1.6 }}>{f.a}</p>
            </details>
          )) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>No answer matches. Ask the Super Admin.</p>}
        </section>
        <aside className="v4-side-stack" style={{ position: "static" }}>
          <section className="v4-card v4-card-pad">
            <h2 className="v4-h3" style={{ marginBottom: 10 }}>Still stuck?</h2>
            <div className="v4-device"><span className="v4-di"><Icon name="admin" /></span><span className="v4-dt"><strong>ReqGen Super Admin</strong><span>Positions, accounts, routing, 2FA resets</span></span></div>
            <div className="v4-device"><span className="v4-di"><Icon name="mail" /></span><span className="v4-dt"><strong>Barderian support</strong><span>info@barderians.com.ng</span></span><a className="v4-btn v4-btn-secondary" href="mailto:info@barderians.com.ng">Email</a></div>
          </section>
          <section className="v4-card v4-card-pad" id="privacy">
            <h2 className="v4-h3" style={{ marginBottom: 10 }}>Privacy</h2>
            <ul style={{ margin: 0, paddingLeft: 18, color: "var(--v4-ink-2)", lineHeight: 1.7, fontSize: 13.5 }}>
              <li>A request&rsquo;s contents are seen only by the requester and the officers on its route.</li>
              <li>Registry sees request numbers, dates, offices and people — never contents or amounts.</li>
              <li>Subhead balances are shown only to the positions that need them.</li>
              <li>Every action is in the Audit Log; only the Auditor and the Super Admin can read it.</li>
              <li>Passwords and passcodes are never stored as typed — only a scrambled copy.</li>
            </ul>
          </section>
          <section className="v4-card v4-card-pad" id="about">
            <h2 className="v4-h3" style={{ marginBottom: 10 }}>About ReqGen</h2>
            <dl className="v4-kv"><dt>Version</dt><dd>{REQGEN_VERSION}</dd><dt>Made for</dt><dd>Islamic Education Trust</dd><dt>Built by</dt><dd>Barderian Enterprises</dd></dl>
            <p className="v4-help" style={{ margin: "10px 0 0" }}>Requests, approvals, finance, payment vouchers, registry, reports and audit — role based, with signatures, the IET stamp and a full audit trail. ReqGen keeps the records; the bank moves the money.</p>
          </section>
        </aside>
      </div>
    </V4Page>
  );
}
