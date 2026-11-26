import { useEffect, useState } from "react";
import { Bell, Download, Fingerprint, Info, KeyRound, LogOut, PenLine, ShieldCheck, UserRound } from "lucide-react";
import { appVersion, downloadAndInstall, finger, newerRelease, pin, type Release } from "../lib/native";
import { useApp } from "../App";
import { Avatar, Big, Body, Cell, Chev, Head, Note, Sheet, Toggle, toast, useNav } from "../ui";
import { AppGrid } from "./Offices";
import Notices from "./Notices";
import { MyAccess, MyActivity, SetupGuide } from "./office/Mine";
import { History, ListChecks } from "lucide-react";
import { Credits, Profile, Security, SignaturePhoto } from "./Account";
import { PinPad } from "./Unlock";

/** 4.2.1: the Settings tab (it was "Me"): this phone and how ReqGen looks. The person's own things are in ProfileScreen, opened from their photo. */
export default function SettingsScreen() {
  const { theme, setTheme, look, setLook } = useApp();
  const { push } = useNav();
  const [ver, setVer] = useState({ version: "2.0.0", build: 0 });
  const [rel, setRel] = useState<Release | null>(null);
  const [checked, setChecked] = useState(false);
  const [fing, setFing] = useState(false);
  const [canFing, setCanFing] = useState(false);
  const [sheet, setSheet] = useState<null | "pin" | "update" | "out">(null);
  useEffect(() => {
    void appVersion().then(setVer);
    void newerRelease().then((r) => { setRel(r); setChecked(true); });
    void finger.on().then(setFing); void finger.ready().then(setCanFing);
  }, []);
  return (
    <>
      <Big>Settings</Big>
      <Body tabs>
        <div className="grp">
          <Cell icon={<Fingerprint size={18} />} iconTone="ok" title="Fingerprint" sub={canFing ? (fing ? "On" : "Off") : "Not set up on this phone"}
            right={canFing ? <Toggle on={fing} label="Fingerprint" onChange={async (v) => {
              if (v) { try { await finger.check("Turn on fingerprint"); } catch { return; } }
              await finger.set(v); setFing(v); toast(v ? "Fingerprint on." : "Fingerprint off.");
            }} /> : undefined} />
          <Cell icon={<KeyRound size={18} />} iconTone="wa" title="App PIN" sub="Change the 6 numbers" right={<Chev />} onClick={() => setSheet("pin")} />
        </div>
        <div className="sect"><b>Look</b></div>
        <div className="look2" role="radiogroup" aria-label="Look">
          {LOOKS.map((l) => (
            <button key={l.key} type="button" role="radio" aria-checked={look === l.key} onClick={() => { setLook(l.key); toast(`${l.name} look on.`); }}>
              <i className={`look-pv look-pv-${l.key}`} aria-hidden="true"><b /><b /><b /><b /></i>
              <span><b>{l.name}</b><small>{l.about}</small></span>
            </button>
          ))}
        </div>
        {look === "grid" ? (
          <div className="seg" role="radiogroup" aria-label="Light or dark">
            {(["light", "dark", "system"] as const).map((t) => (
              <button key={t} type="button" role="radio" aria-selected={theme === t} aria-checked={theme === t} onClick={() => setTheme(t)}>{t === "system" ? "Match phone" : t === "light" ? "Light" : "Dark"}</button>
            ))}
          </div>
        ) : <p className="mu" style={{ margin: 0 }}>Glass Dock is always deep IET blue, day and night.</p>}
        <div className="grp">
          <Cell icon={<ShieldCheck size={18} />} iconTone="in" title="Security and phones" sub="2FA, fingerprint, phones set up" right={<Chev />} onClick={() => push(<Security />)} />
          <Cell icon={<ListChecks size={18} />} iconTone="in" title="Setup guide" sub="The steps that make an account ready" right={<Chev />} onClick={() => push(<SetupGuide />)} />
          <Cell icon={<Bell size={18} />} iconTone="mu" title="Notices" sub="SMS, e-mail and app, for every request that reaches you" />
          <Cell icon={<Download size={18} />} iconTone="mu" title={`App version ${ver.version}`} sub={!checked ? "Checking for a newer version…" : rel ? `Version ${rel.version} is ready` : "Up to date"} onClick={rel ? () => setSheet("update") : undefined} right={rel ? <Chev /> : undefined} />
        </div>
        <button type="button" className="btn bs block" style={{ color: "var(--er)" }} onClick={() => setSheet("out")}><LogOut size={18} />Sign out of this phone</button>
        <p className="foot">Developed by Barderian Enterprises. WhatsApp 0803 119 7746, info@barderians.com.ng</p>
      </Body>
      <ChangePin open={sheet === "pin"} onClose={() => setSheet(null)} />
      {rel ? <UpdateSheet open={sheet === "update"} onClose={() => setSheet(null)} rel={rel} /> : null}
      <SignOutSheet open={sheet === "out"} onClose={() => setSheet(null)} />
    </>
  );
}

