"use client";

import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export type Tone = "blue" | "cyan" | "emerald" | "violet" | "amber" | "rose" | "slate";
const accent: Record<Tone,string> = { blue:"#0b5cf0", cyan:"#0891b2", emerald:"#129a67", violet:"#7047e8", amber:"#ef8c18", rose:"#e84655", slate:"#334155" };

export function StrategicHero({ action }:{ eyebrow:string;title:string;description:string;action?:ReactNode }) {
  if (!action) return null;
  return <div className="rg-rmb-actions-row">{action}</div>;
}
export function StrategicShell({ children }:{ children:ReactNode }) { return <main className="rg-module-page rg-adopted-page rg-hr-page">{children}</main>; }
export function StrategicNavigation(){ return null; }
export function StatCard({ label,value,note,tone="blue" }:{ label:string;value:string|number;note:string;tone?:Tone }){ return <article className="rg-stat-card" style={{['--rg-stat-accent' as string]:accent[tone]}}><div className="rg-stat-accent"/><div className="rg-stat-body"><p className="rg-stat-label">{label}</p><p className="rg-stat-value">{value}</p><p className="rg-stat-note">{note}</p></div></article>; }
export function SectionCard({ title,eyebrow,action,children }:{ title:string;eyebrow?:string;action?:ReactNode;children:ReactNode }){ return <section className="rg-section-card"><div className="rg-section-card-head"><div>{eyebrow?<p className="rg-section-eyebrow">{eyebrow}</p>:null}<h2>{title}</h2></div>{action}</div><div className="rg-section-body">{children}</div></section>; }
export function PrimaryButton({ children,onClick,disabled=false,tone="blue",type="button" }:{ children:ReactNode;onClick?:()=>void;disabled?:boolean;tone?:Tone;type?:"button"|"submit" }){ return <button type={type} onClick={onClick} disabled={disabled} className="rg-action-button" style={{['--rg-action-accent' as string]:accent[tone]}}>{children}</button>; }
export function TextInput({ label,value,onChange,type="text",placeholder,required=false }:{ label:string;value:string;onChange:(value:string)=>void;type?:string;placeholder?:string;required?:boolean }){ return <label className="rg-form-field"><span>{label}</span><input type={type} value={value} required={required} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></label>; }
export function SelectInput({ label,value,onChange,options }:{ label:string;value:string;onChange:(value:string)=>void;options:Array<{value:string;label:string}> }){ return <label className="rg-form-field"><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>; }
export function StatusBadge({ children,tone="slate" }:{ children:ReactNode;tone?:Tone }){ return <span className="rg-status-badge" style={{['--rg-status-accent' as string]:accent[tone]}}>{children}</span>; }
export function EmptyState({ title,description }:{ title:string;description:string }){ return <div className="rg-empty-state"><Inbox/><strong>{title}</strong><p>{description}</p></div>; }
