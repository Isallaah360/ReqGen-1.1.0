import { useMemo, useState } from "react";
import { FileText, Search, Send, PenLine } from "lucide-react";
import { db } from "../lib/core";
import { LIST_COLS, useOnline, useSaved, type Req } from "../lib/data";
import { ago, naira, statusChip } from "../lib/text";
import { useApp } from "../App";
import { Big, Body, Cell, Chip, Empty, Seg, Skeleton, Updated, useNav } from "../ui";
import { ReqRow } from "./parts";
import NewRequest, { type Draft } from "./NewRequest";

type Tab = "mine" | "direct" | "drafts";
type F = "all" | "open" | "back" | "done";

export default function Requests() {
  const { me } = useApp();
  const { push } = useNav();
  const online = useOnline();
  const [tab, setTab] = useState<Tab>("mine");
  const [q, setQ] = useState("");
  const [f, setF] = useState<F>("all");

  const mine = useSaved<Req[]>(`mine:${me.id}`, async () => {
    const { data, error } = await (await db()).from("requests").select(LIST_COLS).eq("created_by", me.id).order("created_at", { ascending: false }).limit(300);
    if (error) throw new Error(error.message);
    return (data || []) as Req[];
  });
  const received = useSaved<Req[]>(tab === "direct" ? `direct-in:${me.id}` : null, async () => {
    const s = await db();
    const { data: ids } = await s.from("reqgen_direct_recipients").select("request_id").eq("user_id", me.id).limit(300);
    const list = (ids || []).map((x: { request_id: string }) => x.request_id);
    if (!list.length) return [];
    const { data, error } = await s.from("requests").select(LIST_COLS).in("id", list).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []) as Req[];
  });
  const drafts = useSaved<Draft[]>(tab === "drafts" ? `drafts:${me.id}` : null, async () => {
    const { data, error } = await (await db()).from("reqgen_request_drafts").select("id,request_type,personal_category,dept_id,subhead_id,title,details,amount,attachments,updated_at,expires_at").gt("expires_at", new Date().toISOString()).order("updated_at", { ascending: false });
    if (error) { if (/does not exist|schema cache|could not find/i.test(error.message)) return []; throw new Error(error.message); }
    return (data || []) as Draft[];
  });

  const rows = useMemo(() => {
    const base = tab === "mine" ? (mine.data || []).filter((r) => !r.direct_to && !/sent directly|answered/i.test(String(r.status || "")))
      : [...(mine.data || []).filter((r) => r.direct_to || /sent directly|answered/i.test(String(r.status || ""))), ...(received.data || [])];
    const seen = new Set<string>();
    const t = q.trim().toLowerCase();
    return base.filter((r) => {
      if (seen.has(r.id)) return false; seen.add(r.id);
      const c = statusChip(r).text;
      if (f === "open" && !["In approval", "Sent", "With Account", "Direct", "Approved"].includes(c)) return false;
      if (f === "back" && c !== "Back with me") return false;
      if (f === "done" && !["Paid", "Completed", "Answered"].includes(c)) return false;
      return !t || `${r.request_no} ${r.title} ${r.requester_name}`.toLowerCase().includes(t);
    }).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }, [tab, mine.data, received.data, q, f]);

  const cur = tab === "drafts" ? drafts : tab === "direct" ? received : mine;
  const filters: Array<{ k: F; label: string }> = [{ k: "all", label: "All" }, { k: "open", label: "In approval" }, { k: "back", label: "Back with me" }, { k: "done", label: "Paid or done" }];
  return (
    <>
      <Big>Requests</Big>
      <Body tabs onRefresh={async () => { await Promise.all([mine.reload(), tab === "direct" ? received.reload() : null, tab === "drafts" ? drafts.reload() : null]); }}>
        <Seg value={tab} onChange={(v) => { setTab(v); setF("all"); }} items={[{ k: "mine", label: "Mine" }, { k: "direct", label: "Direct" }, { k: "drafts", label: "Drafts" }]} />
        {tab !== "drafts" ? (
          <>
            <label className="pill"><Search size={18} aria-hidden="true" /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search number or title" aria-label="Search number or title" /></label>
            <div className="filters" role="group" aria-label="Show">
              {filters.map((x) => <button key={x.k} type="button" aria-pressed={f === x.k} onClick={() => setF(x.k)}>{x.label}{x.k === "all" ? ` ${rows.length && f === "all" ? rows.length : ""}`.trimEnd() : ""}</button>)}
            </div>
            {(cur.loading && !cur.data) || (tab === "direct" && mine.loading && !mine.data) ? <Skeleton rows={4} /> : rows.length ? (
              <div className="grp">{rows.map((r) => <ReqRow key={r.id} r={r} meId={me.id} sub={tab === "direct" && r.created_by !== me.id ? `${r.request_no || ""}, from ${r.requester_name || "a colleague"}, ${ago(r.created_at)}` : undefined} />)}</div>
            ) : <Empty icon={tab === "direct" ? <Send size={28} /> : <FileText size={28} />} title={q || f !== "all" ? "Nothing matches" : tab === "direct" ? "No direct requests" : "No requests yet"} text={q || f !== "all" ? "Try another word or filter." : tab === "direct" ? "Direct requests you send or receive show here." : "Tap New to send your first request."} />}
          </>
        ) : drafts.loading && !drafts.data ? <Skeleton /> : drafts.data && drafts.data.length ? (
          <div className="grp">
            {drafts.data.map((d) => <Cell key={d.id} icon={<PenLine size={18} />} iconTone="mu" title={d.title || "Untitled draft"} sub={`${d.request_type || "Official"}${Number(d.amount) > 0 ? `, ${naira(d.amount)}` : ""}, saved ${ago(d.updated_at)}`} right={<Chip tone="mu">Draft</Chip>} onClick={() => push(<NewRequest kind={d.request_type === "Personal" ? "Personal" : "Official"} draft={d} />)} />)}
          </div>
        ) : <Empty icon={<PenLine size={28} />} title="No drafts" text="A request you save without sending is kept here for 60 days." />}
        <Updated at={cur.at} offline={!online} />
      </Body>
    </>
  );
}
