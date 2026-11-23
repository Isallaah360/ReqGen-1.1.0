import { useRef, useState } from "react";
import { Paperclip, Plus, Send, X, Info } from "lucide-react";
import { alert, askCode, db, plainError } from "../lib/core";
import { useOnline } from "../lib/data";
import { ACCEPT, addFiles, fmtAmount, kb, newNumber, parseAmount, uploadAll } from "../lib/files";
import type { Person } from "../lib/people";
import { initials } from "../lib/text";
import { useApp } from "../App";
import { Body, Cell, Chip, Head, Note, Toggle, toast, useNav } from "../ui";
import { PeopleList } from "./PickPerson";
import Detail from "./Detail";
import Sent from "./Sent";

/**
 * Direct: from the sender straight to the people chosen, from any departments, as many as needed (up to 50).
 * No HOD, HR, DG or Account step. Each person answers on their own. To be paid, a receiver forwards it to the DG.
 */
export default function DirectNew() {
  const [step, setStep] = useState<"pick" | "write">("pick");
  const [chosen, setChosen] = useState<Person[]>([]);
  const toggle = (p: Person) => setChosen((c) => (c.some((x) => x.id === p.id) ? c.filter((x) => x.id !== p.id) : c.length >= 50 ? c : [...c, p]));
  if (step === "write") return <Write chosen={chosen} setChosen={setChosen} onAdd={() => setStep("pick")} />;
  return (
    <>
      <Head title="Direct: choose people" />
      <Body bar>
        {chosen.length ? <Tags chosen={chosen} onRemove={toggle} /> : <p className="mu">Choose one person or many, from any department.</p>}
        <PeopleList many chosen={chosen.map((c) => c.id)} onToggle={toggle} />
      </Body>
      <div className="bar"><button type="button" className="btn bp" disabled={!chosen.length} onClick={() => setStep("write")}>{chosen.length ? `Continue with ${chosen.length} ${chosen.length === 1 ? "person" : "people"}` : "Choose at least one person"}</button></div>
    </>
  );
}

function Tags({ chosen, onRemove }: { chosen: Person[]; onRemove: (p: Person) => void }) {
  return (
    <div className="tags">
      {chosen.map((p) => <span className="tag" key={p.id}>{p.full_name || "Staff"}<button type="button" aria-label={`Remove ${p.full_name}`} onClick={() => onRemove(p)}><X size={14} strokeWidth={2.6} /></button></span>)}
    </div>
  );
}

function Write({ chosen, setChosen, onAdd }: { chosen: Person[]; setChosen: (f: (c: Person[]) => Person[]) => void; onAdd: () => void }) {
  const { me } = useApp();
  const { replace } = useNav();
  const online = useOnline();
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [money, setMoney] = useState(false);
  const [amountText, setAmountText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const amount = parseAmount(amountText);

  async function send() {
    const problem = !chosen.length ? "Choose at least one person." : title.trim().length < 3 ? "Write a short title." : details.trim().length < 3 ? "Write your message." : money && !(amount > 0) ? "Type the amount, or turn off Money involved." : !me.signature_url ? "Add your signature in My Account on the website first." : "";
    if (problem) { setMsg(problem); return; }
    setMsg(null);
    if (!(await askCode("send this request"))) { setMsg("Not sent: the code was not entered."); return; }
    setBusy(true);
    try {
      const no = newNumber();
      const { data, error } = await (await db()).rpc("reqgen_direct_send", { p_title: title.trim(), p_details: details.trim(), p_amount: money ? amount : 0, p_to: chosen.map((c) => c.id), p_request_no: no });
      if (error) throw new Error(/could not find|schema cache/i.test(error.message) ? "Sending to several people needs the v4.7.0 database step. Ask the Super Admin to run it." : error.message);
      const id = (data as { request_id?: string } | null)?.request_id;
      if (!id) throw new Error("ReqGen did not return the request. Check Requests before trying again.");
      alert(id, "waiting");
      if (files.length) { try { await uploadAll(id, me.id, files); } catch (e) { toast(plainError(e), "er"); } }
      replace(
        <Sent title={`Sent to ${chosen.length} ${chosen.length === 1 ? "person" : "people"}`} no={no} openNode={<Detail id={id} meId={me.id} />}>
          <div className="grp" style={{ width: "100%", textAlign: "left" }}>
            {chosen.map((p) => <Cell key={p.id} icon={initials(p.full_name)} title={p.full_name || "Staff"} sub="SMS, e-mail and app notice sent" right={<Chip tone="ok">Told</Chip>} />)}
          </div>
        </Sent>,
      );
    } catch (e) { setMsg(plainError(e)); setBusy(false); }
  }

  return (
    <>
      <Head title="Direct" />
      <Body bar>
        <div><span className="lbl">To</span>
          <div className="tags">
            {chosen.map((p) => <span className="tag" key={p.id}>{p.full_name || "Staff"}<button type="button" aria-label={`Remove ${p.full_name}`} onClick={() => setChosen((c) => c.filter((x) => x.id !== p.id))}><X size={14} strokeWidth={2.6} /></button></span>)}
            <button type="button" className="tag" style={{ background: "var(--card2)", color: "var(--ink)", paddingRight: 12 }} onClick={onAdd}><Plus size={14} strokeWidth={2.4} />Add</button>
          </div>
        </div>
        <label><span className="lbl">Title</span><input className="inp" value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lab keys for Monday" /></label>
        <label><span className="lbl">Message</span><textarea className="inp" value={details} maxLength={4000} onChange={(e) => setDetails(e.target.value)} placeholder="What you need from them" /></label>
        <div className="cell grp"><span className="t"><b>Money involved</b><small>{money ? "On. Type the amount." : "Off. Turn on to add an amount."}</small></span><Toggle on={money} onChange={setMoney} label="Money involved" /></div>
        {money ? <label><span className="lbl">Amount (₦)</span><input className="inp" inputMode="decimal" value={amountText} onChange={(e) => setAmountText(fmtAmount(e.target.value))} placeholder="0" /></label> : null}
        {files.length ? <div className="grp">{files.map((f, i) => (
          <div className="cell" key={`${f.name}-${i}`}><span className="av ic-mu"><Paperclip size={18} /></span><span className="t"><b>{f.name}</b><small>{kb(f.size)}</small></span><button type="button" className="ib" aria-label={`Remove ${f.name}`} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}><X size={18} /></button></div>
        ))}</div> : null}
        <input ref={fileRef} type="file" multiple accept={ACCEPT} hidden onChange={(e) => { const r = addFiles(files, e.target.files); setFiles(r.files); if (r.problem) setMsg(r.problem); e.target.value = ""; }} />
        <Note tone="in" icon={<Info size={16} />}>Only {chosen.length === 1 ? "this person sees" : `these ${chosen.length} people see`} it. Each answers on their own. To be paid, a receiver forwards it to the DG with the Account Officer.</Note>
        {msg ? <Note tone="er">{msg}</Note> : null}
        {!online ? <Note tone="wa">You are offline. Sending waits until the network returns.</Note> : null}
      </Body>
      <div className="bar">
        <button type="button" className="btn bs" style={{ flex: "0 0 auto" }} aria-label="Add a file" onClick={() => fileRef.current?.click()}><Paperclip size={18} /></button>
        <button type="button" className="btn bp" disabled={busy || !online} onClick={() => void send()}><Send size={18} />{busy ? "Sending…" : "Sign and send"}</button>
      </div>
    </>
  );
}
