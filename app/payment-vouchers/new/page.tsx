"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { normalizeRole } from "@/lib/roles";
import { NIGERIAN_BANKS } from "@/lib/v4/finance";
import { nairaExact, nairaInWords } from "@/lib/v4/money";
import { SECTIONS } from "@/lib/v4/vouchers";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { Select } from "@/app/components/v4/Select";
import { Card, Chip, Notice, PageHead, Skeleton, V4Page } from "@/app/components/v4/ui";

type Ready = { id: string; request_no: string | null; title: string | null; amount: number | null; request_type: string | null; personal_category: string | null; requester_name: string | null; dept_name: string | null; subhead_code: string | null; subhead_name: string | null };
type Saved = { payee_key: string; payee_name: string | null; account_name: string; account_number: string; bank_name: string };
type Line = { key: string; payee: string; account_name: string; account_number: string; bank_name: string; saved: boolean };
type Mode = "Transfer" | "Cash" | "Cheque";

const CAP = 10;
/** Same rule as public.normalize_person_name: one payee per person, however the name is typed. */
const payeeKey = (n: string | null | undefined) => String(n || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "");
const isOfficial = (r: Ready) => String(r.request_type || "").toLowerCase() === "official";
const today = () => new Date().toISOString().slice(0, 10);

export default function GenerateVoucherPage() {
  return <Suspense fallback={<V4Page><Skeleton lines={8} /></V4Page>}><Generate /></Suspense>;
}

