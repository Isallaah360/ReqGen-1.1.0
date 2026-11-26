import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { House, FileText, Plus, Settings, ShieldCheck } from "lucide-react";
import { checkSignIn, db, onSignedOut, session, signingOut, store } from "./lib/core";
import { ensureDevice, forgetDevice } from "./lib/device";
import { buzz, finger, lockDue, onResume, paintStatusBar, pin, touch } from "./lib/native";
import { loadMe, type Me } from "./lib/data";
import { waitingForMe } from "./lib/text";
import { Stack, ToastHost, useBack, toast } from "./ui";
import ConfirmHost from "./screens/Confirm";
import SignIn from "./screens/SignIn";
import Unlock from "./screens/Unlock";
import Home from "./screens/Home";
import Requests from "./screens/Requests";
import Approvals from "./screens/Approvals";
import MeScreen from "./screens/Me";
import NewTypeSheet from "./screens/NewType";

export type Tab = "home" | "requests" | "approvals" | "me";
type Ctx = {
  me: Me; reloadMe: () => Promise<void>; pending: number; refreshPending: () => Promise<void>;
  tab: Tab; setTab: (t: Tab) => void; openNew: () => void; signOut: () => Promise<void>;
  theme: "system" | "light" | "dark"; setTheme: (t: "system" | "light" | "dark") => void;
  /** 4.2.1: "grid" (Icon Grid, the default, light or dark) or "glass" (Glass Dock, deep IET blue). Older "sand"/"gold" become "grid". */
  look: "grid" | "glass"; setLook: (l: "grid" | "glass") => void;
};
const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => useContext(AppCtx) as Ctx;

/** Light or dark: follows the phone unless the person chose one in Me. The status bar follows too. */
function useTheme() {
  const [theme, setThemeState] = useState<"system" | "light" | "dark">("system");
  const [look, setLookState] = useState<"grid" | "glass">("grid");
  useEffect(() => { void store.get<"system" | "light" | "dark">("rg:theme", "system").then(setThemeState); }, []);
  useEffect(() => { void store.get<string>("rg:look", "grid").then((l) => setLookState(l === "glass" ? "glass" : "grid")); }, []);
  // Icon Grid uses the IET Blue colours (data-look "sand"); Glass Dock has its own (data-look "glass")
  useEffect(() => { document.documentElement.dataset.look = look === "glass" ? "glass" : "sand"; document.documentElement.dataset.accent = look; }, [look]);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = look === "glass" || theme === "dark" || (theme === "system" && mq.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      requestAnimationFrame(() => paintStatusBar(dark));
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme, look]);
  return {
    theme, setTheme: (t: "system" | "light" | "dark") => { setThemeState(t); void store.set("rg:theme", t); },
    look, setLook: (l: "grid" | "glass") => { setLookState(l); void store.set("rg:look", l); },
  };
}

type Phase = "boot" | "signin" | "locked" | "in" | "error" | "out";

