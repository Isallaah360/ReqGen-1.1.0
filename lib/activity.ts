/**
 * ReqGen v3.1.3 — global "work in progress" tracker for the loading strip.
 * Every Supabase request goes through trackedFetch (lib/supabaseClient.ts),
 * so the strip shows whenever ReqGen is loading or saving anything — not only
 * on route changes. Background HEAD count checks are ignored.
 */
type Listener = (busy: boolean) => void;
let inFlight = 0;
const listeners = new Set<Listener>();
const emit = () => { const busy = inFlight > 0; listeners.forEach((l) => l(busy)); };

export function subscribeActivity(fn: Listener) {
  listeners.add(fn);
  fn(inFlight > 0);
  return () => { listeners.delete(fn); };
}

export function beginActivity() { inFlight += 1; emit(); }
export function endActivity() { inFlight = Math.max(0, inFlight - 1); emit(); }

export const trackedFetch: typeof fetch = async (input, init) => {
  const method = (init?.method || (typeof input === "object" && "method" in input ? input.method : "GET") || "GET").toUpperCase();
  const silent = method === "HEAD";
  if (!silent) beginActivity();
  try {
    return await fetch(input, init);
  } finally {
    if (!silent) endActivity();
  }
};
