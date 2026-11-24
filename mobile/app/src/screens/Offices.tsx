import type { ReactNode } from "react";
import { Archive, BarChart3, Building2, FileText, Landmark, ListChecks, ScrollText, Settings, ShieldCheck, Users, Wallet, Route, Send, Download, Upload, Printer, Clock, History, Scale, ArrowLeftRight, PenLine, Plus, Activity, KeyRound, Bell, CreditCard, TrendingUp, Database } from "lucide-react";
import { useApp } from "../App";
import { officesFor, roleSetOf, type ModuleDef } from "../lib/web";
import { Body, Cell, Empty, Head, useNav } from "../ui";
import { screenFor } from "../modules/registry";

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

export function OfficeList() {
  const offices = useOffices();
  const { push } = useNav();
  if (!offices.length) return null;
  return (
    <div className="grp">
      {offices.map((m) => <Cell key={m.key} icon={iconFor(m.icon)} title={m.label} sub={m.intro} onClick={() => push(<Office mod={m} />)} />)}
    </div>
  );
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
        <div className="grp">
          {mod.tiles.map((t) => (
            <Cell key={t.href} icon={iconFor(t.icon)} iconTone={TONE[t.tone]} title={t.title} sub={t.purpose} wrap onClick={() => push(screenFor(t.href, t.title))} />
          ))}
        </div>
      </Body>
    </>
  );
}
