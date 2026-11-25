import { useState } from "react";
import { Archive as ArchiveIcon, Bell, Check, Download, Plus, Send, Upload } from "lucide-react";
import { db } from "../../lib/core";
import { RETENTION, ageDaysOf, ageText, loadCorrespondence, remindRequest, retentionLabel, type Corr, type Track } from "../../lib/registry";
import { day, when, withWho } from "../../lib/text";
import { Body, Chip, Chips, Empty, FormSheet, Head, Item, More, Note, SearchBox, Sheet, Skeleton, toast, useMore } from "../../ui";
import { Err, Stats, call, rows, useAction, useLoad } from "./kit";

/**
 * App 4.1.0: Registry (PA to the DG). Numbers, dates, offices and people only: Registry never sees what a
 * request says or how much it is for.
 */
const addYears = (n: number) => { const d = new Date(); d.setFullYear(d.getFullYear() + n); return d.toISOString().slice(0, 10); };
type Move = { step_order: number; stage: string; person: string | null; state: "done" | "now" | "next" | "skipped"; at: string | null };

export function Tracking() {
  const [q, setQ] = useState("");
  const [late, setLate] = useState(false);
  const [open, setOpen] = useState<Track | null>(null);
  const { data, error, reload } = useLoad(async () => (await rows<Track>("reqgen_registry_tracking")).sort((a, b) => a.waiting_since.localeCompare(b.waiting_since)), []);
  const now = Date.now();
  const list = (data || []).filter((r) => (!late || ageDaysOf(r.waiting_since, now) >= 3) && (!q.trim() || `${r.request_no} ${r.office} ${r.owner_name}`.toLowerCase().includes(q.trim().toLowerCase())));
  const { shown, more, left } = useMore(list);
  return (
    <>
      <Head title="Request Tracking" />
      <Body onRefresh={reload}>
        <Note tone="mu">Numbers and who holds them only. Registry never sees what a request says.</Note>
        <Stats items={[{ label: "On the move", value: (data || []).length }, { label: "Waiting 3+ days", value: (data || []).filter((r) => ageDaysOf(r.waiting_since, now) >= 3).length, tone: "wa" }]} />
        <Chips label="Show" value={late ? "late" : "all"} onChange={(k) => setLate(k === "late")} items={[{ k: "all", label: "All" }, { k: "late", label: "Waiting 3+ days" }]} />
        <SearchBox value={q} onChange={setQ} placeholder="Search number, office or person" />
        <Err text={error} />
        {!data ? <Skeleton rows={4} /> : !list.length ? <Empty icon={<Check size={28} />} title="Nothing waiting" text="Every request has moved on." /> : shown.map((r) => {
          const days = ageDaysOf(r.waiting_since, now);
          return (
            <Item key={r.id} title={r.request_no || "Request"} sub={`${r.office}, ${r.request_type}`} chip={<Chip tone={days >= 3 ? "er" : days >= 1 ? "wa" : "in"}>{ageText(r.waiting_since, now)}</Chip>}
              facts={[["With", `${r.owner_name}${r.stage ? `, ${withWho(r.stage).replace(/^the /, "")}` : ""}`], ["Since", when(r.waiting_since)], r.last_reminder ? ["Last reminder", when(r.last_reminder)] : null]} onClick={() => setOpen(r)}>
              <button type="button" className="btn bs sm" onClick={async () => { const x = await remindRequest(r.id); if (x.error) toast(x.error, "er"); else { toast(`Reminder sent to ${x.sentTo}.`); await reload(); } }}><Bell size={16} />Remind</button>
            </Item>
          );
        })}
        <More more={more} left={left} />
      </Body>
      <MovesSheet track={open} onClose={() => setOpen(null)} />
    </>
  );
}

