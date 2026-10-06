"use client";

import { useEffect, type RefObject } from "react";

/**
 * ReqGen v3.1.6 — A4 document standard.
 *
 * Every printable document (request, payment voucher) is ONE .rg-a4-page:
 * exactly 210 x 297 mm with fixed margins. Inside it, .rg-a4-content holds the
 * document. useA4Fit() measures the content and
 *   - when it is longer than the page, scales it down uniformly (never below
 *     72%) so the whole document always fits on one A4 sheet;
 *   - when it is shorter, stretches the flexible areas (.rg-a4-grow) so the
 *     document fills the page with signatures at the foot, never squeezed.
 *
 * printA4Sheet() prints the page in an isolated frame: only the document and
 * the app's stylesheets, A4 paper with zero browser margins. The app frame
 * (sidebar, top bar, 90% laptop scale, dark theme) can never affect paper.
 */

const MIN_SCALE = 0.72;

export function fitA4(page: HTMLElement | null) {
  if (!page) return;
  const content = page.querySelector<HTMLElement>(".rg-a4-content");
  if (!content) return;
  const style = window.getComputedStyle(page);
  const innerH = page.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  if (innerH <= 0) return;

  content.style.zoom = "1";
  content.style.minHeight = "0px";
  // Measure with on-screen rectangles so an ancestor zoom (the app frame's
  // laptop scale) cannot distort the ratio between content and page.
  const pageBox = page.getBoundingClientRect();
  const contentBox = content.getBoundingClientRect();
  const innerVisual = pageBox.height * (innerH / page.clientHeight);
  const ratio = innerVisual > 0 ? contentBox.height / innerVisual : 1;
  const scale = ratio > 1 ? Math.max(MIN_SCALE, 1 / ratio) : 1;
  content.style.zoom = String(Number(scale.toFixed(4)));
  content.style.minHeight = `${Math.floor(innerH / scale)}px`;
  page.dataset.a4Scale = scale.toFixed(2);
}

/** Keeps a document fitted to A4 whenever its data or size changes. */
export function useA4Fit(ref: RefObject<HTMLElement | null>, deps: unknown[]) {
  useEffect(() => {
    const page = ref.current;
    if (!page) return;
    fitA4(page);
    const late = window.setTimeout(() => fitA4(page), 350);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      let frame = 0;
      observer = new ResizeObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => fitA4(page));
      });
      const content = page.querySelector(".rg-a4-content");
      if (content) observer.observe(content);
    }
    return () => {
      window.clearTimeout(late);
      observer?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callers pass the data the document renders
  }, deps);
}

function waitForImages(doc: Document, timeoutMs = 4000) {
  const images = Array.from(doc.images);
  return Promise.race([
    Promise.all(
      images.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
            }),
      ),
    ),
    new Promise((resolve) => window.setTimeout(resolve, timeoutMs)),
  ]);
}

function waitForStyles(doc: Document, timeoutMs = 4000) {
  const links = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
  return Promise.race([
    Promise.all(
      links.map((link) =>
        link.sheet
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              link.addEventListener("load", () => resolve(), { once: true });
              link.addEventListener("error", () => resolve(), { once: true });
            }),
      ),
    ),
    new Promise((resolve) => window.setTimeout(resolve, timeoutMs)),
  ]);
}

/** Print one .rg-a4-page on A4 paper through an isolated frame. */
export async function printA4Sheet(page: HTMLElement | null, title = "ReqGen document") {
  if (!page) return;
  fitA4(page);

  const head = Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style'))
    .map((node) => node.outerHTML)
    .join("\n");
  const base = `<base href="${window.location.origin}/">`;
  const paper = `<style>
    @page { size: A4 portrait; margin: 0; }
    html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; zoom: 1 !important; }
    body::before, body::after { display: none !important; }
    .rg-a4-stage { padding: 0 !important; background: #fff !important; overflow: visible !important; }
    .rg-a4-page { margin: 0 !important; box-shadow: none !important; border-radius: 0 !important; }
  </style>`;

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    window.print();
    return;
  }

  doc.open();
  doc.write(`<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><title>${title.replace(/</g, "")}</title>${base}${head}${paper}</head><body><div class="rg-a4-stage">${page.outerHTML}</div></body></html>`);
  doc.close();

  await waitForStyles(doc);
  await waitForImages(doc);
  await new Promise((resolve) => window.setTimeout(resolve, 120));

  const cleanup = () => window.setTimeout(() => frame.remove(), 500);
  win.addEventListener("afterprint", cleanup, { once: true });
  win.focus();
  win.print();
  window.setTimeout(() => { if (document.body.contains(frame)) frame.remove(); }, 60000);
}