const LOOKS: Array<{ key: "grid" | "glass"; name: string; about: string }> = [
  { key: "grid", name: "Icon Grid", about: "IET colours on a light or dark screen" },
  { key: "glass", name: "Glass Dock", about: "Deep IET blue with frosted glass" },
];

/** 4.2.1: the person's own page, opened by tapping their photo on Home. */
export function ProfileScreen() {
  const { me } = useApp();
  const { push } = useNav();
  const [ver, setVer] = useState({ version: "2.0.0", build: 0 });
  const [sheet, setSheet] = useState<null | "about" | "out">(null);
  useEffect(() => { void appVersion().then(setVer); }, []);
  const ic = (n: React.ReactNode) => <span className="app-svg">{n}</span>;
  return (
    <>
      <Head title="Profile" />
      <Body>
        <div className="prof">
          <Avatar name={me.full_name} url={me.avatar_url} size="xl" />
          <b>{me.full_name}</b>
          <small>{[me.roleName, me.deptName].filter(Boolean).join(", ")}</small>
        </div>
        <AppGrid label="Your profile" items={[
          { key: "account", label: "My account", icon: ic(<UserRound size={28} />), color: "#146185", onClick: () => push(<Profile />) },
          { key: "sign", label: "Signature and photo", icon: ic(<PenLine size={28} />), color: "#F9A11F", onClick: () => push(<SignaturePhoto />) },
          { key: "access", label: "My access", icon: ic(<KeyRound size={28} />), color: "#31A8E0", onClick: () => push(<MyAccess />) },
          { key: "activity", label: "My activity", icon: ic(<History size={28} />), color: "#F47824", onClick: () => push(<MyActivity />) },
          { key: "notices", label: "Notices", icon: ic(<Bell size={28} />), color: "#7C4B03", onClick: () => push(<Notices meId={me.id} onRead={() => null} />) },
          { key: "about", label: "About ReqGen", icon: ic(<Info size={28} />), color: "#146185", onClick: () => setSheet("about") },
        ]} />
        <p className="mu" style={{ textAlign: "center", margin: 0 }}>ReqGen app {ver.version}{ver.build ? `, build ${ver.build}` : ""}</p>
        <button type="button" className="btn bs block" style={{ color: "var(--er)" }} onClick={() => setSheet("out")}><LogOut size={18} />Sign out of this phone</button>
      </Body>
      <Sheet open={sheet === "about"} onClose={() => setSheet(null)} title="About ReqGen">
        <p className="mu" style={{ fontSize: 14 }}>IET ReqGen, the requisition and approval system of the Islamic Education Trust. App version {ver.version}.</p>
        <p className="mu" style={{ fontSize: 14 }}>Your data stays with IET. ReqGen never sells, shares or leaks it, and has no trackers or adverts. The app talks only to the ReqGen database.</p>
        <p className="mu" style={{ fontSize: 14 }}>Developed by Barderian Enterprises. WhatsApp 0803 119 7746, info@barderians.com.ng</p>
        <button type="button" className="btn bs block" onClick={() => { setSheet(null); push(<Credits />); }}>Open-source credits</button>
      </Sheet>
      <SignOutSheet open={sheet === "out"} onClose={() => setSheet(null)} />
    </>
  );
}

function SignOutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signOut } = useApp();
  return (
    <Sheet open={open} onClose={onClose} title="Sign out of this phone?">
      <p className="mu" style={{ fontSize: 14 }}>Your PIN, fingerprint and the lists saved on this phone are removed. Next time you sign in with your password and the code.</p>
      <button type="button" className="btn bd block" onClick={() => void signOut()}>Sign out</button>
      <button type="button" className="btn bs block" onClick={onClose}>Cancel</button>
    </Sheet>
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