export default function App() {
  const [phase, setPhase] = useState<Phase>("boot");
  const [me, setMe] = useState<Me | null>(null);
  const [bootError, setBootError] = useState("");
  const [outWhy, setOutWhy] = useState<"elsewhere" | "deactivated">("elsewhere");
  const { theme, setTheme, look, setLook } = useTheme();

  const start = useCallback(async () => {
    setPhase("boot");
    try {
      const s = await session();
      const verified = await store.get<string | null>("rg:verified", null);
      if (!s || verified !== s.user.id) { setPhase("signin"); return; }
      const saved = await store.get<Me | null>("rg:me", null);
      if (saved && saved.id === s.user.id) setMe(saved);
      void loadMe().then(setMe).catch(() => null);
      if (!saved) setMe(await loadMe());
      setPhase((await pin.isSet()) && (await lockDue()) ? "locked" : "in");
      await touch();
    } catch (e) {
      setBootError(e instanceof Error ? e.message : "ReqGen could not start.");
      setPhase("error");
    }
  }, []);
  useEffect(() => { void start(); }, [start]);

  // 4.0.0: signed out somewhere else (a password, passcode or 2FA change, or the account switched off):
  // say so at once and go to sign-in, instead of showing screens the database will refuse
  const phaseRef = useRef<Phase>("boot");
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => {
    onSignedOut((why) => {
      if (phaseRef.current !== "in" && phaseRef.current !== "locked") return;
      phaseRef.current = "out";
      void clearPhone();
      setOutWhy(why); setMe(null); setPhase("out");
    });
  }, []);

  // lock after 15 minutes away; on coming back, check the sign-in is still valid
  useEffect(() => onResume((active) => {
    if (!active) { void touch(); return; }
    void checkSignIn();
    void (async () => { if (phase === "in" && (await pin.isSet()) && (await lockDue())) setPhase("locked"); else void touch(); })();
  }), [phase]);

  if (phase === "boot") return <Splash />;
  if (phase === "error") return <BootError text={bootError} onRetry={() => void start()} />;
  if (phase === "out") return <SignedOut why={outWhy} onOk={() => setPhase("signin")} />;
  if (phase === "signin") return <><Stack root={<SignIn onDone={async () => { setMe(await loadMe()); await touch(); setPhase("in"); }} />} /><ConfirmHost /><ToastHost /></>;
  if (phase === "locked" && me) return <><Unlock me={me} onOpen={async () => { await touch(); setPhase("in"); }} onSwitch={async () => { await signOutAll(); setMe(null); setPhase("signin"); }} /><ToastHost /></>;
  if (!me) return <Splash />;
  return (
    <Signed me={me} setMe={setMe} theme={theme} setTheme={setTheme} look={look} setLook={setLook}
      onSignOut={async () => { await signOutAll(); setMe(null); setPhase("signin"); }} />
  );
}

async function signOutAll() {
  signingOut(true);
  try { await (await db()).auth.signOut(); } catch { /* offline: the saved session is removed below */ }
  await clearPhone();
  // the sign-in service tells "signed out" a moment later: that one is ours, not from elsewhere
  window.setTimeout(() => signingOut(false), 4000);
}

/** Everything of the person on this phone: PIN, fingerprint, device key, saved lists. */
async function clearPhone() {
  await Promise.all([store.del("rg:verified"), store.del("rg:me"), pin.clear(), finger.set(false), forgetDevice()]);
  // lists saved on this phone belong to the person who signed out
  const { Preferences } = await import("@capacitor/preferences");
  const { keys } = await Preferences.keys();
  await Promise.all(keys.filter((k) => k.startsWith("rg:c:")).map((key) => Preferences.remove({ key })));
}

function Signed({ me, setMe, theme, setTheme, look, setLook, onSignOut }: { me: Me; setMe: (m: Me) => void; theme: Ctx["theme"]; setTheme: Ctx["setTheme"]; look: Ctx["look"]; setLook: Ctx["setLook"]; onSignOut: () => Promise<void> }) {
  const [tab, setTab] = useState<Tab>("home");
  const [pending, setPending] = useState(0);
  const [newOpen, setNewOpen] = useState(false);
  const refreshPending = useCallback(async () => {
    try {
      const s = await db();
      const [r, d] = await Promise.all([
        s.from("requests").select("current_owner,current_stage,status,assigned_account_officer_id,assigned_account_officer_user_id").or(`current_owner.eq.${me.id},assigned_account_officer_id.eq.${me.id},assigned_account_officer_user_id.eq.${me.id}`),
        s.rpc("reqgen_direct_waiting"),
      ]);
      const routed = r.error ? 0 : (r.data || []).filter((x) => waitingForMe(x, me.id)).length;
      setPending(routed + (d.error ? 0 : (d.data || []).length));
    } catch { /* offline */ }
  }, [me.id]);
  // this phone's key for fingerprint confirmation (made once; quietly retried if the database step is not there yet)
  useEffect(() => { void ensureDevice(); }, []);
  useEffect(() => {
    void refreshPending();
    const t = window.setInterval(() => void refreshPending(), 60_000);
    let ch: { unsubscribe: () => unknown } | null = null;
    void db().then((s) => {
      ch = s.channel(`app-badge-${me.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, () => void refreshPending())
        // 3.0.2: a new notice shows at once (top banner, a short buzz), and every list refreshes
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${me.id}` }, (p) => {
          const n = (p.new || {}) as { title?: string; message?: string };
          buzz.ok();
          toast(n.title ? `${n.title}${n.message ? `: ${n.message}` : ""}` : "You have a new notice.", "in");
          window.dispatchEvent(new CustomEvent("rg-notice"));
          void refreshPending();
        })
        .subscribe();
    });
    return () => { window.clearInterval(t); ch?.unsubscribe(); };
  }, [refreshPending, me.id]);
  useBack(tab !== "home", () => setTab("home"));

  const ctx: Ctx = {
    me, reloadMe: async () => setMe(await loadMe()), pending, refreshPending, tab, setTab,
    openNew: () => setNewOpen(true), signOut: onSignOut, theme, setTheme, look, setLook,
  };
  return (
    <AppCtx.Provider value={ctx}>
      <Stack root={
        <>
          {tab === "home" ? <Home /> : tab === "requests" ? <Requests /> : tab === "approvals" ? <Approvals /> : <MeScreen />}
          <TabBar tab={tab} setTab={setTab} pending={pending} onNew={() => setNewOpen(true)} />
          <NewTypeSheet open={newOpen} onClose={() => setNewOpen(false)} />
        </>
      } />
      <ConfirmHost />
      <ToastHost />
    </AppCtx.Provider>
  );
}

