import { useEffect, useState } from "react";
import { Bell, Download, Fingerprint, Info, KeyRound, LogOut, Moon, ShieldCheck } from "lucide-react";
import { WEBSITE, openOutside } from "../lib/core";
import { appVersion, downloadAndInstall, finger, newerRelease, pin, type Release } from "../lib/native";
import { useApp } from "../App";
import { Avatar, Big, Body, Cell, Chev, Note, Sheet, Toggle, toast } from "../ui";
import { PinPad } from "./Unlock";

export default function Me() {
  const { me, theme, setTheme, look, setLook, signOut } = useApp();
  const [ver, setVer] = useState({ version: "2.0.0", build: 0 });
  const [rel, setRel] = useState<Release | null>(null);
  const [checked, setChecked] = useState(false);
  const [fing, setFing] = useState(false);
  const [canFing, setCanFing] = useState(false);
  const [sheet, setSheet] = useState<null | "theme" | "pin" | "update" | "about" | "out">(null);
  useEffect(() => {
    void appVersion().then(setVer);
    void newerRelease().then((r) => { setRel(r); setChecked(true); });
    void finger.on().then(setFing); void finger.ready().then(setCanFing);
  }, []);
  const themeText = `${look === "gold" ? "Gold" : "Sand"}, ${theme === "system" ? "Match phone" : theme === "dark" ? "Dark" : "Light"}`;
  return (
    <>
      <Big>Me</Big>
      <Body tabs>
        <div className="cell grp">
          <Avatar name={me.full_name} url={me.avatar_url} size="lg" />
          <span className="t"><b style={{ fontSize: 17 }}>{me.full_name}</b><small>{[me.roleName, me.deptName].filter(Boolean).join(", ")}</small></span>
        </div>
        <div className="grp">
          <Cell icon={<KeyRound size={18} />} iconTone="wa" title="App PIN" sub="Change the 6 numbers" onClick={() => setSheet("pin")} />
          <Cell icon={<Fingerprint size={18} />} iconTone="ok" title="Fingerprint" sub={canFing ? (fing ? "On" : "Off") : "Not set up on this phone"}
            right={canFing ? <Toggle on={fing} label="Fingerprint" onChange={async (v) => {
              if (v) { try { await finger.check("Turn on fingerprint"); } catch { return; } }
              await finger.set(v); setFing(v); toast(v ? "Fingerprint on." : "Fingerprint off.");
            }} /> : undefined} />
          <Cell icon={<ShieldCheck size={18} />} iconTone="in" title="Password and signature" sub="Change them on the website" right={<Chev />} onClick={() => openOutside(`${WEBSITE}/profile`)} />
        </div>
        <div className="grp">
          <Cell icon={<Moon size={18} />} iconTone="mu" title="Appearance" sub={themeText} onClick={() => setSheet("theme")} />
          <Cell icon={<Bell size={18} />} iconTone="mu" title="Notices" sub="SMS, e-mail and app, for every request that reaches you" />
          <Cell icon={<Download size={18} />} iconTone="mu" title={`App version ${ver.version}`} sub={!checked ? "Checking for a newer version…" : rel ? `Version ${rel.version} is ready` : "Up to date"} onClick={rel ? () => setSheet("update") : undefined} right={rel ? <span className="chip c-or">Update</span> : undefined} />
          <Cell icon={<Info size={18} />} iconTone="mu" title="About and credits" sub="IET, by Barderian Enterprises" onClick={() => setSheet("about")} />
        </div>
        <button type="button" className="btn bs block" style={{ color: "var(--er)" }} onClick={() => setSheet("out")}><LogOut size={18} />Sign out of this phone</button>
        <p className="foot">Developed by Barderian Enterprises. WhatsApp 0803 119 7746, info@barderians.com.ng</p>
      </Body>

      <Sheet open={sheet === "theme"} onClose={() => setSheet(null)} title="Appearance">
        <div className="look" role="radiogroup" aria-label="Theme">
          {(["sand", "gold"] as const).map((l) => (
            <button key={l} type="button" role="radio" aria-checked={look === l} onClick={() => setLook(l)}>
              <i aria-hidden="true"><b style={{ background: l === "sand" ? "#F4EEE3" : "#FBF5EA" }} /><b style={{ background: l === "sand" ? "#1D7DB0" : "#F2A01C" }} /></i>
              {l === "sand" ? "Sand" : "Gold"}
            </button>
          ))}
        </div>
        <div className="grp" role="radiogroup" aria-label="Light or dark">
          {(["system", "light", "dark"] as const).map((t) => (
            <button key={t} type="button" className="cell" role="radio" aria-checked={theme === t} onClick={() => { setTheme(t); setSheet(null); }}>
              <span className="t"><b>{t === "system" ? "Match phone" : t === "light" ? "Light" : "Dark"}</b></span>
              <span className={`box${theme === t ? " on" : ""}`} style={{ borderRadius: 13 }} aria-hidden="true" />
            </button>
          ))}
        </div>
      </Sheet>
      <ChangePin open={sheet === "pin"} onClose={() => setSheet(null)} />
      {rel ? <UpdateSheet open={sheet === "update"} onClose={() => setSheet(null)} rel={rel} /> : null}
      <Sheet open={sheet === "about"} onClose={() => setSheet(null)} title="About ReqGen">
        <p className="mu" style={{ fontSize: 14 }}>IET ReqGen, the requisition and approval system of the Islamic Education Trust. App version {ver.version}.</p>
        <p className="mu" style={{ fontSize: 14 }}>Your data stays with IET. ReqGen never sells, shares or leaks it, and has no trackers or adverts. The app talks only to our own website and database.</p>
        <p className="mu" style={{ fontSize: 14 }}>Developed by Barderian Enterprises. WhatsApp 0803 119 7746, info@barderians.com.ng</p>
        <button type="button" className="btn bs block" onClick={() => openOutside(`${WEBSITE}/THIRD-PARTY-LICENSES.txt`)}>Open-source credits</button>
      </Sheet>
      <Sheet open={sheet === "out"} onClose={() => setSheet(null)} title="Sign out of this phone?">
        <p className="mu" style={{ fontSize: 14 }}>Your PIN, fingerprint and the lists saved on this phone are removed. Next time you sign in with your password and the code.</p>
        <button type="button" className="btn bd block" onClick={() => void signOut()}>Sign out</button>
        <button type="button" className="btn bs block" onClick={() => setSheet(null)}>Cancel</button>
      </Sheet>
    </>
  );
}

