"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { confirmWithCode } from "@/lib/codeConfirm";
import { alertPeople } from "@/lib/v4/alerts";
import { nairaExact } from "@/lib/v4/money";
import Icon from "@/app/components/v4/Icon";
import { Select } from "@/app/components/v4/Select";
import { Notice } from "@/app/components/v4/ui";
import { celebrate } from "@/app/components/v4/Motion";
import { toast } from "@/lib/toast";

/**
 * ReqGen v4.7.0: a Direct request sent to one or many people.
 *  The route: from the sender to the people chosen, with each person's answer.
 *  A receiver still waiting answers on their own: approve, reply, decline, or forward
 *  (to the Director General with the Account Officer, to be paid; or to someone else).
 */
export type DirectPerson = { user_id: string; full_name: string | null; position_names: string | null; status: string; comment: string | null; read_at: string | null; acted_at: string | null; added_by_name: string | null };
type Req = { id: string; request_no?: string | null; amount?: number | null; created_by?: string | null; requester_name?: string | null; created_at?: string | null; current_stage?: string | null };
type Choice = "approve" | "reply" | "decline" | "forward" | "forward_dg";

const TONE: Record<string, string> = { Waiting: "amber", Approved: "green", Declined: "red", Replied: "blue", Forwarded: "blue" };
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const initials = (n: string | null) => String(n || "S").split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("");

export function useDirectPeople(requestId: string | null | undefined) {
  const [people, setPeople] = useState<DirectPerson[] | null>(null);
  const load = useCallback(async () => {
    if (!requestId) return;
    const { data, error } = await supabase.rpc("reqgen_direct_people_of", { p_request_id: requestId });
    setPeople(error ? [] : ((data || []) as DirectPerson[]));
  }, [requestId]);
  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);
  return { people, reload: load };
}

