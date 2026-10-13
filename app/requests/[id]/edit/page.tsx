"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import RequestAccessGate from "@/app/components/requests/RequestAccessGate";
import { supabase } from "@/lib/supabaseClient";
import { normalizeRole } from "@/lib/roles";
import { canSeeBudgetBalances } from "@/lib/v4/budgetVisibility";
import { stageTitle } from "@/lib/v4/requestText";
import { formatAmountInput, nairaExact, nairaInWords, parseAmount } from "@/lib/v4/money";
import { fingerprintAvailable, fingerprintStepUp } from "@/lib/v4/deviceSignIn";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { Select } from "@/app/components/v4/Select";
import { Notice, PageHead, Skeleton, V4Page } from "@/app/components/v4/ui";

/**
 * ReqGen v4.1.2 — Correct Request (mock-up 27).
 *
 * The requester corrects a request that was sent back (or edits it while it
 * is still at an early step); the officer who holds it at an early step may
 * also correct it. Type and department are locked after submission. A note
 * saying what changed is required and shown to the officer. When the request
 * was sent back, "Sign and resubmit" saves and returns it to the officer who
 * sent it back (or, after a reopen, to the first officer).
 */

type Req = {
  id: string; request_no: string | null; title: string; details: string; amount: number | null; status: string | null;
  current_stage: string; current_owner: string | null; created_by: string; dept_id: string | null; subhead_id: string | null;
  funds_state: string | null; request_type: string | null; personal_category: string | null;
};
type Sub = { id: string; code: string | null; name: string; approved_allocation?: number | null; reserved_amount?: number | null; expenditure?: number | null };
type Hist = { id: string; action_type: string; comment: string | null; actor_name: string | null; actor_role_name: string | null; created_at: string };
type Existing = { id: string; file_name: string; file_size: number | null; url: string | null };

const EARLY_OFFICIAL = ["PD", "PO", "DOD", "DIRECTOR", "DINADMIN", "REGISTRAR", "HOD"];
const EARLY_PERSONAL = ["DOD", "HOD", "HR"];
const CLOSED = ["DG", "ACCOUNT", "HRFILING", "COMPLETED", "REJECTED", "DELETED", "CANCELLED"];

