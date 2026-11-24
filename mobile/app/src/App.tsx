import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { House, FileText, Plus, ShieldCheck, User } from "lucide-react";
import { db, loadConfig, session, store } from "./lib/core";
import { finger, lockDue, onResume, paintStatusBar, pin, touch } from "./lib/native";
import { loadMe, type Me } from "./lib/data";
import { waitingForMe } from "./lib/text";
import { Stack, ToastHost, CodeHost, useBack } from "./ui";
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
  /** 3.0.0: Sand or Gold */
  look: "sand" | "gold"; setLook: (l: "sand" | "gold") => void;
};
const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => useContext(AppCtx) as Ctx;

/** Light or dark: follows the phone unless the person chose one in Me. The status bar follows too. */
function useTheme() {
  const [theme, setThemeState] = useState<"system" | "light" | "dark">("system");
  const [look, setLookState] = useState<"sand" | "gold">("sand");
  useEffect(() => { void store.get<"system" | "light" | "dark">("rg:theme", "system").then(setThemeState); }, []);
  useEffect(() => { void store.get<"sand" | "gold">("rg:look", "sand").then((l) => setLookState(l === "gold" ? "gold" : "sand")); }, []);
  useEffect(() => { document.documentElement.dataset.look = look; }, [look]);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      paintStatusBar(dark);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  return {
    theme, setTheme: (t: "system" | "light" | "dark") => { setThemeState(t); void store.set("rg:theme", t); },
    look, setLook: (l: "sand" | "gold") => { setLookState(l); void store.set("rg:look", l); },
  };
}

type Phase = "boot" | "signin" | "locked" | "in" | "error";

export default function App() {
  const [phase, setPhase] = useState<Phase>("boot");
  const [me, setMe] = useState<Me | null>(null);
  const [bootError, setBootError] = useState("");
  const { theme, setTheme, look, setLook } = useTheme();

  const start = useCallback(async () => {
    setPhase("boot");
    try {
      await loadConfig();
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

  // lock after 15 minutes away
  useEffect(() => onResume((active) => {
    if (!active) { void touch(); return; }
    void (async () => { if (phase === "in" && (await pin.isSet()) && (await lockDue())) setPhase("locked"); else void touch(); })();
  }), [phase]);

  if (phase === "boot") return <Splash />;
  if (phase === "error") return <BootError text={bootError} onRetry={() => void start()} />;
  if (phase === "signin") return <><SignIn onDone={async () => { setMe(await loadMe()); await touch(); setPhase("in"); }} /><CodeHost /><ToastHost /></>;
  if (phase === "locked" && me) return <><Unlock me={me} onOpen={async () => { await touch(); setPhase("in"); }} onSwitch={async () => { await signOutAll(); setMe(null); setPhase("signin"); }} /><ToastHost /></>;
  if (!me) return <Splash />;
  return (
    <Signed me={me} setMe={setMe} theme={theme} setTheme={setTheme} look={look} setLook={setLook}
      onSignOut={async () => { await signOutAll(); setMe(null); setPhase("signin"); }} />
  );
}

async function signOutAll() {
  try { await (await db()).auth.signOut(); } catch { /* offline: the saved session is removed below */ }
  await Promise.all([store.del("rg:verified"), store.del("rg:me"), pin.clear(), finger.set(false)]);
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
  useEffect(() => {
    void refreshPending();
    const t = window.setInterval(() => void refreshPending(), 60_000);
    let ch: { unsubscribe: () => unknown } | null = null;
    void db().then((s) => { ch = s.channel(`app-badge-${me.id}`).on("postgres_changes", { event: "*", schema: "public", table: "requests" }, () => void refreshPending()).subscribe(); });
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
      <CodeHost />
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
      {b("me", "Me", <User size={22} />)}
    </nav>
  );
}

function Splash() {
  return <div className="center" aria-busy="true"><img className="logo" src="./iet-logo.png" alt="Islamic Education Trust logo" /><p className="mu">Opening ReqGen…</p></div>;
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
