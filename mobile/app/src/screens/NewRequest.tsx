import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Paperclip, Send, X, Save } from "lucide-react";
import { askCode, db, notice, plainError } from "../lib/core";
import { useOnline } from "../lib/data";
import { ACCEPT, addFiles, fmtAmount, kb, newNumber, parseAmount, uploadAll } from "../lib/files";
import { naira, withWho } from "../lib/text";
import { useApp } from "../App";
import { Body, Head, Note, toast, useNav } from "../ui";
import Detail from "./Detail";
import Sent from "./Sent";
import { SubheadField, useLive, useSubheads } from "./Budget";

export type Draft = { id: string; request_type: string | null; personal_category: string | null; dept_id: string | null; subhead_id: string | null; title: string | null; details: string | null; amount: number | null; attachments: unknown[] | null; updated_at: string | null };
type Kind = "Official" | "Personal";
const CATS = [
  { k: "Fund", t: "Personal fund" }, { k: "Leave", t: "Leave" }, { k: "Contract Renewal", t: "Contract renewal" }, { k: "Resignation", t: "Resignation" }, { k: "Others", t: "Other personal" },
];
type Step = { step_order: number; stage: string; is_vacant: boolean; if_vacant: string };

export default function NewRequest({ kind, draft }: { kind: Kind; draft?: Draft }) {
  const { me } = useApp();
  const { replace } = useNav();
  const online = useOnline();
  const [depts, setDepts] = useState<Array<{ id: string; name: string }>>([]);
  const [deptId, setDeptId] = useState(draft?.dept_id || me.dept_id || "");
  const [cat, setCat] = useState(draft?.personal_category || "Fund");
  const [title, setTitle] = useState(draft?.title || "");
  const [details, setDetails] = useState(draft?.details || "");
  const [amountText, setAmountText] = useState(draft?.amount ? fmtAmount(String(draft.amount)) : "");
  const [subId, setSubId] = useState(draft?.subhead_id || "");
  const [route, setRoute] = useState<Step[] | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState<"" | "draft" | "send" | "upload">("");
  const [msg, setMsg] = useState<string | null>(null);
  const [draftId, setDraftId] = useState(draft?.id || null);
  const fileRef = useRef<HTMLInputElement>(null);

  const official = kind === "Official";
  const needsAmount = official || cat === "Fund";
  const amount = parseAmount(amountText);
  // 4.1.0 (HR's rule): the sender chooses the subhead on every official request; names only, never balances
  const subs = useSubheads(deptId, official);
  const mustSub = official && !!subs && subs.length > 0;
  const live = useLive(subId, amount > 0 ? amount : NaN, official);
  const blocked = (route || []).filter((s) => s.is_vacant && s.if_vacant === "block").map((s) => withWho(s.stage));

  useEffect(() => { void db().then((s) => s.from("departments").select("id,name").eq("is_active", true).order("name")).then(({ data }) => setDepts((data || []) as typeof depts)); }, []);
  useEffect(() => {
    if (!deptId) { setRoute(null); return; }
    let alive = true;
    void db().then((s) => s.rpc("reqgen_route_preview", { p_dept_id: deptId, p_request_type: kind, p_personal_category: kind === "Personal" ? cat : null })).then(({ data, error }) => { if (alive) setRoute(error ? null : (data || []) as Step[]); });
    return () => { alive = false; };
  }, [deptId, kind, cat]);

  const problem = useMemo(() => {
    if (!deptId) return "Choose the department.";
    if (title.trim().length < 3) return "Write a short title.";
    if (details.trim().length < 5) return "Write the details.";
    if (needsAmount && !(amount > 0)) return "Type the amount in naira.";
    if (official && !subs) return "Loading the subheads…";
    if (mustSub && !subId) return "Choose the budget subhead.";
    if (live === "checking") return "Checking the budget…";
    if (live === "not_enough") return "This subhead cannot finance the amount. Choose another subhead, lower the amount, or contact the Auditor.";
    if (blocked.length) return `The route has no officer for ${blocked.join(", ")}. The Super Admin must complete the Routing Engine first.`;
    if (!me.signature_url) return "Add your signature in Me › Signature and photo first.";
    if (!ok) return "Tick the box to confirm the details are correct.";
    return "";
  }, [deptId, title, details, needsAmount, amount, official, subs, mustSub, subId, live, blocked, me.signature_url, ok]);

  async function saveDraft() {
    setBusy("draft"); setMsg(null);
    try {
      const s = await db();
      const fields = { request_type: kind, personal_category: kind === "Personal" ? cat : null, dept_id: deptId || null, subhead_id: subId || null, title: title.trim(), details: details.trim(), amount: needsAmount && amount > 0 ? amount : null };
      if (draftId) { const u = await s.from("reqgen_request_drafts").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", draftId); if (u.error) throw new Error(u.error.message); }
      else { const i = await s.from("reqgen_request_drafts").insert({ ...fields, owner_id: me.id }).select("id").single(); if (i.error) throw new Error(i.error.message); setDraftId((i.data as { id: string }).id); }
      toast(files.length ? "Draft saved. Files are not kept in an app draft: add them when you send." : "Draft saved.");
    } catch (e) { setMsg(plainError(e)); }
    finally { setBusy(""); }
  }

  async function send() {
    if (problem) { setMsg(problem); return; }
    setMsg(null);
    if (!(await askCode("send this request"))) { setMsg("Not sent: the code was not entered."); return; }
    setBusy("send");
    try {
      const s = await db();
      const no = newNumber();
      const { data, error } = await s.rpc("submit_request_with_reservation", {
        p_title: title.trim(), p_details: details.trim(), p_amount: needsAmount ? amount : 0, p_dept_id: deptId, p_subhead_id: mustSub ? subId || null : null,
        p_request_type: kind, p_personal_category: kind === "Personal" ? cat : null, p_created_by: me.id, p_requester_name: me.full_name, p_requester_signature: me.signature_url, p_request_no: no,
      });
      if (error) throw new Error(error.message);
      const res = (Array.isArray(data) ? data[0] : data) as { request_id?: string; first_stage?: string } | null;
      if (!res?.request_id) throw new Error("The request was sent but ReqGen did not return its number. Check Requests before trying again.");
      notice("submitted", res.request_id);
      if (files.length) { setBusy("upload"); try { await uploadAll(res.request_id, me.id, files); } catch (e) { toast(plainError(e), "er"); } }
      if (draftId) await s.from("reqgen_request_drafts").delete().eq("id", draftId);
      replace(<Sent title="Request sent" no={no} line={`It is with ${withWho(res.first_stage)}. They get an SMS, an e-mail and an app notice.`} openNode={<Detail id={res.request_id} meId={me.id} />} />);
    } catch (e) { setMsg(plainError(e)); setBusy(""); }
  }

  const dept = depts.find((d) => d.id === deptId);
  return (
    <>
      <Head title={official ? "Official request" : "Personal request"} />
      <Body bar>
        {draft ? <Note tone="in">Draft opened.{Array.isArray(draft.attachments) && draft.attachments.length ? ` It had ${draft.attachments.length} saved ${draft.attachments.length === 1 ? "file" : "files"}: add ${draft.attachments.length === 1 ? "it" : "them"} again here before you send.` : ""}</Note> : null}
        {!official ? (
          <div><span className="lbl">Kind</span>
            <div className="filters" role="radiogroup" aria-label="Kind">{CATS.map((c) => <button key={c.k} type="button" role="radio" aria-checked={cat === c.k} aria-pressed={cat === c.k} onClick={() => setCat(c.k)}>{c.t}</button>)}</div>
          </div>
        ) : null}
        <label><span className="lbl">Department</span>
          <select className="inp" value={deptId} onChange={(e) => { setDeptId(e.target.value); setSubId(""); }}>
            <option value="">Choose the department</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label><span className="lbl">Title</span><input className="inp" value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} placeholder={official ? "e.g. Printer toner for Registry" : "e.g. Annual leave in December"} /></label>
        <label><span className="lbl">Details</span><textarea className="inp" value={details} maxLength={4000} onChange={(e) => setDetails(e.target.value)} placeholder="What you need, and why" /></label>
        {needsAmount ? (
          <label><span className="lbl">Amount (₦)</span><input className="inp" inputMode="decimal" value={amountText} onChange={(e) => setAmountText(fmtAmount(e.target.value))} placeholder="0" /></label>
        ) : null}
        {official && deptId ? <SubheadField subs={subs} value={subId} onChange={setSubId} live={live} deptName={dept?.name} /> : null}

        <div>
          <span className="lbl">Attachments (optional)</span>
          {files.length ? <div className="grp" style={{ marginBottom: 8 }}>{files.map((f, i) => (
            <div className="cell" key={`${f.name}-${i}`}><span className="av ic-mu"><Paperclip size={18} /></span><span className="t"><b>{f.name}</b><small>{kb(f.size)}</small></span><button type="button" className="ib" aria-label={`Remove ${f.name}`} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}><X size={18} /></button></div>
          ))}</div> : null}
          <input ref={fileRef} type="file" multiple accept={ACCEPT} hidden onChange={(e) => { const r = addFiles(files, e.target.files); setFiles(r.files); if (r.problem) setMsg(r.problem); e.target.value = ""; }} />
          <button type="button" className="btn bs block" onClick={() => fileRef.current?.click()}><Paperclip size={18} />Add a file</button>
        </div>

        {route && route.length ? (
          <div className="card"><b className="h" style={{ fontSize: 14 }}>The route</b>
            <p className="mu">{route.filter((s) => !(s.is_vacant && s.if_vacant === "skip")).map((s) => withWho(s.stage).replace(/^the /, "")).join(", then ")}.</p>
          </div>
        ) : null}
        <button type="button" className="cell grp" role="checkbox" aria-checked={ok} onClick={() => setOk((v) => !v)}>
          <span className={`box${ok ? " on" : ""}`} aria-hidden="true">{ok ? <Check size={15} strokeWidth={3} /> : null}</span>
          <span className="t"><b>The details are correct</b><small className="wrap">Your signature is added when you send{needsAmount && amount > 0 ? ` ${naira(amount)}` : ""}.</small></span>
        </button>
        {msg ? <Note tone="er">{msg}</Note> : null}
        {!online ? <Note tone="wa">You are offline. Sending waits until the network returns.</Note> : null}
      </Body>
      <div className="bar">
        <button type="button" className="btn bs" style={{ flex: "0 0 auto" }} disabled={!!busy} onClick={() => void saveDraft()} aria-label="Save draft"><Save size={18} />{busy === "draft" ? "Saving…" : "Draft"}</button>
        <button type="button" className="btn bp" disabled={!!busy || !online} onClick={() => void send()}><Send size={18} />{busy === "send" ? "Sending…" : busy === "upload" ? "Adding files…" : "Sign and send"}</button>
      </div>
    </>
  );
}
