"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { whenText } from "@/lib/v4/admin";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { Select } from "@/app/components/v4/Select";
import { Notice, PageHead, Skeleton, V4Page } from "@/app/components/v4/ui";

type Rules = { stay_hours: number; idle_minutes: number; passcode_tries: number; twofa_scope: string; updated_at: string | null; updated_by_label: string | null };
type Attention = { kind: "no2fa" | "passcode_removed"; person_id: string; person: string; detail: string; at: string | null };

/** Administration › Security Centre (mock-up 87). */
export default function SecurityCentrePage() {
  const me = useIdentity();
  const [rules, setRules] = useState<Rules | null>(null);
  const [draft, setDraft] = useState<Rules | null>(null);
  const [items, setItems] = useState<Attention[] | null>(null);
  const [systemOk, setSystemOk] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [r, a, people] = await Promise.all([
      supabase.from("reqgen_security_rules").select("stay_hours,idle_minutes,passcode_tries,twofa_scope,updated_at,updated_by_label").eq("id", 1).maybeSingle(),
      supabase.rpc("reqgen_security_attention"),
      supabase.rpc("reqgen_admin_people"),
    ]);
    setError(r.error?.message || a.error?.message || null);
    const row = (r.data || { stay_hours: 12, idle_minutes: 15, passcode_tries: 5, twofa_scope: "everyone", updated_at: null, updated_by_label: null }) as Rules;
    setRules(row); setDraft(row);
    setItems((a.data || []) as Attention[]);
    const sys = ((people.data || []) as Array<{ system_account: string | null; has_2fa: boolean }>).filter((p) => p.system_account);
    setSystemOk(sys.length ? sys.every((p) => p.has_2fa) : null);
  }, []);
  useEffect(() => { if (me.ready) queueMicrotask(() => { void load(); }); }, [me.ready, load]);

  const changed = !!rules && !!draft && (rules.stay_hours !== draft.stay_hours || rules.idle_minutes !== draft.idle_minutes || rules.passcode_tries !== draft.passcode_tries);
  async function save() {
    if (!draft) return;
    setBusy(true); setMsg(null);
    const { error: e } = await supabase.rpc("reqgen_security_rules_save", { p_stay_hours: draft.stay_hours, p_idle_minutes: draft.idle_minutes, p_passcode_tries: draft.passcode_tries });
    setBusy(false);
    if (e) { setMsg({ tone: "red", text: e.message }); return; }
    setMsg({ tone: "green", text: "Rules saved. They apply at each person’s next sign-in (sign-out time at their next page)." });
    await load();
  }
  const no2fa = (items || []).filter((i) => i.kind === "no2fa");
  const removed = (items || []).filter((i) => i.kind === "passcode_removed");
  async function remind() {
    setBusy(true); setMsg(null);
    const { data, error: e } = await supabase.rpc("reqgen_security_remind", { p_ids: no2fa.map((i) => i.person_id) });
    setBusy(false);
    setMsg(e ? { tone: "red", text: e.message } : { tone: "green", text: Number(data || 0) ? `Reminder sent to ${data} officer${Number(data) === 1 ? "" : "s"}.` : "Everyone was already reminded today." });
  }

  return (
    <V4Page>
      <PageHead title="Security Centre" sub="How people sign in and how long they stay signed in. Applies to everyone, including the Super Admin."
        actions={[{ label: busy ? "Saving…" : "Save rules", icon: "check", kind: "primary", disabled: busy || !changed, onClick: () => void save() }]} />
      {error ? <Notice tone="red">{error}</Notice> : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <ul className="v4-layers">
        <li><span className="v4-ico v4-t-blue"><Icon name="fingerprint" /></span><strong>Fingerprint</strong><span>Fastest. Works on laptops and phones with a sensor.</span></li>
        <li><span className="v4-ico v4-t-brand"><Icon name="key" /></span><strong>Passcode on a trusted device</strong><span>6 digits. Works <b>only</b> on the device where it was set.</span></li>
        <li><span className="v4-ico v4-t-green"><Icon name="smartphone" /></span><strong>Password + 2FA code</strong><span>Works on any device. Needed to set up the other two.</span></li>
      </ul>
      <div className="v4-cols">
        <section className="v4-card v4-card-pad">
          <h2 className="v4-h2" style={{ marginBottom: 14 }}>Rules</h2>
          {draft ? (
            <>
              <div className="v4-form-grid">
                <div className="v4-field"><span className="v4-flabel">Stay signed in for</span><Select ariaLabel="Stay signed in for" value={String(draft.stay_hours)} onChange={(v) => setDraft({ ...draft, stay_hours: Number(v) })} options={[{ value: "12", label: "12 hours, then sign in again" }, { value: "8", label: "8 hours, then sign in again" }]} /></div>
                <div className="v4-field"><span className="v4-flabel">Sign out after no activity</span><Select ariaLabel="Sign out after no activity" value={String(draft.idle_minutes)} onChange={(v) => setDraft({ ...draft, idle_minutes: Number(v) })} options={[10, 15, 20, 30].map((m) => ({ value: String(m), label: `${m} minutes` }))} /></div>
                <div className="v4-field"><span className="v4-flabel">Passcode length</span><span className="v4-locked"><Icon name="lock" size="sm" />6 digits</span><span className="v4-help">Easy ones (123456, 000000, birthdays) are refused.</span></div>
                <div className="v4-field"><span className="v4-flabel">Wrong passcode tries</span><Select ariaLabel="Wrong passcode tries" value={String(draft.passcode_tries)} onChange={(v) => setDraft({ ...draft, passcode_tries: Number(v) })} options={[{ value: "5", label: "5 — then the passcode is removed from that device" }, { value: "3", label: "3 — then the passcode is removed from that device" }]} /></div>
                <div className="v4-field v4-span-2"><span className="v4-flabel">Who must use 2FA</span><span className="v4-locked"><Icon name="lock" size="sm" />Everyone (Build Reference §10)</span></div>
              </div>
              <label className="v4-check" style={{ marginTop: 14 }}><input type="checkbox" checked disabled /> Signing and stamping still need fingerprint or 2FA code (not the passcode)</label>
              <label className="v4-check" style={{ marginTop: 8 }}><input type="checkbox" checked disabled /> Changing 2FA or passcode signs out every other device</label>
              {rules?.updated_by_label ? <p className="v4-help" style={{ marginTop: 12 }}>Last changed by {rules.updated_by_label} · {whenText(rules.updated_at)}</p> : null}
            </>
          ) : <Skeleton lines={5} />}
        </section>
        <section className="v4-card">
          <div className="v4-card-head"><h2 className="v4-h2">Needs attention</h2></div>
          {items === null ? <div className="v4-card-pad"><Skeleton lines={3} /></div> : (
            <ul className="v4-rows">
              {no2fa.length ? (
                <li><span className="v4-ri v4-t-red"><Icon name="alert" /></span><span className="v4-rt"><strong>{no2fa.length} officer{no2fa.length === 1 ? "" : "s"} without 2FA</strong><span>{no2fa.slice(0, 4).map((i) => i.person).join(", ")}{no2fa.length > 4 ? ` and ${no2fa.length - 4} more` : ""}</span></span><span className="v4-rr"><button className="v4-btn v4-btn-secondary" type="button" style={{ minHeight: 38 }} disabled={busy} onClick={() => void remind()}>Remind</button></span></li>
              ) : <li><span className="v4-ri v4-t-green"><Icon name="check" /></span><span className="v4-rt"><strong>Every officer uses 2FA</strong><span>Nobody to remind</span></span></li>}
              {removed.map((i) => (
                <li key={`${i.person_id}-${i.at}`}><span className="v4-ri v4-t-amber"><Icon name="key" /></span><span className="v4-rt"><strong>Passcode removed after wrong tries</strong><span>{i.person} · {i.detail} · {whenText(i.at)}</span></span><span className="v4-rr"><Link className="v4-btn v4-btn-secondary" href={`/admin/users/${i.person_id}`} style={{ minHeight: 38 }}>View</Link></span></li>
              ))}
              {systemOk === null ? null : systemOk
                ? <li><span className="v4-ri v4-t-green"><Icon name="shield" /></span><span className="v4-rt"><strong>Super Admin and Developer use 2FA</strong><span>Both accounts protected</span></span></li>
                : <li><span className="v4-ri v4-t-red"><Icon name="shield" /></span><span className="v4-rt"><strong>A system account has no 2FA</strong><span>Set it up in My Account › Security &amp; Devices before go-live</span></span><span className="v4-rr"><Link className="v4-btn v4-btn-secondary" href="/admin/system-accounts" style={{ minHeight: 38 }}>View</Link></span></li>}
            </ul>
          )}
        </section>
      </div>
    </V4Page>
  );
}
