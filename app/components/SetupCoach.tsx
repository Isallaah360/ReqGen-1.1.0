"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ChevronRight, Compass, X } from "lucide-react";
import { confirmDialog } from "@/lib/dialog";
import { SETUP_ORDER, setupStepContent, useSetupSteps, type SetupStepKey } from "@/lib/profileSetup";

const SKIP_PATHS = ["/login", "/signup", "/mfa", "/forgot-password", "/reset-password", "/unauthorized"];
const WELCOME_KEY = "reqgen-setup-welcome-shown";

/**
 * ReqGen v3.1.8 — Setup Coach (mounted in the app frame).
 *  • Banner: while any step is missing, a slim bar says what is missing.
 *  • Welcome: once per sign-in session, a centred dialog offers the guide.
 *  • Coach: on the page a guide step opened (?guide=…), a floating card shows
 *    the numbered instructions, highlights the right section, and confirms
 *    automatically when the step is done.
 */
export default function SetupCoach() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const params = useSearchParams();
  const guide = params.get("guide") as SetupStepKey | null;
  const { steps } = useSetupSteps();
  const [closed, setClosed] = useState(false);

  const hidden = SKIP_PATHS.some((p) => pathname.startsWith(p));
  const missing = useMemo(() => (steps || []).filter((s) => !s.done), [steps]);
  const missingRequired = missing.filter((s) => s.required);
  const guideStep = guide && SETUP_ORDER.includes(guide) ? (steps || []).find((s) => s.key === guide) || null : null;

  // Welcome dialog — once per session, only when something is missing.
  useEffect(() => {
    if (hidden || !steps || !missing.length || pathname.startsWith("/profile/setup") || guide) return;
    try {
      if (sessionStorage.getItem(WELCOME_KEY)) return;
      sessionStorage.setItem(WELCOME_KEY, "1");
    } catch {
      return;
    }
    void (async () => {
      const ok = await confirmDialog({
        title: "Let's finish setting up your account",
        message: `${missing.length} step${missing.length === 1 ? " is" : "s are"} still missing: ${missing.map((s) => s.title.toLowerCase()).join(", ")}.`,
        details: missingRequired.some((s) => s.key === "signature") ? ["Your signature is required before you can submit, approve or sign anything."] : undefined,
        confirmLabel: "Start the setup guide",
        cancelLabel: "Later",
      });
      if (ok) router.push("/profile/setup");
    })();
  }, [guide, hidden, missing, missingRequired, pathname, router, steps]);

  // Highlight the section the guide points at.
  useEffect(() => {
    if (!guide) return;
    const timer = window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(`[data-guide="${guide}"]`);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("rg-guide-focus");
      window.setTimeout(() => target.classList.remove("rg-guide-focus"), 6000);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [guide, pathname]);

  if (hidden || !steps) return null;

  return (
    <>
      {missing.length && !pathname.startsWith("/profile/setup") && !guideStep ? (
        <div className={`rg-setup-banner ${missingRequired.length ? "is-required" : ""}`} role="status">
          <Compass size={16} aria-hidden="true" />
          <span>
            Account setup {steps.length - missing.length} of {steps.length} complete — missing: {missing.map((s) => s.title.replace(/^(Set|Connect|Add|Upload) (your )?/i, "")).join(", ")}.
          </span>
          <Link href="/profile/setup">Continue setup <ChevronRight size={14} /></Link>
        </div>
      ) : null}

      {guideStep && !closed ? (
        <aside className={`rg-coach ${guideStep.done ? "is-done" : ""}`} aria-label="Setup guide">
          <header>
            <span><Compass size={16} /> Setup guide · Step {SETUP_ORDER.indexOf(guideStep.key) + 1} of 4</span>
            <button type="button" aria-label="Close guide" onClick={() => setClosed(true)}><X size={16} /></button>
          </header>
          <h3>{setupStepContent(guideStep.key).title}</h3>
          {guideStep.done ? (
            <p className="rg-coach-done"><CheckCircle2 size={18} /> Done! This step is complete.</p>
          ) : (
            <ol>{guideStep.howTo.map((line, i) => <li key={line}><span>{i + 1}</span>{line}</li>)}</ol>
          )}
          <footer>
            <Link className="rg-btn rg-btn-primary" href="/profile/setup">{guideStep.done ? "Next step" : "Back to the guide"} <ChevronRight size={14} /></Link>
          </footer>
        </aside>
      ) : null}
    </>
  );
}
