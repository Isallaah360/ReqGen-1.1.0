"use client";

import { useEffect } from "react";

/**
 * v3.1.4 — no "box inside a box". When a bordered frame tightly wraps an input,
 * dropdown or date field (search boxes, filter dropdowns, date ranges), the
 * inner control becomes borderless and transparent so only ONE clean frame
 * shows and nothing paints over its outline. Measured at runtime, so fields
 * built the other way (plain wrapper + bordered input) are left untouched.
 */
const SEL = 'input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]):not([type=range]),select,textarea';

function bordered(el: Element) {
  const s = getComputedStyle(el);
  return ["Top", "Right", "Bottom", "Left"].filter((k) => {
    const w = parseFloat(s.getPropertyValue(`border-${k.toLowerCase()}-width`));
    const c = s.getPropertyValue(`border-${k.toLowerCase()}-color`);
    return w > 0 && s.getPropertyValue(`border-${k.toLowerCase()}-style`) !== "none" && !/rgba\(0, 0, 0, 0\)/.test(c);
  }).length >= 3;
}

export default function FieldShells() {
  useEffect(() => {
    const scan = () => {
      document.querySelectorAll<HTMLElement>(`.rg-content ${SEL}`).forEach((field) => {
        if (field.dataset.rgShellChecked === "1") return;
        const fr = field.getBoundingClientRect();
        if (!fr.width || !fr.height) return; // not laid out yet — try on a later scan
        field.dataset.rgShellChecked = "1";
        let a: HTMLElement | null = field.parentElement;
        for (let i = 0; i < 2 && a && !a.classList.contains("rg-content"); i += 1, a = a.parentElement) {
          if (!bordered(a)) continue;
          const ar = a.getBoundingClientRect();
          const hugs = fr.top - ar.top <= 12 && ar.bottom - fr.bottom <= 12 && fr.left - ar.left <= 48 && ar.right - fr.right <= 64;
          const controls = a.querySelectorAll(SEL).length;
          if (hugs && controls <= 2) {
            a.classList.add("rg-field-shell");
            field.classList.add("rg-field-inner");
          }
          break;
        }
      });
    };
    scan();
    let t: number | null = null;
    const mo = new MutationObserver(() => { if (t) window.clearTimeout(t); t = window.setTimeout(scan, 150); });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); if (t) window.clearTimeout(t); };
  }, []);
  return null;
}
