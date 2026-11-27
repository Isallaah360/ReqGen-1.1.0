import { Bell, Plus, Send, ShieldCheck, Wallet, FileText } from "lucide-react";
import { db } from "../lib/core";
import { LIST_COLS, useOnline, useSaved, type Req, type DirectWaiting } from "../lib/data";
import { first } from "../lib/text";
import { useApp } from "../App";
import { Avatar, Body, Empty, LoadError, Skeleton, Updated, useNav } from "../ui";
import { ReqRow } from "./parts";
import Notices from "./Notices";
import { VoucherList } from "./office/Vouchers";
import DirectNew from "./DirectNew";
import { AppGrid, useOffices, type AppIcon } from "./Offices";
import AllApps, { moreIcon, pageApps } from "./AllApps";
import { ProfileScreen } from "./Me";

/** The pages most people in an office open first; they fill the home screen's free places. */
const PRIORITY = ["Staff & Positions", "Budget & Subheads", "Departments", "Routing Engine", "Finance Processing", "Voucher Centre", "Vouchers to Sign", "Ready to Pay", "Request Tracking", "Incoming", "Audit Log", "Transactions + Analysis"];

type HomeData = { mine: Req[]; direct: DirectWaiting[]; unread: number; vouchers: number };

export default function Home() {
  const { me, pending, setTab, openNew, refreshPending } = useApp();
  const { push } = useNav();
  const online = useOnline();
  const { data, at, loading, reload, error } = useSaved<HomeData>(`home:${me.id}`, async () => {
    const s = await db();
    const [mine, direct, unread, pv] = await Promise.all([
      s.from("requests").select(LIST_COLS).eq("created_by", me.id).order("created_at", { ascending: false }).limit(5),
      s.rpc("reqgen_direct_waiting"),
      s.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", me.id).eq("is_read", false),
      s.rpc("get_payment_vouchers_assigned_to_me"),
    ]);
    if (mine.error) throw new Error(mine.error.message);
    return { mine: (mine.data || []) as Req[], direct: (direct.data || []) as DirectWaiting[], unread: unread.count || 0, vouchers: pv.error ? 0 : (pv.data || []).length };
  });
  const offices = useOffices();
  const directN = data?.direct.length || 0;
  // 4.2.2: two rows of app icons; the four-squares More icon opens every page (owner, 26 Nov 2026)
  const everyday: AppIcon[] = [
    { key: "new", label: "New request", icon: <span className="app-svg"><Plus size={28} strokeWidth={2.4} /></span>, color: "#F9A11F", onClick: openNew },
    { key: "approvals", label: "Approvals", icon: <span className="app-svg"><ShieldCheck size={28} /></span>, color: "#146185", badge: pending, onClick: () => setTab("approvals") },
    { key: "direct", label: "Direct", icon: <span className="app-svg"><Send size={26} /></span>, color: "#31A8E0", onClick: () => push(<DirectNew />) },
    { key: "vouchers", label: "My vouchers", icon: <span className="app-svg"><Wallet size={28} /></span>, color: "#F47824", badge: data?.vouchers || 0, onClick: () => push(<VoucherList mode="mine" />) },
    { key: "requests", label: "My requests", icon: <span className="app-svg"><FileText size={28} /></span>, color: "#31A8E0", onClick: () => setTab("requests") },
    { key: "notices", label: "Notices", icon: <span className="app-svg"><Bell size={28} /></span>, color: "#7C4B03", badge: data?.unread || 0, onClick: () => push(<Notices meId={me.id} onRead={() => void reload()} />) },
  ];
  const pages = pageApps(offices, push).flatMap((g) => g.apps);
  const seen = new Set(["New Request", "My Requests", "Requests to Approve"]);
  const ranked = [...PRIORITY.map((t) => pages.find((a) => a.label === t)).filter((a): a is AppIcon => !!a), ...pages]
    .filter((a) => (seen.has(a.label) ? false : (seen.add(a.label), true)));
  const all = [...everyday, ...ranked];
  const home = all.length > 8 ? [...everyday.slice(0, 4), ...ranked.slice(0, 3), { key: "more", label: "More", icon: moreIcon, color: "#146185", onClick: () => push(<AllApps everyday={everyday} />) }] : all;
  const routedN = Math.max(0, pending - directN);
  return (
    <>
      <div className="hello">
        <button type="button" className="av-btn" aria-label="Your profile" onClick={() => push(<ProfileScreen />)}><Avatar name={me.full_name} url={me.avatar_url} /></button>
        <span className="who"><small>Assalamu alaikum</small><b>{me.full_name}</b></span>
        <button type="button" className="ib" aria-label={data?.unread ? `Notices, ${data.unread} new` : "Notices"} onClick={() => push(<Notices meId={me.id} onRead={() => void reload()} />)}>
          <Bell size={21} />{data?.unread ? <span className="dot" /> : null}
        </button>
      </div>
      <Body tabs onRefresh={async () => { await Promise.all([reload(), refreshPending()]); }}>
        <LoadError error={error} />
        <div className="hero">
          <small>Waiting for you</small>
          <b>{pending}</b>
          <span>{pending ? [routedN ? `${routedN} ${routedN === 1 ? "request" : "requests"}` : "", directN ? `${directN} direct ${directN === 1 ? "message" : "messages"}` : ""].filter(Boolean).join(" and ") : `Nothing to approve, ${first(me.full_name)}.`}</span>
          {pending ? <button type="button" className="btn bp sm" onClick={() => setTab("approvals")}>Open Approvals</button> : null}
        </div>
        <div className="sect"><b>Your apps</b>{all.length > 8 ? <button type="button" className="link" onClick={() => push(<AllApps everyday={everyday} />)}>See all</button> : null}</div>
        <AppGrid label="Your apps" items={home} />
        <div className="sect"><b>My requests</b><button type="button" className="link" onClick={() => setTab("requests")}>See all</button></div>
        {loading && !data ? <Skeleton /> : data && data.mine.length ? (
          <div className="grp">{data.mine.map((r) => <ReqRow key={r.id} r={r} meId={me.id} />)}</div>
        ) : <div className="grp"><Empty icon={<FileText size={28} />} title="No requests yet" text="Tap New to send your first request." /></div>}
        <Updated at={at} offline={!online} />
      </Body>
    </>
  );
}
