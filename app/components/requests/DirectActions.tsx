"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { nairaExact } from "@/lib/v4/money";
import { confirmFresh } from "@/lib/v4/freshConfirm";
import Icon from "@/app/components/v4/Icon";
import { Select } from "@/app/components/v4/Select";
import { Notice } from "@/app/components/v4/ui";
import { celebrate } from "@/app/components/v4/Motion";

export type DirectRequest = {
  id: string; request_no: string | null; current_stage: string | null; status: string | null; amount: number | null;
  created_by: string | null; current_owner: string | null; direct_to?: string | null;
};
type Choice = "to_dg" | "forward" | "return" | "decline" | "approve" | "resend";

const key = (s: string | null | undefined) => String(s || "").toUpperCase().replace(/[\s_-]+/g, "");

async function notify(requestId: string) {
  if (process.env.NEXT_PUBLIC_REQGEN_NOTIFICATIONS_ENABLED === "false") return;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;
  await fetch("/api/notifications/sms/request-approval", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ requestId }) }).catch(() => null);
}

/**
 * v4.6.10 — the decision card of a Direct request (reqgen_direct_act). Shown to the person holding it:
 * the addressed person (forward to the DG / to someone else, send back, decline), the DG (approve, send
 * back, decline) or the writer after a return (send again). The Account Officer treats it in Finance.
 */
