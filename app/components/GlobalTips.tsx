"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type TipState = { text: string; left: number; top: number; width: number } | null;

function targetFrom(node: EventTarget | null) {
  if (!(node instanceof Element)) return null;
  return node.closest<HTMLElement>("[data-tip]");
}

export default function GlobalTips() {
  const pathname = usePathname();
  const [tip, setTip] = useState<TipState>(null);

  useEffect(() => {
    let timer: number | undefined;

    const hide = () => {
      window.clearTimeout(timer);
      setTip(null);
    };

    const show = (element: HTMLElement) => {
      const text = element.getAttribute("data-tip")?.trim();
      if (!text) return;

      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const rect = element.getBoundingClientRect();
        const width = Math.min(320, Math.max(220, rect.width + 80));
        const left = Math.min(
          window.innerWidth - width - 12,
          Math.max(12, rect.left + rect.width / 2 - width / 2)
        );
        const below = rect.bottom + 10;
        const top = below + 88 < window.innerHeight ? below : Math.max(12, rect.top - 94);
        setTip({ text, left, top, width });
      }, 500);
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
  }, [pathname]);

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
