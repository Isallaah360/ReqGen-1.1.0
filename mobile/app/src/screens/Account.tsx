import { useEffect, useRef, useState } from "react";
import { Camera, Check, Eraser, Eye, EyeOff, ImagePlus, PenLine, Smartphone, Trash2, UserRound } from "lucide-react";
import { SUPABASE_URL, db, plainError } from "../lib/core";
import { useOnline } from "../lib/data";
import { cleanSignatureFile } from "../lib/signatureInk";
import { when } from "../lib/text";
import { useApp } from "../App";
import { Avatar, Body, Cell, Chip, Choose, Field, Head, Note, Skeleton, toast } from "../ui";

/** App 4.0.0: My account, as app screens (profile, acting as, password, signature, photo, phones). */

// ---- Profile ------------------------------------------------------------------------------------------
export function Profile() {
  const { me, reloadMe } = useApp();
  const online = useOnline();
  const [name, setName] = useState(me.full_name);
  const [phone, setPhone] = useState(me.phone || "");
  const [gender, setGender] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "role" | "pw">("");
  const [msg, setMsg] = useState<{ tone: string; text: string } | null>(null);
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [show, setShow] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await (await db()).from("profiles").select("gender").eq("id", me.id).maybeSingle();
      setGender(String((data as { gender?: string | null } | null)?.gender || ""));
    })();
  }, [me.id]);

  async function save() {
    if (name.trim().length < 3) { setMsg({ tone: "er", text: "Write your full name." }); return; }
    if (phone.trim() && phone.replace(/\D/g, "").length < 10) { setMsg({ tone: "er", text: "Write a full phone number, e.g. 0803 000 0000." }); return; }
    setBusy("save"); setMsg(null);
    const { error } = await (await db()).from("profiles").update({ full_name: name.trim(), phone: phone.trim() || null, ...(gender ? { gender } : {}) }).eq("id", me.id);
    setBusy("");
    if (error) { setMsg({ tone: "er", text: plainError(error) }); return; }
    await reloadMe(); toast("Profile saved.");
  }

  async function actAs(key: string) {
    setBusy("role"); setMsg(null);
    const { error } = await (await db()).rpc("set_my_active_role", { p_role_key: key });
    setBusy("");
    if (error) { setMsg({ tone: "er", text: plainError(error) }); return; }
    await reloadMe(); toast("Position changed.");
  }

  async function changePassword() {
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) { setMsg({ tone: "er", text: "Use at least 8 characters, with letters and numbers." }); return; }
    if (pw !== pw2) { setMsg({ tone: "er", text: "The two passwords are not the same." }); return; }
    setBusy("pw"); setMsg(null);
    const { error } = await (await db()).auth.updateUser({ password: pw });
    setBusy("");
    if (error) { setMsg({ tone: "er", text: plainError(error) }); return; }
    setPw(""); setPw2(""); toast("Password changed.");
  }

  return (
    <>
      <Head title="Profile" />
      <Body>
        <div className="cell grp">
          <Avatar name={me.full_name} url={me.avatar_url} size="lg" />
          <span className="t"><b style={{ fontSize: 17 }}>{me.full_name}</b><small>{me.email}</small></span>
        </div>
        {msg ? <Note tone={msg.tone}>{msg.text}</Note> : null}
        <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="Full name" req><input className="inp" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
          <Field label="Phone for SMS" help="Codes and notices are sent here."><input className="inp" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0803 000 0000" /></Field>
          <Field label="Gender"><Choose label="Gender" value={gender} onChange={setGender} placeholder="Choose" options={[{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }]} /></Field>
          <button type="button" className="btn bp block" disabled={busy !== "" || !online} onClick={() => void save()}><Check size={18} />{busy === "save" ? "Saving…" : "Save"}</button>
          <p className="foot" style={{ textAlign: "left" }}>Your sign-in e-mail and department are changed by the Super Admin.</p>
        </section>

        {me.positions.length > 1 ? (
          <>
            <div className="sect"><b>Acting as</b></div>
            <div className="grp" role="radiogroup" aria-label="Acting as">
              {me.positions.map((p) => {
                const on = p.key === me.role;
                return (
                  <button key={p.key} type="button" className="cell" role="radio" aria-checked={on} disabled={busy !== "" || on} onClick={() => void actAs(p.key)}>
                    <span className="t"><b>{p.name}</b>{p.primary ? <small>Main position</small> : null}</span>
                    <span className={`box${on ? " on" : ""}`} style={{ borderRadius: 13 }} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        <div className="sect"><b>Password</b></div>
        <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="New password" help="At least 8 characters, with letters and numbers.">
            <span className="inp-wrap" style={{ display: "block" }}>
              <input className="inp" type={show ? "text" : "password"} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
              <button type="button" className="eye" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((v) => !v)}>{show ? <EyeOff size={20} /> : <Eye size={20} />}</button>
            </span>
          </Field>
          <Field label="Type it again"><input className="inp" type={show ? "text" : "password"} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
          <button type="button" className="btn bs block" disabled={busy !== "" || !online || !pw} onClick={() => void changePassword()}>{busy === "pw" ? "Changing…" : "Change password"}</button>
        </section>
      </Body>
    </>
  );
}

// ---- Signature and photo ---------------------------------------------------------------------------------
const sigUrl = (path: string | null) => !path ? null : /^(https?:|data:)/.test(path) ? path : `${SUPABASE_URL}/storage/v1/object/public/signatures/${path.replace(/^signatures\//, "")}?t=${Date.now()}`;

export function SignaturePhoto() {
  const { me, reloadMe } = useApp();
  const online = useOnline();
  const pad = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [drawn, setDrawn] = useState(false);
  const [mode, setMode] = useState<"draw" | "photo">("draw");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "sig" | "photo">("");
  const [msg, setMsg] = useState<{ tone: string; text: string } | null>(null);
  const current = sigUrl(me.signature_url);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = pad.current!; const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  }
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = pad.current?.getContext("2d"); if (!ctx) return;
    pad.current!.setPointerCapture(e.pointerId); drawing.current = true;
    const p = point(e); ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#111111";
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return; const ctx = pad.current?.getContext("2d"); if (!ctx) return;
    const p = point(e); ctx.lineTo(p.x, p.y); ctx.stroke(); setDrawn(true);
  }
  function clear() { const c = pad.current; c?.getContext("2d")?.clearRect(0, 0, c.width, c.height); setDrawn(false); }

  function pick(f: File | null) {
    setMsg(null);
    if (!f) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) { setMsg({ tone: "er", text: "Use a PNG, JPG or WEBP picture." }); return; }
    if (f.size > 5 * 1024 * 1024) { setMsg({ tone: "er", text: "The picture is too large (up to 5 MB)." }); return; }
    setFile(f); setPreview(URL.createObjectURL(f));
  }

  async function saveSig(fromSaved = false) {
    setMsg(null);
    let up: File | null = null;
    if (fromSaved) {
      // 4.2.2: clean a signature saved before cleaning existed, and save it again as ink only.
      if (!current) return;
      try { const r = await fetch(current); if (!r.ok) throw new Error(); up = new File([await r.blob()], "signature.png", { type: "image/png" }); }
      catch { setMsg({ tone: "er", text: "Your saved signature could not be opened. Save it again." }); return; }
    } else if (mode === "draw") {
      if (!drawn || !pad.current) { setMsg({ tone: "er", text: "Sign in the box first." }); return; }
      const blob = await new Promise<Blob | null>((ok) => pad.current!.toBlob(ok, "image/png"));
      if (!blob) { setMsg({ tone: "er", text: "The drawing could not be read. Try again." }); return; }
      up = new File([blob], "signature.png", { type: "image/png" });
    } else {
      if (!file) { setMsg({ tone: "er", text: "Take or choose a photo of your signature first." }); return; }
      up = file;
    }
    setBusy("sig");
    try {
      up = (await cleanSignatureFile(up)).file; // always: only the ink goes on the papers
      if (up.size > 500 * 1024) throw new Error("The cleaned signature is still too large. Take a closer photo.");
      const s = await db();
      const path = `${me.id}/signature-${Date.now()}.png`;
      const r = await s.storage.from("signatures").upload(path, up, { upsert: false, contentType: up.type || "image/png" });
      if (r.error) throw r.error;
      const { error } = await s.from("profiles").update({ signature_url: path }).eq("id", me.id);
      if (error) throw error;
      clear(); setFile(null); setPreview(null);
      await reloadMe(); toast("Signature saved. It goes on everything you sign from now on.");
    } catch (e) { setMsg({ tone: "er", text: plainError(e) }); }
    finally { setBusy(""); }
  }

  async function savePhoto(f: File | null) {
    setMsg(null);
    if (f && !["image/png", "image/jpeg", "image/webp"].includes(f.type)) { setMsg({ tone: "er", text: "The photo must be PNG, JPG or WEBP." }); return; }
    if (f && f.size > 1024 * 1024) { setMsg({ tone: "er", text: "The photo is too large (up to 1 MB)." }); return; }
    setBusy("photo");
    try {
      const s = await db();
      let url: string | null = null;
      if (f) {
        const path = `${me.id}/avatar-${Date.now()}.${f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg"}`;
        const r = await s.storage.from("avatars").upload(path, f, { upsert: false, contentType: f.type, cacheControl: "3600" });
        if (r.error) throw r.error;
        url = s.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await s.from("profiles").update({ avatar_url: url }).eq("id", me.id);
      if (error) throw error;
      await reloadMe(); toast(url ? "Photo updated." : "Photo removed.");
    } catch (e) { setMsg({ tone: "er", text: plainError(e) }); }
    finally { setBusy(""); }
  }

  return (
    <>
      <Head title="Signature and photo" />
      <Body>
        {msg ? <Note tone={msg.tone}>{msg.text}</Note> : null}
        <div className="sect"><b>Your signature</b>{current ? <Chip tone="ok">Saved</Chip> : <Chip tone="er">Missing</Chip>}</div>
        {current ? <div className="card" style={{ background: "#fff" }}><img src={current} alt="Your saved signature" style={{ maxHeight: 90, maxWidth: "100%", objectFit: "contain" }} /></div> : <Note tone="wa">You need a signature before you can approve or sign anything.</Note>}
        <div className="seg" role="tablist" aria-label="How to add the signature">
          <button type="button" role="tab" aria-selected={mode === "draw"} onClick={() => setMode("draw")}><PenLine size={16} /> Draw it</button>
          <button type="button" role="tab" aria-selected={mode === "photo"} onClick={() => setMode("photo")}><Camera size={16} /> Photo of it</button>
        </div>
        {mode === "draw" ? (
          <div className="card" style={{ padding: 8, background: "#fff" }}>
            <canvas ref={pad} width={900} height={300} aria-label="Sign here with your finger" style={{ width: "100%", height: 150, touchAction: "none", borderRadius: 12, border: "1.5px dashed #C9CED8", background: "#fff" }}
              onPointerDown={down} onPointerMove={move} onPointerUp={() => { drawing.current = false; }} onPointerLeave={() => { drawing.current = false; }} />
            <button type="button" className="btn bs" style={{ marginTop: 8 }} onClick={clear}><Eraser size={16} />Clear</button>
          </div>
        ) : (
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label className="btn bs block" style={{ cursor: "pointer" }}><Camera size={18} />Take or choose a photo
              <input type="file" accept="image/png,image/jpeg,image/webp" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0] || null)} />
            </label>
            {preview ? <img src={preview} alt="Chosen signature photo" style={{ maxHeight: 120, objectFit: "contain", background: "#fff", borderRadius: 10 }} /> : <p className="mu" style={{ fontSize: 13.5 }}>Sign on white paper with a dark pen, then take a close, clear photo.</p>}
          </div>
        )}
        <p className="mu" style={{ fontSize: 13.5 }}>ReqGen removes the paper background, so only the ink of your signature goes on the papers.</p>
        {current && !preview && !drawn ? <button type="button" className="btn bs block" disabled={busy !== "" || !online} onClick={() => void saveSig(true)}><Check size={18} />Clean my saved signature</button> : null}
        <button type="button" className="btn bp block" disabled={busy !== "" || !online} onClick={() => void saveSig()}>{busy === "sig" ? "Saving…" : "Save signature"}</button>

        <div className="sect"><b>Your photo</b></div>
        <div className="cell grp">
          <Avatar name={me.full_name} url={me.avatar_url} size="lg" />
          <span className="t"><b>{me.avatar_url ? "Photo set" : "No photo"}</b><small>Shown beside your name</small></span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <label className="btn bs" style={{ flex: 1, cursor: "pointer" }}><Camera size={18} />{busy === "photo" ? "Saving…" : "Take a photo"}
            <input type="file" accept="image/png,image/jpeg,image/webp" capture="user" hidden disabled={busy !== ""} onChange={(e) => void savePhoto(e.target.files?.[0] || null)} />
          </label>
          <label className="btn bs" style={{ flex: 1, cursor: "pointer" }}><ImagePlus size={18} />Choose
            <input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={busy !== ""} onChange={(e) => void savePhoto(e.target.files?.[0] || null)} />
          </label>
          {me.avatar_url ? <button type="button" className="btn bs" style={{ flex: 1, color: "var(--er)" }} disabled={busy !== ""} onClick={() => void savePhoto(null)}><Trash2 size={18} />Remove</button> : null}
        </div>
      </Body>
    </>
  );
}

