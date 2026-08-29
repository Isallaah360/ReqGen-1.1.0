import Link from "next/link";
import { BookOpen, CircleHelp, FileText, ShieldCheck, Workflow } from "lucide-react";

export default function ReqGenHelpCentrePage() {
  return (
    <main className="rg-help-page">
      <header className="rg-help-head"><div><span>SUPPORT</span><h1>ReqGen Help Centre</h1><p>Quick guidance for the working ReqGen request, approval and finance workflows.</p></div><Link href="/dashboard">Back to Dashboard</Link></header>
      <section className="rg-help-grid">
        <article><FileText /><div><h2>Creating Requests</h2><p>Complete the required fields, attach supporting documents where necessary, sign the request, then use the visible Submit Request action.</p><Link href="/requests/new">Create New Request</Link></div></article>
        <article><Workflow /><div><h2>Tracking Requests</h2><p>Use Requests Overview to view, edit where permitted, print, and follow the current workflow status of your requests.</p><Link href="/requests">Open Requests</Link></div></article>
        <article><ShieldCheck /><div><h2>Approvals & Security</h2><p>Approval actions follow your active role and the configured MFA/security controls. Access is verified silently during navigation.</p><Link href="/approvals">Open Approvals</Link></div></article>
        <article><CircleHelp /><div><h2>Need More Help?</h2><p>Contact your ReqGen System Administrator for account, role, signature, MFA or workflow issues.</p><Link href="/profile">Check My Profile</Link></div></article>
      </section>
      <section className="rg-help-note"><BookOpen size={18}/><p>This centre documents existing ReqGen functionality only; it does not create or change workflow rules.</p></section>
    </main>
  );
}
