/**
 * ReqGen v4.7.0: the one code for every send and every decision.
 *
 *   if (!(await confirmWithCode("approve this request"))) return;
 *
 * A 6-digit code goes by SMS and e-mail together; either works. When it is
 * right, the server writes a pass the database checks before the request is
 * sent or moved on. Drawn by <CodeHost /> (mounted once in app/layout.tsx).
 * If a page forgets to ask first, the database refuses with
 * REQGEN_CODE_REQUIRED, and lib/supabaseClient.ts asks for the code and tries
 * again by itself.
 */
export type CodeAsk = { id: number; what: string; purpose: "action" | "sign_in"; resolve: (ok: boolean) => void };
export const CODE_EVENT = "reqgen-code-ask";
let nextId = 1;
let open: Promise<boolean> | null = null;

export function confirmWithCode(what = "confirm this", purpose: "action" | "sign_in" = "action"): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (open) return open; // one box at a time
  open = new Promise<boolean>((resolve) => {
    window.dispatchEvent(new CustomEvent<CodeAsk>(CODE_EVENT, { detail: { id: nextId++, what, purpose, resolve: (ok) => { open = null; resolve(ok); } } }));
  });
  return open;
}

export const CODE_REQUIRED = /REQGEN_CODE_REQUIRED/;
/** The database message without its marker, for showing on screen. */
export function plainCodeError(message: string) {
  return message.replace(/^.*REQGEN_CODE_REQUIRED:\s*/, "");
}
