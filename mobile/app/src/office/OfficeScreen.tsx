import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { useNav, Head, Note, Skeleton } from "../ui";
import { RouteCtx, NavCtx, RedirectSignal, findPage, splitHref, type OfficeNav, type OfficeRoute } from "./route";
import { MODULES } from "../lib/web";
import "./web.css";

/**
 * 3.0.2: an office page, inside the app. It is the website's own page (packed in the APK, the same
 * data, rules and buttons), drawn in the app's frame: the app header with Back, no website menu.
 * Links inside it open the next page inside the app. Nothing opens the website.
 */
const TITLES: Record<string, string> = Object.fromEntries(MODULES.flatMap((m) => [[m.href, m.label], ...m.tiles.map((t) => [t.href.split("#")[0], t.title])]));
const cache = new Map<string, ComponentType<PageProps>>();

type PageProps = { params: Promise<Record<string, string>>; searchParams: Promise<Record<string, string>> };
function pageFor(path: string): { Page: ComponentType<PageProps>; params: Record<string, string> } | null {
  const found = findPage(path);
  if (!found) return null;
  let Page = cache.get(found.file);
  if (!Page) {
    Page = lazy(found.load as () => Promise<{ default: ComponentType<PageProps> }>);
    cache.set(found.file, Page);
  }
  return { Page, params: found.params };
}

type Override = (href: string, nav: { push: (n: ReactNode) => void; replace: (n: ReactNode) => void }) => boolean;
let override: Override | null = null;
/** The app's own native screens (request details, new request) take these addresses first. */
export function setOfficeOverride(fn: Override) { override = fn; }

/** True when the app's own screen took the address. */
export function tryOverride(href: string, nav: { push: (n: ReactNode) => void; replace: (n: ReactNode) => void }) { return !!override && override(href, nav); }

const PATTERN_TITLES: Array<[RegExp, string]> = [
  [/^\/payment-vouchers\/[^/]+\/print\/?$/, "Print voucher"],
  [/^\/requests\/[^/]+\/print\/?$/, "Print request"],
  [/^\/requests\/[^/]+\/edit\/?$/, "Edit request"],
  [/^\/payment-vouchers\/print-centre\/batch\/?$/, "Print vouchers"],
  [/^\/reports\/print\/?$/, "Print report"],
];
export function titleFor(path: string) {
  return TITLES[path] || PATTERN_TITLES.find(([re]) => re.test(path))?.[1] || "";
}

export default function OfficeScreen({ href, title }: { href: string; title?: string }) {
  const nav = useNav();
  const [cur, setCur] = useState(href);
  const [pageTitle, setPageTitle] = useState("");
  const box = useRef<HTMLDivElement>(null);
  // the header shows the page's own title (a voucher number, a person's name) when the address has no fixed name
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => { const h = el.querySelector(".v4-page-title, .v4-page-head h1"); const t = (h?.textContent || "").trim(); if (t) setPageTitle(t); };
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, [cur]);
  const [key, setKey] = useState(0);
  const { path, query } = splitHref(cur);
  const found = useMemo(() => pageFor(path), [path]);
  const route: OfficeRoute = useMemo(() => ({ href: cur, path, query, params: found?.params || {} }), [cur, path, query, found]);
  // Next.js gives pages their address parts as promises (params, searchParams); the same here, made once per address
  const props = useMemo(() => ({ params: Promise.resolve(route.params), searchParams: Promise.resolve(Object.fromEntries(new URLSearchParams(route.query))) }), [route]);
  const open = useCallback((h: string) => {
    if (override && override(h, nav)) return;
    nav.push(<OfficeScreen href={h} />);
  }, [nav]);
  const officeNav: OfficeNav = useMemo(() => ({
    open,
    replace: (h: string) => { if (override && override(h, { push: nav.replace, replace: nav.replace })) return; setCur(h); },
    back: () => nav.pop(),
    refresh: () => setKey((k) => k + 1),
  }), [open, nav]);
  return (
    <>
      <Head title={title || titleFor(path) || pageTitle || "ReqGen"} />
      <div className="body office-body">
        <RouteCtx.Provider value={route}>
          <NavCtx.Provider value={officeNav}>
            <div className="webui v4-root v4-ui" ref={box}>
              <Boundary key={`${cur}#${key}`} onRedirect={(to) => setCur(to)}>
                <Suspense fallback={<Skeleton rows={5} />}>
                  {found ? <found.Page {...props} /> : <Note tone="er" icon={<CircleAlert size={16} />}>This page is not in the app yet.</Note>}
                </Suspense>
              </Boundary>
            </div>
          </NavCtx.Provider>
        </RouteCtx.Provider>
      </div>
    </>
  );
}

class Boundary extends Component<{ children: ReactNode; onRedirect: (to: string) => void }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) {
    if (error instanceof RedirectSignal) queueMicrotask(() => this.props.onRedirect(error.to));
  }
  render() {
    const e = this.state.error;
    if (!e) return this.props.children;
    if (e instanceof RedirectSignal) return <Skeleton rows={3} />;
    return <Note tone="er" icon={<CircleAlert size={16} />}>This page could not open: {e.message}. Go back and try again.</Note>;
  }
}
