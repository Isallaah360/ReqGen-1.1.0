"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type TipState = { text: string; left: number; top: number; width: number } | null;

const ACTION_HINTS: Array<[RegExp, string]> = [
  [/\brefresh\b/i, "Refresh this view with the latest records."],
  [/\bsearch\b/i, "Search only the pages and functions permitted for your active role."],
  [/\badd\b|\bnew\b|\bcreate\b/i, "Create a new record. Review the details before saving."],
  [/\bsave\b|\bsubmit\b/i, "Validate the form and save the entered information."],
  [/\bdelete\b|\bremove\b/i, "Remove this record. Confirm carefully because this action may be permanent."],
  [/\barchive\b/i, "Move this record to the archive while retaining its history."],
  [/\bapprove\b/i, "Approve this item and move it to the next authorised stage."],
  [/\breject\b/i, "Reject this item and record the decision in its workflow history."],
  [/\bassign\b|\bdelegate\b/i, "Assign responsibility to an authorised officer or unit."],
  [/\bexport\b|\bdownload\b/i, "Generate or download the available record in the supported format."],
  [/\bprint\b/i, "Open a print-ready version of this information."],
  [/\baudit\b/i, "Open the audit trail showing authorised activities and accountability records."],
  [/\breport\b/i, "Open reporting information available to your active role."],
  [/\bfinance\b|\bbank\b/i, "Open the authorised finance workspace or related bank register function."],
  [/\brole\b/i, "Use only a role assigned to your account. Your active role controls accessible functions."],
  [/\bsecurity\b|\bmfa\b|\b2fa\b/i, "Open security controls for account protection and verification."],
  [/\bback\b/i, "Return to the previous workspace."],
  [/\bopen\b|\bview\b/i, "Open this page or record using your current role permissions."],
];

function textOf(element: HTMLElement) {
  return (
    element.getAttribute("data-tip") ||
    element.getAttribute("aria-label") ||
    element.getAttribute("title") ||
    element.innerText ||
    element.getAttribute("placeholder") ||
    element.getAttribute("name") ||
    ""
  ).replace(/\s+/g, " ").trim();
}

function deriveTip(element: HTMLElement, pathname: string) {
  const explicit = element.getAttribute("data-tip");
  if (explicit) return explicit;

  const raw = textOf(element);
  const tag = element.tagName.toLowerCase();
  const href = element.getAttribute("href");

  if (tag === "input" || tag === "textarea") {
    const placeholder = element.getAttribute("placeholder") || raw || "information";
    return `Enter ${placeholder.replace(/[.…]+$/g, "").toLowerCase()}.`;
  }
  if (tag === "select") return "Choose one of the options available for this field.";

  for (const [pattern, hint] of ACTION_HINTS) {
    if (pattern.test(raw) || (href && pattern.test(href))) return hint;
  }

  if (href) return `Open ${raw || href}. Access remains controlled by your active role.`;
  if (element.getAttribute("role") === "tab") return `Switch to the ${raw || "selected"} tab without leaving this workspace.`;
  if (tag === "button") return raw ? `Use “${raw}” on this page.` : "Use this control to perform the indicated action.";

  return `Available on ${pathname}. Use this control according to your assigned role.`;
}

function targetFrom(node: EventTarget | null) {
  if (!(node instanceof Element)) return null;
  return node.closest<HTMLElement>(
    "button, a[href], [role='button'], [role='tab'], input:not([type='hidden']), textarea, select, [data-tip]"
  );
}

export default function GlobalTips() {
  const pathname = usePathname();
  const [tip, setTip] = useState<TipState>(null);
  const enabled = useMemo(() => !["/", "/login", "/signup", "/forgot-password", "/reset-password"].includes(pathname), [pathname]);

  useEffect(() => {
    if (!enabled) return;
    let timer: number | undefined;

    const show = (element: HTMLElement) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const rect = element.getBoundingClientRect();
        const width = Math.min(360, Math.max(230, rect.width));
        const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.left + rect.width / 2 - width / 2));
        const below = rect.bottom + 10;
        const top = below + 92 < window.innerHeight ? below : Math.max(12, rect.top - 98);
        setTip({ text: deriveTip(element, pathname), left, top, width });
      }, 350);
    };

    const hide = () => {
      window.clearTimeout(timer);
      setTip(null);
    };

    const onOver = (event: Event) => {
      const target = targetFrom(event.target);
      if (target) show(target);
    };
    const onFocus = (event: Event) => {
      const target = targetFrom(event.target);
      if (target) show(target);
    };

    document.addEventListener("pointerover", onOver, true);
    document.addEventListener("focusin", onFocus, true);
    document.addEventListener("pointerout", hide, true);
    document.addEventListener("focusout", hide, true);
    document.addEventListener("scroll", hide, true);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerover", onOver, true);
      document.removeEventListener("focusin", onFocus, true);
      document.removeEventListener("pointerout", hide, true);
      document.removeEventListener("focusout", hide, true);
      document.removeEventListener("scroll", hide, true);
    };
  }, [enabled, pathname]);

  if (!tip) return null;

  return (
    <div
      className="reqgen-global-tip"
      style={{ left: tip.left, top: tip.top, width: tip.width }}
      role="tooltip"
    >
      <span aria-hidden="true" className="reqgen-global-tip-icon">i</span>
      <span>{tip.text}</span>
    </div>
  );
}
