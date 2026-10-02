"use client";

import { useEffect } from "react";

const EYE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.9 17.9A10.4 10.4 0 0 1 12 19c-6.5 0-10-7-10-7a18.5 18.5 0 0 1 5.1-5.9M9.9 5.2A9.9 9.9 0 0 1 12 5c6.5 0 10 7 10 7a18.6 18.6 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2"/><path d="M2 2l20 20"/></svg>';

/**
 * v3.0.10: every password field in ReqGen gets the standard "eye" button to
 * show/hide what was typed (login, sign-up, reset, change password, admin
 * temporary password, and any future form) — one behaviour everywhere.
 */
export default function PasswordReveal() {
  useEffect(() => {
    const enhance = (input: HTMLInputElement) => {
      if (input.dataset.rgReveal) return;
      const host = input.parentElement;
      if (!host) return;
      input.dataset.rgReveal = "1";
      // A page that already provides its own show/hide button keeps it (no double eye).
      if (host.querySelector("button:not(.rg-reveal)")) return;
      if (getComputedStyle(host).position === "static") host.style.position = "relative";
      input.style.paddingRight = "44px";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rg-reveal";
      btn.setAttribute("aria-label", "Show password");
      btn.setAttribute("aria-pressed", "false");
      btn.innerHTML = EYE;
      btn.addEventListener("click", () => {
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        btn.innerHTML = show ? EYE_OFF : EYE;
        btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
        btn.setAttribute("aria-pressed", String(show));
        input.focus({ preventScroll: true });
      });
      // centre the button on the input itself (the host may also hold a label)
      const place = () => {
        const top = input.offsetTop + input.offsetHeight / 2;
        btn.style.top = `${top}px`;
        btn.style.right = `${Math.max(4, host.clientWidth - (input.offsetLeft + input.offsetWidth) + 4)}px`;
      };
      host.appendChild(btn);
      place();
      new ResizeObserver(place).observe(input);
    };
    const scan = () => document.querySelectorAll<HTMLInputElement>('input[type="password"]:not([data-rg-reveal])').forEach(enhance);
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return null;
}
