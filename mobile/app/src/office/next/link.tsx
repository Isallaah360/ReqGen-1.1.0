import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from "react";
import { useOfficeNav } from "../route";
import { openOutside } from "../../lib/core";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string | { pathname?: string; query?: Record<string, string> }; children?: ReactNode; prefetch?: boolean; replace?: boolean; scroll?: boolean };

/** 3.0.2: a website link opens the page inside the app (never the website). */
const Link = forwardRef<HTMLAnchorElement, Props>(function Link({ href, children, onClick, prefetch: _p, replace, scroll: _s, ...rest }, ref) {
  const nav = useOfficeNav();
  const to = typeof href === "string" ? href : `${href.pathname || "/"}${href.query ? `?${new URLSearchParams(href.query).toString()}` : ""}`;
  return (
    <a ref={ref} href={to} {...rest} onClick={(e) => {
      onClick?.(e);
      if (e.defaultPrevented) return;
      e.preventDefault();
      if (/^(mailto:|tel:|https?:\/\/(?!ietreqgen))/i.test(to)) { openOutside(to); return; }
      if (replace) nav.replace(to); else nav.open(to);
    }}>{children}</a>
  );
});
export default Link;