/** Payment Vouchers › Generate from Requests (mock-up 48). */
function Generate() {
  const me = useIdentity();
  const router = useRouter();
  const params = useSearchParams();
  const reissueOf = params.get("reissue");
  const role = normalizeRole(me.role).replace(/\d+$/, "");
  const mayPrepare = ["account", "accounts", "accountofficer", "admin"].includes(role);

  const [rows, setRows] = useState<Ready[] | null>(null);
  const [saved, setSaved] = useState<Map<string, Saved>>(new Map());
  const [counters, setCounters] = useState<string[]>([]);
  const [auditor, setAuditor] = useState("");
  const [reissueNo, setReissueNo] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [kind, setKind] = useState<"official" | "personal">("official");
  const [picked, setPicked] = useState<string[]>([]);
  const [section, setSection] = useState("");
  const [mode, setMode] = useState<Mode>("Transfer");
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [counter, setCounter] = useState("");
  const [cashPayee, setCashPayee] = useState("");
  const [cheque, setCheque] = useState({ no: "", date: today(), bank: "" });
  const [narration, setNarration] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "red" | "green" | "amber"; text: string } | null>(null);

  const load = useCallback(async () => {
    const [r, b, c, a] = await Promise.all([
      supabase.rpc("get_requests_ready_for_payment_voucher"),
      supabase.from("reqgen_payee_bank_accounts").select("payee_key,payee_name,account_name,account_number,bank_name"),
      supabase.from("payment_voucher_counter_signatories").select("full_name,signatory_type,is_active").eq("is_active", true).order("full_name"),
      supabase.rpc("reqgen_pv_checkers"),
    ]);
    setLoadError(r.error ? r.error.message : null);
    const ready = ((r.data || []) as Ready[]).filter((x) => Number(x.amount || 0) > 0);
    setRows(ready);
    setSaved(new Map(((b.data || []) as Saved[]).map((s) => [s.payee_key, s])));
    const names = ((c.data || []) as Array<{ full_name: string; signatory_type: string | null }>).filter((x) => !x.signatory_type || /counter/i.test(x.signatory_type)).map((x) => x.full_name);
    setCounters(names);
    if (names.length === 1) setCounter(names[0]);
    const checkers = (a.data || []) as Array<{ full_name: string }>;
    setAuditor(checkers.map((x) => x.full_name).join(", "));
    if (reissueOf) {
      const [v, items] = await Promise.all([
        supabase.rpc("reqgen_pv_record", { p_voucher_id: reissueOf }),
        supabase.rpc("get_payment_voucher_items", { p_voucher_id: reissueOf }),
      ]);
      const old = (Array.isArray(v.data) ? v.data[0] : v.data) as { voucher_no?: string; status?: string; disbursement_mode?: string; prepared_section?: string; counter_signatory_name?: string; narration?: string } | null;
      if (old?.status === "Cancelled") {
        setReissueNo(old.voucher_no || "");
        const ids = ((items.data || []) as Array<{ request_id: string }>).map((i) => i.request_id).filter((id) => ready.some((x) => x.id === id));
        setPicked(ids);
        if (ready.find((x) => x.id === ids[0] && !isOfficial(x))) setKind("personal");
        if (old.disbursement_mode === "Cash" || old.disbursement_mode === "Cheque" || old.disbursement_mode === "Transfer") setMode(old.disbursement_mode);
        if (old.prepared_section) setSection(old.prepared_section);
        if (old.counter_signatory_name) setCounter(old.counter_signatory_name);
        if (old.narration) setNarration(old.narration);
      }
    }
  }, [reissueOf]);
  useEffect(() => { if (me.ready && mayPrepare) queueMicrotask(() => { void load(); }); }, [me.ready, mayPrepare, load]);

  const official = useMemo(() => (rows || []).filter(isOfficial), [rows]);
  const personal = useMemo(() => (rows || []).filter((r) => !isOfficial(r)), [rows]);
  const list = kind === "official" ? official : personal;
  const chosen = useMemo(() => (rows || []).filter((r) => picked.includes(r.id)), [rows, picked]);
  const total = chosen.reduce((t, r) => t + Number(r.amount || 0), 0);

  // one payee per person: the Transfer Schedule groups their requests together
  const payees = useMemo(() => {
    const m = new Map<string, { name: string; ids: string[]; amount: number }>();
    chosen.forEach((r) => {
      const k = payeeKey(r.requester_name) || r.id;
      const p = m.get(k) || { name: String(r.requester_name || "Payee").toUpperCase(), ids: [], amount: 0 };
      p.ids.push(r.id); p.amount += Number(r.amount || 0);
      m.set(k, p);
    });
    return [...m.entries()];
  }, [chosen]);
  const many = payees.length > 1;
  const effMode: Mode = many ? "Transfer" : mode;

  const line = (k: string, name: string): Line => {
    if (lines[k]) return lines[k];
    const s = saved.get(k);
    return s ? { key: k, payee: name, account_name: s.account_name, account_number: s.account_number, bank_name: s.bank_name, saved: true }
      : { key: k, payee: name, account_name: name, account_number: "", bank_name: "", saved: false };
  };
  const setLine = (k: string, name: string, patch: Partial<Line>) => setLines((all) => ({ ...all, [k]: { ...line(k, name), ...patch, saved: false } }));
  const lineOk = (l: Line) => l.account_name.trim().length > 1 && l.account_number.replace(/\D/g, "").length === 10 && l.bank_name.trim().length > 1;

  function toggle(r: Ready) {
    setMsg(null);
    if (!isOfficial(r)) { setPicked((p) => (p.includes(r.id) ? [] : [r.id])); return; }
    setPicked((p) => {
      const onlyOfficial = p.filter((id) => official.some((o) => o.id === id));
      if (onlyOfficial.includes(r.id)) return onlyOfficial.filter((id) => id !== r.id);
      if (onlyOfficial.length >= CAP) return onlyOfficial;
      return [...onlyOfficial, r.id];
    });
  }
  function switchKind(k: "official" | "personal") { setKind(k); setPicked([]); setMsg(null); }

  async function generate() {
    setMsg(null);
    if (!chosen.length) { setMsg({ tone: "red", text: "Tick at least one request." }); return; }
    if (!section) { setMsg({ tone: "red", text: "Choose who you are preparing as." }); return; }
    if (!counter) { setMsg({ tone: "red", text: "Choose the Counter Signer." }); return; }
    const schedule = effMode === "Transfer" ? payees.map(([k, p]) => { const l = line(k, p.name); return { payee_name: p.name, account_name: l.account_name.trim().toUpperCase(), account_number: l.account_number.replace(/\D/g, ""), bank_name: l.bank_name.trim(), request_ids: p.ids }; }) : [];
    if (effMode === "Transfer") {
      const bad = payees.filter(([k, p]) => !lineOk(line(k, p.name))).map(([, p]) => p.name);
      if (bad.length) { setMsg({ tone: "red", text: `Complete the bank details (account name, 10-digit account number, bank) for: ${bad.join(", ")}.` }); return; }
    }
    if (effMode === "Cheque" && (!cheque.no.trim() || !cheque.bank)) { setMsg({ tone: "red", text: "Type the cheque number and choose the bank." }); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("reqgen_pv_generate", {
      p_request_ids: picked, p_mode: effMode, p_preparing_as: section, p_counter_signer: counter, p_schedule: schedule,
      p_cash_payee: effMode === "Cash" ? (cashPayee.trim() || payees[0]?.[1].name || null) : null,
      p_cheque_no: effMode === "Cheque" ? cheque.no.trim() : null, p_cheque_date: effMode === "Cheque" ? cheque.date || null : null,
      p_cheque_bank: effMode === "Cheque" ? cheque.bank : null, p_narration: narration.trim() || null, p_reissue_of: reissueNo ? reissueOf : null,
    });
    setBusy(false);
    if (error) { setMsg({ tone: "red", text: error.message }); return; }
    const res = (typeof data === "string" ? JSON.parse(data) : data) as { voucher_id?: string; voucher_no?: string };
    if (res?.voucher_id) router.push(`/payment-vouchers/${res.voucher_id}?made=1`);
    else setMsg({ tone: "green", text: `${res?.voucher_no || "Voucher"} generated and sent to the Auditor.` });
  }

  if (me.ready && !mayPrepare) {
    return <V4Page><PageHead title="Generate from Requests" /><Notice tone="amber" title="Only an Account Officer prepares payment vouchers.">Acting as {me.roleName}, you can open and sign vouchers from the Voucher Centre.</Notice></V4Page>;
  }

  const officialChosen = chosen.filter(isOfficial).length;
  const step = !chosen.length ? 1 : 2;

  return (
    <V4Page>
      <PageHead title="Generate from Requests" sub="Official requests from any staff can share one voucher — up to 10 — paid by bank transfer. Personal requests get a voucher of their own."
        actions={[{ label: "Manual voucher", icon: "pen", kind: "secondary", href: "/payment-vouchers/manual" }]} />
      {reissueNo ? <Notice tone="blue" title={`Reissuing ${reissueNo}.`}>The cancelled voucher keeps its number. This one gets a new number and records that it replaces {reissueNo}.</Notice> : null}
      {loadError ? <Notice tone="red">{loadError}</Notice> : null}
      <div className="v4-stepper" aria-label="Progress">
        <div className={step > 1 ? "v4-done" : "v4-on"}>1 · Pick requests</div>
        <div className={step === 2 ? "v4-on" : ""}>2 · Payment details</div>
        <div>3 · Prepared &amp; sent to Auditor</div>
      </div>

      <Card>
        <div className="v4-card-head">
          <h2 className="v4-h2">1 · Requests ready for a voucher</h2>
          <div className="v4-segmented" role="tablist" aria-label="Request type">
            <button type="button" role="tab" aria-selected={kind === "official"} onClick={() => switchKind("official")}>Official <span className="v4-n">{official.length}</span></button>
            <button type="button" role="tab" aria-selected={kind === "personal"} onClick={() => switchKind("personal")}>Personal <span className="v4-n">{personal.length}</span></button>
          </div>
        </div>
        {rows === null ? <Skeleton lines={6} /> : list.length ? (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th style={{ width: 44 }}><span className="v4-sr-only">Select</span></th><th>Request</th><th className="v4-r">Amount</th><th>Payee</th><th>Subhead</th><th>Type</th></tr></thead>
              <tbody>
                {list.map((r) => {
                  const on = picked.includes(r.id);
                  const full = isOfficial(r) && !on && officialChosen >= CAP;
                  return (
                    <tr key={r.id} className={full ? "v4-muted-row" : undefined} title={full ? "Voucher full — start another voucher for the rest" : undefined}>
                      <td><input className="v4-pick" type="checkbox" checked={on} disabled={full} onChange={() => toggle(r)} aria-label={`Select ${r.request_no || r.title}`} /></td>
                      <td><span className="v4-strong">{r.request_no || "—"}</span><span className="v4-sub">{r.title || ""}</span></td>
                      <td className="v4-r v4-num v4-strong">{nairaExact(r.amount)}</td>
                      <td data-label="Payee"><span className="v4-strong">{String(r.requester_name || "—").toUpperCase()}</span><span className="v4-sub">{r.dept_name || ""}</span></td>
                      <td data-label="Subhead" className="v4-hide-sm">{r.subhead_code ? `${r.subhead_code} — ${r.subhead_name || ""}` : <span className="v4-muted">Not set</span>}</td>
                      <td data-label="Type">{isOfficial(r) ? <Chip tone="blue">Official</Chip> : <Chip tone="grey">Personal · own voucher</Chip>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>{kind === "official" ? "No official request is waiting for a voucher." : "No personal fund request is waiting for a voucher."}</p>}
        {kind === "official" ? (
          <div className="v4-group-bar">
            <span><b>{officialChosen} of {CAP}</b> selected · Official · <b>{payees.length} payee{payees.length === 1 ? "" : "s"}</b> · <b className="v4-num">{nairaExact(total)}</b></span>
            <span className="v4-cap-meter" aria-label={`${officialChosen} of ${CAP} places used`}><i style={{ width: `${(officialChosen / CAP) * 100}%` }} /></span>
            {officialChosen >= CAP ? <Chip tone="amber">Voucher full — start another voucher for the rest</Chip> : <Chip tone="green">Can be combined · {CAP - officialChosen} place{CAP - officialChosen === 1 ? "" : "s"} left</Chip>}
          </div>
        ) : (
          <div className="v4-group-bar"><span>A personal request is paid on a voucher of its own{chosen.length ? <> · <b className="v4-num">{nairaExact(total)}</b></> : null}.</span></div>
        )}
      </Card>

      {chosen.length ? (
        <Card>
          <div className="v4-card-pad">
            <h2 className="v4-h2" style={{ marginBottom: 14 }}>2 · Payment details</h2>
            <div className="v4-form-grid">
              <div className="v4-field v4-span-2">
                <span className="v4-flabel">Preparing as <span className="v4-req">*</span></span>
                <Select ariaLabel="Preparing as" value={section} onChange={setSection} placeholder="Choose the section" options={SECTIONS.map((s) => ({ value: s, label: `Account Officer — ${s}` }))} />
                <span className="v4-help">Printed on the voucher: “Prepared by {me.name || "you"} — Account Officer{section ? `, ${section}` : ""}”.</span>
              </div>
              <div className="v4-field v4-span-2">
                <span className="v4-flabel">Disbursement mode <span className="v4-req">*</span></span>
                <div className="v4-segmented" role="tablist" aria-label="Disbursement mode">
                  {(["Transfer", "Cash", "Cheque"] as Mode[]).map((m) => (
                    <button key={m} type="button" role="tab" aria-selected={effMode === m} disabled={many && m !== "Transfer"} title={many && m !== "Transfer" ? "Only for one payee" : undefined} onClick={() => setMode(m)}>{m}</button>
                  ))}
                </div>
                <span className="v4-help">{many ? "More than one payee, so the voucher is paid by bank transfer. Cash and cheque are for one payee only." : "Cash and cheque are for one payee only."}</span>
              </div>
              {effMode === "Cash" ? (
                <label className="v4-field v4-span-2"><span className="v4-flabel">Cash paid to</span><input className="v4-input" value={cashPayee} placeholder={payees[0]?.[1].name || "Payee"} onChange={(e) => setCashPayee(e.target.value)} /><span className="v4-help">Leave empty to pay the requester.</span></label>
              ) : null}
              {effMode === "Cheque" ? (
                <>
                  <label className="v4-field"><span className="v4-flabel">Cheque no. <span className="v4-req">*</span></span><input className="v4-input" inputMode="numeric" value={cheque.no} onChange={(e) => setCheque({ ...cheque, no: e.target.value })} /></label>
                  <label className="v4-field"><span className="v4-flabel">Cheque date</span><input className="v4-input" type="date" value={cheque.date} onChange={(e) => setCheque({ ...cheque, date: e.target.value })} /></label>
                  <div className="v4-field v4-span-2"><span className="v4-flabel">Bank <span className="v4-req">*</span></span><Select ariaLabel="Cheque bank" searchable value={cheque.bank} onChange={(v) => setCheque({ ...cheque, bank: v })} placeholder="Choose the bank" options={NIGERIAN_BANKS.map((b) => ({ value: b, label: b }))} /></div>
                </>
              ) : null}
              <label className="v4-field v4-span-2"><span className="v4-flabel">Narration (optional)</span><input className="v4-input" value={narration} maxLength={240} placeholder={chosen.length === 1 ? chosen[0].title || "" : "Being payment for the requests listed"} onChange={(e) => setNarration(e.target.value)} /></label>
            </div>
          </div>

          {effMode === "Transfer" ? (
            <>
              <div className="v4-card-head" style={{ borderTop: "1px solid var(--line-2)" }}>
                <h2 className="v4-h3">Transfer schedule · {payees.length} payee{payees.length === 1 ? "" : "s"}</h2>
                <span className="v4-help">Filled from each person’s saved bank details. Same person twice = one transfer.</span>
              </div>
              <div className="v4-table-wrap">
                <table className="v4-data v4-stack">
                  <thead><tr><th>Account name</th><th>Bank</th><th>Account no.</th><th className="v4-hide-sm">Requests</th><th className="v4-r">Amount</th><th className="v4-r">Check</th></tr></thead>
                  <tbody>
                    {payees.map(([k, p]) => {
                      const l = line(k, p.name);
                      const ok = lineOk(l);
                      return (
                        <tr key={k}>
                          <td data-label="Account name"><input className="v4-input" aria-label={`Account name for ${p.name}`} value={l.account_name} onChange={(e) => setLine(k, p.name, { account_name: e.target.value.toUpperCase() })} /></td>
                          <td data-label="Bank" style={{ minWidth: 170 }}><Select size="compact" searchable ariaLabel={`Bank for ${p.name}`} value={l.bank_name} placeholder="Bank" onChange={(v) => setLine(k, p.name, { bank_name: v })} options={[...new Set([...(l.bank_name ? [l.bank_name] : []), ...NIGERIAN_BANKS])].map((b) => ({ value: b, label: b }))} /></td>
                          <td data-label="Account no."><input className="v4-input v4-num" inputMode="numeric" maxLength={10} aria-label={`Account number for ${p.name}`} value={l.account_number} onChange={(e) => setLine(k, p.name, { account_number: e.target.value.replace(/\D/g, "").slice(0, 10) })} /></td>
                          <td data-label="Requests" className="v4-hide-sm">{p.ids.length}</td>
                          <td className="v4-r v4-num v4-strong">{nairaExact(p.amount)}</td>
                          <td className="v4-r">{!ok ? <Chip tone="red">Incomplete</Chip> : l.saved ? <Chip tone="green">Saved details</Chip> : <Chip tone="blue">New details</Chip>}</td>
                        </tr>
                      );
                    })}
                    <tr><td colSpan={4} className="v4-r v4-strong v4-hide-sm">Total to transfer</td><td className="v4-r v4-num v4-strong">{nairaExact(total)}</td><td /></tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          <div className="v4-card-pad" style={{ borderTop: "1px solid var(--line-2)" }}>
            <div className="v4-form-grid">
              <div className="v4-field">
                <span className="v4-flabel">Counter Signer <span className="v4-req">*</span></span>
                <Select ariaLabel="Counter Signer" value={counter} onChange={setCounter} placeholder={counters.length ? "Choose the Counter Signer" : "No Counter Signer yet"} disabled={!counters.length} options={counters.map((n) => ({ value: n, label: n }))} />
                <span className="v4-help">{counters.length ? "Order: Auditor check → Counter Signer → DG signs and authorises." : "Add a Counter Signer in Payment Vouchers › Signatories first."}</span>
              </div>
              <div className="v4-field">
                <span className="v4-flabel">Checker</span>
                <span className="v4-locked">Auditor{auditor ? ` · ${auditor}` : ""}</span>
                <span className="v4-help">IET has one internal auditor, so nobody chooses.</span>
              </div>
            </div>
            <p className="v4-help" style={{ margin: "14px 0 0" }}>Amount in words: <b>{nairaInWords(total)}</b></p>
            <Notice tone="blue">Your saved signature goes on Prepared By. The voucher is numbered on save, the Auditor is notified, and {payees.length === 1 ? "the payee is" : `each of the ${payees.length} payees is`} told their request is on a voucher.</Notice>
            {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
            <div className="v4-form-actions">
              <button type="button" className="v4-btn v4-btn-ghost" onClick={() => router.push("/payment-vouchers/centre")}>Cancel</button>
              <button type="button" className="v4-btn v4-btn-primary" disabled={busy} onClick={() => void generate()}><Icon name="pen" />{busy ? "Generating…" : "Sign and generate PV"}</button>
            </div>
          </div>
        </Card>
      ) : msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
    </V4Page>
  );
}
