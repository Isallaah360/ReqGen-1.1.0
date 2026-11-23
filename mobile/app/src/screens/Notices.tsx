import { Bell, Check, CornerUpLeft, X, Wallet, Info } from "lucide-react";
import { db } from "../lib/core";
import { useOnline, useSaved } from "../lib/data";
import { ago } from "../lib/text";
import { Body, Cell, Empty, Head, Skeleton, Updated, useNav, toast } from "../ui";
import Detail from "./Detail";

type N = { id: string; title: string | null; message: string | null; body?: string | null; link: string | null; is_read: boolean | null; created_at: string | null };
const look = (t: string) => {
  const s = t.toLowerCase();
  if (/reject|declin/.test(s)) return { i: <X size={18} />, tone: "er" };
  if (/return|correction/.test(s)) return { i: <CornerUpLeft size={18} />, tone: "wa" };
  if (/paid|payment|voucher/.test(s)) return { i: <Wallet size={18} />, tone: "ok" };
  if (/waiting|pending|for your/.test(s)) return { i: <Bell size={18} />, tone: "in" };
  if (/approv|complet/.test(s)) return { i: <Check size={18} />, tone: "ok" };
  return { i: <Info size={18} />, tone: "mu" };
};

/** In-app notices (the same as the bell on the website). */
export default function Notices({ meId, onRead }: { meId: string; onRead: () => void }) {
  const { push } = useNav();
  const online = useOnline();
  const { data, at, loading, reload } = useSaved<N[]>(`notices:${meId}`, async () => {
    const s = await db();
    const { data: rows, error } = await s.from("notifications").select("*").eq("user_id", meId).order("created_at", { ascending: false }).limit(40);
    if (error) throw new Error(error.message);
    return (rows || []) as N[];
  });
  async function readAll() {
    const s = await db();
    const { error } = await s.rpc("reqgen_mark_notifications_read", { p_ids: null });
    if (error) { toast("Could not mark them read. Try again.", "er"); return; }
    await reload(); onRead();
  }
  function open(n: N) {
    const id = /\/requests\/([0-9a-f-]{36})/i.exec(String(n.link || ""))?.[1];
    if (!n.is_read) void db().then((s) => s.rpc("reqgen_mark_notifications_read", { p_ids: [n.id] })).then(() => { void reload(); onRead(); });
    if (id) push(<Detail id={id} meId={meId} />);
  }
  const unread = (data || []).filter((n) => !n.is_read).length;
  return (
    <>
      <Head title="Notices" />
      <Body onRefresh={reload}>
        {unread ? <div className="row"><span className="mu">{unread} new</span><button type="button" className="link" onClick={() => void readAll()}>Mark all read</button></div> : null}
        {loading && !data ? <Skeleton rows={5} /> : data && data.length ? (
          <div className="grp">
            {data.map((n) => { const t = `${n.title || ""} ${n.message || n.body || ""}`; const l = look(t); return (
              <Cell key={n.id} icon={l.i} iconTone={l.tone} title={<>{!n.is_read ? <span aria-label="New" style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: "var(--or)", marginRight: 6 }} /> : null}{n.title || "ReqGen"}</>}
                sub={`${n.message || n.body || ""} ${ago(n.created_at)}`.trim()} wrap onClick={() => open(n)} />
            ); })}
          </div>
        ) : <Empty icon={<Bell size={28} />} title="No notices" text="When a request reaches you or yours moves, it shows here." />}
        <Updated at={at} offline={!online} />
      </Body>
    </>
  );
}
