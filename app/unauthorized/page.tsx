"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PublicAuthShell from "../components/PublicAuthShell";
import Icon from "../components/v4/Icon";
import { Notice } from "../components/v4/ui";

function Content() {
  const params = useSearchParams();
  const page = params.get("from") || params.get("path") || "";
  const role = params.get("role") || "";
  return (
    <PublicAuthShell title="This page is not open to you" subtitle={page ? `Your position cannot open ${page}.` : "Your position cannot open the page you asked for."} showHomeLink={false}>
      <div className="v4-auth-form">
        <Notice tone="amber" title="What you can do">
          {role ? <>You are acting as <b>{role}</b>. </> : null}If you hold another position, switch &ldquo;Acting as&rdquo; in the top bar. If you think your position should open this page, ask the Super Admin.
        </Notice>
        <Link className="v4-btn v4-btn-primary v4-btn-lg v4-btn-block" href="/dashboard"><Icon name="dashboard" />Go to my Dashboard</Link>
        <Link className="v4-btn v4-btn-secondary v4-btn-lg v4-btn-block" href="/profile/access"><Icon name="key" />See what my positions can open</Link>
      </div>
    </PublicAuthShell>
  );
}

/** Shown when a position cannot open a page. Nothing about the page is revealed. */
export default function UnauthorizedPage() {
  return <Suspense fallback={<PublicAuthShell title="This page is not open to you" subtitle="Checking…"><p className="v4-muted">Loading…</p></PublicAuthShell>}><Content /></Suspense>;
}
