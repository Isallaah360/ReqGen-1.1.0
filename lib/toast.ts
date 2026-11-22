/**
 * ReqGen v4.6.12 (Kit K4): the centred toast.
 *
 *   toast({ text: "Approved. Saving in the background." })
 *   toast({ text: "Draft deleted.", undo: () => restore() })
 *   toast({ text: "Not saved: the network dropped. Your approval was undone.", tone: "error" })
 *
 * It shows in the centre for 2.5 s (4 s when there is an Undo or an error)
 * and then leaves. Clicks pass through everything except its own button.
 * Drawn by <ToastHost /> (mounted once in app/layout.tsx).
 */
export type ToastTone = "info" | "success" | "error";
export type Toast = { id: number; text: string; tone: ToastTone; undo?: () => void; undoLabel?: string };

export const TOAST_EVENT = "reqgen-toast";
let nextId = 1;

export function toast(t: { text: string; tone?: ToastTone; undo?: () => void; undoLabel?: string }) {
  if (typeof window === "undefined") return;
  const detail: Toast = { id: nextId++, text: t.text, tone: t.tone || "success", undo: t.undo, undoLabel: t.undoLabel };
  window.dispatchEvent(new CustomEvent<Toast>(TOAST_EVENT, { detail }));
}

export const TOAST_CLEAR_EVENT = "reqgen-toast-clear";
/** Takes the toast away at once (for example when the success moment shows). */
export function clearToast() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TOAST_CLEAR_EVENT));
}
