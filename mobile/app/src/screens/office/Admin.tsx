import { useState } from "react";
import { Activity, Building2, KeyRound, Lock, Plus, Route as RouteIcon, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { db, office } from "../../lib/core";
import { ASSIGNABLE, CELL_TEXT, MATRIX, MATRIX_COLUMNS, POSITIONS, positionFor, positionsOf, whenText, type AdminPerson } from "../../lib/admin";
import { OFFICER_STAGES, REVIEW, STAGE_TEXT, loadRouting, routeOf, saveRoute, type IfVacant, type Lane, type OfficerStage, type RouteKind } from "../../lib/routing";
import { naira, when } from "../../lib/text";
import { useApp } from "../../App";
import { Body, Cell, Chip, Chips, FormSheet, Head, Item, More, Note, SearchBox, Skeleton, useMore, useNav } from "../../ui";
import { Err, Facts, Stats, call, isAdminRole, rows, useAction, useLoad } from "./kit";

/**
 * App 4.1.0: Administration. Staff and positions, departments, the Routing Engine and the security rules.
 * Staff accounts (create, e-mail, 2FA, deactivate, delete) go through the reqgen-office Edge Function,
 * the website's own server code running on Supabase. Only the Super Admin and the Developer.
 */
const people = () => rows<AdminPerson>("reqgen_admin_people");

export function StaffList() {
  const { push } = useNav();
  const { data, error, reload } = useLoad(async () => {
    const [p, d] = await Promise.all([people(), (await db()).from("departments").select("id,name").order("name")]);
    return { people: p, depts: (d.data || []) as Array<{ id: string; name: string }> };
  }, []);
  const [q, setQ] = useState("");
  const [f, setF] = useState<"all" | "active" | "off" | "no2fa">("active");
  const [form, setForm] = useState<null | { fullName: string; email: string; password: string; roleKey: string; deptId: string }>(null);
  const { busy, err, setErr, run } = useAction();
  const list = (data?.people || []).filter((p) => (f === "all" || (f === "active" ? p.is_active : f === "off" ? !p.is_active : p.is_active && !p.has_2fa)) && (!q.trim() || `${p.full_name} ${p.email} ${p.dept_name}`.toLowerCase().includes(q.trim().toLowerCase())));
  const { shown, more, left } = useMore(list);
  return (
    <>
      <Head title="Staff & Positions" />
      <Body onRefresh={reload}>
        <Stats items={[{ label: "Active", value: (data?.people || []).filter((p) => p.is_active).length }, { label: "Without 2FA", value: (data?.people || []).filter((p) => p.is_active && !p.has_2fa).length, tone: "wa" }]} />
        <button type="button" className="btn bp block" onClick={() => setForm({ fullName: "", email: "", password: "", roleKey: "staff", deptId: "" })}><UserPlus size={18} />Add a staff member</button>
        <Chips label="Show" value={f} onChange={setF} items={[{ k: "active", label: "Active" }, { k: "no2fa", label: "No 2FA" }, { k: "off", label: "Switched off" }, { k: "all", label: "All" }]} />
        <SearchBox value={q} onChange={setQ} placeholder="Search name, e-mail or department" />
        <Err text={error} />
        {!data ? <Skeleton rows={5} /> : shown.map((p) => (
          <Item key={p.id} title={p.full_name || p.email} sub={`${p.email}${p.dept_name ? `, ${p.dept_name}` : ""}`} chip={<Chip tone={!p.is_active ? "mu" : p.has_2fa ? "ok" : "wa"}>{!p.is_active ? "Off" : p.has_2fa ? "2FA on" : "No 2FA"}</Chip>}
            facts={[["Positions", positionsOf(p).map((x) => x.def.name).join(", ") || "Staff"], ["Last sign-in", whenText(p.last_sign_in)]]} onClick={() => push(<StaffRecord id={p.id} onChanged={reload} />)} />
        ))}
        <More more={more} left={left} />
      </Body>
      <FormSheet open={!!form} title="Add a staff member" sub="They sign in with this e-mail and password, then set up 2FA." onClose={() => setForm(null)} saveLabel="Add" busy={busy} error={err} onSave={() => {
        if (!form) return;
        const why = form.fullName.trim().length < 3 ? "Type the full name." : !/^\S+@\S+\.\S+$/.test(form.email.trim()) ? "Type a valid e-mail." : form.password.length < 8 ? "The password needs at least 8 characters." : "";
        if (why) { setErr(why); return; }
        void run("add this staff member", () => office("admin_users", { body: { fullName: form.fullName.trim(), email: form.email.trim().toLowerCase(), password: form.password, roleKey: form.roleKey, departmentId: form.deptId || null } }), "Staff member added.", async () => { setForm(null); await reload(); });
      }}>
        {form ? (<>
          <label><span className="lbl">Full name</span><input className="inp" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
          <label><span className="lbl">E-mail</span><input className="inp" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label><span className="lbl">First password</span><input className="inp" type="text" autoComplete="off" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
          <label><span className="lbl">Position</span><select className="inp" value={form.roleKey} onChange={(e) => setForm({ ...form, roleKey: e.target.value })}><option value="staff">Staff</option>{ASSIGNABLE.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}</select></label>
          <label><span className="lbl">Department</span><select className="inp" value={form.deptId} onChange={(e) => setForm({ ...form, deptId: e.target.value })}><option value="">Choose</option>{(data?.depts || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        </>) : null}
      </FormSheet>
    </>
  );
}

/** One staff member: details, positions, 2FA, passcodes, switch off, delete. This now opens in the app. */
export function StaffRecord({ id, onChanged }: { id: string; onChanged?: () => void }) {
  const { pop } = useNav();
  const { data, error, reload } = useLoad(async () => {
    const [p, d, ph] = await Promise.all([people(), (await db()).from("departments").select("id,name").order("name"), (await db()).from("profiles").select("phone").eq("id", id).maybeSingle()]);
    const person = p.find((x) => x.id === id);
    if (!person) throw new Error("That staff member was not found.");
    return { person, depts: (d.data || []) as Array<{ id: string; name: string }>, phone: String((ph.data as { phone?: string | null } | null)?.phone || "") };
  }, [id]);
  const [sheet, setSheet] = useState<null | "edit" | "add" | "off" | "delete">(null);
  const [edit, setEdit] = useState({ fullName: "", email: "", phone: "", deptId: "" });
  const [addKey, setAddKey] = useState("");
  const [primary, setPrimary] = useState(false);
  const [text, setText] = useState("");
  const { busy, err, setErr, run } = useAction();
  const after = async () => { setSheet(null); await reload(); onChanged?.(); };
  if (error && !data) return <><Head title="Staff member" /><Body><Note tone="er">{error}</Note></Body></>;
  if (!data) return <><Head title="Staff member" /><Body><Skeleton rows={4} /></Body></>;
  const p = data.person;
  const name = p.full_name || p.email;
  const pos = positionsOf(p);
  const patch = (body: Record<string, unknown>, what: string, ok: string) => run(what, () => office("admin_user", { method: "PATCH", id, body }), ok, after);
  return (
    <>
      <Head title={name} />
      <Body onRefresh={reload}>
        <div className="card">
          <div className="row"><b className="title" style={{ fontSize: 17 }}>{name}</b><Chip tone={p.is_active ? "ok" : "mu"}>{p.is_active ? "Active" : "Switched off"}</Chip></div>
          <Facts rows={[["E-mail", p.email], ["Phone", data.phone || "-"], ["Department", p.dept_name || "-"], ["2FA", p.has_2fa ? "On" : "Off"], ["Fingerprints", String(p.fingerprints)], ["Passcodes", String(p.passcodes)], ["Signature", p.has_signature ? "Added" : "Missing"], ["Last sign-in", whenText(p.last_sign_in)]]} />
          {p.system_account ? <Note tone="in">A system account. It cannot be switched off or deleted.</Note> : null}
        </div>
        <div className="sect"><b>Positions</b></div>
        <div className="grp">
          {pos.length ? pos.map((x) => {
            const raw = p.positions.find((q) => positionFor(q.key)?.code === x.def.code)?.key || x.def.keys[0];
            return (
              <Cell key={x.def.code} icon={<KeyRound size={18} />} title={`${x.def.name}${x.primary ? " (main)" : ""}`} sub={x.since ? `Since ${when(x.since)}` : x.def.about} wrap
                right={x.def.group === "System" ? undefined : <span style={{ display: "flex", gap: 6 }}>
                  {!x.primary ? <button type="button" className="btn bs sm" disabled={busy} onClick={() => void run(null, () => call("reqgen_set_primary_profile_role", { p_profile_id: id, p_role_key: raw }), `${x.def.name} is now the main position.`, after)}>Main</button> : null}
                  <button type="button" className="btn bs sm" disabled={busy} onClick={() => void run("remove this position", () => call("reqgen_deactivate_profile_role", { p_profile_id: id, p_role_key: raw }), `${x.def.name} removed.`, after)}>Remove</button>
                </span>} />
            );
          }) : <Cell icon={<KeyRound size={18} />} title="Staff" sub="Everyone in IET" />}
        </div>
        <button type="button" className="btn bs block" onClick={() => { setAddKey(""); setPrimary(false); setSheet("add"); }}><Plus size={18} />Give a position</button>
        <div className="sect"><b>Account</b></div>
        <div className="grp">
          <Cell icon={<Users size={18} />} title="Edit details" sub="Name, e-mail, phone and department" onClick={() => { setEdit({ fullName: p.full_name || "", email: p.email, phone: data.phone, deptId: p.dept_id || "" }); setSheet("edit"); }} />
          {p.has_2fa ? <Cell icon={<ShieldCheck size={18} />} title="Reset 2FA" sub="They set up a new authenticator at the next sign-in" onClick={() => void patch({ action: "reset2fa" }, "reset 2FA", `2FA reset for ${name}.`)} /> : null}
          {p.passcodes ? <Cell icon={<Lock size={18} />} title="Remove passcodes" sub={`${p.passcodes} passcode${p.passcodes === 1 ? "" : "s"}`} onClick={() => void patch({ action: "removePasscodes" }, "remove the passcodes", `Passcodes removed for ${name}.`)} /> : null}
          {!p.system_account ? (p.is_active
            ? <Cell icon={<Lock size={18} />} iconTone="er" title="Switch off this account" sub="They cannot sign in; their phones are switched off" onClick={() => { setText(""); setSheet("off"); }} />
            : <><Cell icon={<Lock size={18} />} title="Switch it back on" sub="They can sign in again" onClick={() => void patch({ action: "reactivate" }, "switch this account on", `${name} can sign in again.`)} />
              <Cell icon={<Trash2 size={18} />} iconTone="er" title="Delete this account" sub="Only when it has no history" onClick={() => { setText(""); setSheet("delete"); }} /></>) : null}
        </div>
        <Err text={err} />
      </Body>
      <FormSheet open={sheet === "edit"} title="Edit details" onClose={() => setSheet(null)} saveLabel="Save" busy={busy} error={err} onSave={() => {
        if (edit.fullName.trim().length < 3 || !/^\S+@\S+\.\S+$/.test(edit.email.trim())) { setErr("Type the full name and a valid e-mail."); return; }
        void patch({ action: "profile", fullName: edit.fullName.trim(), deptId: edit.deptId || null, email: edit.email.trim().toLowerCase(), phone: edit.phone.trim() }, "save these details", "Details saved.");
      }}>
        <label><span className="lbl">Full name</span><input className="inp" value={edit.fullName} onChange={(e) => setEdit({ ...edit, fullName: e.target.value })} /></label>
        <label><span className="lbl">E-mail</span><input className="inp" type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></label>
        <label><span className="lbl">Phone</span><input className="inp" inputMode="tel" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></label>
        <label><span className="lbl">Department</span><select className="inp" value={edit.deptId} onChange={(e) => setEdit({ ...edit, deptId: e.target.value })}><option value="">None</option>{data.depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      </FormSheet>
      <FormSheet open={sheet === "add"} title="Give a position" onClose={() => setSheet(null)} saveLabel="Give" busy={busy} error={err} onSave={() => {
        if (!addKey) { setErr("Choose the position."); return; }
        void run("give this position", () => call("reqgen_assign_profile_role", { p_profile_id: id, p_role_key: addKey, p_is_primary: primary }), `${positionFor(addKey)?.name || "Position"} given to ${name}.`, after);
      }}>
        <select className="inp" value={addKey} onChange={(e) => setAddKey(e.target.value)}><option value="">Choose the position</option>{ASSIGNABLE.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}</select>
        <Chips label="Main" value={primary ? "y" : "n"} onChange={(k) => setPrimary(k === "y")} items={[{ k: "n", label: "Extra position" }, { k: "y", label: "Main position" }]} />
      </FormSheet>
      <FormSheet open={sheet === "off"} title={`Switch off ${name}?`} sub="They are signed out everywhere and cannot sign in." onClose={() => setSheet(null)} saveLabel="Switch off" busy={busy} error={err} onSave={() => {
        if (text.trim().length < 3) { setErr("Write the reason."); return; }
        void patch({ action: "deactivate", reason: text.trim() }, "switch this account off", `${name} was switched off.`);
      }}><label><span className="lbl">Reason</span><input className="inp" value={text} onChange={(e) => setText(e.target.value)} /></label></FormSheet>
      <FormSheet open={sheet === "delete"} title={`Delete ${name}?`} sub="This cannot be undone. Type DELETE to confirm." onClose={() => setSheet(null)} saveLabel="Delete" busy={busy} error={err} onSave={() => {
        if (text.trim() !== "DELETE") { setErr("Type DELETE to confirm."); return; }
        void run("delete this account", () => office("admin_user", { method: "DELETE", id, body: { confirm: "DELETE" } }), `${name} was deleted.`, () => { onChanged?.(); pop(); });
      }}><input className="inp" value={text} autoComplete="off" onChange={(e) => setText(e.target.value)} placeholder="DELETE" /></FormSheet>
    </>
  );
}

type PRow = { position_key: string; position_name: string; holders: number; holder_names: string[] };
export function Positions() {
  const { data, error } = useLoad(() => rows<PRow>("reqgen_admin_positions"), []);
  return (
    <>
      <Head title="Positions" />
      <Body>
        <Err text={error} />
        {POSITIONS.map((def) => {
          const r = (data || []).filter((x) => def.keys.includes(String(x.position_key).toLowerCase().replace(/[^a-z]/g, "")));
          const names = r.flatMap((x) => x.holder_names || []);
          return <Item key={def.code} title={def.name} sub={def.about} chip={<Chip tone={names.length ? "ok" : def.code === "STAFF" ? "in" : "wa"}>{def.code === "STAFF" ? "Everyone" : `${names.length} holder${names.length === 1 ? "" : "s"}`}</Chip>} facts={names.length ? [["Held by", names.join(", ")]] : []} />;
        })}
      </Body>
    </>
  );
}

export function Permissions() {
  const [col, setCol] = useState<string>("Staff");
  const i = MATRIX_COLUMNS.indexOf(col as (typeof MATRIX_COLUMNS)[number]);
  return (
    <>
      <Head title="Permissions Matrix" />
      <Body>
        <p className="mu" style={{ margin: 0 }}>What each position can see and do. It describes what ReqGen enforces, and changes only with a release.</p>
        <select className="inp" value={col} onChange={(e) => setCol(e.target.value)} aria-label="Position">{MATRIX_COLUMNS.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        {MATRIX.map((g) => (
          <div key={g.group}>
            <div className="sect" style={{ marginBottom: 8 }}><b>{g.group}</b></div>
            <div className="grp">{g.rows.map((r) => { const c = r.cells[i]; return <Cell key={r.action} icon={<ShieldCheck size={18} />} iconTone={c === "y" ? "ok" : c === "n" ? "mu" : "in"} title={r.action} right={<Chip tone={c === "y" ? "ok" : c === "n" ? "mu" : "in"}>{c === "y" ? "Yes" : c === "n" ? "No" : CELL_TEXT[c]}</Chip>} />; })}</div>
          </div>
        ))}
      </Body>
    </>
  );
}

type DRow = { id: string; name: string; is_active: boolean | null };
export function Departments() {
  const { data, error, reload } = useLoad(async () => {
    const c = await db();
    const [d, dd, p, a] = await Promise.all([c.from("departments").select("id,name,is_active").order("name"), c.rpc("reqgen_admin_departments_data"), people(), c.from("iet_accounts").select("id,name,bank_name").eq("is_active", true).order("name")]);
    if (d.error) throw new Error(d.error.message);
    const extra = (dd.data || {}) as { routing?: Array<{ dept_id: string; iet_account_id: string; officer_user_id: string }> };
    return { depts: (d.data || []) as DRow[], routing: extra.routing || [], people: p, accounts: (a.data || []) as Array<{ id: string; name: string; bank_name: string | null }> };
  }, []);
  const [form, setForm] = useState<null | { id: string | null; name: string; active: boolean; account: string; officer: string }>(null);
  const { busy, err, setErr, run } = useAction();
  const officers = (data?.people || []).filter((p) => p.is_active && p.positions.some((x) => /^account/i.test(x.key)));
  return (
    <>
      <Head title="Departments" />
      <Body onRefresh={reload}>
        <button type="button" className="btn bp block" onClick={() => setForm({ id: null, name: "", active: true, account: "", officer: "" })}><Plus size={18} />Add a department</button>
        <Err text={error} />
        {!data ? <Skeleton rows={4} /> : data.depts.map((d) => {
          const r = data.routing.find((x) => x.dept_id === d.id);
          const acc = data.accounts.find((a) => a.id === r?.iet_account_id);
          const staff = data.people.filter((p) => p.dept_id === d.id && p.is_active).length;
          return <Item key={d.id} title={d.name} chip={<Chip tone={d.is_active === false ? "mu" : "ok"}>{d.is_active === false ? "Off" : "Active"}</Chip>} facts={[["Staff", String(staff)], ["Paid from", acc ? acc.name : "Not set"], ["Account Officer", data.people.find((p) => p.id === r?.officer_user_id)?.full_name || "-"]]}
            onClick={() => setForm({ id: d.id, name: d.name, active: d.is_active !== false, account: r?.iet_account_id || "", officer: r?.officer_user_id || "" })} />;
        })}
      </Body>
      <FormSheet open={!!form} title={form?.id ? `Edit ${form.name}` : "Add a department"} sub="Its directors and heads are set in the Routing Engine." onClose={() => setForm(null)} saveLabel="Save" busy={busy} error={err} onSave={() => {
        if (!form) return;
        if (form.name.trim().length < 2) { setErr("Type the department name."); return; }
        void run(null, () => call("reqgen_admin_save_department", { p_dept_id: form.id, p_name: form.name.trim(), p_is_active: form.active, p_account_id: form.account || null, p_officer_id: form.officer || null }), "Department saved.", async () => { setForm(null); await reload(); });
      }}>
        {form ? (<>
          <label><span className="lbl">Name</span><input className="inp" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label><span className="lbl">Paid from (IET account)</span><select className="inp" value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })}><option value="">Not set</option>{(data?.accounts || []).map((a) => <option key={a.id} value={a.id}>{a.name}{a.bank_name ? `, ${a.bank_name}` : ""}</option>)}</select></label>
          <label><span className="lbl">Account Officer</span><select className="inp" value={form.officer} onChange={(e) => setForm({ ...form, officer: e.target.value })}><option value="">Not set</option>{officers.map((o) => <option key={o.id} value={o.id}>{o.full_name}</option>)}</select></label>
          <Chips label="Status" value={form.active ? "on" : "off"} onChange={(k) => setForm({ ...form, active: k === "on" })} items={[{ k: "on", label: "Active" }, { k: "off", label: "Switched off" }]} />
        </>) : null}
      </FormSheet>
    </>
  );
}

const KINDS: Array<{ k: RouteKind; label: string }> = [{ k: "official", label: "Official" }, { k: "personal_fund", label: "Personal fund" }, { k: "personal_other", label: "Personal, other" }];
const INSTITUTION = [{ key: "DG_USER_ID", label: "Director General" }, { key: "GENSEC_USER_ID", label: "General Secretary (acts for the DG)" }, { key: "REGISTRAR_USER_ID", label: "Registrar" }, { key: "HR_USER_ID", label: "HR Coordinator" }, { key: "DIN_ADMIN_USER_ID", label: "DIN Admin" }, { key: "REGISTRY_USER_ID", label: "Registry officer" }];
export function Routing() {
  const { push } = useNav();
  const { data, error, reload } = useLoad(async () => {
    const c = await db();
    const [d, r, p, s] = await Promise.all([c.from("departments").select("id,name,is_active").order("name"), loadRouting(), people(), c.from("app_settings").select("key,value").in("key", INSTITUTION.map((i) => i.key))]);
    return { depts: (d.data || []) as DRow[], routing: r, people: p, settings: Object.fromEntries(((s.data || []) as Array<{ key: string; value: string | null }>).map((x) => [x.key, x.value || ""])) };
  }, []);
  const [inst, setInst] = useState<Record<string, string> | null>(null);
  const { busy, err, run } = useAction();
  const nameOf = (id: string) => data?.people.find((p) => p.id === id)?.full_name || "";
  return (
    <>
      <Head title="Routing Engine" />
      <Body onRefresh={reload}>
        <p className="mu" style={{ margin: 0 }}>Who approves what, in which order. A saved route is a new version: requests already moving keep theirs.</p>
        <Err text={error || data?.routing.error} />
        <div className="sect"><b>Institution officers</b></div>
        <div className="grp">{INSTITUTION.map((i) => <Cell key={i.key} icon={<KeyRound size={18} />} title={i.label} sub={nameOf(data?.settings[i.key] || "") || "Not set"} onClick={() => setInst({ ...(data?.settings || {}) })} />)}</div>
        <div className="sect"><b>Departments</b></div>
        {!data ? <Skeleton rows={4} /> : <div className="grp">{data.depts.filter((d) => d.is_active !== false).map((d) => {
          const steps = data.routing.overview.filter((r) => r.dept_id === d.id && r.route_kind === "official").sort((a, b) => a.step_order - b.step_order);
          return <Cell key={d.id} icon={<RouteIcon size={18} />} title={d.name} sub={steps.length ? steps.map((s) => STAGE_TEXT[s.stage] || s.stage).join(", then ") : "No route yet"} wrap onClick={() => push(<RouteEditor deptId={d.id} deptName={d.name} onSaved={reload} />)} />;
        })}</div>}
      </Body>
      <FormSheet open={!!inst} title="Institution officers" sub="New requests use them at once." onClose={() => setInst(null)} saveLabel="Save" busy={busy} error={err} onSave={() => {
        if (!inst || !data) return;
        const changed = INSTITUTION.filter((i) => (inst[i.key] || "") !== (data.settings[i.key] || ""));
        if (!changed.length) { setInst(null); return; }
        void run("change the institution officers", async () => {
          const c = await db();
          const { error: e } = await c.from("app_settings").upsert(changed.map((i) => ({ key: i.key, value: inst[i.key] || "" })), { onConflict: "key" });
          if (e) throw new Error(e.message);
          void c.rpc("reqgen_audit_write", { p_category: "settings", p_module: "Administration", p_action: "Institution officers changed", p_record_no: changed.map((x) => x.label).join(", "), p_record_id: null, p_details: null });
        }, "Saved. New requests use them at once.", async () => { setInst(null); await reload(); });
      }}>
        {inst ? INSTITUTION.map((i) => <label key={i.key}><span className="lbl">{i.label}</span><select className="inp" value={inst[i.key] || ""} onChange={(e) => setInst({ ...inst, [i.key]: e.target.value })}><option value="">Not set</option>{(data?.people || []).filter((p) => p.is_active).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label>) : null}
      </FormSheet>
    </>
  );
}

function RouteEditor({ deptId, deptName, onSaved }: { deptId: string; deptName: string; onSaved: () => void }) {
  const { pop } = useNav();
  const { data, error } = useLoad(async () => { const [r, p] = await Promise.all([loadRouting(), people()]); return { r: routeOf(deptId, r.overview, r.officers), people: p.filter((x) => x.is_active) }; }, [deptId]);
  const [kind, setKind] = useState<RouteKind>("official");
  const [lanes, setLanes] = useState<Record<RouteKind, Lane> | null>(null);
  const [offs, setOffs] = useState<Record<OfficerStage, string> | null>(null);
  const [dgVacant, setDgVacant] = useState<IfVacant | null>(null);
  const { busy, err, run } = useAction();
  if (!data) return <><Head title={deptName} /><Body>{error ? <Note tone="er">{error}</Note> : <Skeleton rows={4} />}</Body></>;
  const L = lanes || data.r.lanes, O = offs || data.r.officers, D = dgVacant || data.r.dgVacant;
  const setLane = (s: (typeof REVIEW)[number], patch: Partial<{ on: boolean; ifVacant: IfVacant }>) => setLanes({ ...L, [kind]: { ...L[kind], [s]: { ...L[kind][s], ...patch } } });
  return (
    <>
      <Head title={deptName} />
      <Body bar>
        <Chips label="Kind of request" value={kind} onChange={setKind} items={KINDS} />
        <p className="mu" style={{ margin: 0 }}>Steps before the DG, in this order. A vacant step is skipped or blocks, as you choose.</p>
        <div className="grp">
          {REVIEW.map((s) => (
            <div key={s} className="cell" style={{ flexWrap: "wrap" }}>
              <button type="button" className={`box${L[kind][s].on ? " on" : ""}`} role="checkbox" aria-checked={L[kind][s].on} aria-label={STAGE_TEXT[s]} onClick={() => setLane(s, { on: !L[kind][s].on })}>{L[kind][s].on ? "✓" : ""}</button>
              <span className="t"><b>{STAGE_TEXT[s]}</b><small>{L[kind][s].on ? (L[kind][s].ifVacant === "skip" ? "Skipped when vacant" : "Blocks when vacant") : "Not on this route"}</small></span>
              {L[kind][s].on ? <button type="button" className="btn bs sm" onClick={() => setLane(s, { ifVacant: L[kind][s].ifVacant === "skip" ? "block" : "skip" })}>{L[kind][s].ifVacant === "skip" ? "Skip" : "Block"}</button> : null}
            </div>
          ))}
          <div className="cell"><span className="t"><b>DG + stamp</b><small>{D === "skip" ? "Skipped when vacant" : "Blocks when vacant"}</small></span><button type="button" className="btn bs sm" onClick={() => setDgVacant(D === "skip" ? "block" : "skip")}>{D === "skip" ? "Skip" : "Block"}</button></div>
        </div>
        <div className="sect"><b>Officers for {deptName}</b></div>
        {OFFICER_STAGES.map((s) => <label key={s}><span className="lbl">{STAGE_TEXT[s]}</span><select className="inp" value={O[s] || ""} onChange={(e) => setOffs({ ...O, [s]: e.target.value })}><option value="">Not set (institution officer)</option>{data.people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label>)}
        <Err text={err} />
      </Body>
      <div className="bar"><button type="button" className="btn bp" disabled={busy} onClick={() => void run("save this route", () => saveRoute(deptId, L, O, D), "Route saved. New requests follow it.", () => { onSaved(); pop(); })}><RouteIcon size={18} />{busy ? "Saving…" : "Save the route"}</button></div>
    </>
  );
}

type Rules = { stay_hours: number; idle_minutes: number; passcode_tries: number; twofa_scope: string; updated_at: string | null; updated_by_label: string | null };
type Attention = { kind: "no2fa" | "passcode_removed"; person_id: string; person: string; detail: string; at: string | null };
export function SecurityCentre() {
  const { data, error, reload } = useLoad(async () => {
    const c = await db();
    const [r, a] = await Promise.all([c.from("reqgen_security_rules").select("stay_hours,idle_minutes,passcode_tries,twofa_scope,updated_at,updated_by_label").eq("id", 1).maybeSingle(), c.rpc("reqgen_security_attention")]);
    return { rules: (r.data as Rules | null) || null, attention: (a.data || []) as Attention[] };
  }, []);
  const [draft, setDraft] = useState<Rules | null>(null);
  const { busy, err, run } = useAction();
  const R = draft || data?.rules;
  const no2fa = (data?.attention || []).filter((x) => x.kind === "no2fa");
  return (
    <>
      <Head title="Security Centre" />
      <Body onRefresh={reload}>
        <Err text={error || err} />
        {R ? (<div className="card">
          <b>Sign-in rules</b>
          <label><span className="lbl">Stay signed in (hours)</span><input className="inp" inputMode="numeric" value={R.stay_hours} onChange={(e) => setDraft({ ...R, stay_hours: Number(e.target.value.replace(/\D/g, "") || 0) })} /></label>
          <label><span className="lbl">Lock after idle (minutes)</span><input className="inp" inputMode="numeric" value={R.idle_minutes} onChange={(e) => setDraft({ ...R, idle_minutes: Number(e.target.value.replace(/\D/g, "") || 0) })} /></label>
          <label><span className="lbl">Passcode tries</span><input className="inp" inputMode="numeric" value={R.passcode_tries} onChange={(e) => setDraft({ ...R, passcode_tries: Number(e.target.value.replace(/\D/g, "") || 0) })} /></label>
          <p className="foot" style={{ textAlign: "left" }}>2FA: {R.twofa_scope}. Last changed {when(R.updated_at)}{R.updated_by_label ? ` by ${R.updated_by_label}` : ""}.</p>
          <button type="button" className="btn bp block" disabled={busy || !draft} onClick={() => void run("save the security rules", () => call("reqgen_security_rules_save", { p_stay_hours: R.stay_hours, p_idle_minutes: R.idle_minutes, p_passcode_tries: R.passcode_tries }), "Rules saved.", async () => { setDraft(null); await reload(); })}>Save rules</button>
        </div>) : data ? <Note tone="wa">The sign-in rules could not be read. They are set by the security database step; ask the Developer.</Note> : <Skeleton rows={2} />}
        <div className="sect"><b>Needs attention ({(data?.attention || []).length})</b></div>
        {no2fa.length ? <button type="button" className="btn bs block" disabled={busy} onClick={() => void run(null, () => call("reqgen_security_remind", { p_ids: no2fa.map((x) => x.person_id) }), `Reminded ${no2fa.length} to set up 2FA.`)}>Remind {no2fa.length} to set up 2FA</button> : null}
        {(data?.attention || []).map((a, i) => <Item key={i} title={a.person} sub={a.detail} chip={<Chip tone="wa">{a.kind === "no2fa" ? "No 2FA" : "Passcode removed"}</Chip>} facts={a.at ? [["When", when(a.at)]] : []} />)}
      </Body>
    </>
  );
}

type Diag = { tables: number; rls_on: number; rls_off: string[]; last_notification: string | null; last_nightly: { at: string | null; bytes: number | null } | null; old_po_codes: number; audit_events_today: number; response_ms: number; checks: Array<{ label: string; count: number }> };
export function Diagnostics() {
  const { data, error, reload } = useLoad(async () => { const t = Date.now(); const d = await call<Diag>("reqgen_diagnostics"); return { ...d, app_ms: Date.now() - t }; }, []);
  return (
    <>
      <Head title="Diagnostics" />
      <Body onRefresh={reload}>
        <Err text={error} />
        {!data ? <Skeleton rows={3} /> : (<>
          <Stats items={[{ label: "Tables with rules", value: `${data.rls_on} of ${data.tables}`, tone: data.rls_off.length ? "er" : "ok" }, { label: "Answer time", value: `${data.app_ms} ms` }, { label: "Audit events today", value: data.audit_events_today }, { label: "Old PO codes", value: data.old_po_codes, tone: data.old_po_codes ? "wa" : undefined }]} />
          {data.rls_off.length ? <Note tone="er">Tables without row rules: {data.rls_off.join(", ")}.</Note> : <Note tone="ok">Every table has its row rules on.</Note>}
          <Facts rows={[["Last notice sent", when(data.last_notification) || "-"], ["Last nightly backup", data.last_nightly?.at ? when(data.last_nightly.at) : "-"]]} />
          <div className="grp">{data.checks.map((c) => <Cell key={c.label} icon={<Activity size={18} />} iconTone={c.count ? "wa" : "ok"} title={c.label} right={<Chip tone={c.count ? "wa" : "ok"}>{String(c.count)}</Chip>} />)}</div>
        </>)}
      </Body>
    </>
  );
}

const SCOPES: Array<{ key: "finance" | "vouchers" | "requests"; title: string; about: string }> = [
  { key: "finance", title: "Finance records (always)", about: "Ledger lines, account transactions, transfers, reversals and reconciliations. Every subhead and IET account figure goes to ₦0.00." },
  { key: "vouchers", title: "Payment vouchers", about: "Every voucher with its lines, signing history, transfer schedule and attachments list." },
  { key: "requests", title: "Requests", about: "Every request with its history, attachments list, drafts and reminders. Needs the vouchers to be cleared too." },
];
type PreviewRow = { part: string; item: string; rows: number; note: string };
export function FinanceReset() {
  const { me } = useApp();
  const [scopes, setScopes] = useState<Set<string>>(new Set(["finance"]));
  const list = SCOPES.map((s) => s.key).filter((k) => scopes.has(k));
  const { data, error } = useLoad(() => rows<PreviewRow>("reqgen_finance_reset_preview", { p_scopes: list }), [list.join(",")]);
  const [backup, setBackup] = useState<null | { id: string; records: number; at: number }>(null);
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const { busy, err, setErr, run } = useAction();
  const fresh = !!backup && Date.now() - backup.at < 55 * 60000;
  if (!isAdminRole(me.role) && me.systemAccount !== "developer") return <><Head title="Financial Reset" /><Body><Note tone="wa">Only the Super Admin or the Developer can reset finance records.</Note></Body></>;
  return (
    <>
      <Head title="Financial Reset" />
      <Body>
        <Note tone="er">This clears test records and starts the money at ₦0.00. A checked backup is taken first, and nothing is cleared without it.</Note>
        <div className="grp">{SCOPES.map((s) => { const on = scopes.has(s.key); return (
          <button key={s.key} type="button" className="cell" role="checkbox" aria-checked={on} disabled={s.key === "finance"} onClick={() => { setBackup(null); const n = new Set(scopes); if (on) { n.delete(s.key); if (s.key === "vouchers") n.delete("requests"); } else { n.add(s.key); if (s.key === "requests") n.add("vouchers"); } setScopes(n); }}>
            <span className={`box${on ? " on" : ""}`} aria-hidden="true">{on ? "✓" : ""}</span><span className="t"><b>{s.title}</b><small className="wrap">{s.about}</small></span>
          </button>
        ); })}</div>
        <Err text={error} />
        {data ? <div className="grp">{data.map((r, i) => <Cell key={i} icon={<Building2 size={18} />} title={`${r.part}: ${r.item}`} sub={r.note} right={<b>{r.rows}</b>} />)}</div> : <Skeleton rows={2} />}
        <button type="button" className="btn bs block" disabled={busy} onClick={() => void run("take the backup before the reset", async () => { const out = await office<{ backup?: { id: string; records: number } }>("finance_reset", { body: { action: "backup" } }); if (!out.backup) throw new Error("The backup failed. Nothing was reset."); setBackup({ id: out.backup.id, records: out.backup.records, at: Date.now() }); }, "Backup stored and checked. You can reset within the hour.")}>1. Take and check the backup</button>
        {fresh ? <Note tone="ok">Backup of {backup!.records} records is ready.</Note> : null}
        <label><span className="lbl">Reason (at least 10 letters)</span><input className="inp" value={reason} onChange={(e) => setReason(e.target.value)} disabled={!fresh} /></label>
        <label><span className="lbl">Type RESET FINANCE</span><input className="inp" value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} disabled={!fresh} placeholder="RESET FINANCE" /></label>
        <button type="button" className="btn bd block" disabled={busy || !fresh || reason.trim().length < 10 || typed !== "RESET FINANCE"} onClick={() => {
          if (!backup) { setErr("Take the backup first."); return; }
          void run("reset the finance records", () => office("finance_reset", { body: { action: "reset", backupId: backup.id, scopes: list, confirm: typed, reason: reason.trim() } }), "Reset done. Every figure is now ₦0.00.", () => { setBackup(null); setTyped(""); setReason(""); });
        }}>2. Reset finance records</button>
        <Err text={err} />
        <p className="foot" style={{ textAlign: "left" }}>Every figure afterwards: {naira(0)}.</p>
      </Body>
    </>
  );
}

type SA = { kind: string; email: string; signin: string; last_sign_in: string | null; full_name: string | null; marked: string | null; active: boolean; positions: string | null; acting: string | null; has_2fa: boolean };
export function SystemAccounts() {
  const { me } = useApp();
  const { data, error, reload } = useLoad(async () => { const [s, k] = await Promise.all([rows<SA>("reqgen_system_accounts_status"), (await db()).from("app_settings").select("value").eq("key", "SUPERADMIN_KEEPER").maybeSingle()]); return { list: s, keeper: String((k.data as { value?: string } | null)?.value || "") }; }, []);
  const [dlg, setDlg] = useState<null | { keeper: string; confirm: string }>(null);
  const { busy, err, setErr, run } = useAction();
  return (
    <>
      <Head title="System Accounts" />
      <Body onRefresh={reload}>
        <p className="mu" style={{ margin: 0 }}>The Super Admin (the Trust's own account, ietreqgen@gmail.com) and the Developer. Not people: neither can be deleted.</p>
        <Err text={error} />
        {!data ? <Skeleton rows={2} /> : data.list.map((s) => (
          <Item key={s.kind} title={s.kind} sub={s.email} chip={<Chip tone={s.active ? "ok" : "er"}>{s.active ? "Active" : "Off"}</Chip>} facts={[["Sign-in", s.signin], ["Last sign-in", whenText(s.last_sign_in)], ["2FA", s.has_2fa ? "On" : "Off"], s.acting ? ["Acting as", s.acting] : null, s.positions ? ["Positions", s.positions] : null]} />
        ))}
        {data?.keeper ? <Note tone="in">Keeper of the Super Admin account: {data.keeper}.</Note> : null}
        {isAdminRole(me.role) ? <button type="button" className="btn bs block" onClick={() => setDlg({ keeper: "", confirm: "" })}>Hand over the Super Admin account</button> : null}
      </Body>
      <FormSheet open={!!dlg} title="Hand over the Super Admin account" sub="The new keeper gets the password reset e-mail; your sign-ins end." onClose={() => setDlg(null)} saveLabel="Hand over" busy={busy} error={err} onSave={() => {
        if (!dlg) return;
        if (dlg.keeper.trim().length < 3) { setErr("Write the full name of the new keeper."); return; }
        if (dlg.confirm.trim().toUpperCase() !== "HAND OVER") { setErr("Type HAND OVER to confirm."); return; }
        void run("hand over the Super Admin account", () => office("handover", { body: { keeper: dlg.keeper.trim(), confirm: dlg.confirm.trim() } }), "Handed over.", async () => { setDlg(null); await reload(); });
      }}>
        {dlg ? (<>
          <label><span className="lbl">New keeper (full name)</span><input className="inp" value={dlg.keeper} onChange={(e) => setDlg({ ...dlg, keeper: e.target.value })} /></label>
          <label><span className="lbl">Type HAND OVER</span><input className="inp" value={dlg.confirm} autoComplete="off" onChange={(e) => setDlg({ ...dlg, confirm: e.target.value })} /></label>
        </>) : null}
      </FormSheet>
    </>
  );
}