function MovesSheet({ track, onClose }: { track: Track | null; onClose: () => void }) {
  const { data } = useLoad(async () => (track ? rows<Move>("reqgen_registry_moves", { p_request_id: track.id }) : []), [track?.id]);
  return (
    <Sheet open={!!track} onClose={onClose} title={track?.request_no || "Request"}>
      {!data ? <p className="mu">Loading…</p> : !data.length ? <p className="mu">No route recorded.</p> : (
        <ol className="tl">{data.map((m) => (
          <li key={m.step_order}><span className={`pt ${m.state === "done" ? "ic-ok" : m.state === "now" ? "ic-wa" : "ic-mu"}`}>{m.state === "done" ? <Check size={15} /> : <span style={{ fontWeight: 800, fontSize: 12 }}>{m.step_order}</span>}</span>
            <span className="tx"><b>{withWho(m.stage).replace(/^the /, "")}</b><small>{m.person || ""}{m.at ? `, ${when(m.at)}` : m.state === "now" ? ", holds it now" : m.state === "skipped" ? ", skipped" : ""}</small></span></li>
        ))}</ol>
      )}
    </Sheet>
  );
}

/** Incoming and outgoing letters and files. */
export function Correspondence({ direction }: { direction: "incoming" | "outgoing" }) {
  const incoming = direction === "incoming";
  const { data, error, reload } = useLoad(async () => {
    const [c, d] = await Promise.all([loadCorrespondence(direction), (await db()).from("departments").select("id,name").order("name")]);
    if (c.error) throw new Error(c.error);
    return { list: c.rows, depts: (d.data || []) as Array<{ id: string; name: string }> };
  }, [direction]);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [form, setForm] = useState<null | { subject: string; party: string; dept: string; priority: string; received: string; note: string; items: string }>(null);
  const { busy, err, setErr, run } = useAction();
  const status = (r: Corr) => r.status || (incoming ? "New" : "Ready to dispatch");
  const deptName = (id: string | null) => data?.depts.find((d) => d.id === id)?.name || "";
  const tabs = [...new Set((data?.list || []).map(status))];
  const list = (data?.list || []).filter((r) => (tab === "all" || status(r) === tab) && (!q.trim() || `${r.reference_no} ${r.subject} ${r.from_to}`.toLowerCase().includes(q.trim().toLowerCase())));
  const { shown, more, left } = useMore(list);
  const act = (r: Corr, action: "acknowledge" | "forward" | "delivered", receiver: string | null = null) => run(null, () => call("reqgen_registry_act", { p_id: r.id, p_action: action, p_department_id: r.department_id, p_receiver: receiver }), `${r.reference_no} ${action === "acknowledge" ? "acknowledged" : action === "forward" ? `forwarded to ${deptName(r.department_id) || "the office"}` : "marked delivered"}.`, reload);
  return (
    <>
      <Head title={incoming ? "Incoming" : "Outgoing"} />
      <Body onRefresh={reload}>
        <button type="button" className="btn bp block" onClick={() => setForm({ subject: "", party: "", dept: "", priority: "Normal", received: new Date().toISOString().slice(0, 16), note: "", items: "1" })}><Plus size={18} />{incoming ? "Record a letter received" : "Record a letter to send"}</button>
        <Chips label="Status" value={tab} onChange={setTab} items={[{ k: "all", label: "All" }, ...tabs.map((t) => ({ k: t, label: t }))]} />
        <SearchBox value={q} onChange={setQ} placeholder="Search reference, subject or party" />
        <Err text={error || err} />
        {!data ? <Skeleton rows={4} /> : !list.length ? <Empty icon={incoming ? <Download size={28} /> : <Upload size={28} />} title="Nothing here" text="Recorded letters and files appear here." /> : shown.map((r) => (
          <Item key={r.id} title={`${r.reference_no || ""} · ${r.subject || "Letter"}`} sub={`${incoming ? "From" : "To"} ${r.from_to || "-"}${r.department_id ? `, ${deptName(r.department_id)}` : ""}`} chip={<Chip tone={/new|ready/i.test(status(r)) ? "wa" : /deliver|dispatch|forward/i.test(status(r)) ? "ok" : "in"}>{status(r)}</Chip>}
            facts={[["Priority", r.priority || "Normal"], ["Recorded", day(r.received_at || r.created_at)], ["Items", String(r.items_count || 1)], r.receiver_name ? ["Received by", r.receiver_name] : null]}>
            {incoming && !r.acknowledged_at ? <button type="button" className="btn bs sm" disabled={busy} onClick={() => void act(r, "acknowledge")}>Acknowledge</button> : null}
            {incoming && r.acknowledged_at && !r.forwarded_at && r.department_id ? <button type="button" className="btn bp sm" disabled={busy} onClick={() => void act(r, "forward")}>Forward</button> : null}
          </Item>
        ))}
        <More more={more} left={left} />
      </Body>
      <FormSheet open={!!form} title={incoming ? "Letter received" : "Letter to send"} onClose={() => setForm(null)} saveLabel="Record" busy={busy} error={err} onSave={() => {
        if (!form) return;
        if (form.subject.trim().length < 2 || form.party.trim().length < 2) { setErr("Type the subject and who it is from or to."); return; }
        void run(null, () => call("reqgen_registry_save", { p_direction: direction, p_subject: form.subject.trim(), p_party: form.party.trim(), p_department_id: form.dept || null, p_priority: form.priority, p_received_at: incoming && form.received ? new Date(form.received).toISOString() : null, p_note: form.note || null, p_items: Number(form.items || 1) }), "Recorded.", async () => { setForm(null); await reload(); });
      }}>
        {form ? (<>
          <label><span className="lbl">Subject</span><input className="inp" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></label>
          <label><span className="lbl">{incoming ? "From" : "To"}</span><input className="inp" value={form.party} onChange={(e) => setForm({ ...form, party: e.target.value })} /></label>
          <label><span className="lbl">Office</span><select className="inp" value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })}><option value="">Choose (optional)</option>{(data?.depts || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <Chips label="Priority" value={form.priority} onChange={(p) => setForm({ ...form, priority: p })} items={[{ k: "Normal", label: "Normal" }, { k: "Urgent", label: "Urgent" }, { k: "Confidential", label: "Confidential" }]} />
          {incoming ? <label><span className="lbl">Received at</span><input className="inp" type="datetime-local" value={form.received} onChange={(e) => setForm({ ...form, received: e.target.value })} /></label> : null}
          <label><span className="lbl">Number of items</span><input className="inp" inputMode="numeric" value={form.items} onChange={(e) => setForm({ ...form, items: e.target.value.replace(/\D/g, "") })} /></label>
          <label><span className="lbl">Note (optional)</span><input className="inp" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
        </>) : null}
      </FormSheet>
    </>
  );
}

