import { useEffect } from "react";
import DialogHost from "@/app/components/ui/DialogHost";
import WebToastHost from "@/app/components/kit/ToastHost";
import TableCards from "@/app/components/TableCards";
import { useNav } from "../ui";
import OfficeScreen, { setOfficeOverride, tryOverride } from "./OfficeScreen";
import { splitHref } from "./route";
import Detail from "../screens/Detail";
import { useApp } from "../App";

/**
 * 3.0.2: the website's dialog box, its toast and its "tables become cards" helper, for the office pages,
 * and the addresses the app answers with its own screens (a request's details, a new request).
 */
export default function OfficeHosts() {
  const nav = useNav();
  const { me, openNew, setTab, signOut } = useApp();
  useEffect(() => {
    setOfficeOverride((href, n) => {
      const { path, query } = splitHref(href);
      if (/(^|&)full=1/.test(query)) return false;
      if (path === "/requests/new") { openNew(); return true; }
      if (path === "/approvals" || path === "/approvals/inbox") { nav.popAll(); setTab("approvals"); return true; }
      if (path === "/requests" || path === "/requests/mine") { nav.popAll(); setTab("requests"); return true; }
      if (path === "/dashboard" || path === "/") { nav.popAll(); setTab("home"); return true; }
      const m = path.match(/^\/requests\/([0-9a-f-]{36})\/?$/i);
      if (m) { n.push(<Detail id={m[1]} meId={me.id} />); return true; }
      return false;
    });
    // a page that sends the whole browser somewhere: sign-in means sign out of the app; anything else opens in the app
    (window as unknown as { __rgGo?: (h: string | URL) => void }).__rgGo = (h) => {
      const u = new URL(String(h), "https://localhost");
      if (u.pathname.startsWith("/login") || u.pathname.startsWith("/unauthorized")) { nav.popAll(); void signOut(); return; }
      const href = u.pathname + u.search;
      nav.popAll();
      if (!tryOverride(href, nav)) nav.push(<OfficeScreen href={href} />);
    };
    // test hook for the automatic checks (only on the test address, never in the phone app)
    if (window.location.port === "3200") (window as unknown as { __rgOpen?: (h: string) => void }).__rgOpen = (h: string) => nav.push(<OfficeScreen href={h} />);
  }, [nav, me.id, openNew, setTab, signOut]);
  return (
    <div style={{ display: "contents" }}>
      <DialogHost />
      <WebToastHost />
      <TableCards />
    </div>
  );
}

/** Before sign-in (forgot password, setting up 2FA): the same dialog and toast; going "home" comes back to sign-in. */
export function SignInHosts() {
  const nav = useNav();
  useEffect(() => {
    setOfficeOverride((href) => {
      const { path } = splitHref(href);
      if (/^\/(dashboard|login|app)?\/?$/.test(path) || path === "/") { nav.popAll(); return true; }
      return false;
    });
    (window as unknown as { __rgGo?: (h: string | URL) => void }).__rgGo = () => nav.popAll();
  }, [nav]);
  return (
    <div style={{ display: "contents" }}>
      <DialogHost />
      <WebToastHost />
    </div>
  );
}