export default function DirectMany({ req, meId, people, onDone }: { req: Req; meId: string; people: DirectPerson[]; onDone: () => Promise<void> | void }) {
  const mine = people.find((p) => p.user_id === meId) || null;
  const waiting = !!mine && mine.status === "Waiting";
  const isMoney = Number(req.amount || 0) > 0;
  const [choice, setChoice] = useState<Choice>("approve");
  const [note, setNote] = useState("");
  const [to, setTo] = useState("");
  const [officer, setOfficer] = useState("");
  const [everyone, setEveryone] = useState<Array<{ id: string; full_name: string | null; dept: string }>>([]);
  const [officers, setOfficers] = useState<Array<{ id: string; full_name: string | null }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answered = people.filter((p) => p.status !== "Waiting").length;

  useEffect(() => { if (waiting && !mine?.read_at) void supabase.rpc("reqgen_direct_read", { p_request_id: req.id }); }, [waiting, mine?.read_at, req.id]);
  useEffect(() => {
    if (choice === "forward" && !everyone.length) {
      void supabase.from("departments").select("id,name").order("name").then(async ({ data }) => {
        const all: Array<{ id: string; full_name: string | null; dept: string }> = [];
        for (const d of (data || []) as Array<{ id: string; name: string }>) {
          const { data: ps } = await supabase.rpc("reqgen_direct_people", { p_dept_id: d.id });
          for (const p of (ps || []) as Array<{ id: string; full_name: string | null }>) if (p.id !== req.created_by && !people.some((x) => x.user_id === p.id)) all.push({ ...p, dept: d.name });
        }
        setEveryone(all.sort((a, b) => String(a.full_name).localeCompare(String(b.full_name))));
      });
    }
    if (choice === "forward_dg" && isMoney && !officers.length) void supabase.rpc("reqgen_direct_account_officers").then(({ data }) => setOfficers((data || []) as typeof officers));
  }, [choice, everyone.length, officers.length, isMoney, people, req.created_by]);

  const problem = (choice === "reply" || choice === "decline") && note.trim().length < 2 ? "Write your answer."
    : choice === "forward" && !to ? "Choose who to forward it to."
      : choice === "forward_dg" && isMoney && !officer ? "Choose the Account Officer who will pay it." : "";

  async function act() {
    if (problem) { setError(problem); return; }
    setError(null);
    const what = choice === "approve" ? "approve this request" : choice === "decline" ? "decline this request" : choice === "reply" ? "send your reply" : "forward this request";
    if (!(await confirmWithCode(what))) { setError("Not done: the code was not entered."); return; }
    setBusy(true);
    const { error: e } = await supabase.rpc("reqgen_direct_answer", { p_request_id: req.id, p_action: choice, p_comment: note.trim() || null, p_to: choice === "forward" ? to : choice === "forward_dg" ? officer || null : null });
    if (e) { setBusy(false); setError(e.message.replace(/^.*REQGEN_CODE_REQUIRED:\s*/, "")); return; }
    if (choice === "forward" || choice === "forward_dg") void alertPeople(req.id, "waiting");
    void alertPeople(req.id, "answered");
    if (choice === "approve") celebrate({ title: "Approved successfully", line: `${req.request_no || "The request"}: the sender is told.` });
    else toast({ text: choice === "decline" ? "Declined. The sender is told." : choice === "reply" ? "Reply sent. The sender is told." : "Forwarded. They are told by SMS, e-mail and in the app." });
    window.dispatchEvent(new Event("reqgen-approval-queue-changed"));
    setBusy(false); setNote("");
    await onDone();
  }

  async function remind(p: DirectPerson) {
    const r = await alertPeople(req.id, "waiting", [p.user_id]);
    toast({ text: r.error ? r.error : r.told ? `${p.full_name || "They"} got an SMS and e-mail reminder.` : "Already reminded in the last minute.", tone: r.error ? "error" : "success" });
  }

  const choices: Array<{ k: Choice; label: string; sub: string }> = [
    { k: "approve", label: "Approve", sub: "Agree and sign" },
    { k: "reply", label: "Reply", sub: "Answer with a note" },
    { k: "forward_dg", label: "Forward to the DG", sub: isMoney ? `To approve and pay ${nairaExact(req.amount)}` : "To approve and stamp" },
    { k: "forward", label: "Forward to someone", sub: "They answer on their own" },
    { k: "decline", label: "Decline", sub: "With your reason" },
  ];

  return (
    <>
      {waiting ? (
        <section className="v4-action-card v4-card-pad" aria-labelledby="dm-answer">
          <h2 className="v4-h2" id="dm-answer" style={{ marginBottom: 4 }}>Your answer</h2>
          <p className="v4-help" style={{ margin: "0 0 14px" }}>
            Sent to you directly by {req.requester_name || "a colleague"}{people.length > 1 ? `, and to ${people.length - 1} other ${people.length === 2 ? "person" : "people"}. Each answers on their own.` : "."}
          </p>
          <div className="v4-typecards v4-typecards-sm" role="radiogroup" aria-label="Your answer">
            {choices.map((c) => (
              <button key={c.k} type="button" role="radio" aria-checked={choice === c.k} className="v4-typecard" onClick={() => { setChoice(c.k); setError(null); }}>
                <span><strong>{c.label}</strong><small>{c.sub}</small></span>
                <Icon name="tick" className="v4-typecard-tick" />
              </button>
            ))}
          </div>
          <div className="v4-form-grid" style={{ marginTop: 14 }}>
            {choice === "forward" ? (
              <div className="v4-field v4-span-2">
                <span className="v4-flabel">Forward to <span className="v4-req">*</span></span>
                <Select value={to} onChange={setTo} ariaLabel="Forward to" placeholder={everyone.length ? "Choose the person" : "Loading staff…"} options={everyone.map((p) => ({ value: p.id, label: p.full_name || "Staff", hint: p.dept }))} />
              </div>
            ) : null}
            {choice === "forward_dg" && isMoney ? (
              <div className="v4-field v4-span-2">
                <span className="v4-flabel">Account Officer who will pay it <span className="v4-req">*</span></span>
                <Select value={officer} onChange={setOfficer} ariaLabel="Account Officer" placeholder="Choose the Account Officer" options={officers.map((o) => ({ value: o.id, label: o.full_name || "Account Officer" }))} />
              </div>
            ) : null}
            <label className="v4-field v4-span-2">
              <span className="v4-flabel">{choice === "reply" || choice === "decline" ? "Your answer" : "Note"} <span className="v4-muted" style={{ fontWeight: 600 }}>{choice === "reply" || choice === "decline" ? "(required)" : "(optional)"}</span></span>
              <textarea className="v4-textarea" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} style={{ minHeight: 80 }} placeholder={choice === "decline" ? "e.g. Not my office" : "e.g. Done, I will hand them over"} />
            </label>
          </div>
          {error ? <Notice tone="red">{error}</Notice> : null}
          <div className="v4-form-actions" style={{ marginTop: 14 }}>
            <button type="button" className={`v4-btn v4-btn-lg ${choice === "decline" ? "v4-btn-danger" : "v4-btn-primary"}`} disabled={busy} onClick={() => void act()}>
              <Icon name={choice === "approve" ? "pentool" : choice === "decline" ? "x" : "send"} />{busy ? "Working…" : choices.find((c) => c.k === choice)?.label}
            </button>
          </div>
          <p className="v4-help" style={{ margin: "8px 0 0", textAlign: "right" }}><Icon name="shield" size="sm" /> You confirm with the 6-digit code sent to your phone and e-mail.</p>
        </section>
      ) : null}

      <section className="v4-card v4-card-pad" aria-labelledby="dm-route">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <h2 className="v4-h2" id="dm-route">Route: from {req.created_by === meId ? "you" : req.requester_name || "the sender"} to {people.length} {people.length === 1 ? "person" : "people"}</h2>
          <span className="v4-chip v4-chip-blue">Direct, {answered} of {people.length} answered</span>
        </div>
        <ul className="v4-rows">
          {people.map((p) => (
            <li key={p.user_id}>
              <span className="v4-ri v4-t-brand" style={{ fontWeight: 800, fontSize: 13 }}>{initials(p.full_name)}</span>
              <span className="v4-rt">
                <strong>{p.full_name || "Staff"}{p.user_id === meId ? " (you)" : ""}</strong>
                <span>{p.comment ? `“${p.comment}” ` : ""}{p.status === "Waiting" ? (p.read_at ? `Read ${when(p.read_at)}, no answer yet` : "Not opened yet") : when(p.acted_at)}{p.added_by_name && p.added_by_name !== req.requester_name ? `, forwarded by ${p.added_by_name}` : ""}</span>
              </span>
              <span className="v4-rr" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className={`v4-chip v4-chip-${TONE[p.status] || "grey"}`}>{p.status}</span>
                {p.status === "Waiting" && req.created_by === meId ? <button type="button" className="v4-btn v4-btn-secondary" style={{ minHeight: 40 }} onClick={() => void remind(p)}><Icon name="bell" size="sm" />Remind</button> : null}
              </span>
            </li>
          ))}
        </ul>
        <p className="v4-help" style={{ margin: "12px 0 0" }}><Icon name="lock" size="sm" /> No HOD, HR, DG or Account step. Only the sender and these people can open it. Registry sees the number and who has it, never the message.</p>
      </section>
    </>
  );
}