export function Dispatch() {
  const { data, error, reload } = useLoad(async () => { const c = await loadCorrespondence("outgoing"); if (c.error) throw new Error(c.error); return c.rows; }, []);
  const [picked, setPicked] = useState<string[]>([]);
  const [form, setForm] = useState<null | { method: string; receiver: string; note: string }>(null);
  const [deliver, setDeliver] = useState<Corr | null>(null);
  const [who, setWho] = useState("");
  const { busy, err, setErr, run } = useAction();
  const ready = (data || []).filter((r) => !r.dispatched_at);
  const sent = (data || []).filter((r) => r.dispatched_at && !r.delivered_at);
  return (
    <>
      <Head title="Dispatch" />
      <Body bar={picked.length > 0} onRefresh={reload}>
        <Err text={error} />
        <div className="sect"><b>Ready to dispatch ({ready.length})</b></div>
        {!data ? <Skeleton rows={3} /> : !ready.length ? <p className="mu">Nothing to dispatch.</p> : (
          <div className="grp">{ready.map((r) => { const on = picked.includes(r.id); return (
            <button key={r.id} type="button" className="cell" role="checkbox" aria-checked={on} onClick={() => setPicked((p) => on ? p.filter((x) => x !== r.id) : [...p, r.id])}>
              <span className={`box${on ? " on" : ""}`} aria-hidden="true">{on ? <Check size={15} strokeWidth={3} /> : null}</span><span className="t"><b>{r.reference_no}</b><small className="wrap">{r.subject}, to {r.from_to}</small></span>
            </button>
          ); })}</div>
        )}
        <div className="sect"><b>Dispatched, not yet delivered ({sent.length})</b></div>
        {sent.map((r) => <Item key={r.id} title={`${r.reference_no} · ${r.subject || ""}`} sub={`${r.dispatch_method || ""} ${when(r.dispatched_at)}`}><button type="button" className="btn bs sm" onClick={() => { setWho(r.receiver_name || ""); setDeliver(r); }}>Mark delivered</button></Item>)}
      </Body>
      {picked.length ? <div className="bar"><button type="button" className="btn bp" onClick={() => setForm({ method: "Hand delivery", receiver: "", note: "" })}><Send size={18} />Dispatch {picked.length}</button></div> : null}
      <FormSheet open={!!form} title={`Dispatch ${picked.length} item${picked.length === 1 ? "" : "s"}`} onClose={() => setForm(null)} saveLabel="Dispatch" busy={busy} error={err} onSave={() => {
        if (!form) return;
        if (form.receiver.trim().length < 2) { setErr("Type who received it or who carries it."); return; }
        void run(null, () => call("reqgen_registry_dispatch", { p_ids: picked, p_method: form.method, p_receiver: form.receiver.trim(), p_note: form.note || null }), "Dispatched.", async () => { setForm(null); setPicked([]); await reload(); });
      }}>
        {form ? (<>
          <Chips label="Method" value={form.method} onChange={(m) => setForm({ ...form, method: m })} items={["Hand delivery", "Courier", "Email"].map((k) => ({ k, label: k }))} />
          <label><span className="lbl">Receiver or carrier</span><input className="inp" value={form.receiver} onChange={(e) => setForm({ ...form, receiver: e.target.value })} /></label>
          <label><span className="lbl">Note (optional)</span><input className="inp" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
        </>) : null}
      </FormSheet>
      <FormSheet open={!!deliver} title={`${deliver?.reference_no || ""} delivered`} onClose={() => setDeliver(null)} saveLabel="Save" busy={busy} error={err} onSave={() => {
        if (!deliver || who.trim().length < 2) { setErr("Type who received it."); return; }
        void run(null, () => call("reqgen_registry_act", { p_id: deliver.id, p_action: "delivered", p_department_id: null, p_receiver: who.trim() }), "Marked delivered.", async () => { setDeliver(null); await reload(); });
      }}><label><span className="lbl">Received by</span><input className="inp" value={who} onChange={(e) => setWho(e.target.value)} /></label></FormSheet>
    </>
  );
}

