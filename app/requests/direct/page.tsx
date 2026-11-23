"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { formatAmountInput, nairaExact, nairaInWords, parseAmount } from "@/lib/v4/money";
import { confirmDialog } from "@/lib/dialog";
import { confirmWithCode } from "@/lib/codeConfirm";
import { alertPeople } from "@/lib/v4/alerts";
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
 * v4.7.0: Direct request. You write to one or many people, from any departments, at once.
 * Only they receive it: no HOD, HR, DG or Account step. Each answers on their own (approve, reply,
 * decline, forward). To be paid, a receiver forwards it to the Director General with the Account
 * Officer. It needs the 6-digit code sent by SMS and e-mail. reqgen_direct_send / reqgen_direct_answer.
 */
export default function DirectRequestPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<{ id: string; full_name: string | null; signature_url: string | null } | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [deptId, setDeptId] = useState("");
  const [people, setPeople] = useState<Person[] | null>(null);
  const [everyone, setEveryone] = useState<Record<string, Person & { dept: string }>>({});
  const [chosen, setChosen] = useState<string[]>([]);
  const [find, setFind] = useState("");
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

  // Everyone, from every department (one list for search and "All departments")
  useEffect(() => {
    if (!depts.length) return;
    let alive = true;
    void Promise.all(depts.map((d) => supabase.rpc("reqgen_direct_people", { p_dept_id: d.id }).then(({ data, error }) => ({ d, data: (data || []) as Person[], error })))).then((all) => {
      if (!alive) return;
      const map: Record<string, Person & { dept: string }> = {};
      let err = "";
      for (const { d, data, error } of all) { if (error) err = error.message; for (const p of data) map[p.id] = { ...p, dept: d.name }; }
      setEveryone(map);
      setPeople(Object.values(map));
      if (err) setMsg({ tone: "red", text: /could not find|schema cache/i.test(err) ? "Direct requests are not switched on yet. Ask the Super Admin to run the database step." : err });
    });
    return () => { alive = false; };
  }, [depts]);

  const amount = parseAmount(amountText);
  const isMoney = money === "yes";
  const shown = useMemo(() => {
    const t = find.trim().toLowerCase();
    return Object.values(everyone).filter((p) => (!deptId || p.dept === depts.find((d) => d.id === deptId)?.name) && (!t || `${p.full_name} ${p.position_names} ${p.dept}`.toLowerCase().includes(t)))
      .sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
  }, [everyone, deptId, depts, find]);
  const names = chosen.map((id) => everyone[id]?.full_name || "Staff");
  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(0, 50)));
  const problem = useMemo(() => {
    if (!chosen.length) return "Choose at least one person.";
    if (title.trim().length < 3) return "Type the title.";
    if (details.trim().length < 3) return "Write what the request is for.";
    if (isMoney && !(Number.isFinite(amount) && amount > 0)) return "Type the amount (numbers only).";
    if (!me?.signature_url) return "Add your signature in My Account before you send a request.";
    return "";
  }, [chosen, title, details, isMoney, amount, me]);

  async function send() {
    if (problem || !me) { setMsg({ tone: "red", text: problem }); return; }
    const ok = await confirmDialog({
      title: chosen.length === 1 ? `Sign and send to ${names[0]}?` : `Sign and send to ${chosen.length} people?`,
      message: chosen.length === 1 ? "Your saved signature is placed on the request. Only this person receives it." : `Your saved signature is placed on the request. Only these people receive it, and each answers on their own: ${names.join(", ")}.`,
      details: [title.trim(), isMoney ? `${nairaExact(amount)}: ${nairaInWords(amount)}` : "No money is requested"],
      confirmLabel: "Sign and send",
    });
    if (!ok) return;
    if (!(await confirmWithCode("send this request"))) { setMsg({ tone: "red", text: "Not sent: the code was not entered." }); return; }
    setBusy(true); setMsg(null);
    try {
      const now = new Date();
      const requestNo = `REQ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getTime()).slice(-6)}`;
      const { data, error } = await supabase.rpc("reqgen_direct_send", { p_title: title.trim(), p_details: details.trim(), p_amount: isMoney ? amount : 0, p_to: chosen, p_request_no: requestNo });
      if (error) throw new Error(/could not find|schema cache/i.test(error.message) ? "Sending to several people needs the v4.7.0 database step. Ask the Super Admin to run it." : error.message);
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
      const told = await alertPeople(id, "waiting");
      setMsg({ tone: "green", text: `Sent to ${chosen.length === 1 ? names[0] : `${chosen.length} people`}.${told.error ? ` ${told.error}` : " Each got an SMS, an e-mail and an app notice."}` });
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
      <PageHead title="Direct request" sub="Straight to the people you choose, from any departments. Nobody else receives it." />
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <div className="v4-split">
        <section className="v4-card v4-card-pad">
          <div className="v4-form-grid">
            <div className="v4-field v4-span-2">
              <span className="v4-flabel">Send to <span className="v4-req">*</span> <span className="v4-muted" style={{ fontWeight: 600 }}>(one or many people, any department)</span></span>
              {chosen.length ? (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "0 0 8px" }}>
                  {chosen.map((id) => <span key={id} className="v4-chip v4-chip-brand" style={{ height: 32 }}>{everyone[id]?.full_name || "Staff"}<button type="button" aria-label={`Remove ${everyone[id]?.full_name || "this person"}`} onClick={() => toggle(id)} style={{ border: 0, background: "none", cursor: "pointer", marginLeft: 4, minWidth: 24, minHeight: 24 }}>×</button></span>)}
                </div>
              ) : null}
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 220px)", gap: 8 }} className="k-direct-find">
                <span className="v4-control"><Icon name="search" /><input className="v4-input" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search any staff name or position" aria-label="Search staff" /></span>
                <Select id="dr-dept" value={deptId} onChange={(v) => setDeptId(v)} options={[{ value: "", label: "All departments" }, ...depts.map((d) => ({ value: d.id, label: d.name }))]} ariaLabel="Department" />
              </div>
              <div className="k-picks" role="group" aria-label="Staff to send to" style={{ padding: "10px 0 0", maxHeight: 340, overflowY: "auto" }}>
                {people === null ? <Skeleton kind="rows" lines={3} /> : shown.length ? shown.slice(0, 80).map((p) => {
                  const on = chosen.includes(p.id);
                  return (
                    <button key={p.id} type="button" role="checkbox" aria-checked={on} className="k-pick" onClick={() => toggle(p.id)}>
                      <span className="k-box" aria-hidden="true">{on ? <Icon name="tick" /> : null}</span>
                      <span className="k-pt"><b>{p.full_name || "Staff"}</b><small>{[p.position_names || "Staff", p.dept].filter(Boolean).join(", ")}</small></span>
                    </button>
                  );
                }) : <p className="v4-muted" style={{ margin: 0 }}>Nobody matches. Try another name or department.</p>}
              </div>
              <span className="v4-help">Only the people you choose receive it. Each answers on their own.</span>
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
                <span className="v4-help">{amount > 0 ? `${nairaExact(amount)}: ${nairaInWords(amount)}` : "No subhead is needed. To be paid, a receiver forwards it to the Director General with the Account Officer."}</span>
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
            <li>You choose one or many people, from any departments.</li>
            <li>You confirm with the 6-digit code sent by SMS and e-mail. Each person is told at once by SMS, e-mail and in the app.</li>
            <li>Each answers on their own: approve, reply, decline or forward. You see every answer. No HOD, HR, DG or Account step.</li>
            <li>To be paid, a receiver forwards it to the Director General with the Account Officer.</li>
          </ol>
        </section>
      </div>
    </V4Page>
  );
}