function key(s: string | null | undefined) { return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function err(e: unknown) { return e instanceof Error ? e.message : "Something went wrong."; }
function size(b: number | null | undefined) { const n = Number(b || 0); return n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`; }
function safeName(name: string) {
  const parts = name.split(".");
  const ext = parts.length > 1 ? (parts.pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) : "";
  const base = parts.join(".").toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "attachment";
  return ext ? `${base}.${ext}` : base;
}

export default function EditRequestPage() {
  const params = useParams<{ id: string }>();
  return (
    <RequestAccessGate requestId={params?.id}>
      <Suspense fallback={<V4Page><Skeleton lines={6} /></V4Page>}>
        <CorrectRequest id={params?.id || ""} />
      </Suspense>
    </RequestAccessGate>
  );
}

function CorrectRequest({ id }: { id: string }) {
  const router = useRouter();
  const embedded = useSearchParams().get("embedded") === "1";
  const who = useIdentity();
  const [loading, setLoading] = useState(true);
  const [req, setReq] = useState<Req | null>(null);
  const [me, setMe] = useState<{ id: string; full_name: string | null; signature_url: string | null } | null>(null);
  const [deptName, setDeptName] = useState("");
  const [subs, setSubs] = useState<Sub[]>([]);
  const [lastBack, setLastBack] = useState<Hist | null>(null);
  const [existing, setExisting] = useState<Existing[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [amountText, setAmountText] = useState("");
  const [subheadId, setSubheadId] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "red" | "green" | "amber" | "blue"; text: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [live, setLive] = useState<"idle" | "checking" | "available" | "not_enough" | "unknown">("idle");
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [canFinger, setCanFinger] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const role = normalizeRole(who.role);
  const seeBalances = canSeeBudgetBalances(who.role);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.push("/login"); return; }
    const [prof, r, factors] = await Promise.all([
      supabase.from("profiles").select("id,full_name,signature_url").eq("id", auth.user.id).maybeSingle(),
      supabase.from("requests").select("id,request_no,title,details,amount,status,current_stage,current_owner,created_by,dept_id,subhead_id,funds_state,request_type,personal_category").eq("id", id).maybeSingle(),
      supabase.auth.mfa.listFactors(),
    ]);
    setMe((prof.data || null) as typeof me);
    setFactorId(factors.data?.totp.find((f) => f.status === "verified")?.id || null);
    const row = (r.data || null) as Req | null;
    setReq(row);
    if (row) {
      setTitle(row.title || "");
      setDetails(row.details || "");
      setAmountText(row.amount ? formatAmountInput(String(row.amount)) : "");
      setSubheadId(row.subhead_id || "");
      const [dep, hist, att] = await Promise.all([
        row.dept_id ? supabase.from("departments").select("name").eq("id", row.dept_id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from("request_history").select("id,action_type,comment,actor_name,actor_role_name,created_at").eq("request_id", row.id).in("action_type", ["Return", "Reopen"]).order("created_at", { ascending: false }).limit(1),
        supabase.from("request_attachments").select("id,file_name,file_path,file_size").eq("request_id", row.id).order("created_at", { ascending: true }),
      ]);
      setDeptName(String((dep.data as { name?: string } | null)?.name || ""));
      setLastBack(((hist.data || []) as Hist[])[0] || null);
      const rows = (att.data || []) as Array<{ id: string; file_name: string; file_path: string; file_size: number | null }>;
      const signed = await Promise.all(rows.map(async (a) => {
        const s = await supabase.storage.from("request-attachments").createSignedUrl(a.file_path, 600);
        return { id: a.id, file_name: a.file_name, file_size: a.file_size, url: s.data?.signedUrl || null };
      }));
      setExisting(signed);
    }
    setLoading(false);
    void fingerprintAvailable().then(setCanFinger);
  }, [id, router]);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  // subheads of the department: names for staff, figures for officers
  useEffect(() => {
    if (!req?.dept_id || !who.ready || key(req.request_type) !== "OFFICIAL") return;
    let alive = true;
    (async () => {
      if (seeBalances) {
        const { data } = await supabase.from("subheads").select("id,code,name,approved_allocation,reserved_amount,expenditure").eq("dept_id", req.dept_id).eq("is_active", true).order("code");
        if (alive) setSubs((data || []) as Sub[]);
      } else {
        const { data } = await supabase.rpc("reqgen_department_subhead_names", { p_dept_id: req.dept_id });
        if (alive) setSubs((data || []) as Sub[]);
      }
    })();
    return () => { alive = false; };
  }, [req?.dept_id, req?.request_type, who.ready, seeBalances]);

  const stage = key(req?.current_stage);
  const isOfficial = key(req?.request_type) === "OFFICIAL";
  const isFund = isOfficial || key(req?.personal_category) === "FUND";
  const closed = !!req && (CLOSED.includes(stage) || /reject|cancel|delete|paid|closed|complete/i.test(String(req.status || "")));
  const early = !!req && (isOfficial ? EARLY_OFFICIAL.includes(stage) : EARLY_PERSONAL.includes(stage));
  const isRequester = !!req && !!me && req.created_by === me.id;
  const isHolder = !!req && !!me && req.current_owner === me.id;
  const sentBack = !!req && /^returned for correction/i.test(String(req.status || "")) && isHolder;
  const isOverseer = ["admin", "auditor"].includes(role);
  const canEdit = !!req && !closed && early && (isRequester || isHolder || isOverseer);
  const officerFinance = isOfficial && (isOverseer || (isHolder && !isRequester && ["hod", "registrar", "dinadmin", "dod", "director"].includes(role.replace(/\d+$/, ""))));
  const requesterReserved = isRequester && !officerFinance && String(req?.funds_state || "").toLowerCase() === "reserved";
  const canChangeSubhead = isOfficial && (officerFinance || (isRequester && (sentBack || !requesterReserved)));
  const canChangeAmount = isFund && (officerFinance || (isRequester && (sentBack || !requesterReserved)));

  const amount = parseAmount(amountText);
  const amountChanged = isFund && Number.isFinite(amount) && Math.abs(amount - Number(req?.amount || 0)) > 0.001;
  const subChanged = isOfficial && subheadId !== (req?.subhead_id || "");

  useEffect(() => {
    if (!isOfficial || !subheadId || !(amount > 0) || (!amountChanged && !subChanged)) { queueMicrotask(() => setLive("idle")); return; }
    if (seeBalances) {
      const s = subs.find((x) => x.id === subheadId);
      if (!s) { queueMicrotask(() => setLive("idle")); return; }
      const avail = Number(s.approved_allocation || 0) - Number(s.reserved_amount || 0) - Number(s.expenditure || 0) + (subheadId === req?.subhead_id && String(req?.funds_state || "").toLowerCase() === "reserved" ? Number(req?.amount || 0) : 0);
      queueMicrotask(() => setLive(amount <= avail ? "available" : "not_enough"));
      return;
    }
    queueMicrotask(() => setLive("checking"));
    const extra = subheadId === req?.subhead_id ? amount - Number(req?.amount || 0) : amount;
    const t = window.setTimeout(() => {
      if (extra <= 0) { setLive("available"); return; }
      void supabase.rpc("reqgen_subhead_live_check", { p_subhead_id: subheadId, p_amount: extra }).then(({ data, error }) => {
        const v = String(Array.isArray(data) ? data[0] : data || "");
        setLive(error ? "unknown" : v === "available" ? "available" : v === "not_enough" ? "not_enough" : "unknown");
      });
    }, 350);
    return () => window.clearTimeout(t);
  }, [isOfficial, subheadId, amount, amountChanged, subChanged, seeBalances, subs, req?.subhead_id, req?.amount, req?.funds_state]);

  const problem = useMemo(() => {
    if (!title.trim()) return "Type the title.";
    if (!details.trim()) return "Type the description.";
    if (isFund && !(amount > 0)) return "Type the amount.";
    if (live === "not_enough") return "Not enough fund in this subhead for the new amount. Choose another subhead or lower the amount.";
    if (live === "checking") return "Checking the budget…";
    if (note.trim().length < 3) return "Say what you changed — the officer sees this note.";
    if (!me?.signature_url) return "Add your signature in My Account first.";
    return "";
  }, [title, details, isFund, amount, live, note, me]);

  async function confirmIdentity(): Promise<boolean> {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === "aal2") return true;
    if (!factorId && !canFinger) { setMsg({ tone: "red", text: "Set up 2FA in My Account › Security before correcting a request." }); return false; }
    setCode("");
    setCodeOpen(true);
    return false;
  }

  async function save() {
    if (!req || !me) return;
    setMsg(null);
    if (problem) { setMsg({ tone: "red", text: problem }); return; }
    if (!(await confirmIdentity())) return;
    await doSave();
  }

  async function doSave() {
    if (!req || !me) return;
    setBusy("Saving…");
    try {
      if (isRequester) {
        // v4.1.2: the requester's own correction (fund re-reserved with the hard block)
        const { error } = await supabase.rpc("reqgen_correct_request", {
          p_request_id: req.id,
          p_title: title.trim(),
          p_details: details.trim(),
          p_amount: isFund ? (canChangeAmount ? amount : Number(req.amount || 0)) : null,
          p_subhead_id: isOfficial ? (canChangeSubhead ? subheadId || null : req.subhead_id) : null,
          p_note: note.trim(),
        });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.rpc("update_request_adjust_reservation", {
          p_request_id: req.id,
          p_new_subhead_id: canChangeSubhead ? subheadId || req.subhead_id : req.subhead_id,
          p_new_amount: canChangeAmount && isFund ? amount : Number(req.amount || 0),
          p_new_title: title.trim(),
          p_new_details: details.trim(),
        });
        if (error) throw new Error(error.message);
      }

      if (newFiles.length) {
        setBusy("Uploading attachments…");
        const rows = [];
        for (let i = 0; i < newFiles.length; i += 1) {
          const f = newFiles[i];
          const path = `${req.id}/${Date.now()}-${i + 1}-${safeName(f.name)}`;
          const up = await supabase.storage.from("request-attachments").upload(path, f, { upsert: false, contentType: f.type || "application/octet-stream" });
          if (up.error) throw new Error(`The changes were saved, but “${f.name}” did not upload: ${up.error.message}`);
          rows.push({ request_id: req.id, uploaded_by: me.id, file_name: f.name, file_path: path, file_type: f.type || null, file_size: f.size, verification_status: "Pending" });
        }
        const ins = await supabase.from("request_attachments").insert(rows);
        if (ins.error) throw new Error("The files uploaded but could not be linked: " + ins.error.message);
      }

      if (!isRequester) await supabase.from("request_history").insert({
        request_id: req.id,
        action_type: "Request Edited",
        comment: note.trim(),
        from_stage: req.current_stage,
        to_stage: req.current_stage,
        signature_url: me.signature_url,
        actor_name: me.full_name,
        actor_role_key: role || "staff",
        actor_role_name: who.roleName,
        action_by: me.id,
      });

      if (sentBack) {
        setBusy("Sending it back…");
        const back = await supabase.rpc("reqgen_resubmit_request", { p_request_id: req.id, p_comment: note.trim() });
        if (back.error) throw new Error("Saved, but it could not be sent back: " + back.error.message);
      }

      setMsg({ tone: "green", text: sentBack ? "Corrected and sent back." : "Changes saved." });
      if (embedded) { window.parent.postMessage({ type: "reqgen-request-edit-saved", requestId: req.id }, window.location.origin); return; }
      router.push(`/requests/${req.id}?updated=${Date.now()}`);
    } catch (e) {
      setMsg({ tone: "red", text: err(e) });
    } finally {
      setBusy("");
    }
  }

  async function verifyCode(v: string) {
    if (!factorId || v.length !== 6) return;
    setBusy("Checking the code…");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: v });
    setBusy("");
    if (error) { setMsg({ tone: "red", text: "The code is not correct: " + error.message }); setCode(""); return; }
    setCodeOpen(false);
    await doSave();
  }

  async function confirmWithFinger() {
    try { await fingerprintStepUp(); setCodeOpen(false); await doSave(); } catch (e) { setMsg({ tone: "red", text: err(e) }); }
  }

  if (loading || !who.ready) return <V4Page><PageHead title="Correct request" sub="Loading…" /><div className="v4-card"><Skeleton lines={6} /></div></V4Page>;
  if (!req) return <V4Page><Notice tone="red">This request was not found.</Notice></V4Page>;

  if (!canEdit) {
    return (
      <V4Page>
        <PageHead title={`Correct ${req.request_no || "request"}`} sub={req.title} />
        <Notice tone="amber" title="This request cannot be changed now.">
          {closed ? "It has reached the Director General, Account or is closed. Ask the Auditor if something is wrong." : "Only the requester (while it is at an early step or sent back), the officer holding it at an early step, the Auditor or the Super Admin can correct it."}
        </Notice>
        <div><Link className="v4-btn v4-btn-secondary" href={`/requests/${req.id}`}><Icon name="left" />Back to the request</Link></div>
      </V4Page>
    );
  }

  const subOptions = subs.map((s) => {
    const avail = s.approved_allocation !== undefined ? Number(s.approved_allocation || 0) - Number(s.reserved_amount || 0) - Number(s.expenditure || 0) : null;
    return { value: s.id, label: `${s.code ? `${s.code} — ` : ""}${s.name}`, hint: seeBalances && avail !== null ? `Available ${nairaExact(avail)}` : undefined };
  });
  const currentSub = subs.find((s) => s.id === (req.subhead_id || ""));

  return (
    <V4Page className="v4-newreq">
      {lastBack ? (
        <Notice tone="amber">
          <b>{String(lastBack.action_type).toLowerCase() === "reopen" ? "Reopened" : "Sent back"} by {lastBack.actor_name || "officer"}{lastBack.actor_role_name ? ` (${lastBack.actor_role_name})` : ""} on {new Date(lastBack.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}:</b> “{lastBack.comment}”
          {sentBack ? " Correct it below; it goes back to the same officer." : ""}
        </Notice>
      ) : null}
      <PageHead title={`Correct ${req.request_no || "request"}`} sub={<>{req.title}{deptName ? ` · ${deptName}` : ""}. Fields with a lock cannot change after submission.</>} />
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}

      <div className="v4-split">
        <form className="v4-card v4-card-pad" style={{ display: "flex", flexDirection: "column", gap: 22 }} onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <div className="v4-form-grid">
            <div className="v4-field"><span className="v4-flabel">Type</span><span className="v4-locked"><Icon name="lock" size="sm" />{isOfficial ? "Official" : `Personal · ${req.personal_category || ""}`}</span></div>
            <div className="v4-field"><span className="v4-flabel">Department</span><span className="v4-locked"><Icon name="lock" size="sm" />{deptName || "—"}</span></div>
            <label className="v4-field v4-span-2"><span className="v4-flabel">Title <span className="v4-req">*</span></span><input className="v4-input" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} /></label>
            <label className="v4-field v4-span-2"><span className="v4-flabel">Description <span className="v4-req">*</span></span><textarea className="v4-textarea" value={details} maxLength={2000} onChange={(e) => setDetails(e.target.value)} /></label>
            {isFund ? (
              <label className="v4-field">
                <span className="v4-flabel">Amount (₦) <span className="v4-req">*</span></span>
                {canChangeAmount
                  ? <input className="v4-input v4-num" inputMode="decimal" value={amountText} onChange={(e) => setAmountText(formatAmountInput(e.target.value))} />
                  : <span className="v4-locked"><Icon name="lock" size="sm" />{nairaExact(req.amount)}</span>}
                <span className="v4-help">{amountChanged ? `Was ${nairaExact(req.amount)} · now ${nairaInWords(amount)}` : `Was ${nairaExact(req.amount)}`}</span>
              </label>
            ) : null}
            {isOfficial ? (
              <div className="v4-field">
                <label className="v4-flabel" htmlFor="cr-sub" style={{ fontSize: 13, fontWeight: 700 }}>Budget subhead</label>
                {canChangeSubhead
                  ? <Select id="cr-sub" value={subheadId} onChange={setSubheadId} options={subOptions} placeholder="Choose the subhead" menuMinWidth={300} />
                  : <span className="v4-locked"><Icon name="lock" size="sm" />{currentSub ? `${currentSub.code ? `${currentSub.code} — ` : ""}${currentSub.name}` : "Set by the officer"}</span>}
                <span className="v4-help">{seeBalances ? "Figures shown because of the position you are acting as." : "Balances are private."}</span>
              </div>
            ) : null}
            {live !== "idle" ? (
              <div className={`v4-livecheck ${live === "available" ? "v4-lc-ok" : live === "not_enough" ? "v4-lc-no" : "v4-lc-wait"} v4-span-2`} role="status">
                <Icon name={live === "available" ? "check" : live === "not_enough" ? "x" : "clock"} />
                <span><strong>{live === "available" ? "Fund available" : live === "not_enough" ? "Not enough in this subhead" : live === "checking" ? "Checking the budget…" : "The budget could not be checked"}</strong>
                  <span>{live === "available" ? "The subhead can cover the new amount." : live === "not_enough" ? "Choose another subhead or lower the amount." : "The officer will confirm it."}</span></span>
              </div>
            ) : null}
          </div>

          <div>
            <span className="v4-label">Attachments</span>
            <ul className="v4-files" style={{ marginTop: 8 }}>
              {existing.map((a) => (
                <li key={a.id}><span className="v4-fi">{(a.file_name.split(".").pop() || "FILE").toUpperCase().slice(0, 4)}</span>
                  <span className="v4-ft"><strong>{a.file_name}</strong><span>{size(a.file_size)}</span></span>{a.url ? <a href={a.url} target="_blank" rel="noreferrer">View</a> : null}</li>
              ))}
              {newFiles.map((f, i) => (
                <li key={`${f.name}-${f.size}`}><span className="v4-fi v4-x">{(f.name.split(".").pop() || "FILE").toUpperCase().slice(0, 4)}</span>
                  <span className="v4-ft"><strong>{f.name}</strong><span>Added now · {size(f.size)}</span></span><span className="v4-chip v4-chip-green">New</span>
                  <button type="button" className="v4-btn v4-btn-ghost" style={{ minHeight: 34, color: "var(--v4-red)" }} onClick={() => setNewFiles((all) => all.filter((_, j) => j !== i))}>Remove</button></li>
              ))}
            </ul>
            <button type="button" className="v4-dropzone v4-dropzone-btn" style={{ marginTop: 10, padding: 16, flexDirection: "row", justifyContent: "center" }} onClick={() => fileInput.current?.click()}>
              <Icon name="upload" /><strong>Add another file</strong>
            </button>
            <input ref={fileInput} type="file" multiple hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt"
              onChange={(e) => { const l = Array.from(e.target.files || []); if (l.some((f) => f.size > 10 * 1048576)) setMsg({ tone: "red", text: "Each file must be 10 MB or smaller." }); else setNewFiles((a) => [...a, ...l]); e.target.value = ""; }} />
          </div>

          <label className="v4-field">
            <span className="v4-flabel">What did you change? <span className="v4-req">*</span></span>
            <input className="v4-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Attached the supplier quotation." />
            <span className="v4-help">The officer sees this note at the top of the request.</span>
          </label>

          <div className="v4-form-actions">
            <Link className="v4-btn v4-btn-ghost" href={`/requests/${req.id}`}>Cancel</Link>
            <button type="submit" className="v4-btn v4-btn-primary" disabled={!!busy || !!problem}><Icon name="pentool" />{busy || (sentBack ? "Sign and resubmit" : "Sign and save changes")}</button>
          </div>
          {problem && !busy ? <p className="v4-help" style={{ textAlign: "right", margin: "-12px 0 0" }}>{problem}</p> : null}
        </form>

        <aside className="v4-side-stack">
          <section className="v4-card v4-card-pad">
            <h2 className="v4-h3" style={{ marginBottom: 10 }}>Where it is</h2>
            <dl className="v4-kv">
              <dt>Step</dt><dd>{stageTitle(req.current_stage)}</dd>
              <dt>With</dt><dd>{isHolder ? "You" : "The officer"}</dd>
              <dt>Status</dt><dd>{req.status || "—"}</dd>
            </dl>
          </section>
          <section className="v4-notice v4-notice-blue"><Icon name="info" /><span>{sentBack ? "Saving sends the request back with your note. You sign with your saved signature." : "Saving keeps the request where it is. The officer sees your note."}</span></section>
        </aside>
      </div>

      {codeOpen ? (
        <div className="v4-newreq-otp" role="dialog" aria-modal="true" aria-labelledby="cr-code">
          <div className="v4-card v4-card-pad">
            <h2 id="cr-code" className="v4-h2" style={{ textAlign: "center" }}>Confirm it is you</h2>
            <p className="v4-muted" style={{ textAlign: "center", margin: "6px 0 16px", fontSize: 13.5 }}>Type the 6-number code from your authenticator app.</p>
            <input className="v4-input v4-num" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} aria-label="Six-number code"
              style={{ textAlign: "center", fontSize: 24, letterSpacing: ".4em", fontWeight: 800 }}
              onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setCode(v); if (v.length === 6) void verifyCode(v); }} />
            <div className="v4-form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="v4-btn v4-btn-ghost" onClick={() => setCodeOpen(false)}>Cancel</button>
              {canFinger ? <button type="button" className="v4-btn v4-btn-secondary" onClick={() => void confirmWithFinger()}><Icon name="fingerprint" />Use fingerprint</button> : null}
            </div>
          </div>
        </div>
      ) : null}
    </V4Page>
  );
}
