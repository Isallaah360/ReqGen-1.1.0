import { createContext, useContext } from "react";

/**
 * 3.0.2: every website office page is built into the app and opened inside it.
 * A route is the page address the website uses (for example /finance/subheads?tab=x).
 */
export type OfficeRoute = { href: string; path: string; query: string; params: Record<string, string> };
export type OfficeNav = { open: (href: string) => void; replace: (href: string) => void; back: () => void; refresh: () => void };
export const RouteCtx = createContext<OfficeRoute>({ href: "/", path: "/", query: "", params: {} });
export const NavCtx = createContext<OfficeNav>({ open: () => undefined, replace: () => undefined, back: () => undefined, refresh: () => undefined });
export const useOfficeRoute = () => useContext(RouteCtx);
export const useOfficeNav = () => useContext(NavCtx);

export class RedirectSignal extends Error { constructor(public to: string) { super(`redirect:${to}`); } }

// The website page files, packed into the app and loaded when first opened.
const PAGES = import.meta.glob([
  "../../../../app/dashboard/**/page.tsx", "../../../../app/requests/**/page.tsx", "../../../../app/approvals/**/page.tsx",
  "../../../../app/finance/**/page.tsx", "../../../../app/payment-vouchers/**/page.tsx", "../../../../app/registry/**/page.tsx",
  "../../../../app/reports/**/page.tsx", "../../../../app/audit-centre/**/page.tsx", "../../../../app/workflow/**/page.tsx",
  "../../../../app/admin/**/page.tsx", "../../../../app/profile/**/page.tsx", "../../../../app/developer/**/page.tsx",
  "../../../../app/notifications/**/page.tsx", "../../../../app/credits/**/page.tsx", "../../../../app/forgot-password/**/page.tsx",
  "../../../../app/mfa/**/page.tsx", "../../../../app/change-password/**/page.tsx",
]);

type Entry = { pattern: RegExp; keys: string[]; load: () => Promise<unknown>; dynamic: number; file: string };
const ENTRIES: Entry[] = Object.entries(PAGES).map(([file, load]) => {
  const route = file.replace(/^.*\/app\//, "/").replace(/\/page\.tsx$/, "") || "/";
  const keys: string[] = [];
  const pattern = new RegExp("^" + route.replace(/\[(\.\.\.)?([^\]]+)\]/g, (_m, dots, k) => { keys.push(k); return dots ? "(.+)" : "([^/]+)"; }) + "/?$");
  return { pattern, keys, load, dynamic: keys.length, file };
}).sort((a, b) => a.dynamic - b.dynamic);

export function splitHref(href: string) {
  const clean = href.replace(/^https?:\/\/[^/]+/, "");
  const [pathAndQuery] = clean.split("#");
  const [path, query = ""] = pathAndQuery.split("?");
  return { path: path || "/", query };
}

export function findPage(path: string): { load: () => Promise<unknown>; params: Record<string, string>; file: string } | null {
  for (const e of ENTRIES) {
    const m = path.match(e.pattern);
    if (m) return { load: e.load, params: Object.fromEntries(e.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])), file: e.file };
  }
  return null;
}
export const officePageCount = ENTRIES.length;
