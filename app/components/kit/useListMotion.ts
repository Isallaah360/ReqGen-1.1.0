"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";

/**
 * ReqGen v4.6.12: new items slide into a list and removed ones fade out
 * (auto-animate, 240 ms, transform and opacity only). It follows the
 * phone's "reduce motion" setting and is off on low-power phones.
 */
export function useListMotion<T extends Element>() {
  const [ref, enable] = useAutoAnimate<T>({ duration: 240, easing: "cubic-bezier(.2, .8, .2, 1)" });
  if (typeof document !== "undefined" && document.documentElement.classList.contains("v4-low-power")) enable(false);
  return ref;
}