// ---- Security: this account's phones --------------------------------------------------------------------
type Dev = { id: string; label: string | null; platform: string | null; app_version: string | null; created_at: string; last_used_at: string | null; revoked_at: string | null; revoked_reason: string | null };
export function Security() {
  const { me } = useApp();
  const [rows, setRows] = useState<Dev[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mine, setMine] = useState<string | null>(null);
  async function load() {
    const s = await db();
    const { data, error } = await s.from("reqgen_app_devices").select("id,label,platform,app_version,created_at,last_used_at,revoked_at,revoked_reason").eq("user_id", me.id).order("created_at", { ascending: false }).limit(20);
    if (error) { setErr(plainError(error)); setRows([]); return; }
    setRows((data || []) as Dev[]);
  }
  useEffect(() => { void load(); void import("../lib/device").then((d) => d.deviceId()).then(setMine); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function off(id: string) {
    const { error } = await (await db()).rpc("reqgen_app_device_revoke", { p_device: id, p_user: null, p_reason: "Removed by the owner" });
    if (error) { toast(plainError(error), "er"); return; }
    toast("That phone is switched off."); void load();
  }
  return (
    <>
      <Head title="Security and phones" />
      <Body onRefresh={load}>
        <Note tone="in">Sign-in uses your password and the authenticator app (2FA). On this phone, the fingerprint or app PIN then opens ReqGen and confirms what you send, approve, sign or pay.</Note>
        {err ? <Note tone="er">{err}</Note> : null}
        <div className="sect"><b>Phones set up for your account</b></div>
        {rows === null ? <Skeleton rows={2} /> : rows.length ? (
          <div className="grp">
            {rows.map((d) => (
              <Cell key={d.id} icon={<Smartphone size={18} />} iconTone={d.revoked_at ? "mu" : "ok"}
                title={`${d.label || "Phone"}${d.id === mine ? " (this phone)" : ""}`}
                sub={d.revoked_at ? `Switched off ${when(d.revoked_at)}${d.revoked_reason ? `: ${d.revoked_reason}` : ""}` : `Set up ${when(d.created_at)}${d.last_used_at ? `, last used ${when(d.last_used_at)}` : ""}${d.app_version ? `, app ${d.app_version}` : ""}`}
                right={!d.revoked_at && d.id !== mine ? <button type="button" className="btn bs sm" style={{ color: "var(--er)" }} onClick={() => void off(d.id)}>Switch off</button> : undefined} />
            ))}
          </div>
        ) : <p className="mu">No phone set up yet.</p>}
        <p className="foot" style={{ textAlign: "left" }}>Lost a phone? Switch it off here, or ask the Super Admin.</p>
      </Body>
    </>
  );
}

// ---- Credits (the free software inside the app) -----------------------------------------------------------
const CREDITS: Array<[string, string]> = [
  ["React", "MIT"], ["Capacitor", "MIT"], ["Supabase JavaScript client", "MIT"], ["Lucide icons", "ISC"],
  ["Plus Jakarta Sans font", "SIL Open Font License 1.1"], ["jsPDF", "MIT"], ["html-to-image", "MIT"], ["Vite", "MIT"],
  ["Capgo Native Biometric", "MPL-2.0"], ["Capacitor File Opener", "MIT"],
];
export function Credits() {
  return (
    <>
      <Head title="Open-source credits" />
      <Body>
        <p className="mu">ReqGen is built with this free software. Thank you to their authors.</p>
        <div className="grp">{CREDITS.map(([n, l]) => <Cell key={n} icon={<UserRound size={18} />} iconTone="mu" title={n} sub={l} />)}</div>
      </Body>
    </>
  );
}