type Rec = { id: string; record_kind: string; record_id: string | null; record_no: string; description: string | null; category: string; keep_until: string | null; permanent: boolean; location: string | null; archived_by_label: string | null; archived_at: string; restored_at: string | null; reviewed_at: string | null; review_note: string | null };
export function Archive() {
  const { data, error, reload } = useLoad(async () => {
    const [a, c] = await Promise.all([(await db()).from("reqgen_registry_archive").select("*").order("archived_at", { ascending: false }).limit(20000), loadCorrespondence("all")]);
    if (a.error) throw new Error(a.error.message);
    return { recs: (a.data || []) as Rec[], letters: c.rows.filter((x) => !x.archived_at) };
  }, []);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<null | { kind: string; letter: string; no: string; desc: string; category: string; keep: string; permanent: boolean; location: string }>(null);
  const [act, setAct] = useState<null | { r: Rec; a: "restore" | "review" }>(null);
  const [note, setNote] = useState("");
  const { busy, err, setErr, run } = useAction();
  const today = new Date().toISOString().slice(0, 10);
  const list = (data?.recs || []).filter((r) => !r.restored_at && (!q.trim() || `${r.record_no} ${r.description} ${r.location}`.toLowerCase().includes(q.trim().toLowerCase())));
  const due = list.filter((r) => !r.permanent && r.keep_until && r.keep_until <= today);
  const { shown, more, left } = useMore(list);
  return (
    <>
      <Head title="Archive" />
      <Body onRefresh={reload}>
        <Stats items={[{ label: "Filed", value: list.length }, { label: "Due for review", value: due.length, tone: due.length ? "wa" : undefined }]} />
        <button type="button" className="btn bp block" onClick={() => setForm({ kind: "letter", letter: "", no: "", desc: "", category: RETENTION[1].value, keep: addYears(3), permanent: false, location: "" })}><Plus size={18} />Archive a record</button>
        <SearchBox value={q} onChange={setQ} placeholder="Search number, description or shelf" />
        <Err text={error || err} />
        {!data ? <Skeleton rows={4} /> : !list.length ? <Empty icon={<ArchiveIcon size={28} />} title="Nothing filed yet" text="Filed records appear here with their shelf." /> : shown.map((r) => (
          <Item key={r.id} title={r.record_no} sub={r.description || r.record_kind} chip={<Chip tone={!r.permanent && r.keep_until && r.keep_until <= today ? "wa" : "mu"}>{r.permanent ? "Permanent" : `Until ${day(r.keep_until)}`}</Chip>}
            facts={[["Retention", retentionLabel(r.category)], ["Shelf", r.location || "-"], ["Filed", `${day(r.archived_at)}${r.archived_by_label ? `, ${r.archived_by_label}` : ""}`], r.review_note ? ["Review", r.review_note] : null]}>
            <button type="button" className="btn bs sm" onClick={() => { setNote(""); setAct({ r, a: "review" }); }}>Review</button>
            <button type="button" className="btn bs sm" onClick={() => { setNote(""); setAct({ r, a: "restore" }); }}>Take out</button>
          </Item>
        ))}
        <More more={more} left={left} />
      </Body>
      <FormSheet open={!!form} title="Archive a record" onClose={() => setForm(null)} saveLabel="Archive" busy={busy} error={err} onSave={() => {
        if (!form) return;
        const letter = data?.letters.find((l) => l.id === form.letter);
        if (form.kind === "letter" ? !letter : form.no.trim().length < 2) { setErr(form.kind === "letter" ? "Choose the letter." : "Type the record number."); return; }
        void run(null, () => call("reqgen_registry_archive_add", { p_kind: form.kind, p_record_id: form.kind === "letter" ? letter?.id || null : null, p_record_no: form.kind === "letter" ? letter?.reference_no || "" : form.no.trim(), p_description: form.kind === "letter" ? letter?.subject || "Letter" : form.desc, p_category: form.category, p_keep_until: form.permanent ? null : form.keep || null, p_permanent: form.permanent, p_location: form.location }), "Archived.", async () => { setForm(null); await reload(); });
      }}>
        {form ? (<>
          <Chips label="Kind" value={form.kind} onChange={(k) => setForm({ ...form, kind: k })} items={[{ k: "letter", label: "A recorded letter" }, { k: "other", label: "Another record" }]} />
          {form.kind === "letter" ? <label><span className="lbl">Letter</span><select className="inp" value={form.letter} onChange={(e) => setForm({ ...form, letter: e.target.value })}><option value="">Choose</option>{(data?.letters || []).map((l) => <option key={l.id} value={l.id}>{l.reference_no}: {l.subject}</option>)}</select></label> : (<>
            <label><span className="lbl">Record number</span><input className="inp" value={form.no} onChange={(e) => setForm({ ...form, no: e.target.value })} /></label>
            <label><span className="lbl">Description</span><input className="inp" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} /></label>
          </>)}
          <label><span className="lbl">How long it is kept</span><select className="inp" value={form.category} onChange={(e) => { const r = RETENTION.find((x) => x.value === e.target.value); setForm({ ...form, category: e.target.value, permanent: r ? r.years === 0 : form.permanent, keep: r && r.years ? addYears(r.years) : form.keep }); }}>{RETENTION.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></label>
          {!form.permanent ? <label><span className="lbl">Keep until</span><input className="inp" type="date" value={form.keep} onChange={(e) => setForm({ ...form, keep: e.target.value })} /></label> : null}
          <label><span className="lbl">Shelf or cabinet</span><input className="inp" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Cabinet B, shelf 2" /></label>
        </>) : null}
      </FormSheet>
      <FormSheet open={!!act} title={act?.a === "restore" ? `Take ${act.r.record_no} out?` : `Review ${act?.r.record_no || ""}`} onClose={() => setAct(null)} saveLabel="Save" busy={busy} error={err} onSave={() => {
        if (!act || note.trim().length < 3) { setErr("Write the note."); return; }
        void run(null, () => act.a === "restore" ? call("reqgen_registry_archive_restore", { p_id: act.r.id, p_reason: note.trim() }) : call("reqgen_registry_archive_review", { p_id: act.r.id, p_keep_until: /keep/i.test(note) ? addYears(1) : null, p_note: note.trim() }), "Saved.", async () => { setAct(null); await reload(); });
      }}><label><span className="lbl">{act?.a === "restore" ? "Reason" : "Review note (write “keep” to keep it a year more)"}</span><input className="inp" value={note} onChange={(e) => setNote(e.target.value)} /></label></FormSheet>
    </>
  );
}

