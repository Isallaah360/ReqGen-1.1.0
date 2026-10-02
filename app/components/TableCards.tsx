"use client";

import { useEffect } from "react";

/**
 * v3.0.10/v3.1.1: on phones every data table is read as stacked cards, and on
 * laptops columns auto-fit (short columns tight, name columns roomy) —
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
      // v3.1.1 auto-fit: short columns take only what they need; name/text
      // columns receive the freed space and wrap instead of being cut off.
      const rows = Array.from(table.querySelectorAll("tbody tr"));
      heads.forEach((head, i) => {
        const cells = rows.map((tr) => tr.children[i] as HTMLElement | undefined).filter(Boolean) as HTMLElement[];
        const th = table.querySelectorAll("thead th")[i] as HTMLElement | undefined;
        if (!th || !cells.length) return;
        const longest = Math.max(head.length, ...cells.map((c) => (c.innerText || "").split("\n").reduce((m, l) => Math.max(m, l.trim().length), 0)));
        const isText = /name|user|officer|requester|actor|title|description|purpose|subhead|department|beneficiary|narration|details?$|remark|comment/i.test(head) && !/^details$/i.test(head);
        const kind = isText ? "rg-col-grow" : longest <= 16 ? "rg-col-fit" : "";
        [th, ...cells].forEach((el) => {
          el.classList.remove("rg-col-grow", "rg-col-fit");
          if (kind) el.classList.add(kind);
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
