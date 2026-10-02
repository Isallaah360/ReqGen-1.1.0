"use client";

import { useEffect } from "react";

/**
 * v3.0.10/v3.1.2: on phones every data table is read as stacked cards; on
 * laptops genuine long-text columns are marked so only they may wrap —
 * each cell is labelled with its column name, so no table ever needs sideways
 * scrolling. Opt a table out with data-no-cards (e.g. print layouts).
 */
export default function TableCards() {
  useEffect(() => {
    const label = (table: HTMLTableElement) => {
      if (table.dataset.noCards !== undefined || table.closest("[data-no-cards], .rg-print, [class*=print]")) return;
      const heads = Array.from(table.querySelectorAll("thead th")).map((th) => (th.textContent || "").trim());
      if (!heads.length) return;
      table.classList.add("rg-cards");
      // v3.1.2: no forced widths. Only genuine long-text columns are marked so
      // they may wrap; every other cell stays on one line (table CSS standard).
      const ths = Array.from(table.querySelectorAll("thead th")) as HTMLElement[];
      heads.forEach((head, i) => {
        const isText = /description|narration|comment|remark|purpose|justification|details?$|note|reason/i.test(head) && !/^details?$/i.test(head.trim());
        const cells = Array.from(table.querySelectorAll(`tbody tr > :nth-child(${i + 1})`)) as HTMLElement[];
        [ths[i], ...cells].forEach((el) => {
          if (!el) return;
          el.classList.remove("rg-col-grow", "rg-col-fit");
          el.classList.toggle("rg-col-text", isText);
        });
      });
      table.querySelectorAll("tbody tr").forEach((tr) => {
        Array.from(tr.children).forEach((cell, i) => {
          const el = cell as HTMLTableCellElement;
          const want = heads[i] || "";
          if (el.dataset.label !== want) el.dataset.label = want;
          if (el.colSpan > 1) el.dataset.span = "1";
        });
      });
    };
    const scan = () => document.querySelectorAll<HTMLTableElement>(".rg-content table").forEach(label);
    scan();
    let t: number | null = null;
    const mo = new MutationObserver(() => { if (t) window.clearTimeout(t); t = window.setTimeout(scan, 120); });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); if (t) window.clearTimeout(t); };
  }, []);
  return null;
}