function TabBar({ tab, setTab, pending, onNew }: { tab: Tab; setTab: (t: Tab) => void; pending: number; onNew: () => void }) {
  const b = (k: Tab, label: string, icon: React.ReactNode, badge?: number) => (
    <button type="button" aria-current={tab === k ? "page" : undefined} onClick={() => setTab(k)} aria-label={badge ? `${label}, ${badge} waiting` : label}>
      {icon}{label}{badge ? <span className="nd" aria-hidden="true">{badge > 99 ? "99+" : badge}</span> : null}
    </button>
  );
  return (
    <nav className="tb" aria-label="Main">
      {b("home", "Home", <House size={22} />)}
      {b("requests", "Requests", <FileText size={22} />)}
      <button type="button" onClick={onNew} aria-label="New request"><span className="fab"><Plus size={24} strokeWidth={2.4} /></span>New</button>
      {b("approvals", "Approvals", <ShieldCheck size={22} />, pending)}
      {b("me", "Settings", <Settings size={22} />)}
    </nav>
  );
}

function SignedOut({ why, onOk }: { why: "elsewhere" | "deactivated"; onOk: () => void }) {
  return (
    <div className="center">
      <img className="logo" src="./iet-logo.png" alt="Islamic Education Trust logo" />
      <p className="title">{why === "deactivated" ? "This account is switched off" : "You were signed out"}</p>
      <p className="mu" style={{ maxWidth: 320 }}>{why === "deactivated"
        ? "The Super Admin has switched this account off. If this is a mistake, contact the Super Admin."
        : "Your sign-in changed on another device (a new password, passcode or 2FA), so ReqGen signed this phone out to keep your account safe. Sign in again to continue."}</p>
      <button type="button" className="btn bp" onClick={onOk}>Sign in again</button>
    </div>
  );
}

/** 4.1.1: the opening screen sits in the middle of the phone, with a live loading bar. */
function Splash() {
  return (
    <div className="splash" role="status" aria-busy="true" aria-label="Opening ReqGen">
      <img className="logo splash-logo" src="./iet-logo.png" alt="Islamic Education Trust logo" />
      <p className="splash-txt">Opening ReqGen<span className="splash-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></p>
      <div className="splash-bar" aria-hidden="true"><span /></div>
    </div>
  );
}
function BootError({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="center">
      <img className="logo" src="./iet-logo.png" alt="Islamic Education Trust logo" />
      <p className="title">ReqGen could not open</p>
      <p className="mu" style={{ maxWidth: 320 }}>{text}</p>
      <button type="button" className="btn bp" onClick={onRetry}>Try again</button>
    </div>
  );
}
