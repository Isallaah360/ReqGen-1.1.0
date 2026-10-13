"use client";

import { use, useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { confirmDialog, promptDialog } from "@/lib/dialog";
import { ASSIGNABLE, adminApi, initials, positionFor, positionsOf, whenText, type AdminPerson } from "@/lib/v4/admin";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import Modal from "@/app/components/v4/Modal";
import { Select } from "@/app/components/v4/Select";
import { Notice, Skeleton, V4Page } from "@/app/components/v4/ui";

type Dept = { id: string; name: string };
/** Positions whose holder signs letters or vouchers: a signature must be on file first. */
const SIGNS = new Set(["dg", "generalsecretary", "director", "dod", "hod", "pd", "dinadmin", "registrar", "hrcoordinator", "accountofficer", "auditor", "pvcountersigner"]);
const DEPT_POSITIONS = new Set(["DOD", "HOD", "PD"]);
const monthYear = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "—");

/** Administration › Staff record (mock-up 82). */
export default function StaffRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useIdentity();
  const [person, setPerson] = useState<AdminPerson | null | undefined>(undefined);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [addPos, setAddPos] = useState<{ key: string; primary: boolean } | null>(null);
  const [edit, setEdit] = useState<{ fullName: string; deptId: string } | null>(null);

  const load = useCallback(async () => {
    const [p, d] = await Promise.all([supabase.rpc("reqgen_admin_people"), supabase.from("departments").select("id,name").order("name")]);
    setError(p.error?.message || null);
    setPerson(((p.data || []) as AdminPerson[]).find((x) => x.id === id) || null);
    setDepts((d.data || []) as Dept[]);
  }, [id]);
  useEffect(() => { if (me.ready) queueMicrotask(() => { void load(); }); }, [me.ready, load]);

  async function act(label: string, fn: () => Promise<{ ok: boolean; error?: string } | { error: { message: string } | null }>, done: string) {
    setBusy(true); setMsg(null);
    const res = await fn();
    setBusy(false);
    const err = "ok" in res ? (res.ok ? null : res.error || `${label} failed.`) : res.error?.message || null;
    setMsg(err ? { tone: "red", text: err } : { tone: "green", text: done });
    if (!err) await load();
  }

  if (person === undefined) return <V4Page><Skeleton lines={10} /></V4Page>;
  if (!person) return <V4Page><Notice tone="red">{error || "That staff member was not found."}</Notice></V4Page>;

  const held = positionsOf(person);
  const name = person.full_name || person.email;
  const deptName = person.dept_name || "IET";
  const isSystem = !!person.system_account;

  async function givePosition() {
    if (!addPos || !person) return;
    const key = addPos.key;
    if (SIGNS.has(key) && !person.has_signature) { setMsg({ tone: "red", text: `${positionFor(key)?.name || "This position"} signs letters or vouchers. Ask ${name} to add their signature in My Account first.` }); return; }
    setAddPos(null);
    await act("Giving the position", async () => await supabase.rpc("reqgen_assign_profile_role", { p_profile_id: person.id, p_role_key: key, p_is_primary: addPos.primary }), `${positionFor(key)?.name || "Position"} given to ${name}.`);
  }
  async function removePosition(key: string, label: string) {
    if (!person) return;
    const ok = await confirmDialog({ title: `Remove ${label}?`, message: `${name} will no longer act as ${label}. Everything already signed in this position stays as it is.`, confirmLabel: "Remove position", tone: "warning" });
    if (!ok) return;
    const raw = person.positions.find((p) => positionFor(p.key)?.name === label)?.key || key;
    await act("Removing the position", async () => await supabase.rpc("reqgen_deactivate_profile_role", { p_profile_id: person.id, p_role_key: raw }), `${label} removed from ${name}.`);
  }
  async function makeMain(label: string) {
    if (!person) return;
    const raw = person.positions.find((p) => positionFor(p.key)?.name === label)?.key;
    if (!raw) return;
    await act("Changing the main position", async () => await supabase.rpc("reqgen_set_primary_profile_role", { p_profile_id: person.id, p_role_key: raw }), `${label} is now ${name}’s main position.`);
  }
  async function reset2fa() {
    const ok = await confirmDialog({ title: `Reset 2FA for ${name}?`, message: "Their authenticator stops working. At the next sign-in ReqGen asks them to set up a new one.", details: ["Do this only after you have spoken to the person.", "It is written to the Audit Log."], confirmLabel: "Reset 2FA", tone: "warning" });
    if (ok) await act("Resetting 2FA", () => adminApi(`/api/admin/users/${id}`, "PATCH", { action: "reset2fa" }), `2FA reset for ${name}. They set up a new authenticator at the next sign-in.`);
  }
  async function removePasscodes() {
    const ok = await confirmDialog({ title: `Remove ${name}’s passcodes?`, message: "Every passcode on every device stops working. They can still sign in with password + 2FA, or fingerprint.", confirmLabel: "Remove passcodes", tone: "warning" });
    if (ok) await act("Removing passcodes", () => adminApi(`/api/admin/users/${id}`, "PATCH", { action: "removePasscodes" }), `Passcodes removed for ${name}.`);
  }
  async function toggleActive() {
    if (!person) return;
    if (person.is_active) {
      const reason = await promptDialog({ title: `Deactivate ${name}?`, message: "They can no longer sign in. Their requests, signatures and history stay in ReqGen. Remove their positions first if someone else takes over.", label: "Reason", placeholder: "e.g. Left IET on 30 September 2026", confirmLabel: "Deactivate", tone: "danger" });
      if (!reason) return;
      await act("Deactivating", () => adminApi(`/api/admin/users/${id}`, "PATCH", { action: "deactivate", reason }), `${name} was deactivated.`);
    } else {
      await act("Reactivating", () => adminApi(`/api/admin/users/${id}`, "PATCH", { action: "reactivate" }), `${name} can sign in again.`);
    }
  }
  async function saveDetails() {
    if (!edit) return;
    const body = { action: "profile", fullName: edit.fullName, deptId: edit.deptId || null };
    setEdit(null);
    await act("Saving", () => adminApi(`/api/admin/users/${id}`, "PATCH", body), "Details saved.");
  }

  const status = [person.is_active ? "Active" : "Deactivated", person.has_2fa ? "2FA on" : "2FA off", person.fingerprints ? "fingerprint on" : "no fingerprint"].join(" · ");
  const lines = [
    ...held.map((h) => ({ when: h.def.code === "DG" ? "Approving and stamping as the Director General:" : `Acting as ${h.def.name}:`, as: `${h.def.name}${DEPT_POSITIONS.has(h.def.code) ? `, ${deptName}` : h.def.code === "ACC" ? "" : h.def.group === "Offices" ? ", IET" : ""}` })),
    { when: "Raising their own request:", as: `Staff, ${deptName}` },
  ];

  return (
    <V4Page>
      <section className="v4-card v4-card-pad">
        <div className="v4-rec">
          <div style={{ display: "flex", gap: 16, alignItems: "center", minWidth: 0 }}>
            <span className="v4-avatar" style={{ width: 64, height: 64, fontSize: 20, cursor: "default", flex: "none" }}>{initials(name)}</span>
            <div style={{ minWidth: 0 }}>
              <h1 className="v4-page-title">{name}</h1>
              <div className="v4-meta"><span>Email <b>{person.email}</b></span><span>Department <b>{person.dept_name || "—"}</b></span><span>Since <b>{monthYear(person.created_at)}</b></span></div>
              <div className="v4-pos" style={{ marginTop: 10 }}><span className="v4-pchip v4-staff">Staff</span>{held.map((h) => <span key={h.def.code} className={`v4-pchip v4-${h.def.chip}`}>{h.def.name}{h.def.one ? <span className="v4-one">ONE</span> : null}</span>)}</div>
            </div>
          </div>
          <div className="v4-right" style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <span className={`v4-chip ${person.is_active ? (person.has_2fa ? "v4-chip-green" : "v4-chip-amber") : "v4-chip-grey"}`}><Icon name={person.is_active ? "check" : "x"} size="sm" />{status}</span>
            {!isSystem ? <button className="v4-btn v4-btn-secondary" type="button" style={{ minHeight: 38 }} onClick={() => setEdit({ fullName: person.full_name, deptId: person.dept_id || "" })}><Icon name="pen" />Edit details</button> : null}
          </div>
        </div>
      </section>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {isSystem ? <Notice tone="blue">This is a system account. It holds no staff position and cannot raise, approve, sign, stamp or pay. Only the Developer can change it.</Notice> : null}

      {!isSystem ? (
        <div className="v4-cols">
          <section className="v4-card">
            <div className="v4-card-head"><h2 className="v4-h2">Positions</h2><button className="v4-btn v4-btn-primary" type="button" disabled={busy || !person.is_active} onClick={() => setAddPos({ key: "", primary: false })}><Icon name="plus" />Add position</button></div>
            <div className="v4-table-wrap">
              <table className="v4-data v4-stack">
                <thead><tr><th>Position</th><th>Where</th><th>From</th><th className="v4-r">Action</th></tr></thead>
                <tbody>
                  <tr><td><span className="v4-strong">Staff</span><span className="v4-sub">Everyone has this level</span></td><td data-label="Where">IET</td><td data-label="From">{monthYear(person.created_at)}</td><td className="v4-r"><span className="v4-chip v4-chip-grey">Always</span></td></tr>
                  {held.map((h) => (
                    <tr key={h.def.code}>
                      <td><span className="v4-strong">{h.def.name}{h.primary ? <span className="v4-chip v4-chip-blue" style={{ marginLeft: 8 }}>Main</span> : null}</span><span className="v4-sub">{h.def.one ? "One holder in IET" : h.def.about.split(".")[0]}</span></td>
                      <td data-label="Where">{DEPT_POSITIONS.has(h.def.code) ? deptName : "IET"}</td>
                      <td data-label="From">{monthYear(h.since)}</td>
                      <td className="v4-r"><span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {!h.primary ? <button className="v4-btn v4-btn-ghost" type="button" style={{ minHeight: 38 }} disabled={busy} onClick={() => void makeMain(h.def.name)}>Make main</button> : null}
                        <button className="v4-btn v4-btn-secondary" type="button" style={{ minHeight: 38 }} disabled={busy} onClick={() => void removePosition(h.def.keys[0], h.def.name)}>Remove</button>
                      </span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="v4-card v4-card-pad">
            <h2 className="v4-h2" style={{ marginBottom: 6 }}>How their name shows</h2>
            <p className="v4-help" style={{ margin: "0 0 14px" }}>ReqGen always writes the position they acted in — on requests, vouchers, letters, notifications and the Audit Log.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {lines.map((l) => <div key={l.when} className="v4-actline"><em>{l.when}</em><br /><b>{name}</b> — {l.as}</div>)}
            </div>
          </section>
        </div>
      ) : null}

      <section className="v4-card v4-card-pad">
        <h2 className="v4-h2" style={{ marginBottom: 12 }}>Sign-in and devices</h2>
        <dl className="v4-kv" style={{ maxWidth: 560 }}>
          <dt>2FA</dt><dd>{person.has_2fa ? "On · every 12 hours" : "Not set up yet"}</dd>
          <dt>Fingerprint</dt><dd>{person.fingerprints ? `On · ${person.fingerprints} device${person.fingerprints === 1 ? "" : "s"}` : "Off"}</dd>
          <dt>Passcode</dt><dd>{person.passcodes ? `Set on ${person.passcodes} device${person.passcodes === 1 ? "" : "s"}` : "None"}</dd>
          <dt>Signature</dt><dd>{person.has_signature ? "On file" : "Not added yet"}</dd>
          <dt>Last sign-in</dt><dd>{whenText(person.last_sign_in)}</dd>
        </dl>
        {person.id !== me.userId ? (
          <div className="v4-form-actions" style={{ marginTop: 14, justifyContent: "flex-start", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="v4-btn v4-btn-secondary" type="button" disabled={busy || !person.has_2fa} onClick={() => void reset2fa()}><Icon name="returned" />Reset 2FA</button>
            <button className="v4-btn v4-btn-secondary" type="button" disabled={busy || !person.passcodes} onClick={() => void removePasscodes()}><Icon name="key" />Remove passcodes</button>
            {!isSystem ? <button className={`v4-btn ${person.is_active ? "v4-btn-danger" : "v4-btn-primary"}`} type="button" disabled={busy} onClick={() => void toggleActive()}><Icon name={person.is_active ? "x" : "check"} />{person.is_active ? "Deactivate" : "Reactivate"}</button> : null}
          </div>
        ) : <p className="v4-help" style={{ marginTop: 14 }}>This is your own account — change your sign-in in My Account › Security &amp; Devices.</p>}
      </section>

      <Modal open={!!addPos} title={`Give ${name} a position`} sub="Staff stays. The new position is added on top." onClose={() => setAddPos(null)} busy={busy}
        footer={<><button type="button" className="v4-btn v4-btn-ghost" onClick={() => setAddPos(null)}>Cancel</button><button type="button" className="v4-btn v4-btn-primary" disabled={!addPos?.key} onClick={() => void givePosition()}><Icon name="check" />Give position</button></>}>
        {addPos ? (
          <div className="v4-form-grid">
            <div className="v4-field v4-span-2"><span className="v4-flabel">Position</span><Select ariaLabel="Position" value={addPos.key} placeholder="Choose the position" onChange={(v) => setAddPos({ ...addPos, key: v })}
              options={ASSIGNABLE.filter((a) => !held.some((h) => h.def.keys.includes(a.key))).map((a) => ({ value: a.key, label: a.label, hint: SIGNS.has(a.key) ? "signs" : undefined }))} /></div>
            <label className="v4-check v4-span-2"><input type="checkbox" checked={addPos.primary} onChange={(e) => setAddPos({ ...addPos, primary: e.target.checked })} /> Make it their main position (shown first in “Acting as”)</label>
            {addPos.key && positionFor(addPos.key)?.one ? <div className="v4-span-2"><Notice tone="amber">{positionFor(addPos.key)?.name} has one holder in IET. Remove it from the current holder first if this person replaces them.</Notice></div> : null}
          </div>
        ) : null}
      </Modal>
      <Modal open={!!edit} title="Edit details" onClose={() => setEdit(null)} busy={busy}
        footer={<><button type="button" className="v4-btn v4-btn-ghost" onClick={() => setEdit(null)}>Cancel</button><button type="button" className="v4-btn v4-btn-primary" onClick={() => void saveDetails()}><Icon name="check" />Save</button></>}>
        {edit ? (
          <div className="v4-form-grid">
            <label className="v4-field v4-span-2"><span className="v4-flabel">Full name</span><input className="v4-input" value={edit.fullName} onChange={(e) => setEdit({ ...edit, fullName: e.target.value })} /></label>
            <div className="v4-field v4-span-2"><span className="v4-flabel">Department</span><Select ariaLabel="Department" searchable value={edit.deptId} placeholder="No department" onChange={(v) => setEdit({ ...edit, deptId: v })} options={depts.map((d) => ({ value: d.id, label: d.name }))} /></div>
            <p className="v4-help v4-span-2" style={{ margin: 0 }}>The email is the person’s sign-in name. To change it, add the new email as a new staff member and deactivate this one.</p>
          </div>
        ) : null}
      </Modal>
    </V4Page>
  );
}