function ChangePin({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<"old" | "new" | "again">("old");
  const [first, setFirst] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (open) { setStep("old"); setMsg(null); } }, [open]);
  return (
    <Sheet open={open} onClose={onClose} title={step === "old" ? "Type your current PIN" : step === "new" ? "Choose a new PIN" : "Type the new PIN again"}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <PinPad key={step} error={msg} onFull={async (p) => {
          if (step === "old") { if (await pin.matches(p)) { setMsg(null); setStep("new"); return true; } setMsg("That PIN is not right."); return false; }
          if (step === "new") { if (/^(\d)\1{5}$/.test(p) || "0123456789".includes(p) || "9876543210".includes(p)) { setMsg("Too easy to guess. Choose another PIN."); return false; } setFirst(p); setMsg(null); setStep("again"); return true; }
          if (p !== first) { setMsg("The two PINs are not the same. Start again."); setStep("new"); return false; }
          await pin.set(p); toast("PIN changed."); onClose(); return true;
        }} />
      </div>
    </Sheet>
  );
}

function UpdateSheet({ open, onClose, rel }: { open: boolean; onClose: () => void; rel: Release }) {
  const [pct, setPct] = useState<number | null>(null);
  const [stop, setStop] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Sheet open={open} onClose={() => { if (pct === null) onClose(); }} title={`Version ${rel.version} is ready`}>
      {rel.size ? <p className="mu">Download size {rel.size}.</p> : null}
      {[...(rel.new || []), ...(rel.better || []), ...(rel.fixed || [])].slice(0, 6).map((t, i) => <p key={i} className="mu" style={{ fontSize: 14 }}>{t}</p>)}
      {pct !== null ? <div className="bar-prog" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div> : null}
      {err ? <Note tone="er">{err}</Note> : null}
      {pct === null ? (
        <button type="button" className="btn bp block" onClick={async () => {
          setPct(0); setErr(null); setStop(false);
          try { await downloadAndInstall(rel, (p) => setPct(p), () => stop); } catch { setErr("The download stopped. Check the network and try again."); }
          setPct(null);
        }}><Download size={18} />Download and install</button>
      ) : <button type="button" className="btn bs block" onClick={() => setStop(true)}>Cancel</button>}
    </Sheet>
  );
}
