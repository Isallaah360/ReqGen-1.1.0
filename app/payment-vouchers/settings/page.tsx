"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { normalizeRole } from "@/lib/roles";
import { confirmDialog } from "@/lib/dialog";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Modal from "@/app/components/v4/Modal";
import SignatureInk from "@/app/components/ui/SignatureInk";
import { Select } from "@/app/components/v4/Select";
import { Card, Chip, Notice, PageHead, Skeleton, Stats, V4Page, type StatItem } from "@/app/components/v4/ui";

type Signatory = { id: string; full_name: string; signatory_type: string | null; is_active: boolean | null };
type Person = { id: string; full_name: string | null; email: string | null; role: string | null; signature_url: string | null; is_active: boolean | null };

/** Same rule as public.normalize_person_name — how a Counter Signer is matched to their profile. */
const key = (n: string | null | undefined) => String(n || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "");

/** Payment Vouchers › Signatories (mock-up 56): the Counter Signers an Account Officer can choose. */
export default function SignatoriesPage() {
  const me = useIdentity();
  const role = normalizeRole(me.role).replace(/\d+$/, "");
  const canManage = role === "admin" || role === "auditor";
  const [rows, setRows] = useState<Signatory[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [signed, setSigned] = useState<Map<string, number>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [s, p, v] = await Promise.all([
      supabase.from("payment_voucher_counter_signatories").select("id,full_name,signatory_type,is_active").order("full_name"),
      supabase.from("profiles").select("id,full_name,email,role,signature_url,is_active").order("full_name"),
      supabase.from("payment_vouchers").select("cheque_counter_signed_by_name,cheque_counter_signed_at").not("cheque_counter_signed_at", "is", null).limit(20000),
    ]);
    setError(s.error ? s.error.message : null);
    setRows(((s.data || []) as Signatory[]).filter((r) => !r.signatory_type || /counter|both/i.test(r.signatory_type)));
    setPeople((p.data || []) as Person[]);
    const m = new Map<string, number>();
    ((v.data || []) as Array<{ cheque_counter_signed_by_name: string | null }>).forEach((r) => { const k = key(r.cheque_counter_signed_by_name); if (k) m.set(k, (m.get(k) || 0) + 1); });
    setSigned(m);
  }, []);
  useEffect(() => { if (me.ready && canManage) queueMicrotask(() => { void load(); }); }, [me.ready, canManage, load]);

  const byName = useMemo(() => new Map(people.flatMap((p) => [[key(p.full_name), p] as const, [key(p.email), p] as const]).filter(([k]) => k)), [people]);
  const profileOf = (r: Signatory) => byName.get(key(r.full_name)) || null;
  const list = rows || [];
  const active = list.filter((r) => r.is_active !== false);
  const withSig = list.filter((r) => !!profileOf(r)?.signature_url);
  const noSig = list.filter((r) => !profileOf(r)?.signature_url);
  const candidates = people.filter((p) => p.is_active !== false && p.full_name && !list.some((r) => key(r.full_name) === key(p.full_name)) && !["dg", "directorgeneral", "auditor"].includes(normalizeRole(p.role || "")));

  const stats: StatItem[] = [
    { label: "Counter Signers", value: rows ? list.length : "…", note: `${active.length} active`, icon: "users", tone: "blue" },
    { label: "Signature saved", value: rows ? withSig.length : "…", note: "Ready to sign", icon: "pentool", tone: "green" },
    { label: "Missing signature", value: rows ? noSig.length : "…", note: "Cannot sign yet", icon: "alert", tone: "amber" },
  ];

  async function setActive(r: Signatory, on: boolean) {
    if (!on && !(await confirmDialog({ title: `Deactivate ${r.full_name}?`, message: "They can no longer be chosen. Vouchers they already signed stay as they are; a voucher waiting for them needs a new Counter Signer.", confirmLabel: "Deactivate", tone: "danger" }))) return;
    setBusy(true);
    const { error: e } = await supabase.from("payment_voucher_counter_signatories").update({ is_active: on, updated_at: new Date().toISOString() }).eq("id", r.id);
    setBusy(false);
    setMsg(e ? { tone: "red", text: e.message } : { tone: "green", text: `${r.full_name} ${on ? "can be chosen again" : "deactivated"}.` });
    if (!e) await load();
  }

  async function add() {
    const p = people.find((x) => x.id === pick);
    if (!p?.full_name) return;
    setBusy(true);
    const { error: e } = await supabase.from("payment_voucher_counter_signatories").insert({ full_name: p.full_name.trim(), signatory_type: "CounterSigner", is_active: true, created_by: me.userId });
    setBusy(false);
    if (e) { setMsg({ tone: "red", text: e.message }); return; }
    setMsg({ tone: "green", text: `${p.full_name} added as a Counter Signer.${p.signature_url ? "" : " Ask them to save their signature in My Account before signing."}` });
    setAdding(false); setPick("");
    await load();
  }

  if (me.ready && !canManage) {
    return <V4Page><PageHead title="Signatories" /><Notice tone="amber" title="Only the Super Admin and the Auditor manage signatories.">Acting as {me.roleName}, you can see who signed each voucher on the voucher itself.</Notice></V4Page>;
  }

  return (
    <V4Page>
      <PageHead title="Signatories" sub="Counter Signers the Account Officer can choose. The Director General signs every voucher last." actions={[{ label: "Add Counter Signer", icon: "plus", kind: "primary", onClick: () => setAdding(true) }]} />
      {error ? <Notice tone="red">{error}</Notice> : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <Stats items={stats} />
      <Card>
        {rows === null ? <Skeleton lines={5} /> : list.length ? (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Person</th><th>Signature</th><th className="v4-hide-sm">Vouchers signed</th><th>Status</th><th className="v4-r">Action</th></tr></thead>
              <tbody>
                {list.map((r) => {
                  const p = profileOf(r);
                  return (
                    <tr key={r.id}>
                      <td><span className="v4-strong">{r.full_name}</span><span className="v4-sub">{p ? p.email || "" : "No matching user — the name must match a profile"}</span></td>
                      <td data-label="Signature">{p?.signature_url ? <span className="rg-sig-slot" style={{ display: "inline-block", width: 120, height: 32 }}><SignatureInk src={p.signature_url} alt={`${r.full_name} signature`} /></span> : <Chip tone="amber">No signature</Chip>}</td>
                      <td className="v4-hide-sm">{signed.get(key(r.full_name)) || 0}</td>
                      <td data-label="Status">{r.is_active !== false ? <Chip tone="green">Active</Chip> : <Chip tone="grey">Inactive</Chip>}</td>
                      <td className="v4-r"><button type="button" className="v4-btn v4-btn-ghost" disabled={busy} onClick={() => void setActive(r, r.is_active === false)}>{r.is_active === false ? "Activate" : "Deactivate"}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>No Counter Signer yet. Add one so Account Officers can generate vouchers.</p>}
      </Card>
      <Notice tone="blue">The Auditor checks every voucher and the Director General signs, stamps and authorises it — they are not chosen here. A Counter Signer signs with the signature saved in their own account.</Notice>
      <Modal open={adding} title="Add Counter Signer" onClose={() => setAdding(false)} footer={<>
          <button type="button" className="v4-btn v4-btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
          <button type="button" className="v4-btn v4-btn-primary" disabled={!pick || busy} onClick={() => void add()}>Add</button>
        </>}>
          <div className="v4-field"><span className="v4-flabel">Person</span><Select ariaLabel="Person" searchable value={pick} onChange={setPick} placeholder={candidates.length ? "Choose a user" : "Everyone eligible is already listed"} options={candidates.map((p) => ({ value: p.id, label: p.full_name || p.email || "", hint: p.signature_url ? "Signature saved" : "No signature yet" }))} /><span className="v4-help">Only users with an account can sign. Their saved signature goes on the voucher.</span></div>
      </Modal>
    </V4Page>
  );
}
