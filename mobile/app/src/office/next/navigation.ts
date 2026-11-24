import { useMemo } from "react";
import { RedirectSignal, useOfficeNav, useOfficeRoute } from "../route";

/** 3.0.2: the website's Next.js navigation, answered by the app's own screen stack. */
export function useRouter() {
  const nav = useOfficeNav();
  return useMemo(() => ({ push: (h: string) => nav.open(h), replace: (h: string) => nav.replace(h), back: () => nav.back(), refresh: () => nav.refresh(), prefetch: () => undefined, forward: () => undefined }), [nav]);
}
export function useSearchParams() {
  const { query } = useOfficeRoute();
  return useMemo(() => new URLSearchParams(query), [query]);
}
export function usePathname() { return useOfficeRoute().path; }
export function useParams<T = Record<string, string>>() { return useOfficeRoute().params as unknown as T; }
export function redirect(to: string): never { throw new RedirectSignal(to); }
export function notFound(): never { throw new Error("This page is not in ReqGen."); }
