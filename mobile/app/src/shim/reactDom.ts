// 3.0.2: the website's pop-ups (dialogs, modals, lists, toasts) are drawn into one layer that carries the
// website's look (".webui") without covering the app. Everything else in react-dom is unchanged.
import * as RD from "react-dom";
import type { ReactNode } from "react";

let layer: HTMLElement | null = null;
function webLayer() {
  if (layer && document.body.contains(layer)) return layer;
  layer = document.createElement("div");
  layer.className = "webui v4-root v4-ui webui-layer";
  document.body.appendChild(layer);
  return layer;
}
export function createPortal(children: ReactNode, container: Element | DocumentFragment, key?: string | null) {
  const target = typeof document !== "undefined" && container === document.body ? webLayer() : container;
  return RD.createPortal(children, target, key);
}
export const { flushSync, preconnect, prefetchDNS, preinit, preinitModule, preload, preloadModule, requestFormReset, unstable_batchedUpdates, useFormState, useFormStatus, version } = RD as unknown as Record<string, never>;
export default { ...RD, createPortal };