export default function DirectActions({ req, meId, onDone }: { req: DirectRequest; meId: string; onDone: () => void | Promise<void> }) {
  const stage = key(req.current_stage);
  const writerBack = req.created_by === meId && /returned for correction/i.test(String(req.status || ""));
  const isMoney = Number(req.amount || 0) > 0;
  const choices: Array<{ k: Choice; label: string; sub: string }> = writerBack
    ? [{ k: "resend", label: "Send it again", sub: "After correcting it, it goes back to the person you wrote to." }]
    : stage === "DG"
      ? [
          { k: "approve", label: "Approve, sign and stamp", sub: isMoney ? "It goes to the chosen Account Officer to release the fund." : "The request closes as approved." },
          { k: "return", label: "Send back", sub: "Back to the officer who forwarded it, with your reason." },
          { k: "decline", label: "Decline", sub: "The request closes. The writer sees your reason." },
        ]
      : [
          { k: "to_dg", label: "Forward to the Director General", sub: isMoney ? "Choose the Account Officer who will treat it first." : "With your comment and signature." },
          { k: "forward", label: "Forward to someone else", sub: "Another person who should see it first." },
          { k: "return", label: "Send back to the writer", sub: "They correct it and send it again." },
          { k: "decline", label: "Decline", sub: "The request closes. The writer sees your reason." },
        ];
  const [choice, setChoice] = useState<Choice>(choices[0].k);
  const [comment, setComment] = useState("");
  const [officers, setOfficers] = useState<Array<{ id: string; full_name: string | null }>>([]);
  const [officer, setOfficer] = useState("");
  const [depts, setDepts] = useState<Array<{ id: string; name: string }>>([]);
  const [dept, setDept] = useState("");
  const [people, setPeople] = useState<Array<{ id: string; full_name: string | null; position_names: string | null }>>([]);
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (choice === "to_dg" && isMoney && !officers.length) void supabase.rpc("reqgen_direct_account_officers").then(({ data }) => setOfficers((data || []) as typeof officers));
    if (choice === "forward" && !depts.length) void supabase.from("departments").select("id,name").order("name").then(({ data }) => setDepts((data || []) as typeof depts));
  }, [choice, isMoney, officers.length, depts.length]);
  useEffect(() => {
    if (!dept) return;
    void supabase.rpc("reqgen_direct_people", { p_dept_id: dept }).then(({ data }) => setPeople(((data || []) as typeof people).filter((p) => p.id !== req.created_by)));
  }, [dept, req.created_by]);

  const needsReason = choice === "return" || choice === "decline";
  const problem = needsReason && comment.trim().length < 3 ? "Write the reason."
    : choice === "to_dg" && isMoney && !officer ? "Choose the Account Officer who will treat it."
      : choice === "forward" && !to ? "Choose the person to forward it to." : "";

  async function act() {
    if (problem) { setError(problem); return; }
    setError(null);
    if (choice === "approve" || choice === "to_dg") {
      const fresh = await confirmFresh(choice === "approve" ? "sign and stamp" : "sign and forward it");
      if (fresh) { if (fresh !== "cancelled") setError(fresh); return; }
    }
    setBusy(true);
    const { error: e } = await supabase.rpc("reqgen_direct_act", {
      p_request_id: req.id, p_action: choice, p_comment: comment.trim() || null,
      p_to: choice === "forward" ? to : null, p_account_officer: choice === "to_dg" && isMoney ? officer : null,
    });
    if (e) { setBusy(false); setError(e.message); return; }
    if (choice === "approve") celebrate({ title: "Approved and stamped", line: `${req.request_no || "The request"} ${isMoney ? "goes to Account." : "is approved."}`, stamp: true });
    else celebrate({ title: choice === "return" ? "Sent back successfully" : choice === "decline" ? "Done successfully" : "Sent successfully", line: req.request_no || undefined });
    await notify(req.id);
    window.dispatchEvent(new Event("reqgen-approval-queue-changed"));
    setBusy(false); setComment("");
    await onDone();
  }

  return (
    <section className="v4-action-card v4-card-pad" aria-labelledby="direct-decision">
      <h2 className="v4-h2" id="direct-decision" style={{ marginBottom: 4 }}>{writerBack ? "Correct and send again" : "Your decision"}</h2>
      <p className="v4-help" style={{ margin: "0 0 14px" }}>
        {writerBack ? "Correct the request with Edit if needed, then send it again." : `A direct request${isMoney ? ` for ${nairaExact(req.amount)}` : ""}. No subhead is needed.`}
      </p>
      <div className="v4-typecards v4-typecards-sm" role="radiogroup" aria-label="Decision">
        {choices.map((c) => (
          <button key={c.k} type="button" role="radio" aria-checked={choice === c.k} className="v4-typecard" onClick={() => { setChoice(c.k); setError(null); }}>
            <span><strong>{c.label}</strong><small>{c.sub}</small></span>
            <Icon name="tick" className="v4-typecard-tick" />
          </button>
        ))}
      </div>
      <div className="v4-form-grid" style={{ marginTop: 14 }}>
        {choice === "to_dg" && isMoney ? (
          <div className="v4-field v4-span-2">
            <label className="v4-flabel" htmlFor="dr-ao" style={{ fontSize: 13, fontWeight: 700 }}>Account Officer who will treat it <span className="v4-req">*</span></label>
            <Select id="dr-ao" value={officer} onChange={setOfficer} placeholder="Choose the Account Officer" options={officers.map((o) => ({ value: o.id, label: o.full_name || "Account Officer" }))} />
          </div>
        ) : null}
        {choice === "forward" ? (
          <>
            <div className="v4-field">
              <label className="v4-flabel" htmlFor="dr-fdept" style={{ fontSize: 13, fontWeight: 700 }}>Department</label>
              <Select id="dr-fdept" value={dept} onChange={(v) => { setDept(v); setTo(""); }} placeholder="Choose the department" options={depts.map((d) => ({ value: d.id, label: d.name }))} />
            </div>
            <div className="v4-field">
              <label className="v4-flabel" htmlFor="dr-fto" style={{ fontSize: 13, fontWeight: 700 }}>Forward to <span className="v4-req">*</span></label>
              <Select id="dr-fto" value={to} onChange={setTo} disabled={!dept} placeholder={dept ? "Choose the person" : "Choose the department first"} menuMinWidth={280}
                options={people.map((p) => ({ value: p.id, label: p.full_name || "Staff", hint: p.position_names || "Staff" }))} />
            </div>
          </>
        ) : null}
        <label className="v4-field v4-span-2">
          <span className="v4-flabel">{needsReason ? <>Reason <span className="v4-req">*</span></> : "Comment"}</span>
          <textarea className="v4-textarea" value={comment} maxLength={1000} onChange={(e) => setComment(e.target.value)} placeholder={needsReason ? "Why?" : "Your comment (optional)"} style={{ minHeight: 80 }} />
        </label>
      </div>
      {error ? <Notice tone="red">{error}</Notice> : null}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <button type="button" className={`v4-btn v4-btn-lg ${choice === "decline" ? "v4-btn-danger" : "v4-btn-primary"}`} disabled={busy || !!problem} onClick={() => void act()}>
          <Icon name={choice === "approve" || choice === "to_dg" ? "pentool" : choice === "decline" ? "x" : choice === "return" ? "returned" : "send"} />
          {busy ? "Working…" : choices.find((c) => c.k === choice)?.label}
        </button>
      </div>
      {choice === "approve" || choice === "to_dg" ? <p className="v4-help" style={{ margin: "8px 0 0", textAlign: "right" }}><Icon name="fingerprint" size="sm" /> You confirm with your fingerprint or your 2FA code.</p> : null}
    </section>
  );
}