type FileItem = { kind: "request" | "voucher"; record_id: string; record_no: string; office: string; paid_at: string | null };
export function Filing() {
  const { data, error, reload } = useLoad(() => rows<FileItem>("reqgen_registry_filing_queue"), []);
  const [picked, setPicked] = useState<string[]>([]);
  const [form, setForm] = useState<null | { category: string; keep: string; location: string }>(null);
  const { busy, err, run } = useAction();
  const list = data || [];
  return (
    <>
      <Head title="Registry Filing" />
      <Body bar={picked.length > 0} onRefresh={reload}>
        <Note tone="mu">Paid requests and vouchers to file: numbers only.</Note>
        <Err text={error || err} />
        {!data ? <Skeleton rows={4} /> : !list.length ? <Empty icon={<ArchiveIcon size={28} />} title="Nothing to file" text="Paid requests and vouchers appear here." /> : (
          <div className="grp">{list.map((it) => { const k = `${it.kind}:${it.record_id}`; const on = picked.includes(k); return (
            <button key={k} type="button" className="cell" role="checkbox" aria-checked={on} onClick={() => setPicked((p) => on ? p.filter((x) => x !== k) : [...p, k])}>
              <span className={`box${on ? " on" : ""}`} aria-hidden="true">{on ? <Check size={15} strokeWidth={3} /> : null}</span><span className="t"><b>{it.record_no}</b><small>{it.kind === "voucher" ? "Voucher" : "Request"}, {it.office}{it.paid_at ? `, paid ${day(it.paid_at)}` : ""}</small></span>
            </button>
          ); })}</div>
        )}
      </Body>
      {picked.length ? <div className="bar"><button type="button" className="btn bp" onClick={() => setForm({ category: RETENTION[0].value, keep: addYears(6), location: "" })}><ArchiveIcon size={18} />File {picked.length}</button></div> : null}
      <FormSheet open={!!form} title={`File ${picked.length} record${picked.length === 1 ? "" : "s"}`} onClose={() => setForm(null)} saveLabel="File" busy={busy} error={err} onSave={() => {
        if (!form) return;
        const chosen = list.filter((it) => picked.includes(`${it.kind}:${it.record_id}`));
        void run(null, async () => {
          const failed: string[] = [];
          for (const it of chosen) {
            try { await call("reqgen_registry_archive_add", { p_kind: it.kind, p_record_id: it.record_id, p_record_no: it.record_no, p_description: null, p_category: form.category, p_keep_until: form.keep, p_permanent: false, p_location: form.location }); }
            catch (e) { failed.push(`${it.record_no}: ${e instanceof Error ? e.message : ""}`); }
          }
          if (failed.length) throw new Error(`Not filed: ${failed.join("; ")}`);
        }, "Filed.", async () => { setForm(null); setPicked([]); await reload(); });
      }}>
        {form ? (<>
          <label><span className="lbl">How long it is kept</span><select className="inp" value={form.category} onChange={(e) => { const r = RETENTION.find((x) => x.value === e.target.value); setForm({ ...form, category: e.target.value, keep: r && r.years ? addYears(r.years) : form.keep }); }}>{RETENTION.filter((r) => r.years > 0).map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></label>
          <label><span className="lbl">Keep until</span><input className="inp" type="date" value={form.keep} onChange={(e) => setForm({ ...form, keep: e.target.value })} /></label>
          <label><span className="lbl">Shelf or cabinet</span><input className="inp" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
        </>) : null}
      </FormSheet>
    </>
  );
}
