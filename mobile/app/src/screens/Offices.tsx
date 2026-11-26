import type { ReactNode } from "react";
import { Archive, BarChart3, Building2, FileText, Landmark, ListChecks, ScrollText, Settings, ShieldCheck, Users, Wallet, Route, Send, Download, Upload, Printer, Clock, History, Scale, ArrowLeftRight, PenLine, Plus, Activity, KeyRound, Bell, CreditCard, TrendingUp, Database } from "lucide-react";
import { useApp } from "../App";
import { officesFor, roleSetOf, type ModuleDef } from "../lib/offices";
import { Body, Empty, Head, useNav } from "../ui";
import { screenFor } from "../lib/screens";

/** Icons for the website's icon names (lib/v4/modules.ts), so each office looks the same in the app. */
const ICON: Record<string, ReactNode> = {
  archive: <Archive size={18} />, trend: <TrendingUp size={18} />, file: <FileText size={18} />, landmark: <Landmark size={18} />, list: <ListChecks size={18} />,
  settings: <Settings size={18} />, shield: <ShieldCheck size={18} />, users: <Users size={18} />, wallet: <Wallet size={18} />, route: <Route size={18} />,
  send: <Send size={18} />, download: <Download size={18} />, upload: <Upload size={18} />, printer: <Printer size={18} />, clock: <Clock size={18} />,
  history: <History size={18} />, scale: <Scale size={18} />, arrows: <ArrowLeftRight size={18} />, pen: <PenLine size={18} />, plus: <Plus size={18} />,
  activity: <Activity size={18} />, key: <KeyRound size={18} />, bell: <Bell size={18} />, card: <CreditCard size={18} />, chart: <BarChart3 size={18} />,
  building: <Building2 size={18} />, log: <ScrollText size={18} />, database: <Database size={18} />,
};
export const iconFor = (name: string) => ICON[name] || <FileText size={18} />;
const TONE: Record<string, string> = { brand: "", blue: "in", green: "ok", amber: "wa", red: "er" };

/** Every office this position can open, the same list as the website's menu. */
export function useOffices() {
  const { me } = useApp();
  return officesFor(roleSetOf(me.role, me.systemAccount));
}

/** 4.2.1: every list of offices and pages is a grid of app icons, like a phone's home screen. */
export type AppIcon = { key: string; label: string; icon: ReactNode; color: string; badge?: number; onClick: () => void };
// IET logo colours only; the second value is the symbol colour that stays readable on it
const PALETTE: Array<[string, string]> = [["#146185", "#FFFFFF"], ["#31A8E0", "#FFFFFF"], ["#F9A11F", "#000000"], ["#F47824", "#FFFFFF"], ["#7C4B03", "#FFFFFF"], ["#EF3F27", "#FFFFFF"]];
const OFFICE_COLOR: Record<string, number> = { finance: 0, vouchers: 1, "payment-vouchers": 1, registry: 4, reports: 2, audit: 5, administration: 0, admin: 0, developer: 3 };
export const tileColor = (i: number) => PALETTE[i % PALETTE.length];
export function AppGrid({ items, label }: { items: AppIcon[]; label: string }) {
  if (!items.length) return null;
  return (
    <div className="apps" role="list" aria-label={label}>
      {items.map((a, i) => {
        const [bg, fg] = PALETTE.find((p) => p[0] === a.color) || tileColor(i);
        return (
          <div role="listitem" key={a.key}>
            <button type="button" className="app" style={{ animationDelay: `${Math.min(i, 16) * 35}ms` }} onClick={a.onClick}
              aria-label={a.badge ? `${a.label}, ${a.badge} waiting` : a.label}>
              <span className="app-ic" style={{ background: bg, color: fg }} aria-hidden="true">{a.icon}</span>
              {a.badge ? <span className="app-nd" aria-hidden="true">{a.badge > 99 ? "99+" : a.badge}</span> : null}
              <span className="app-t">{a.label}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
const big = (node: ReactNode) => <span className="app-svg">{node}</span>;
export function officeIcons(offices: ModuleDef[], open: (m: ModuleDef) => void): AppIcon[] {
  return offices.map((m, i) => ({ key: m.key, label: m.label, icon: big(iconFor(m.icon)), color: tileColor(OFFICE_COLOR[m.key] ?? i)[0], onClick: () => open(m) }));
}

export function OfficeList() {
  const offices = useOffices();
  const { push } = useNav();
  if (!offices.length) return null;
  return <AppGrid label="Your offices" items={officeIcons(offices, (m) => push(<Office mod={m} />))} />;
}

export default function Offices() {
  const offices = useOffices();
  return (
    <>
      <Head title="Offices" />
      <Body>
        {offices.length ? <OfficeList /> : <Empty icon={<Building2 size={28} />} title="No offices for this position" text="Requests, Approvals and Notices are in the tabs below." />}
      </Body>
    </>
  );
}

export function Office({ mod }: { mod: ModuleDef }) {
  const { push } = useNav();
  return (
    <>
      <Head title={mod.label} />
      <Body>
        <p className="mu">{mod.intro}</p>
        <AppGrid label={`${mod.label} pages`} items={mod.tiles.map((t, i) => ({
          key: t.href, label: t.title, icon: big(iconFor(t.icon)), color: TONE[t.tone] === "er" ? "#EF3F27" : tileColor(i)[0],
          onClick: () => push(screenFor(t.href, t.title)),
        }))} />
      </Body>
    </>
  );
}
