import { useMemo, useState } from "react";
import { Paperclip, Send, X } from "lucide-react";
import { alert, askCode, db, plainError } from "../lib/core";
import { useOnline, type Req } from "../lib/data";
import { ACCEPT, addFiles, fmtAmount, kb, parseAmount, uploadAll } from "../lib/files";
import { naira } from "../lib/text";
import { useApp } from "../App";
import { AttachButtons, Body, Head, Note, toast, useNav } from "../ui";
import { SubheadField, useLive, useSubheads } from "./Budget";

type Full = Req & { details: string | null; subhead_id: string | null };

/**
 * App 4.1.0 (HR's rule): the sender corrects their own request, only when it was sent back to them,
 * and sends it again in one step. Officers never change a request; they comment.
 */
export default function EditRequest({ r, deptName, onDone }: { r: Full; deptName: string; onDone: () => Promise<void> }) {
  const { me } = useApp();
  const { pop } = useNav();
  const online = useOnline();
  const official = String(r.request_type || "").toUpperCase() === "OFFICIAL";
  const isFund = official || String(r.personal_category || "").toUpperCase() === "FUND";
  const [title, setTitle] = useState(r.title || "");
  const [details, setDetails] = useState(r.details || "");
  const [amountText, setAmountText] = useState(r.amount ? fmtAmount(String(r.amount)) : "");
  const [subId, setSubId] = useState(r.subhead_id || "");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const amount = parseAmount(amountText);
  const subs = useSubheads(r.dept_id || "", official);
  // a correction needs only the difference when the subhead stays the same (the old amount is already reserved)
  const extra = !(amount > 0) ? NaN : subId && subId === r.subhead_id ? amount - Number(r.amount || 0) : amount;
  const live = useLive(subId, extra, official);

  const problem = useMemo(() => {
    if (title.trim().length < 2) return "Type the title.";
    if (details.trim().length < 2) return "Type the details.";
    if (isFund && !(amount > 0)) return "Type the amount in naira.";
    if (official && subs && subs.length && !subId) return "Choose the budget subhead.";
    if (live === "checking") return "Checking the budget…";
    if (live === "not_enough") return "This subhead cannot finance the amount. Choose another subhead, lower the amount, or contact the Auditor.";
    if (note.trim().length < 3) return "Say what you changed: the officer sees this note.";
    if (!me.signature_url) return "Add your signature in Me › Signature and photo first.";
    return "";
  }, [title, details, isFund, amount, official, subs, subId, live, note, me.signature_url]);

  async function save() {
    if (problem) { setMsg(problem); return; }
    setMsg(null);
    if (!(await askCode("send the corrected request"))) { setMsg("Not sent: it was not confirmed."); return; }
    setBusy("Saving…");
    try {
      const s = await db();
      const c = await s.rpc("reqgen_correct_request", {
        p_request_id: r.id, p_title: title.trim(), p_details: details.trim(),
        p_amount: isFund ? amount : null, p_subhead_id: official ? subId || null : null, p_note: note.trim(),
      });
      if (c.error) throw new Error(c.error.message);
      if (files.length) {
        setBusy("Adding files…");
        try { await uploadAll(r.id, me.id, files); } catch (e) { toast(plainError(e), "er"); }
      }
      setBusy("Sending…");
      const back = await s.rpc("reqgen_resubmit_request", { p_request_id: r.id, p_comment: note.trim() });
      if (back.error) throw new Error("Saved, but it could not be sent again: " + plainError(back.error));
      alert(r.id, "waiting");
      toast("Corrected and sent again.");
      await onDone();
      pop();
    } catch (e) { setMsg(plainError(e)); }
    finally { setBusy(""); }
  }

  return (
    <>
      <Head title={`Correct ${r.request_no || "request"}`} />
      <Body bar>
        <Note tone="in">It was sent back to you, so only you can change it now. When you send it again it goes back to the officer, with your note.</Note>
        <label><span className="lbl">Title</span><input className="inp" value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} /></label>
        <label><span className="lbl">Details</span><textarea className="inp" value={details} maxLength={4000} onChange={(e) => setDetails(e.target.value)} /></label>
        {isFund ? <label><span className="lbl">Amount (₦)</span><input className="inp" inputMode="decimal" value={amountText} onChange={(e) => setAmountText(fmtAmount(e.target.value))} /></label> : null}
        {official ? <SubheadField subs={subs} value={subId} onChange={setSubId} live={live} deptName={deptName} /> : null}
        <div>
          <span className="lbl">Add files (optional)</span>
          {files.length ? <div className="grp" style={{ marginBottom: 8 }}>{files.map((f, i) => (
            <div className="cell" key={`${f.name}-${i}`}><span className="av ic-mu"><Paperclip size={18} /></span><span className="t"><b>{f.name}</b><small>{kb(f.size)}</small></span><button type="button" className="ib" aria-label={`Remove ${f.name}`} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}><X size={18} /></button></div>
          ))}</div> : null}
          <AttachButtons accept={ACCEPT} onFiles={(list) => { const x = addFiles(files, list); setFiles(x.files); if (x.problem) setMsg(x.problem); }} />
        </div>
        <label><span className="lbl">What you changed (the officer sees this)</span><textarea className="inp" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Quotation attached and amount lowered" style={{ minHeight: 84 }} /></label>
        {msg ? <Note tone="er">{msg}</Note> : null}
        {!online ? <Note tone="wa">You are offline. Sending waits until the network returns.</Note> : null}
      </Body>
      <div className="bar">
        <button type="button" className="btn bp" disabled={!!busy || !online} onClick={() => void save()}><Send size={18} />{busy || `Sign and send again${isFund && amount > 0 ? `, ${naira(amount)}` : ""}`}</button>
      </div>
    </>
  );
}
