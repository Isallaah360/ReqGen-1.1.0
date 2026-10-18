"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { cleanSignatureFile } from "@/lib/signatureInk";
import { SETUP_EVENT } from "@/lib/profileSetup";
import { normalizeRole } from "@/lib/roles";
import SignatureInk from "@/app/components/ui/SignatureInk";
import { positionName } from "@/app/components/v4/RoleSelect";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { Select } from "@/app/components/v4/Select";
import { Chip, Notice, PageHead, Skeleton, V4Page } from "@/app/components/v4/ui";

const AVATAR_BUCKET = "avatars";
const AVATAR_MAX_BYTES = 1024 * 1024;
const AVATAR_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const SIG_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

type View = "profile" | "signature";
type Msg = { tone: "green" | "red" | "blue"; text: string } | null;
type Me = { fullName: string; phone: string; gender: string; dept: string; role: string; email: string; sigPath: string | null; avatarUrl: string | null; avatarOk: boolean; since: string | null; lastSignIn: string | null };

function signatureUrl(path: string | null | undefined, stamp: number) {
  const raw = String(path || "").trim();
  if (!raw) return null;
  if (/^(https?:|data:image\/|blob:)/.test(raw)) return raw;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/signatures/${raw.replace(/^signatures\//, "").replace(/^\/+/, "")}?t=${stamp}` : null;
}
function avatarObjectPath(url: string | null): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
  const i = url.indexOf(marker);
  return i < 0 ? null : decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
}
const viewFromHash = (): View => (typeof window !== "undefined" && /^#(signature|photo)$/.test(window.location.hash) ? "signature" : "profile");
const dateText = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

/** My Account › Profile (mock-up 16) and Signature & Photo (mock-up 17). */
export default function ProfileDetailsPage() {
  const router = useRouter();
  const ident = useIdentity();
  const [view, setView] = useState<View>("profile");
  const [me, setMe] = useState<Me | null>(null);
  const [stamp, setStamp] = useState(0);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // profile form
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  // signature
  const [sigMode, setSigMode] = useState<"upload" | "draw">("upload");
  const [cleanBg, setCleanBg] = useState(true);
  const [sigFile, setSigFile] = useState<File | null>(null);
  const [sigOriginal, setSigOriginal] = useState<string | null>(null);
  const [drawn, setDrawn] = useState(false);
  const pad = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const on = () => setView(viewFromHash());
    queueMicrotask(on);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) { router.push("/login"); return; }
    const [p, av] = await Promise.all([
      supabase.from("profiles").select("full_name,phone,gender,dept_id,role,signature_url").eq("id", user.id).maybeSingle(),
      supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle(),
    ]);
    if (p.error) { setMsg({ tone: "red", text: `Your profile could not be loaded: ${p.error.message}` }); return; }
    const row = (p.data || {}) as { full_name?: string | null; phone?: string | null; gender?: string | null; dept_id?: string | null; role?: string | null; signature_url?: string | null };
    let dept = "";
    if (row.dept_id) {
      const d = await supabase.from("departments").select("name").eq("id", row.dept_id).maybeSingle();
      dept = String((d.data as { name?: string } | null)?.name || "");
    }
    const next: Me = {
      fullName: row.full_name || "", phone: row.phone || "", gender: row.gender || "", dept, role: row.role || "Staff", email: user.email || "",
      sigPath: row.signature_url || null,
      avatarUrl: av.error ? null : String((av.data as { avatar_url?: string | null } | null)?.avatar_url || "").trim() || null,
      avatarOk: !av.error, since: user.created_at || null, lastSignIn: user.last_sign_in_at || null,
    };
    setMe(next);
    setFullName(next.fullName); setPhone(next.phone); setGender(next.gender); setNewEmail(next.email);
    setStamp(Date.now());
  }, [router]);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  function go(v: View) {
    setView(v); setMsg(null);
    window.history.replaceState(null, "", v === "signature" ? "#signature" : window.location.pathname);
  }

  async function saveProfile() {
    if (fullName.trim().length < 3 || !gender) { setMsg({ tone: "red", text: "Write your full name and choose your gender." }); return; }
    setBusy("profile"); setMsg(null);
    const { error } = await supabase.from("profiles").update({ full_name: fullName.trim(), phone: phone.trim() || null, gender }).eq("id", ident.userId);
    setBusy(null);
    if (error) { setMsg({ tone: "red", text: `Not saved: ${error.message}` }); return; }
    setMsg({ tone: "green", text: "Your profile is saved." });
    window.dispatchEvent(new Event("reqgen-profile-updated"));
    void load();
  }

  async function changeEmail() {
    const clean = newEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(clean)) { setMsg({ tone: "red", text: "Write a valid email address." }); return; }
    if (clean === me?.email.toLowerCase()) { setMsg({ tone: "blue", text: "This is already your sign-in email." }); return; }
    setBusy("email"); setMsg(null);
    const { error } = await supabase.auth.updateUser({ email: clean });
    if (!error) await supabase.from("profiles").update({ email: clean }).eq("id", ident.userId);
    setBusy(null);
    if (error) { setMsg({ tone: "red", text: `Email not changed: ${error.message}` }); return; }
    setEmailOpen(false);
    setMsg({ tone: "green", text: `We sent a link to ${clean}. Open it to confirm the change.` });
  }

  async function chooseSignature(file: File | null) {
    setMsg(null); setSigFile(null); setSigOriginal(null);
    if (!file) return;
    if (!SIG_TYPES.includes(file.type)) { setMsg({ tone: "red", text: "The signature must be a PNG, JPG or WEBP picture." }); return; }
    if (file.size > 500 * 1024) { setMsg({ tone: "red", text: "The picture is too large (up to 500 KB)." }); return; }
    setSigFile(file);
    setSigOriginal(URL.createObjectURL(file));
  }

  function padPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = pad.current!; const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  }
  function padDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = pad.current?.getContext("2d"); if (!ctx) return;
    pad.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = padPoint(e);
    ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#0B1F4D";
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
  }
  function padMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = pad.current?.getContext("2d"); if (!ctx) return;
    const p = padPoint(e); ctx.lineTo(p.x, p.y); ctx.stroke(); setDrawn(true);
  }
  function padClear() {
    const c = pad.current; c?.getContext("2d")?.clearRect(0, 0, c.width, c.height); setDrawn(false);
  }

  async function saveSignature() {
    setMsg(null);
    let upload: File | null = null;
    if (sigMode === "draw") {
      if (!drawn || !pad.current) { setMsg({ tone: "red", text: "Sign in the box first." }); return; }
      const blob = await new Promise<Blob | null>((ok) => pad.current!.toBlob(ok, "image/png"));
      if (!blob) { setMsg({ tone: "red", text: "The drawing could not be read. Try again." }); return; }
      upload = new File([blob], "signature.png", { type: "image/png" });
    } else {
      if (!sigFile) { setMsg({ tone: "red", text: "Choose a photo of your signature first." }); return; }
      upload = sigFile;
    }
    setBusy("signature");
    try {
      if (cleanBg) upload = (await cleanSignatureFile(upload)).file;
      const ext = (upload.name.split(".").pop() || "png").toLowerCase();
      const path = `${ident.userId}/signature-${Date.now()}.${["png", "jpg", "jpeg", "webp"].includes(ext) ? ext : "png"}`;
      const up = await supabase.storage.from("signatures").upload(path, upload, { upsert: false, contentType: upload.type || "image/png" });
      if (up.error) throw new Error(up.error.message);
      const { error } = await supabase.from("profiles").update({ signature_url: path }).eq("id", ident.userId);
      if (error) throw new Error(error.message);
      setSigFile(null); setSigOriginal(null); padClear();
      setMsg({ tone: "green", text: "Your signature is saved. It is added to everything you sign from now on." });
      window.dispatchEvent(new Event(SETUP_EVENT));
      await load();
    } catch (e) {
      setMsg({ tone: "red", text: `Signature not saved: ${e instanceof Error ? e.message : "please try again"}` });
    } finally { setBusy(null); }
  }

  async function saveAvatar(file: File | null) {
    setMsg(null);
    if (file && !AVATAR_TYPES[file.type]) { setMsg({ tone: "red", text: "The photo must be PNG, JPG or WEBP." }); return; }
    if (file && file.size > AVATAR_MAX_BYTES) { setMsg({ tone: "red", text: "The photo is too large (up to 1 MB)." }); return; }
    setBusy("photo");
    const previous = avatarObjectPath(me?.avatarUrl || null);
    try {
      let url: string | null = null;
      if (file) {
        const path = `${ident.userId}/avatar-${Date.now()}.${AVATAR_TYPES[file.type]}`;
        const up = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, { upsert: false, contentType: file.type, cacheControl: "3600" });
        if (up.error) throw new Error(up.error.message);
        url = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", ident.userId);
      if (error) throw new Error(error.message);
      if (previous) await supabase.storage.from(AVATAR_BUCKET).remove([previous]);
      setMsg({ tone: "green", text: url ? "Your photo is updated." : "Your photo is removed." });
      window.dispatchEvent(new Event("reqgen-profile-updated"));
      window.dispatchEvent(new Event(SETUP_EVENT));
      await load();
    } catch (e) {
      setMsg({ tone: "red", text: `Photo not saved: ${e instanceof Error ? e.message : "please try again"}` });
    } finally { setBusy(null); }
  }

  const name = me?.fullName || ident.name || "";
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "RG";
  const position = positionName(normalizeRole(me?.role || "staff"), me?.role || "Staff");
  const savedSig = signatureUrl(me?.sigPath, stamp);
  const avatar = (size: "xl") => (
    <span className={`v4-avatar-${size}`} style={{ overflow: "hidden", margin: "0 auto" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- photo from Supabase Storage */}
      {me?.avatarUrl ? <img src={me.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
    </span>
  );

  return (
    <V4Page>
      <PageHead title={view === "profile" ? "Profile" : "Signature & Photo"}
        sub={view === "profile" ? "How your name and contact appear across ReqGen and on printed documents." : "Your signature is added to every request, approval and voucher you sign."} />
      <div className="v4-segmented" role="tablist" aria-label="Profile pages">
        <button type="button" role="tab" aria-selected={view === "profile"} onClick={() => go("profile")}>Profile</button>
        <button type="button" role="tab" aria-selected={view === "signature"} onClick={() => go("signature")}>Signature &amp; Photo</button>
      </div>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}

      {!me ? <section className="v4-card v4-card-pad"><Skeleton lines={8} /></section> : view === "profile" ? (
        <div className="v4-split">
          <form className="v4-card v4-card-pad" style={{ display: "flex", flexDirection: "column", gap: 24 }} onSubmit={(e) => { e.preventDefault(); void saveProfile(); }}>
            <section>
              <div className="v4-section-title"><span className="v4-no">1</span><h2 className="v4-h2">Personal details</h2></div>
              <div className="v4-form-grid">
                <label className="v4-field v4-span-2"><span className="v4-flabel">Full name <span className="v4-req">*</span></span><input className="v4-input" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" /><span className="v4-help">Printed on requests and vouchers you sign. Use the name on your staff record.</span></label>
                <div className="v4-field"><span className="v4-flabel">Gender <span className="v4-req">*</span></span><Select ariaLabel="Gender" value={gender} placeholder="Choose" onChange={setGender} options={[{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }]} /></div>
                <label className="v4-field"><span className="v4-flabel">Phone number</span><input className="v4-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /><span className="v4-help">Used for SMS reminders.</span></label>
              </div>
            </section>
            <section>
              <div className="v4-section-title"><span className="v4-no">2</span><h2 className="v4-h2">Email</h2></div>
              <div className="v4-form-grid">
                <label className="v4-field"><span className="v4-flabel">Sign-in email</span>{emailOpen ? <input className="v4-input" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoComplete="email" /> : <input className="v4-input" readOnly value={me.email} />}</label>
                <div className="v4-field" style={{ justifyContent: "flex-end" }}>
                  {emailOpen ? (
                    <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="v4-btn v4-btn-primary" type="button" disabled={busy === "email"} onClick={() => void changeEmail()}><Icon name="send" />{busy === "email" ? "Sending…" : "Send confirmation link"}</button>
                      <button className="v4-btn v4-btn-ghost" type="button" onClick={() => { setEmailOpen(false); setNewEmail(me.email); }}>Cancel</button>
                    </span>
                  ) : <button className="v4-btn v4-btn-secondary" type="button" onClick={() => setEmailOpen(true)}><Icon name="mail" />Change email</button>}
                  <span className="v4-help">We send a link to the new address to confirm it.</span>
                </div>
              </div>
            </section>
            <section>
              <div className="v4-section-title"><span className="v4-no">3</span><h2 className="v4-h2">Work details</h2></div>
              <div className="v4-form-grid">
                <label className="v4-field"><span className="v4-flabel">Department</span><input className="v4-input" readOnly value={me.dept || "Not set"} /></label>
                <label className="v4-field"><span className="v4-flabel">Position</span><input className="v4-input" readOnly value={position} /></label>
              </div>
              <div style={{ marginTop: 12 }}><Notice tone="blue">Department, position and roles are set by the Super Admin. Ask them if something is wrong.</Notice></div>
            </section>
            <div className="v4-form-actions">
              <Link className="v4-btn v4-btn-ghost" href="/profile">Cancel</Link>
              <button className="v4-btn v4-btn-primary" type="submit" disabled={busy === "profile"}><Icon name="tick" />{busy === "profile" ? "Saving…" : "Save changes"}</button>
            </div>
          </form>
          <aside className="v4-side-stack">
            <section className="v4-card v4-card-pad" style={{ textAlign: "center" }} data-guide="avatar" id="photo">
              {avatar("xl")}
              <h2 className="v4-h3" style={{ margin: "12px 0 2px" }}>{name || "My profile"}</h2>
              <p className="v4-help" style={{ margin: "0 0 12px" }}>{position}{me.dept ? ` · ${me.dept}` : ""}</p>
              <button className="v4-btn v4-btn-secondary v4-btn-block" type="button" onClick={() => go("signature")}><Icon name="camera" />Change photo</button>
            </section>
            <section className="v4-card v4-card-pad">
              <dl className="v4-kv"><dt>Member since</dt><dd>{dateText(me.since)}</dd><dt>Last sign-in</dt><dd>{me.lastSignIn ? new Date(me.lastSignIn).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</dd><dt>Main position</dt><dd>{position}</dd></dl>
              <Link className="v4-btn v4-btn-ghost" style={{ marginTop: 10 }} href="/change-password"><Icon name="key" />Change password</Link>
            </section>
          </aside>
        </div>
      ) : (
        <div className="v4-grid-2">
          <section className="v4-card v4-card-pad" style={{ display: "flex", flexDirection: "column", gap: 16 }} data-guide="signature" id="signature">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h2 className="v4-h2">Signature</h2>
              {sigFile || drawn ? <Chip tone="amber">Preview · not saved yet</Chip> : me.sigPath ? <Chip tone="green">Saved</Chip> : <Chip tone="red">Needed</Chip>}
            </div>
            <div className="v4-segmented" role="tablist" aria-label="How to add your signature">
              <button type="button" role="tab" aria-selected={sigMode === "upload"} onClick={() => setSigMode("upload")}>Upload a photo of it</button>
              <button type="button" role="tab" aria-selected={sigMode === "draw"} onClick={() => setSigMode("draw")}>Draw with finger or mouse</button>
            </div>
            {sigMode === "upload" ? (
              <>
                <div className="v4-sig-pair">
                  <div className="v4-sig-frame"><span>{sigOriginal ? "Your photo" : "Saved now"}</span><div className="v4-canvas v4-paper">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen file */}
                    {sigOriginal ? <img src={sigOriginal} alt="Your photo of the paper" style={{ maxWidth: "90%", maxHeight: 110 }} /> : savedSig ? <span className="rg-sig-slot" style={{ display: "block", width: "80%", height: 100 }}><SignatureInk src={savedSig} alt="Saved signature" /></span> : <span className="v4-muted">No signature yet</span>}
                  </div></div>
                  <div className="v4-sig-frame"><span>What ReqGen saves</span><div className="v4-canvas v4-clean">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen picture */}
                    {sigOriginal && cleanBg ? <span className="rg-sig-slot" style={{ display: "block", width: "80%", height: 100 }}><SignatureInk src={sigOriginal} alt="Signature as ReqGen saves it" /></span> : sigOriginal ? <img src={sigOriginal} alt="The picture as uploaded" style={{ maxWidth: "90%", maxHeight: 110 }} /> : savedSig ? <span className="rg-sig-slot" style={{ display: "block", width: "80%", height: 100 }}><SignatureInk src={savedSig} alt="Saved signature" /></span> : <span className="v4-muted">—</span>}
                  </div></div>
                </div>
                <label className="v4-check"><input type="checkbox" checked={cleanBg} onChange={(e) => setCleanBg(e.target.checked)} /> Remove the paper background automatically</label>
                <label className="v4-dropzone" style={{ cursor: "pointer" }}>
                  <Icon name="upload" size="lg" />
                  <p style={{ margin: "8px 0 4px" }}><b>Choose a clear photo</b> of your signature on white paper</p>
                  <span className="v4-help">PNG or JPG · up to 500 KB · dark pen</span>
                  <input className="v4-sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const f = e.target.files?.[0] || null; e.target.value = ""; void chooseSignature(f); }} />
                </label>
              </>
            ) : (
              <>
                <div className="v4-sig-frame"><span>Sign inside the box</span>
                  <canvas ref={pad} width={720} height={240} aria-label="Signature pad" style={{ width: "100%", height: 160, display: "block", touchAction: "none", cursor: "crosshair", background: "#fff" }}
                    onPointerDown={padDown} onPointerMove={padMove} onPointerUp={() => { drawing.current = false; }} onPointerLeave={() => { drawing.current = false; }} />
                </div>
                <button className="v4-btn v4-btn-ghost" type="button" onClick={padClear} disabled={!drawn}><Icon name="returned" />Clear and sign again</button>
              </>
            )}
            <div><span className="v4-label">Used on</span><div className="v4-uses" style={{ marginTop: 6 }}><Chip>Requests</Chip><Chip>Approvals</Chip><Chip>Payment vouchers</Chip><Chip>Print register</Chip></div></div>
            {!me.sigPath ? <Notice tone="amber">You cannot submit, approve or sign until your signature is saved.</Notice> : null}
            <div className="v4-form-actions">
              <button className="v4-btn v4-btn-primary" type="button" disabled={busy === "signature" || (sigMode === "upload" ? !sigFile : !drawn)} onClick={() => void saveSignature()}><Icon name="tick" />{busy === "signature" ? "Saving…" : "Save signature"}</button>
            </div>
          </section>
          <section className="v4-card v4-card-pad" style={{ display: "flex", flexDirection: "column", gap: 16 }} data-guide="avatar">
            <h2 className="v4-h2">Profile photo</h2>
            {avatar("xl")}
            <ul style={{ margin: 0, paddingLeft: 18, color: "var(--v4-ink-2)", lineHeight: 1.8, fontSize: 13.5 }}>
              <li>Face the camera, plain background, good light.</li>
              <li>PNG, JPG or WEBP, up to 1 MB.</li>
              <li>Shown in the top bar and next to your name in lists.</li>
            </ul>
            {me.avatarOk ? (
              <div className="v4-form-actions">
                {me.avatarUrl ? <button className="v4-btn v4-btn-ghost" type="button" disabled={!!busy} onClick={() => void saveAvatar(null)}>Remove photo</button> : null}
                <label className="v4-btn v4-btn-secondary" style={{ cursor: busy ? "default" : "pointer" }}>
                  <Icon name="camera" />{busy === "photo" ? "Saving…" : "Take or choose photo"}
                  <input className="v4-sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={!!busy} onChange={(e) => { const f = e.target.files?.[0] || null; e.target.value = ""; if (f) void saveAvatar(f); }} />
                </label>
              </div>
            ) : <Notice tone="amber">Profile photos are not switched on yet. Ask the Super Admin.</Notice>}
          </section>
        </div>
      )}
    </V4Page>
  );
}
