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
import { OfficeList, useOffices } from "./Offices";

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
  const routedN = Math.max(0, pending - directN);
  return (
    <>
      <div className="hello">
        <Avatar name={me.full_name} url={me.avatar_url} />
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
        <div className="qa">
          <button type="button" onClick={openNew}><span style={{ color: "var(--ort)" }}><Plus size={24} strokeWidth={2.4} /></span>New request</button>
          <button type="button" onClick={() => push(<DirectNew />)}><span style={{ color: "var(--in)" }}><Send size={22} /></span>Direct</button>
          <button type="button" onClick={() => setTab("approvals")}><span style={{ color: "var(--ok)" }}><ShieldCheck size={22} /></span>Approvals</button>
          <button type="button" onClick={() => push(<VoucherList mode="mine" />)}><span style={{ color: "var(--wa)" }}><Wallet size={22} /></span>Vouchers{data?.vouchers ? ` (${data.vouchers})` : ""}</button>
        </div>
        <div className="sect"><b>My requests</b><button type="button" className="link" onClick={() => setTab("requests")}>See all</button></div>
        {loading && !data ? <Skeleton /> : data && data.mine.length ? (
          <div className="grp">{data.mine.map((r) => <ReqRow key={r.id} r={r} meId={me.id} />)}</div>
        ) : <div className="grp"><Empty icon={<FileText size={28} />} title="No requests yet" text="Tap New to send your first request." /></div>}
        {offices.length ? <><div className="sect"><b>Your offices</b></div><OfficeList /></> : null}
        <Updated at={at} offline={!online} />
      </Body>
    </>
  );
}
