"use client";

import { useEffect, useState } from "react";

type TipState = { text: string; left: number; top: number; width: number } | null;

export default function GlobalTips() {
  const [tip, setTip] = useState<TipState>(null);

  useEffect(() => {
    let timer: number | undefined;

    const show = (element: HTMLElement) => {
      const text = element.getAttribute("data-tip");
      if (!text) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const rect = element.getBoundingClientRect();
        const width = Math.min(320, Math.max(220, rect.width));
        const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.left + rect.width / 2 - width / 2));
        const top = rect.bottom + 86 < window.innerHeight ? rect.bottom + 10 : Math.max(12, rect.top - 82);
        setTip({ text, left, top, width });
      }, 500);
    };

    const hide = () => {
      window.clearTimeout(timer);
      setTip(null);
    };

    const onOver = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      const target = event.target.closest<HTMLElement>("[data-tip]");
      if (target) show(target);
    };

    const onFocus = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      const target = event.target.closest<HTMLElement>("[data-tip]");
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
  }, []);

  if (!tip) return null;

  return (
    <div className="reqgen-global-tip" style={{ left: tip.left, top: tip.top, width: tip.width }} role="tooltip">
      <span className="reqgen-global-tip-icon" aria-hidden="true">i</span>
      <span>{tip.text}</span>
    </div>
  );
}
