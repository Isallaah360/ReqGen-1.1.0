import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Bell, Check, CornerUpLeft, Eye, FileCheck, Forward, Laptop, Lock, Paperclip, PenLine, Reply, Send, ShieldCheck, Stamp, X, Wallet, Undo2, Printer } from "lucide-react";
import { alert, askCode, db, notice, plainError, site, openOutside } from "../lib/core";
import OfficeScreen from "../office/OfficeScreen";
import { buzz } from "../lib/native";
import { useOnline, type Req } from "../lib/data";
import { accountOfficers, type Person } from "../lib/people";
import { day, initials, naira, stageKey, statusChip, waitingForMe, when, withWho } from "../lib/text";
import { useApp } from "../App";
import { Body, Cell, Chip, Head, Note, Sheet, Skeleton, toast, useNav } from "../ui";
import { PeopleList } from "./PickPerson";

type Full = Req & { details: string | null; subhead_id: string | null };
type Hist = { id: string; action_type: string | null; comment: string | null; created_at: string | null; actor_name: string | null; actor_role_name: string | null; action_by: string | null };
type Chain = { step_order: number; stage: string; owner_name: string | null; state: string; acted_by_name: string | null; acted_role: string | null; acted_at: string | null; comment: string | null; signed: boolean };
type DP = { user_id: string; full_name: string | null; position_names: string | null; status: string; comment: string | null; read_at: string | null; acted_at: string | null; added_by_name: string | null };
type Att = { id: string; file_name: string; file_path: string; file_size: number | null };
type Data = { r: Full; hist: Hist[]; chain: Chain[]; people: DP[]; atts: Att[]; checked: string[]; dept: string; sub: string };

const TONE: Record<string, string> = { Waiting: "wa", Approved: "ok", Declined: "er", Replied: "in", Forwarded: "in" };
const BUDGET_STAGES = ["DIRECTOR", "DINADMIN", "HOD", "REGISTRAR", "HR", "DG"];

