"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { Chip, Notice, PageHead, Skeleton, Stats, V4Page, type StatItem } from "@/app/components/v4/ui";

type Check = { key: string; title: string; about: string; status: "pass" | "warn" | "fail"; note: string; link: string };
type Run = { run_at: string; passed: number; warnings: number; failed: number; results: Check[]; run_by_label?: string | null };

const LOOK = { fail: { tone: "red" as const, icon: "x", cls: "v4-fail" }, warn: { tone: "amber" as const, icon: "alert", cls: "v4-warn" }, pass: { tone: "green" as const, icon: "check", cls: "v4-pass" } };

/** Reports › Compliance (mock-up 66): automatic checks; each line opens the records behind it. */
export default function CompliancePage() {
  const me = useIdentity();
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const runNow = useCallback(async () => {
    setBusy(true);
    const { data, error: e } = await supabase.rpc("reqgen_compliance_run", { p_save: true });
    setBusy(false);
    if (e) { setError(e.message); return; }
    const r = (typeof data === "string" ? JSON.parse(data) : data) as Run;
    setError(null);
    setRun({ ...r, run_by_label: me.name });
  }, [me.name]);

  useEffect(() => {
    if (!me.ready) return;
    let alive = true;
    queueMicrotask(() => {
      // the latest saved run (today's) is shown; if there is none from today, run the checks now
      void supabase.from("reqgen_compliance_runs").select("run_at,passed,warnings,failed,results,run_by_label").order("run_at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
        if (!alive) return;
        const last = data as Run | null;
        if (last && new Date(last.run_at).toDateString() === new Date().toDateString()) setRun(last); else void runNow();
      });
    });
    return () => { alive = false; };
  }, [me.ready, runNow]);

  const results = run?.results || [];
  const stats: StatItem[] = [
    { label: "Passed", value: run ? run.passed : "…", note: `of ${results.length || 12} checks`, icon: "check", tone: "green" },
    { label: "To check", value: run ? run.warnings : "…", note: "Warnings", icon: "alert", tone: "amber" },
    { label: "Failed", value: run ? run.failed : "…", note: "Needs action", icon: "x", tone: "red" },
    { label: "Last run", value: run ? new Date(run.run_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "…", note: run ? `${new Date(run.run_at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}${run.run_by_label ? ` · ${run.run_by_label}` : ""}` : undefined, icon: "clock", tone: "blue" },
  ];
  const order = { fail: 0, warn: 1, pass: 2 };

  return (
    <V4Page>
      <PageHead title="Compliance" sub="Automatic checks on vouchers, signatures, budgets and security. They run the first time the page is opened each day and when you press Run now. Each line opens the records behind it."
        scope={`Your view: whole Trust · ${me.roleName}`}
        actions={[
          { label: busy ? "Running…" : "Run now", icon: "returned", kind: "secondary", onClick: () => void runNow(), disabled: busy },
          { label: "Print A4", icon: "printer", kind: "primary", onClick: () => window.print(), disabled: !run },
        ]} />
      {error ? <Notice tone="red">{error}</Notice> : null}
      <Stats items={stats} />
      {!run ? <Skeleton lines={8} /> : (
        <section className="v4-checks">
          {[...results].sort((a, b) => order[a.status] - order[b.status]).map((c) => {
            const l = LOOK[c.status];
            return (
              <article key={c.key} className={`v4-chk ${l.cls}`}>
                <span className={`v4-ci v4-t-${l.tone}`}><Icon name={l.icon} /></span>
                <strong>{c.title}</strong>
                <p>{c.about}</p>
                <div className="v4-foot"><Chip tone={l.tone}>{c.note}</Chip>{c.link ? <Link href={c.link}>{c.status === "pass" ? "View" : "Open"} <Icon name="right" size="sm" /></Link> : null}</div>
              </article>
            );
          })}
        </section>
      )}
      <Notice tone="blue">Every run is kept with the time and who ran it, so the Auditor can show the checks at any later date.</Notice>
    </V4Page>
  );
}
