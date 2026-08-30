"use client";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
export type HRTone = "blue" | "cyan" | "emerald" | "amber" | "rose" | "violet" | "slate";
const accent: Record<HRTone,string>={blue:"#0b5cf0",cyan:"#0891b2",emerald:"#129a67",amber:"#ef8c18",rose:"#e84655",violet:"#7047e8",slate:"#334155"};
export function HRPageShell({children}:{children:ReactNode}){return <div className="rg-module-page rg-adopted-page rg-hr-page">{children}</div>}
export function HRHero({action}:{eyebrow:string;title:string;description:string;icon:LucideIcon;tone?:HRTone;action?:ReactNode}){if(!action)return null;return <div className="rg-rmb-actions-row">{action}</div>}
export function HRStatCard({label,value,note,icon:Icon,tone="blue"}:{label:string;value:string|number;note:string;icon:LucideIcon;tone?:HRTone}){return <article className="rg-stat-card" style={{['--rg-stat-accent' as string]:accent[tone]}}><div className="rg-stat-accent"/><div className="rg-stat-body"><div className="rg-stat-top"><p className="rg-stat-label">{label}</p><Icon className="rg-stat-icon"/></div><p className="rg-stat-value">{value}</p><p className="rg-stat-note">{note}</p></div></article>}
export function HRPanel({title,eyebrow,action,children}:{title:string;eyebrow?:string;action?:ReactNode;children:ReactNode}){return <section className="rg-section-card"><div className="rg-section-card-head"><div>{eyebrow?<p className="rg-section-eyebrow">{eyebrow}</p>:null}<h2>{title}</h2></div>{action}</div>{children}</section>}
export function HRButton({children,onClick,disabled,tone="blue",type="button"}:{children:ReactNode;onClick?:()=>void;disabled?:boolean;tone?:HRTone;type?:"button"|"submit"}){return <button type={type} onClick={onClick} disabled={disabled} className="rg-action-button" style={{['--rg-action-accent' as string]:accent[tone]}}>{children}</button>}
export function HRRefreshButton({onClick,loading}:{onClick:()=>void;loading?:boolean}){return <HRButton onClick={onClick} disabled={loading} tone="cyan"><RefreshCw className={loading?"animate-spin":""}/>{loading?"Refreshing...":"Refresh"}</HRButton>}
export function HRBadge({value,tone="slate"}:{value:string;tone?:HRTone}){return <span className="rg-status-badge" style={{['--rg-status-accent' as string]:accent[tone]}}>{pretty(value)}</span>}
export function HREmpty({title="No records found",description="There is no matching record for the selected view."}:{title?:string;description?:string}){return <div className="rg-empty-state"><Inbox/><strong>{title}</strong><p>{description}</p></div>}
export function HRAlert({message}:{message:string}){return <div className="rg-alert"><AlertTriangle/><span>{message}</span></div>}
export function pretty(value:string|null|undefined){return(value||"Not available").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())}
export function formatDate(value:string|null|undefined){if(!value)return"—";const d=new Date(value);return Number.isNaN(d.getTime())?"—":d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}
export function formatDateTime(value:string|null|undefined){if(!value)return"—";const d=new Date(value);return Number.isNaN(d.getTime())?"—":d.toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"numeric",minute:"2-digit",hour12:true})}
