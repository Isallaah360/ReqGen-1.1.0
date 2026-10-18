"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import PublicAuthShell from "../components/PublicAuthShell";
import Icon from "../components/v4/Icon";
import { Notice } from "../components/v4/ui";

async function signOut() {
  await supabase.auth.signOut();
  window.location.assign("/login");
}

function Content() {
  const params = useSearchParams();
  const page = params.get("from") || params.get("path") || "";
  const role = params.get("role") || "";
  const reason = params.get("reason") || "";

  // v4.6.6: signed in, but the account has no staff record yet
  if (reason === "no-profile") {
    return (
      <PublicAuthShell title="Your account is not set up yet" subtitle="You signed in, but ReqGen has no staff record for this account." showHomeLink={false}>
        <div className="v4-auth-form">
          <Notice tone="amber" title="What to do">
            If this is the Super Admin (ietreqgen@gmail.com) or the Developer (info@barderians.com.ng) account, run the database step <b>v4_6_6_system_accounts.sql</b> in Supabase, then sign in again. For a staff member, ask the Super Admin to add them in Administration › Staff.
          </Notice>
          <button className="v4-btn v4-btn-primary v4-btn-lg v4-btn-block" type="button" onClick={() => void signOut()}><Icon name="logout" />Sign out</button>
        </div>
      </PublicAuthShell>
    );
  }

  // v4.6.6: a module switched off by the Developer for maintenance
  if (reason === "module-off") {
    const label = params.get("module") || "This module";
    const note = params.get("note") || "";
    return (
      <PublicAuthShell title={`${label} is switched off for now`} subtitle="The Developer is working on it. Everything you saved is safe." showHomeLink={false}>
        <div className="v4-auth-form">
          <Notice tone="blue" title="Message from the Developer">{note || "It will be back shortly."}</Notice>
          <Link className="v4-btn v4-btn-primary v4-btn-lg v4-btn-block" href="/dashboard"><Icon name="dashboard" />Go to my Dashboard</Link>
        </div>
      </PublicAuthShell>
    );
  }

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
