"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Circle, ImageIcon, KeyRound, PenLine, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { confirmDialog } from "@/lib/dialog";
import { confirmOwnPassword, useSetupSteps, type SetupStepKey } from "@/lib/profileSetup";

/** ReqGen v3.1.8 — Profile → Setup Guide: four steps, explained in plain words. */

const ICONS: Record<SetupStepKey, typeof KeyRound> = { password: KeyRound, twofa: ShieldCheck, avatar: ImageIcon, signature: PenLine };

export default function SetupGuidePage() {
  const { steps, loading, refresh } = useSetupSteps();
  const [openKey, setOpenKey] = useState<SetupStepKey | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const doneCount = steps?.filter((s) => s.done).length || 0;
  const total = steps?.length || 4;
  const next = useMemo(() => steps?.find((s) => !s.done) || null, [steps]);
  const active = openKey || next?.key || null;
  const percent = Math.round((doneCount / total) * 100);

  async function markPasswordOwn() {
    const ok = await confirmDialog({
      title: "Is your password already your own?",
      message: "Confirm only if you have already replaced the temporary password the Administrator gave you.",
      confirmLabel: "Yes, it is my own",
      cancelLabel: "No, change it now",
    });
    if (!ok) return;
    try {
      await confirmOwnPassword();
      setMessage("Thank you. Password step confirmed.");
      await refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Could not save. Please try again.");
    }
  }

  return (
    <main className="rg-setup">
      <PageHeader
        title="Account Setup Guide"
        description="Follow the steps one at a time. Each step tells you why it matters and exactly what to tap."
        actions={<button type="button" className="rg-btn rg-btn-secondary" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} /> Check again</button>}
      />

      <section className={`rg-setup-progress ${doneCount === total ? "is-complete" : ""}`}>
        <div className="rg-setup-ring" style={{ ["--p" as string]: `${percent}` }} aria-label={`${percent}% complete`}>
          <strong>{doneCount}/{total}</strong>
        </div>
        <div>
          {doneCount === total ? (
            <><h2><Sparkles size={18} /> Your account is fully set up</h2><p>You can submit requests, approve and sign documents. Well done.</p></>
          ) : (
            <><h2>{next ? `Next: ${next.title}` : "Checking your account..."}</h2><p>{next?.why || "One moment."}</p></>
          )}
          <div className="rg-setup-bar"><span style={{ width: `${percent}%` }} /></div>
        </div>
      </section>

      {message ? <div className="rg-pvd-message is-ok" role="status">{message}</div> : null}

      <ol className="rg-setup-steps">
        {(steps || []).map((step, index) => {
          const Icon = ICONS[step.key];
          const open = active === step.key;
          return (
            <li key={step.key} className={`${step.done ? "is-done" : ""} ${open ? "is-open" : ""}`}>
              <button type="button" className="rg-setup-step-head" onClick={() => setOpenKey(open ? null : step.key)} aria-expanded={open}>
                <span className="rg-setup-num">{step.done ? <CheckCircle2 size={20} /> : index + 1}</span>
                <span className="rg-setup-icon"><Icon size={18} /></span>
                <span className="rg-setup-title">
                  <strong>{step.title}</strong>
                  <small>{step.done ? "Done" : step.required ? "Required" : "Recommended"}</small>
                </span>
                <ChevronRight size={18} className="rg-setup-chevron" />
              </button>
              {open ? (
                <div className="rg-setup-body">
                  <p className="rg-setup-why">{step.why}</p>
                  <ol className="rg-setup-howto">
                    {step.howTo.map((line, i) => (
                      <li key={line}><span>{i + 1}</span>{line}</li>
                    ))}
                  </ol>
                  <div className="rg-setup-actions">
                    {step.done ? (
                      <span className="rg-setup-done"><CheckCircle2 size={16} /> This step is complete.</span>
                    ) : (
                      <>
                        <Link className="rg-btn rg-btn-primary" href={step.href}>Take me there <ChevronRight size={15} /></Link>
                        {step.key === "password" ? <button type="button" className="rg-btn rg-btn-secondary" onClick={() => void markPasswordOwn()}>I already changed it</button> : null}
                      </>
                    )}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
        {loading && !steps ? <li className="rg-setup-loading"><Circle size={16} /> Checking your account...</li> : null}
      </ol>
    </main>
  );
}
