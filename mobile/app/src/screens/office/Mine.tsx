import { useState } from "react";
import { Check, KeyRound, PenLine, Phone, ShieldCheck } from "lucide-react";
import { db } from "../../lib/core";
import { positionFor } from "../../lib/admin";
import { when, day } from "../../lib/text";
import { downloadXlsx } from "../../lib/xlsx";
import { useApp } from "../../App";
import { Body, Cell, Chip, Chips, Empty, Head, Item, More, Note, Skeleton, toast, useMore, useNav } from "../../ui";
import { Profile, SignaturePhoto } from "../Account";
import { Err, call, rows, useAction, useLoad } from "./kit";

/** App 4.1.0: My Access, My Activity and the Setup Guide, as app screens. */
export function MyAccess() {
  const { me, reloadMe } = useApp();
  const { data, error, reload } = useLoad(async () => {
    const c = await db();
    const [r, st, av] = await Promise.all([
      c.from("profile_roles").select("role_key,role_name,is_active,is_primary,created_at").eq("profile_id", me.id),
      c.from("reqgen_department_stage_officers").select("stage,dept_id").eq("user_id", me.id),
      c.from("reqgen_officer_availability").select("is_away,away_until").eq("user_id", me.id).maybeSingle(),
    ]);
    return { roles: ((r.data || []) as Array<{ role_key: string; role_name: string | null; is_active: boolean; is_primary: boolean; created_at: string | null }>).filter((x) => x.is_active), stages: (st.data || []) as Array<{ stage: string; dept_id: string }>, away: (av.data as { is_away?: boolean; away_until?: string | null } | null) || null };
  }, [me.id]);
  const [until, setUntil] = useState("");
  const { busy, err, run } = useAction();
  return (
    <>
      <Head title="My Access" />
      <Body onRefresh={reload}>
        <p className="mu" style={{ margin: 0 }}>Your positions. What you see and do follows the position you are acting as now: {me.roleName}.</p>
        <Err text={error || err} />
        {!data ? <Skeleton rows={2} /> : (
          <div className="grp">{data.roles.map((r) => {
            const def = positionFor(r.role_key);
            const acting = (def?.keys || [r.role_key]).includes(me.role.replace(/\d+$/, ""));
            return <Cell key={r.role_key} icon={<KeyRound size={18} />} title={`${def?.name || r.role_name || r.role_key}${r.is_primary ? " (main)" : ""}`} sub={def?.about} wrap
              right={acting ? <Chip tone="ok">Acting</Chip> : <button type="button" className="btn bs sm" disabled={busy} onClick={() => void run(null, () => call("set_my_active_role", { p_role_key: r.role_key }), `Now acting as ${def?.name || r.role_name}.`, reloadMe)}>Act as</button>} />;
          })}</div>
        )}
        {data?.stages.length ? (
          <div className="card">
            <b>Away</b>
            <p className="mu" style={{ margin: 0 }}>{data.away?.is_away ? `You are marked away${data.away.away_until ? ` until ${day(data.away.away_until)}` : ""}. Requests go to your back-up.` : "When you are away, your requests go to your back-up officer."}</p>
            {data.away?.is_away ? <button type="button" className="btn bs block" disabled={busy} onClick={() => void run(null, () => call("reqgen_set_officer_availability", { p_user_id: me.id, p_is_away: false, p_from: null, p_until: null, p_note: null }), "You are back.", reload)}>I am back</button> : (<>
              <label><span className="lbl">Away until</span><input className="inp" type="date" value={until} onChange={(e) => setUntil(e.target.value)} /></label>
              <button type="button" className="btn bs block" disabled={busy || !until} onClick={() => void run(null, () => call("reqgen_set_officer_availability", { p_user_id: me.id, p_is_away: true, p_from: new Date().toISOString().slice(0, 10), p_until: until, p_note: null }), "Marked away.", reload)}>Mark me away</button>
            </>)}
          </div>
        ) : null}
      </Body>
    </>
  );
}

type Ev = { at: string; category: string; module: string; action: string; record_no: string | null; device: string | null };
export function MyActivity() {
  const [days, setDays] = useState<"7" | "30" | "90">("30");
  const { data, error } = useLoad(async () => { const to = new Date(Date.now() + 60000); const from = new Date(Date.now() - Number(days) * 86400000); return rows<Ev>("reqgen_my_activity", { p_from: from.toISOString(), p_to: to.toISOString() }); }, [days]);
  const list = (data || []).slice().sort((a, b) => b.at.localeCompare(a.at));
  const { shown, more, left } = useMore(list);
  return (
    <>
      <Head title="My Activity" />
      <Body>
        <Chips label="Period" value={days} onChange={setDays} items={[{ k: "7", label: "7 days" }, { k: "30", label: "30 days" }, { k: "90", label: "90 days" }]} />
        <button type="button" className="btn bs block" disabled={!list.length} onClick={() => void downloadXlsx(`My_Activity_${days}_days`, [{ name: "My activity", title: "My activity in ReqGen", rows: list.map((e) => ({ When: when(e.at), Module: e.module, Action: e.action, Record: e.record_no, Device: e.device })) }]).catch(() => toast("Not saved.", "er"))}>Save as Excel</button>
        <Err text={error} />
        {!data ? <Skeleton rows={4} /> : !list.length ? <Empty icon={<Check size={28} />} title="Nothing in this period" text="Choose a longer period." /> : shown.map((e, i) => <Item key={`${e.at}-${i}`} title={e.action} sub={when(e.at)} chip={<Chip tone="in">{e.module}</Chip>} facts={[e.record_no ? ["Record", e.record_no] : null, e.device ? ["Device", e.device] : null]} />)}
        <More more={more} left={left} />
      </Body>
    </>
  );
}

export function SetupGuide() {
  const { me } = useApp();
  const { push } = useNav();
  const steps = [
    { key: "2fa", title: "Two-step sign-in (2FA)", done: true, why: "Needed to sign in to the app.", icon: <ShieldCheck size={18} />, go: null },
    { key: "signature", title: "Your signature", done: !!me.signature_url, why: "Printed on what you send, approve or sign.", icon: <PenLine size={18} />, go: () => push(<SignaturePhoto />) },
    { key: "phone", title: "Your phone number", done: !!me.phone, why: "For SMS notices and back-up codes.", icon: <Phone size={18} />, go: () => push(<Profile />) },
  ];
  const left = steps.filter((s) => !s.done).length;
  return (
    <>
      <Head title="Setup Guide" />
      <Body>
        {left ? <Note tone="wa">{left} step{left === 1 ? "" : "s"} still to do.</Note> : <Note tone="ok">Everything is done.</Note>}
        <div className="grp">{steps.map((s) => <Cell key={s.key} icon={s.done ? <Check size={18} /> : s.icon} iconTone={s.done ? "ok" : "wa"} title={s.title} sub={s.done ? "Done" : s.why} onClick={!s.done && s.go ? s.go : undefined} />)}</div>
      </Body>
    </>
  );
}