export default function Detail({ id, meId, onChanged }: { id: string; meId: string; onChanged?: () => void }) {
  const { me, refreshPending } = useApp();
  const { push } = useNav();
  const online = useOnline();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | "approve" | "back" | "answer" | "direct" | "resend">(null);

  const load = useCallback(async () => {
    try {
      const s = await db();
      const { data: r, error } = await s.from("requests").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!r) throw new Error("This request is not open to you, or it was removed.");
      const full = r as Full;
      const [h, c, p, a, k, dept, sub] = await Promise.all([
        s.from("request_history").select("id,action_type,comment,created_at,actor_name,actor_role_name,action_by").eq("request_id", id).order("created_at", { ascending: true }),
        s.rpc("reqgen_request_chain", { p_request_id: id }),
        s.rpc("reqgen_direct_people_of", { p_request_id: id }),
        s.from("request_attachments").select("id,file_name,file_path,file_size").eq("request_id", id).order("created_at"),
        s.from("request_attachment_checks").select("attachment_id").eq("request_id", id).eq("checked_by", meId),
        full.dept_id ? s.from("departments").select("name").eq("id", full.dept_id).maybeSingle() : Promise.resolve({ data: null }),
        full.subhead_id ? s.from("subheads").select("code,name").eq("id", full.subhead_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const sb = sub.data as { code?: string; name?: string } | null;
      setD({
        r: full, hist: (h.data || []) as Hist[], chain: c.error ? [] : (c.data || []) as Chain[], people: p.error ? [] : (p.data || []) as DP[],
        atts: (a.data || []) as Att[], checked: ((k.data || []) as Array<{ attachment_id: string }>).map((x) => x.attachment_id),
        dept: String((dept.data as { name?: string } | null)?.name || ""), sub: sb ? `${sb.code ? `${sb.code}: ` : ""}${sb.name || ""}` : "",
      });
      setErr(null);
      const mine = ((p.data || []) as DP[]).find((x) => x.user_id === meId);
      if (mine && mine.status === "Waiting" && !mine.read_at) void s.rpc("reqgen_direct_read", { p_request_id: id });
    } catch (e) { setErr(plainError(e)); }
  }, [id, meId]);
  useEffect(() => { void load(); }, [load]);

  const after = useCallback(async () => { await load(); void refreshPending(); onChanged?.(); }, [load, refreshPending, onChanged]);

  if (err && !d) return <><Head title="Request" /><Body><Note tone="er">{err}</Note><button type="button" className="btn bs" onClick={() => void load()}>Try again</button></Body></>;
  if (!d) return <><Head title="Request" /><Body><div className="card"><div className="sk" style={{ height: 22, width: "60%" }} /><div className="sk" style={{ height: 14, width: "90%" }} /><div className="sk" style={{ height: 14, width: "70%" }} /></div><Skeleton rows={3} /></Body></>;

  const { r } = d;
  const st = stageKey(r.current_stage);
  const chip = statusChip(r);
  const many = d.people.length > 0;
  const mineDirect = d.people.find((p) => p.user_id === meId);
  const answerDirect = many && mineDirect?.status === "Waiting";
  const isSender = r.created_by === meId;
  const ownDirect = !!r.direct_to && r.current_owner === meId && st !== "ACCOUNT";
  const writerBack = isSender && /returned for correction/i.test(String(r.status || "")) && r.current_owner === meId;
  const canAct = !r.direct_to && waitingForMe(r, meId);
  const official = String(r.request_type || "").toUpperCase() === "OFFICIAL";
  const personalFund = String(r.request_type || "").toUpperCase() === "PERSONAL" && String(r.personal_category || "").toUpperCase() === "FUND";
  const needsSubhead = !r.subhead_id && ((official && BUDGET_STAGES.includes(st)) || (personalFund && st === "HR"));
  const unchecked = d.atts.filter((a) => !d.checked.includes(a.id));
  const laptopOnly = canAct && (st === "ACCOUNT" || needsSubhead);
  const comments = d.hist.filter((h) => !/attachment|edited|print/i.test(String(h.action_type || "")) && String(h.comment || "").trim());
  const showBar = online && (answerDirect || ownDirect || writerBack || (canAct && !laptopOnly));

  return (
    <>
      <Head title={r.request_no || "Request"} />
      <Body bar={showBar} onRefresh={load}>
        <div className="card">
          <div className="row"><Chip tone={chip.tone}>{many ? `Direct, ${d.people.filter((p) => p.status !== "Waiting").length} of ${d.people.length} answered` : chip.text}</Chip>{Number(r.amount) > 0 ? <span className="amt">{naira(r.amount)}</span> : null}</div>
          <p className="title">{r.title || "Request"}</p>
          {r.details ? <p className="p">{r.details}</p> : null}
          <dl className="kv" style={{ marginTop: 4 }}>
            <dt>From</dt><dd>{isSender ? "You" : r.requester_name || "Staff"}</dd>
            {d.dept ? <><dt>Department</dt><dd>{d.dept}</dd></> : null}
            <dt>Kind</dt><dd>{r.direct_to || many ? "Direct" : `${r.request_type || "Official"}${r.personal_category ? `, ${r.personal_category}` : ""}`}</dd>
            {d.sub ? <><dt>Subhead</dt><dd>{d.sub}</dd></> : null}
            <dt>Sent</dt><dd>{day(r.created_at)}</dd>
            {!many && !/completed|paid|reject|withdraw|answered/i.test(chip.text) ? <><dt>Now with</dt><dd>{r.current_owner === meId ? "You" : withWho(r.current_stage)}</dd></> : null}
          </dl>
        </div>

        {!online ? <Note tone="wa">You are offline. You can read this request; answering waits until the network returns.</Note> : null}
        {laptopOnly ? (
          <>
            <Note tone="mu" icon={<Laptop size={16} />}>{st === "ACCOUNT" ? "Release the fund and prepare the voucher on the full request page." : "This request needs its budget subhead chosen before you approve. The full request page shows the balances."}</Note>
            <button type="button" className="btn bp block" onClick={() => push(<OfficeScreen href={`/requests/${r.id}?full=1`} title={r.request_no || "Request"} />)}><Laptop size={18} />Open the full request page</button>
          </>
        ) : null}
        {canAct && !laptopOnly && !me.signature_url ? <Note tone="er">Add your signature in Me › Signature and photo before you approve.</Note> : null}

        {d.atts.length ? (
          <section aria-labelledby="att-h">
            <div className="sect" style={{ marginBottom: 8 }}><b id="att-h">Attachments</b>{canAct && unchecked.length ? <Chip tone="wa">{unchecked.length} to check</Chip> : null}</div>
            <div className="grp">
              {d.atts.map((a) => <AttRow key={a.id} a={a} req={r} checked={d.checked.includes(a.id)} canCheck={canAct && !laptopOnly} onChecked={load} />)}
            </div>
            {canAct && unchecked.length ? <p className="foot">Open and check each attachment before you approve.</p> : null}
          </section>
        ) : null}

        {many ? (
          <section aria-labelledby="route-h">
            <div className="sect" style={{ marginBottom: 8 }}><b id="route-h">Route: from {isSender ? "you" : r.requester_name || "the sender"} to {d.people.length} {d.people.length === 1 ? "person" : "people"}</b></div>
            <div className="grp">
              {d.people.map((p) => (
                <Cell key={p.user_id} icon={initials(p.full_name)} title={`${p.full_name || "Staff"}${p.user_id === meId ? " (you)" : ""}`} wrap
                  sub={`${p.comment ? `“${p.comment}” ` : ""}${p.status === "Waiting" ? (p.read_at ? `Read ${when(p.read_at)}, no answer yet` : "Not opened yet") : when(p.acted_at)}${p.added_by_name && p.added_by_name !== r.requester_name ? `, forwarded by ${p.added_by_name}` : ""}`}
                  right={<Chip tone={TONE[p.status] || "mu"}>{p.status}</Chip>} />
              ))}
            </div>
            {isSender ? d.people.filter((p) => p.status === "Waiting").map((p) => (
              <button key={p.user_id} type="button" className="btn bs block" style={{ marginTop: 10 }} onClick={async () => {
                try { const j = await site<{ told: number }>("/api/notifications/alert", { requestId: r.id, kind: "waiting", to: [p.user_id] }); toast(j.told ? `${p.full_name || "They"} got an SMS and e-mail reminder.` : "Already reminded in the last minute.", j.told ? "ok" : "in"); }
                catch (e) { toast(plainError(e), "er"); }
              }}><Bell size={18} />Remind {p.full_name || "them"}</button>
            )) : null}
            <div style={{ marginTop: 10 }}><Note tone="mu" icon={<Lock size={16} />}>No HOD, HR, DG or Account step. Only the sender and these people can open it. Registry sees the number and who has it, never the message.</Note></div>
          </section>
        ) : d.chain.length ? (
          <section aria-labelledby="chain-h">
            <div className="sect" style={{ marginBottom: 8 }}><b id="chain-h">{r.direct_to ? "Route" : "Approval route"}</b></div>
            <div className="card">
              <ol className="tl">
                {d.chain.map((c, i) => {
                  const done = ["done", "paid", "filed", "complete", "completed"].includes(c.state);
                  const now = c.state === "now" || c.state === "wait" || c.state === "treat" || c.state === "pay";
                  const back = c.state === "rejected";
                  const skip = c.state === "skip" || c.state === "skipped";
                  return (
                    <li key={i}>
                      <span className={`pt ${done ? "ic-ok" : now ? "ic-wa" : back ? "ic-er" : "ic-mu"}`} style={skip ? { opacity: 0.5 } : undefined}>{done ? <Check size={16} /> : back ? <X size={16} /> : <span style={{ fontWeight: 800, fontSize: 12 }}>{i + 1}</span>}</span>
                      <span className="tx">
                        <b>{withWho(c.stage).replace(/^the /, "").replace(/^\w/, (x) => x.toUpperCase())}{c.signed ? " (signed)" : ""}</b>
                        <small>{done ? `${c.acted_by_name || c.owner_name || ""}${c.acted_at ? `, ${when(c.acted_at)}` : ""}` : now ? `Waiting for ${c.owner_name || "the officer"}` : skip ? "Skipped (vacant)" : c.owner_name || "Next"}</small>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>
        ) : null}

        <section aria-labelledby="said-h">
          <div className="sect" style={{ marginBottom: 8 }}><b id="said-h">What the officers said</b></div>
          {comments.length ? (
            <div className="card">
              <ol className="tl">
                {comments.map((h) => {
                  const a = String(h.action_type || "").toLowerCase();
                  const look = a === "return" ? { i: <CornerUpLeft size={15} />, t: "ic-wa" } : /reject|declin/.test(a) ? { i: <X size={15} />, t: "ic-er" } : a === "submit" || a === "resubmit" ? { i: <Send size={15} />, t: "ic-in" } : { i: <Check size={15} />, t: "ic-ok" };
                  return (
                    <li key={h.id}>
                      <span className={`pt ${look.t}`}>{look.i}</span>
                      <span className="tx">
                        <b>{h.action_by === meId ? "You" : h.actor_name || "Officer"}{h.actor_role_name ? `, ${h.actor_role_name}` : ""}</b>
                        <small>{h.action_type || "Comment"}, {when(h.created_at)}</small>
                        <p className="quote">{h.comment}</p>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : <p className="mu">No comments yet. Each officer's comment shows here, and prints with the request.</p>}
        </section>
        <button type="button" className="btn bs block" onClick={() => push(<OfficeScreen href={`/requests/${r.id}/print`} title="Print request" />)}><Printer size={18} />Print with the comments</button>
      </Body>

      {showBar ? (
        <div className="bar">
          {answerDirect ? (
            <button type="button" className="btn bp" onClick={() => setSheet("answer")}><Reply size={18} />Answer</button>
          ) : ownDirect ? (
            <button type="button" className="btn bp" onClick={() => setSheet("direct")}><PenLine size={18} />{st === "DG" ? "Decide" : "Answer"}</button>
          ) : writerBack ? (
            <button type="button" className="btn bp" onClick={() => setSheet("resend")}><Undo2 size={18} />Send it again</button>
          ) : (
            <>
              <button type="button" className="btn bs" onClick={() => setSheet("back")}><CornerUpLeft size={18} />Send back</button>
              <button type="button" className="btn bp" disabled={!me.signature_url} onClick={() => {
                if (unchecked.length) { buzz.bad(); toast(`Open and check ${unchecked.length === 1 ? "the attachment" : `all ${unchecked.length} attachments`} first.`, "er"); return; }
                setSheet("approve");
              }}>{st === "DG" ? <Stamp size={18} /> : <Check size={18} />}{st === "DG" ? "Approve and stamp" : st === "HRFILING" ? "Complete" : "Approve"}</button>
            </>
          )}
        </div>
      ) : null}

      <ApproveSheet open={sheet === "approve"} onClose={() => setSheet(null)} r={r} stage={st} onDone={after} />
      <BackSheet open={sheet === "back"} onClose={() => setSheet(null)} r={r} onDone={after} />
      {answerDirect ? <AnswerSheet open={sheet === "answer"} onClose={() => setSheet(null)} r={r} people={d.people} onDone={after} /> : null}
      {ownDirect ? <DirectActSheet open={sheet === "direct"} onClose={() => setSheet(null)} r={r} stage={st} onDone={after} /> : null}
      <ResendSheet open={sheet === "resend"} onClose={() => setSheet(null)} r={r} onDone={after} />
    </>
  );
}

// ---- an attachment: open it, then mark it checked ------------------------------------------------------
function AttRow({ a, req, checked, canCheck, onChecked }: { a: Att; req: Req; checked: boolean; canCheck: boolean; onChecked: () => Promise<void> }) {
  const { me } = useApp();
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  async function open() {
    const { data, error } = await (await db()).storage.from("request-attachments").createSignedUrl(a.file_path, 600);
    if (error || !data?.signedUrl) { toast("The file could not be opened.", "er"); return; }
    openOutside(data.signedUrl);
    setOpened(true);
  }
  async function check() {
    setBusy(true);
    const s = await db();
    const { error } = await s.from("request_attachment_checks").upsert({
      request_id: req.id, attachment_id: a.id, checked_by: me.id, checked_by_name: me.full_name, checked_by_role: me.roleName,
      check_status: "Checked", check_comment: `Checked by ${me.full_name}`, checked_at: new Date().toISOString(),
    }, { onConflict: "attachment_id,checked_by" });
    if (!error) await s.from("request_history").insert({ request_id: req.id, action_type: "Attachment Checked", comment: `${a.file_name} was checked by ${me.full_name} (${me.roleName}).`, to_stage: req.current_stage, actor_name: me.full_name, actor_role_key: me.role, actor_role_name: me.roleName, action_by: me.id });
    setBusy(false);
    if (error) { toast(plainError(error), "er"); return; }
    toast("Attachment checked.");
    await onChecked();
  }
  return (
    <Cell icon={checked ? <FileCheck size={18} /> : <Paperclip size={18} />} iconTone={checked ? "ok" : "mu"} title={a.file_name}
      sub={checked ? "Checked by you" : a.file_size ? `${Math.max(1, Math.round(a.file_size / 1024))} KB` : "File"}
      right={
        <span style={{ display: "flex", gap: 6 }}>
          <button type="button" className="btn bs sm" style={{ padding: 0, width: 44 }} onClick={() => void open()} aria-label={`Open ${a.file_name}`}><Eye size={18} /></button>
          {canCheck && !checked ? <button type="button" className="btn bp sm" disabled={!opened || busy} onClick={() => void check()} aria-label={`Mark ${a.file_name} as checked`}><Check size={16} />Checked</button> : null}
        </span>
      } />
  );
}

// ---- sheets --------------------------------------------------------------------------------------------
function useAct(onClose: () => void, onDone: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (what: string, fn: () => Promise<string | void>, success: string, okLine?: (x: string | void) => string) => {
    setErr(null);
    if (!(await askCode(what))) { setErr("Not done: the code was not entered."); return; }
    setBusy(true);
    try { const x = await fn(); onClose(); toast(okLine ? okLine(x) : success); await onDone(); }
    catch (e) { buzz.bad(); setErr(plainError(e)); }
    finally { setBusy(false); }
  };
  return { busy, err, setErr, run };
}
const CodeLine = () => <p className="foot"><ShieldCheck size={13} style={{ verticalAlign: "-2px" }} /> You confirm with the 6-digit code sent to your phone and e-mail.</p>;
function Comment({ value, onChange, label, placeholder }: { value: string; onChange: (v: string) => void; label: string; placeholder: string }) {
  return <label><span className="lbl">{label}</span><textarea className="inp" value={value} maxLength={1000} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ minHeight: 84 }} /></label>;
}

function ApproveSheet({ open, onClose, r, stage, onDone }: { open: boolean; onClose: () => void; r: Full; stage: string; onDone: () => Promise<void> }) {
  const { me } = useApp();
  const [note, setNote] = useState("");
  const { busy, err, run } = useAct(onClose, onDone);
  const dg = stage === "DG", hr = stage === "HRFILING";
  return (
    <Sheet open={open} onClose={onClose} title={dg ? "Approve, sign and stamp?" : hr ? "Complete the HR review?" : "Approve this request?"}>
      <p className="mu" style={{ fontSize: 14 }}>{Number(r.amount) > 0 ? `${naira(r.amount)} for ${(r.title || "this request").toLowerCase()}. ` : ""}{dg ? "Your signature is added, with the IET stamp beside it. Then it goes to Account." : hr ? "" : "Your signature is added. It goes to the next officer on the route."}</p>
      <Comment value={note} onChange={setNote} label="Comment (optional)" placeholder={dg ? "e.g. Approved" : "e.g. Approved, within the budget"} />
      {err ? <Note tone="er">{err}</Note> : null}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn bs" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
        <button type="button" className="btn bp" style={{ flex: 1 }} disabled={busy} onClick={() => void run(dg ? "sign and stamp this request" : "approve this request", async () => {
          const s = await db();
          if (r.subhead_id && !dg && stage !== "ACCOUNT" && !hr) {
            const c = await s.rpc("reqgen_confirm_request_budget", { p_request_id: r.id });
            if (c.error && !/could not find the function|schema cache/i.test(c.error.message)) throw new Error(c.error.message);
          }
          const { data, error } = await s.rpc("approve_request_step", { p_request_id: r.id, p_actor_id: me.id, p_comment: note.trim(), p_signature_url: me.signature_url });
          if (error) throw new Error(error.message);
          notice("decided", r.id);
          const res = (Array.isArray(data) ? data[0] : data) as { new_stage?: string } | null;
          return res?.new_stage || "";
        }, "Approved.", (next) => next ? (next === "Completed" ? "Approved. The request is complete." : `Approved. It goes to ${withWho(String(next))}.`) : "Approved.")}>
          {busy ? "Saving…" : dg ? "Approve and stamp" : hr ? "Complete" : "Approve"}
        </button>
      </div>
      <CodeLine />
    </Sheet>
  );
}

function BackSheet({ open, onClose, r, onDone }: { open: boolean; onClose: () => void; r: Full; onDone: () => Promise<void> }) {
  const { me } = useApp();
  const [note, setNote] = useState("");
  const { busy, err, setErr, run } = useAct(onClose, onDone);
  return (
    <Sheet open={open} onClose={onClose} title="Send this request back?">
      <p className="mu" style={{ fontSize: 14 }}>It goes back with your reason, so it can be corrected.</p>
      <Comment value={note} onChange={setNote} label="Reason (required)" placeholder="e.g. Attach the quotation and resubmit" />
      {err ? <Note tone="er">{err}</Note> : null}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn bs" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
        <button type="button" className="btn bd" style={{ flex: 1 }} disabled={busy} onClick={() => {
          if (note.trim().length < 3) { setErr("Write the reason for sending it back."); return; }
          void run("send this request back", async () => {
            const { data, error } = await (await db()).rpc("reqgen_return_request", { p_request_id: r.id, p_comment: note.trim(), p_signature_url: me.signature_url });
            if (error) throw new Error(error.message);
            notice("decided", r.id);
            const res = (Array.isArray(data) ? data[0] : data) as { new_status?: string } | null;
            return String(res?.new_status || "");
          }, "Sent back.", (s) => /director general/i.test(String(s)) ? "Sent back to the officer who approved it before you." : "Sent back to the requester to correct.");
        }}>{busy ? "Saving…" : "Send back"}</button>
      </div>
      <CodeLine />
    </Sheet>
  );
}

function ResendSheet({ open, onClose, r, onDone }: { open: boolean; onClose: () => void; r: Full; onDone: () => Promise<void> }) {
  const { push } = useNav();
  const [note, setNote] = useState("");
  const { busy, err, run } = useAct(onClose, onDone);
  return (
    <Sheet open={open} onClose={onClose} title="Send the corrected request again?">
      <p className="mu" style={{ fontSize: 14 }}>It goes back to the officer who returned it. To change the title, amount or files, edit it first.</p>
      <Comment value={note} onChange={setNote} label="Note for the officer (optional)" placeholder="e.g. Quotation attached" />
      {err ? <Note tone="er">{err}</Note> : null}
      <button type="button" className="btn bp block" disabled={busy} onClick={() => void run("send it again", async () => {
        const s = await db();
        const { error } = r.direct_to
          ? await s.rpc("reqgen_direct_act", { p_request_id: r.id, p_action: "resend", p_comment: note.trim() || null })
          : await s.rpc("reqgen_resubmit_request", { p_request_id: r.id, p_comment: note.trim() || null });
        if (error) throw new Error(error.message);
        alert(r.id, "waiting");
      }, "Sent again.")}>{busy ? "Sending…" : "Send it again"}</button>
      <button type="button" className="link" style={{ justifyContent: "center" }} onClick={() => { onClose(); push(<OfficeScreen href={`/requests/${r.id}/edit`} title="Edit request" />); }}>Edit the request</button>
      <CodeLine />
    </Sheet>
  );
}

type Choice = { k: string; label: string; sub: string; icon: ReactNode; danger?: boolean };
function Choices({ list, value, onChange }: { list: Choice[]; value: string; onChange: (k: string) => void }) {
  return (
    <div className="grp" role="radiogroup" aria-label="Your answer">
      {list.map((c) => (
        <button key={c.k} type="button" className="cell" role="radio" aria-checked={value === c.k} onClick={() => { buzz.tap(); onChange(c.k); }}>
          <span className={`av ${c.danger ? "ic-er" : "ic-in"}`} aria-hidden="true">{c.icon}</span>
          <span className="t"><b>{c.label}</b><small className="wrap">{c.sub}</small></span>
          <span className={`box${value === c.k ? " on" : ""}`} style={{ borderRadius: 13 }} aria-hidden="true">{value === c.k ? <Check size={15} strokeWidth={3} /> : null}</span>
        </button>
      ))}
    </div>
  );
}

/** A Direct request sent to me with others: approve, reply, forward (to the DG to be paid, or to someone), or decline. */
function AnswerSheet({ open, onClose, r, people, onDone }: { open: boolean; onClose: () => void; r: Full; people: DP[]; onDone: () => Promise<void> }) {
  const money = Number(r.amount) > 0;
  const [k, setK] = useState("approve");
  const [note, setNote] = useState("");
  const [to, setTo] = useState<Person | null>(null);
  const [officer, setOfficer] = useState("");
  const [officers, setOfficers] = useState<Array<{ id: string; full_name: string | null }>>([]);
  const [pick, setPick] = useState(false);
  const { busy, err, setErr, run } = useAct(onClose, onDone);
  useEffect(() => { if (k === "forward_dg" && money && !officers.length) void accountOfficers().then(setOfficers); }, [k, money, officers.length]);
  const list: Choice[] = [
    { k: "approve", label: "Approve", sub: "Agree and sign", icon: <Check size={18} /> },
    { k: "reply", label: "Reply", sub: "Answer with a note", icon: <Reply size={18} /> },
    { k: "forward_dg", label: "Forward to the DG", sub: money ? `To approve and pay ${naira(r.amount)}` : "To approve and stamp", icon: <Wallet size={18} /> },
    { k: "forward", label: "Forward to someone", sub: "They answer on their own", icon: <Forward size={18} /> },
    { k: "decline", label: "Decline", sub: "With your reason", icon: <X size={18} />, danger: true },
  ];
  const exclude = useMemo(() => [r.created_by || "", ...people.map((p) => p.user_id)], [r.created_by, people]);
  if (pick) {
    return (
      <Sheet open={open} onClose={() => setPick(false)} title="Forward to">
        <PeopleList many={false} chosen={to ? [to.id] : []} exclude={exclude} onToggle={(p) => { setTo(p); setPick(false); }} />
      </Sheet>
    );
  }
  return (
    <Sheet open={open} onClose={onClose} title="Your answer">
      <p className="mu" style={{ fontSize: 14 }}>Sent to you directly by {r.requester_name || "a colleague"}{people.length > 1 ? `, and to ${people.length - 1} other ${people.length === 2 ? "person" : "people"}. Each answers on their own.` : "."}</p>
      <Choices list={list} value={k} onChange={(x) => { setK(x); setErr(null); }} />
      {k === "forward" ? <button type="button" className="cell grp" onClick={() => setPick(true)}><span className="av">{to ? initials(to.full_name) : <Forward size={18} />}</span><span className="t"><b>{to ? to.full_name : "Choose the person"}</b><small>{to ? `${to.position_names || "Staff"}, ${to.dept}` : "Any staff, any department"}</small></span></button> : null}
      {k === "forward_dg" && money ? (
        <label><span className="lbl">Account Officer who will pay it</span>
          <select className="inp" value={officer} onChange={(e) => setOfficer(e.target.value)}>
            <option value="">{officers.length ? "Choose the Account Officer" : "Loading…"}</option>
            {officers.map((o) => <option key={o.id} value={o.id}>{o.full_name || "Account Officer"}</option>)}
          </select>
        </label>
      ) : null}
      <Comment value={note} onChange={setNote} label={k === "reply" || k === "decline" ? "Your answer (required)" : "Note (optional)"} placeholder={k === "decline" ? "e.g. Not my office" : "e.g. Done, I will hand them over"} />
      {err ? <Note tone="er">{err}</Note> : null}
      <button type="button" className={`btn block ${k === "decline" ? "bd" : "bp"}`} disabled={busy} onClick={() => {
        if ((k === "reply" || k === "decline") && note.trim().length < 2) { setErr("Write your answer."); return; }
        if (k === "forward" && !to) { setErr("Choose who to forward it to."); return; }
        if (k === "forward_dg" && money && !officer) { setErr("Choose the Account Officer who will pay it."); return; }
        const what = k === "approve" ? "approve this request" : k === "decline" ? "decline this request" : k === "reply" ? "send your reply" : "forward this request";
        void run(what, async () => {
          const { error } = await (await db()).rpc("reqgen_direct_answer", { p_request_id: r.id, p_action: k, p_comment: note.trim() || null, p_to: k === "forward" ? to?.id : k === "forward_dg" ? officer || null : null });
          if (error) throw new Error(error.message);
          if (k === "forward" || k === "forward_dg") alert(r.id, "waiting");
          alert(r.id, "answered");
        }, k === "approve" ? "Approved. The sender is told." : k === "decline" ? "Declined. The sender is told." : k === "reply" ? "Reply sent. The sender is told." : "Forwarded. They are told by SMS, e-mail and in the app.");
      }}>{busy ? "Saving…" : list.find((c) => c.k === k)?.label}</button>
      <CodeLine />
    </Sheet>
  );
}

/** A Direct request I hold (sent to me alone, or forwarded to me, or at the DG). */
function DirectActSheet({ open, onClose, r, stage, onDone }: { open: boolean; onClose: () => void; r: Full; stage: string; onDone: () => Promise<void> }) {
  const money = Number(r.amount) > 0;
  const dg = stage === "DG";
  const list: Choice[] = dg ? [
    { k: "approve", label: "Approve, sign and stamp", sub: money ? "It goes to the chosen Account Officer to release the fund." : "The request closes as approved.", icon: <Stamp size={18} /> },
    { k: "return", label: "Send back", sub: "Back to the officer who forwarded it, with your reason.", icon: <CornerUpLeft size={18} /> },
    { k: "decline", label: "Decline", sub: "The request closes. The writer sees your reason.", icon: <X size={18} />, danger: true },
  ] : [
    { k: "to_dg", label: "Forward to the Director General", sub: money ? "Choose the Account Officer who will treat it first." : "With your comment and signature.", icon: <Wallet size={18} /> },
    { k: "forward", label: "Forward to someone else", sub: "Another person who should see it first.", icon: <Forward size={18} /> },
    { k: "return", label: "Send back to the writer", sub: "They correct it and send it again.", icon: <CornerUpLeft size={18} /> },
    { k: "decline", label: "Decline", sub: "The request closes. The writer sees your reason.", icon: <X size={18} />, danger: true },
  ];
  const [k, setK] = useState(list[0].k);
  const [note, setNote] = useState("");
  const [to, setTo] = useState<Person | null>(null);
  const [officer, setOfficer] = useState("");
  const [officers, setOfficers] = useState<Array<{ id: string; full_name: string | null }>>([]);
  const [pick, setPick] = useState(false);
  const { busy, err, setErr, run } = useAct(onClose, onDone);
  useEffect(() => { if (k === "to_dg" && money && !officers.length) void accountOfficers().then(setOfficers); }, [k, money, officers.length]);
  if (pick) return <Sheet open={open} onClose={() => setPick(false)} title="Forward to"><PeopleList many={false} chosen={to ? [to.id] : []} exclude={[r.created_by || ""]} onToggle={(p) => { setTo(p); setPick(false); }} /></Sheet>;
  return (
    <Sheet open={open} onClose={onClose} title={dg ? "Your decision" : "Your answer"}>
      <Choices list={list} value={k} onChange={(x) => { setK(x); setErr(null); }} />
      {k === "forward" ? <button type="button" className="cell grp" onClick={() => setPick(true)}><span className="av">{to ? initials(to.full_name) : <Forward size={18} />}</span><span className="t"><b>{to ? to.full_name : "Choose the person"}</b><small>{to ? `${to.position_names || "Staff"}, ${to.dept}` : "Any staff, any department"}</small></span></button> : null}
      {k === "to_dg" && money ? (
        <label><span className="lbl">Account Officer who will treat it</span>
          <select className="inp" value={officer} onChange={(e) => setOfficer(e.target.value)}>
            <option value="">{officers.length ? "Choose the Account Officer" : "Loading…"}</option>
            {officers.map((o) => <option key={o.id} value={o.id}>{o.full_name || "Account Officer"}</option>)}
          </select>
        </label>
      ) : null}
      <Comment value={note} onChange={setNote} label={k === "return" || k === "decline" ? "Reason (required)" : "Comment (optional)"} placeholder={k === "decline" ? "e.g. Not needed this term" : "e.g. Recommended for approval"} />
      {err ? <Note tone="er">{err}</Note> : null}
      <button type="button" className={`btn block ${k === "decline" ? "bd" : "bp"}`} disabled={busy} onClick={() => {
        if ((k === "return" || k === "decline") && note.trim().length < 3) { setErr("Write the reason."); return; }
        if (k === "forward" && !to) { setErr("Choose the person to forward it to."); return; }
        if (k === "to_dg" && money && !officer) { setErr("Choose the Account Officer who will treat it."); return; }
        void run(k === "approve" ? "sign and stamp" : k === "to_dg" ? "sign and forward it" : k === "return" ? "send it back" : k === "decline" ? "decline it" : "forward it", async () => {
          const { error } = await (await db()).rpc("reqgen_direct_act", { p_request_id: r.id, p_action: k, p_comment: note.trim() || null, p_to: k === "forward" ? to?.id : null, p_account_officer: k === "to_dg" && money ? officer : null });
          if (error) throw new Error(error.message);
          alert(r.id, "waiting");
        }, k === "approve" ? (money ? "Approved and stamped. It goes to Account." : "Approved and stamped.") : k === "decline" ? "Declined." : k === "return" ? "Sent back." : "Forwarded. They are told by SMS, e-mail and in the app.");
      }}>{busy ? "Saving…" : list.find((c) => c.k === k)?.label}</button>
      <CodeLine />
    </Sheet>
  );
}

