"use client";

import { useEffect, useState } from "react";
import type { DotLottie } from "@lottiefiles/dotlottie-react";

/**
 * ReqGen v4.6.12 (Kit K9): the success tick.
 *
 * A dotLottie tick (our own animation, public/kit/tick.json) that plays once
 * in 1.2 s with no sound. The player and its engine (public/kit, self-hosted)
 * load only after the page is idle, never with the page itself, and never on
 * low-power phones, Data Saver or reduced motion. Until it is ready the same
 * tick is drawn with plain SVG, so nothing ever waits for it.
 */
type Player = (props: { src: string; autoplay?: boolean; loop?: boolean; className?: string; style?: React.CSSProperties; dotLottieRefCallback?: (d: DotLottie | null) => void }) => React.ReactNode;

let Player: Player | null = null;
let warming: Promise<void> | null = null;

function quiet() {
  if (typeof window === "undefined") return true;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    || document.documentElement.classList.contains("v4-low-power")
    || !!nav.connection?.saveData;
}

/** Loads the player in the background (once). */
export function warmSuccessTick() {
  if (Player || warming || quiet()) return warming;
  warming = import("@lottiefiles/dotlottie-react").then((mod) => {
    mod.setWasmUrl("/kit/dotlottie-player.wasm");
    Player = mod.DotLottieReact as unknown as Player;
  }).catch(() => { warming = null; });
  return warming;
}

export function CssTick() {
  return (
    <svg className="k-tick" viewBox="0 0 120 120" aria-hidden="true">
      <circle className="k-tick-c" cx="60" cy="60" r="52" fill="#1E7A4C" />
      <path className="k-tick-p" d="M39 62l14 14 29-30" fill="none" stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SuccessTick() {
  const [ready, setReady] = useState(false);
  const [P] = useState<Player | null>(() => (quiet() ? null : Player));
  useEffect(() => { if (!P) void warmSuccessTick(); }, [P]);
  if (!P) return <CssTick />;
  return (
    <span className="k-tick k-tick-wrap">
      {!ready ? <CssTick /> : null}
      <P src="/kit/tick.json" autoplay loop={false} className="k-tick-lottie" style={{ opacity: ready ? 1 : 0 }}
        dotLottieRefCallback={(d) => { d?.addEventListener("load", () => setReady(true)); }} />
    </span>
  );
}
