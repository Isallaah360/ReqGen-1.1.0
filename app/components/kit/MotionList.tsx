"use client";

import type { ReactNode } from "react";
import { useListMotion } from "./useListMotion";

/** ReqGen v4.6.12: a <ul> whose new items slide in (see useListMotion). */
export default function MotionList({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useListMotion<HTMLUListElement>();
  return <ul className={className} ref={ref}>{children}</ul>;
}
