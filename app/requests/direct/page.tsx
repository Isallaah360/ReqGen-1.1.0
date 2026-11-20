"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { formatAmountInput, nairaExact, nairaInWords, parseAmount } from "@/lib/v4/money";
import { confirmDialog } from "@/lib/dialog";
import Icon from "@/app/components/v4/Icon";
import { Select } from "@/app/components/v4/Select";
import { Notice, PageHead, Skeleton, V4Page } from "@/app/components/v4/ui";
import { useCelebrate } from "@/app/components/v4/Motion";

type Dept = { id: string; name: string };
type Person = { id: string; full_name: string | null; position_names: string | null };

function cleanFileName(name: string) {
  const parts = name.split(".");
  const ext = parts.length > 1 ? (parts.pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) : "";
  const base = parts.join(".").trim().toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "attachment";
  return ext ? `${base}.${ext}` : base;
}

/**
 * v4.6.10 — Direct request. You write to a named person in any department (for example the Auditor).
 * They comment and sign, then forward it to the Director General (choosing the Account Officer for a
 * money request), forward it to someone else, send it back to you, or decline it. No subhead is needed.
 * It moves only through reqgen_direct_submit / reqgen_direct_act; the Routing Engine is not used.
 */
export default function DirectRequestPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<{ id: string; full_name: string | null; signature_url: string | null } | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [deptId, setDeptId] = useState("");
  const [people, setPeople] = useState<Person[] | null>(null);
  const [to, setTo] = useState("");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [money, setMoney] = useState<"no" | "yes">("no");
  const [amountText, setAmountText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "red" | "green"; text: string } | null>(null);
  useCelebrate(msg);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) { setReady(true); return; }
      const [p, d] = await Promise.all([
        supabase.from("profiles").select("id,full_name,signature_url").eq("id", uid).maybeSingle(),
        supabase.from("departments").select("id,name").order("name"),
      ]);
      if (!alive) return;
      setMe((p.data as typeof me) || null);
      setDepts(((d.data || []) as Dept[]));
      setReady(true);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!deptId) return;
    let alive = true;
    void supabase.rpc("reqgen_direct_people", { p_dept_id: deptId }).then(({ data, error }) => {
      if (!alive) return;
      setPeople(error ? [] : ((data || []) as Person[]));
      if (error) setMsg({ tone: "red", text: /could not find|schema cache/i.test(error.message) ? "Direct requests are not switched on yet. Ask the Super Admin to run the v4.6.10 database step." : error.message });
    });
    return () => { alive = false; };
  }, [deptId]);

  const amount = parseAmount(amountText);
  const isMoney = money === "yes";
  const person = (people || []).find((p) => p.id === to) || null;
  const problem = useMemo(() => {
    if (!deptId) return "Choose the department of the person you are writing to.";
    if (!to) return "Choose the person you are writing to.";
    if (title.trim().length < 3) return "Type the title.";
    if (details.trim().length < 3) return "Write what the request is for.";
    if (isMoney && !(Number.isFinite(amount) && amount > 0)) return "Type the amount (numbers only).";
    if (!me?.signature_url) return "Add your signature in My Account before you send a request.";
    return "";
  }, [deptId, to, title, details, isMoney, amount, me]);

  async function send() {
    if (problem || !me || !person) { setMsg({ tone: "red", text: problem }); return; }
    const ok = await confirmDialog({
      title: `Sign and send to ${person.full_name}?`,
      message: "Your saved signature is placed on the request. It goes straight to this person.",
      details: [title.trim(), isMoney ? `${nairaExact(amount)}: ${nairaInWords(amount)}` : "No money is requested"],
      confirmLabel: "Sign and send",
    });
    if (!ok) return;
    setBusy(true); setMsg(null);
    try {
      const now = new Date();
      const requestNo = `REQ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getTime()).slice(-6)}`;
      const { data, error } = await supabase.rpc("reqgen_direct_submit", { p_title: title.trim(), p_details: details.trim(), p_amount: isMoney ? amount : 0, p_to: to, p_request_no: requestNo });
      if (error) throw new Error(/could not find|schema cache/i.test(error.message) ? "Direct requests are not switched on yet. Ask the Super Admin to run the v4.6.10 database step." : error.message);
      const res = data as { request_id?: string } | null;
      const id = res?.request_id;
      if (!id) throw new Error("ReqGen did not return the request. Check My Requests before trying again.");
      if (files.length) {
        const rows = [];
        for (let i = 0; i < files.length; i += 1) {
          const f = files[i];
          const path = `${id}/${Date.now()}-${i + 1}-${cleanFileName(f.name)}`;
          const up = await supabase.storage.from("request-attachments").upload(path, f, { upsert: false, contentType: f.type || "application/octet-stream" });
          if (up.error) throw new Error(`The request was sent, but “${f.name}” did not upload: ${up.error.message}. Open the request to add it again.`);
          rows.push({ request_id: id, uploaded_by: me.id, file_name: f.name, file_path: path, file_type: f.type || null, file_size: f.size, verification_status: "Pending" });
        }
        const ins = await supabase.from("request_attachments").insert(rows);
        if (ins.error) throw new Error("The files uploaded but could not be linked to the request: " + ins.error.message);
      }
      if (process.env.NEXT_PUBLIC_REQGEN_NOTIFICATIONS_ENABLED !== "false") {
        const { data: s } = await supabase.auth.getSession();
        const token = s.session?.access_token;
        if (token) {
          for (const event of ["submission_success", "approval_pending"]) {
            void fetch("/api/notifications/sms/request-event", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ requestId: id, event }) }).catch(() => null);
          }
        }
      }
      setMsg({ tone: "green", text: `Submitted. It is now with ${person.full_name}.` });
      window.setTimeout(() => router.push(`/requests/${id}`), 1400);
    } catch (e) {
      setMsg({ tone: "red", text: e instanceof Error ? e.message : "The request could not be sent." });
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <V4Page><Skeleton lines={6} /></V4Page>;

  return (
    <V4Page>
      <PageHead title="Direct request" sub="Write to a named person. They sign and forward it to the Director General, or send it on." />
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <div className="v4-split">
        <section className="v4-card v4-card-pad">
          <div className="v4-form-grid">
            <div className="v4-field">
              <label className="v4-flabel" htmlFor="dr-dept" style={{ fontSize: 13, fontWeight: 700 }}>Department of the person <span className="v4-req">*</span></label>
              <Select id="dr-dept" value={deptId} onChange={(v) => { setDeptId(v); setTo(""); setPeople(null); }} options={depts.map((d) => ({ value: d.id, label: d.name }))} placeholder="Choose the department" />
              <span className="v4-help">Any department. Its staff are listed next.</span>
            </div>
            <div className="v4-field">
              <label className="v4-flabel" htmlFor="dr-to" style={{ fontSize: 13, fontWeight: 700 }}>Send to <span className="v4-req">*</span></label>
              <Select id="dr-to" value={to} onChange={setTo} disabled={!deptId || people === null || !people.length} menuMinWidth={280}
                placeholder={!deptId ? "Choose the department first" : people === null ? "Loading…" : people.length ? "Choose the person" : "Nobody active in this department"}
                options={(people || []).map((p) => ({ value: p.id, label: p.full_name || "Staff", hint: p.position_names || "Staff" }))} />
              <span className="v4-help">They can forward it to the DG or to someone else.</span>
            </div>
            <label className="v4-field v4-span-2">
              <span className="v4-flabel">Title <span className="v4-req">*</span></span>
              <input className="v4-input" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Data subscription to update ReqGen modules" />
            </label>
            <label className="v4-field v4-span-2">
              <span className="v4-flabel">What is it for? <span className="v4-req">*</span></span>
              <textarea className="v4-textarea" value={details} maxLength={2000} onChange={(e) => setDetails(e.target.value)} placeholder="Explain the request and why it is needed." style={{ minHeight: 110 }} />
            </label>
            <div className="v4-field v4-span-2">
              <span className="v4-flabel">Is it a request for money?</span>
              <div className="v4-choice-row" role="radiogroup" aria-label="Money">
                <button type="button" role="radio" aria-checked={money === "no"} className="v4-choice" onClick={() => setMoney("no")}>No</button>
                <button type="button" role="radio" aria-checked={money === "yes"} className="v4-choice" onClick={() => setMoney("yes")}>Yes, it asks for money</button>
              </div>
            </div>
            {isMoney ? (
              <label className="v4-field v4-span-2">
                <span className="v4-flabel">Amount (₦) <span className="v4-req">*</span></span>
                <input className="v4-input v4-num" inputMode="decimal" value={amountText} placeholder="0.00" onChange={(e) => setAmountText(formatAmountInput(e.target.value))} />
                <span className="v4-help">{amount > 0 ? `${nairaExact(amount)}: ${nairaInWords(amount)}` : "No subhead is needed. The person you write to chooses the Account Officer who will treat it."}</span>
              </label>
            ) : null}
            <div className="v4-field v4-span-2">
              <span className="v4-flabel">Attachments (optional)</span>
              <input ref={fileInput} type="file" multiple hidden onChange={(e) => { setFiles([...files, ...Array.from(e.target.files || [])].slice(0, 10)); e.target.value = ""; }} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button type="button" className="v4-btn v4-btn-secondary" onClick={() => fileInput.current?.click()}><Icon name="upload" />Add files</button>
                {files.map((f, i) => <span key={`${f.name}-${i}`} className="v4-chip v4-chip-grey">{f.name}<button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))} style={{ border: 0, background: "none", cursor: "pointer", marginLeft: 4 }}>×</button></span>)}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            <Link className="v4-btn v4-btn-ghost" href="/requests/new"><Icon name="left" />Back</Link>
            <button type="button" className="v4-btn v4-btn-primary" disabled={busy || !!problem} onClick={() => void send()}><Icon name="pentool" />{busy ? "Sending…" : "Sign and send"}</button>
          </div>
          {problem ? <p className="v4-help" style={{ textAlign: "right", margin: "8px 0 0" }}>{problem}</p> : null}
        </section>
        <section className="v4-card v4-card-pad">
          <h2 className="v4-h3" style={{ marginBottom: 10 }}>How a direct request moves</h2>
          <ol className="v4-numbered" style={{ fontSize: 13.5 }}>
            <li>You write it to one person, in any department.</li>
            <li>They comment and sign, then forward it to the Director General, pass it to someone else, send it back to you, or decline it.</li>
            <li>For a money request, they choose the Account Officer who will treat it. No subhead is needed.</li>
            <li>The Director General approves with signature and IET stamp, then the Account Officer releases the fund and prepares the voucher.</li>
          </ol>
        </section>
      </div>
    </V4Page>
  );
}
