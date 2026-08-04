"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3, Bell, BookOpenCheck, ChevronDown,
  CircleDollarSign, ClipboardCheck, FileBarChart, FileText, LayoutDashboard,
  LogOut, Menu, Search, Settings, ShieldCheck, SlidersHorizontal, UserRound,
  UsersRound, WalletCards, X, Plus, Download, Eye, Pencil, ArrowUpRight
} from "lucide-react";

type ModuleKey = "dashboard"|"requests"|"approvals"|"vouchers"|"staff"|"finance"|"reports"|"audit"|"profile"|"notifications"|"settings";

type ModuleConfig = {
  key: ModuleKey; label: string; title: string; subtitle: string;
  icon: typeof LayoutDashboard; action?: string;
};

const modules: ModuleConfig[] = [
  { key:"dashboard", label:"Dashboard", title:"EXECUTIVE COMMAND CENTRE", subtitle:"Enterprise overview, performance and operational intelligence", icon:LayoutDashboard },
  { key:"requests", label:"Requests", title:"REQUESTS MANAGEMENT", subtitle:"Create, track and manage all official and personal requests", icon:FileText, action:"New Request" },
  { key:"approvals", label:"Approvals", title:"APPROVAL CENTRE", subtitle:"Review, authorize and escalate pending workflow items", icon:ClipboardCheck },
  { key:"vouchers", label:"Payment Vouchers", title:"PAYMENT VOUCHERS", subtitle:"Manage payment vouchers, disbursements and settlement status", icon:WalletCards, action:"New Voucher" },
  { key:"staff", label:"Staff Registry", title:"STAFF REGISTRY", subtitle:"Manage staff records, assignments, availability and compliance", icon:UsersRound, action:"Add Staff" },
  { key:"finance", label:"Finance", title:"FINANCE DASHBOARD", subtitle:"Financial overview, account controls and budget intelligence", icon:CircleDollarSign },
  { key:"reports", label:"Reports & Analytics", title:"REPORTS & ANALYTICS", subtitle:"Generate, analyse and export enterprise reports", icon:FileBarChart },
  { key:"audit", label:"Audit Trail", title:"AUDIT TRAIL", subtitle:"Trace system activity, approvals, edits and security events", icon:ShieldCheck },
  { key:"profile", label:"My Profile", title:"MY PROFILE", subtitle:"Manage identity, access, preferences and security", icon:UserRound },
  { key:"notifications", label:"Notifications", title:"NOTIFICATIONS CENTRE", subtitle:"Review workflow alerts, approvals and system messages", icon:Bell },
  { key:"settings", label:"Settings", title:"SETTINGS & CONFIGURATION", subtitle:"Configure system preferences, roles and enterprise controls", icon:Settings },
];

const rows = [
  ["REQ-2026-0128","Payment Voucher","Isallaah360","₦250,000.00","Pending"],
  ["REQ-2026-0127","Staff Onboarding","James Daniel","—","Approved"],
  ["REQ-2026-0124","Equipment Request","Michael Brown","₦120,000.00","Pending"],
  ["REQ-2026-0122","Training Request","Sarah Williams","₦80,000.00","Approved"],
  ["REQ-2026-0118","Leave Request","Fatih Joseph","—","Completed"],
];

function getGreeting(hour: number) {
  if (hour < 12) return "GOOD MORNING";
  if (hour < 17) return "GOOD AFTERNOON";
  return "GOOD EVENING";
}

function HeaderGreeting({ section }: { section: string }) {
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setHour(new Date().getHours());
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);
  return <div className="erp-greeting"><strong>{hour === null ? "WELCOME" : getGreeting(hour)}, ISALLAAH360</strong><span>{section}</span></div>;
}

function Clock() {
  const [now,setNow]=useState<Date|null>(null);
  useEffect(()=>{ setNow(new Date()); const id=setInterval(()=>setNow(new Date()),1000); return()=>clearInterval(id); },[]);
  if(!now) return <span>—</span>;
  return <><span>{new Intl.DateTimeFormat("en-GB",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(now)}</span><strong>{new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit",second:"2-digit",hour12:true}).format(now)}</strong></>;
}

function Metric({label,value,tone="blue",note="+8% from yesterday"}:{label:string;value:string;tone?:string;note?:string}){
  return <article className={`erp-metric erp-tone-${tone}`}><span>{label}</span><strong>{value}</strong><small><ArrowUpRight size={13}/>{note}</small></article>;
}

function DataTable({kind}:{kind:ModuleKey}){
  return <section className="erp-panel erp-table-panel">
    <div className="erp-panel-head"><div><h3>{kind==="staff"?"STAFF DIRECTORY":kind==="audit"?"RECENT SYSTEM ACTIVITY":"RECENT TRANSACTIONS"}</h3><p>Latest records requiring visibility or action</p></div><button className="erp-icon-button" aria-label="Filter"><SlidersHorizontal size={17}/></button></div>
    <div className="erp-table-wrap"><table className="erp-table"><thead><tr><th>REFERENCE</th><th>TYPE / MODULE</th><th>OWNER</th><th>AMOUNT</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{rows.map((r,i)=><tr key={r[0]}><td><Link href="#">{r[0]}</Link></td><td>{kind==="audit"?["Login","Create","Update","Delete","Approve"][i]:r[1]}</td><td>{r[2]}</td><td>{r[3]}</td><td><span className={`erp-status erp-status-${r[4].toLowerCase()}`}>{r[4]}</span></td><td><div className="erp-row-actions"><button aria-label="View"><Eye size={15}/></button><button aria-label="Edit"><Pencil size={15}/></button></div></td></tr>)}</tbody></table></div>
  </section>;
}

function DashboardContent({kind}:{kind:ModuleKey}){
  if(kind==="profile") return <div className="erp-profile-grid"><section className="erp-panel erp-profile-card"><div className="erp-avatar-large">I</div><h3>Isallaah360</h3><p>Super Administrator</p><span>Executive Management</span></section><section className="erp-panel"><div className="erp-panel-head"><div><h3>PROFILE INFORMATION</h3><p>Personal and organizational details</p></div></div><div className="erp-form-grid"><label>Full Name<input defaultValue="Isallaah360"/></label><label>Email Address<input defaultValue="admin@barderian.com"/></label><label>Phone Number<input defaultValue="+234 803 123 4567"/></label><label>Department<select defaultValue="Executive Management"><option>Executive Management</option></select></label><label>Role<select defaultValue="Super Administrator"><option>Super Administrator</option></select></label><label>Time Format<select defaultValue="12 Hour (AM/PM)"><option>12 Hour (AM/PM)</option></select></label></div><button className="erp-button erp-button-gold">Update Profile</button></section></div>;
  if(kind==="settings") return <div className="erp-settings-grid"><aside className="erp-panel erp-settings-menu">{["General Settings","Business Settings","User Management","Role Management","System Configuration","Email Settings","Security Settings","Backup & Restore"].map((x,i)=><button className={i===0?"active":""} key={x}>{x}</button>)}</aside><section className="erp-panel"><div className="erp-panel-head"><div><h3>GENERAL SETTINGS</h3><p>Core enterprise configuration</p></div></div><div className="erp-form-grid"><label>System Name<input defaultValue="ReqGen ERP 2.0"/></label><label>Company Name<input defaultValue="Barderian Enterprises"/></label><label>Timezone<select><option>(GMT+1) West Africa Time</option></select></label><label>Date Format<select><option>DD MMM YYYY</option></select></label><label>Time Format<select><option>12 Hour (AM/PM)</option></select></label><label>Currency<select><option>NGN — Nigerian Naira</option></select></label></div><button className="erp-button erp-button-gold">Save Changes</button></section></div>;
  if(kind==="notifications") return <section className="erp-panel"><div className="erp-tabs"><button className="active">All</button><button>Unread (5)</button><button>Requests</button><button>Approvals</button><button>Payments</button><button>System</button></div><div className="erp-notification-list">{[
    ["Payment Voucher PV-2026-0046 has been approved","2 mins ago","success"],
    ["New request REQ-2026-0128 submitted for approval","15 mins ago","info"],
    ["Staff record for James Daniel has been updated","47 mins ago","info"],
    ["Budget report for July 2026 is now available","1 hr ago","danger"],
    ["System maintenance scheduled for this weekend","2 hrs ago","warning"],
  ].map(n=><article key={n[0]}><span className={`erp-notification-icon ${n[2]}`}><Bell size={18}/></span><div><strong>{n[0]}</strong><small>{n[1]}</small></div></article>)}</div></section>;
  if(kind==="reports") return <div className="erp-report-grid">{[["Financial Reports",24,CircleDollarSign],["HR Reports",16,UsersRound],["Request Reports",12,FileText],["Payment Reports",15,WalletCards],["Audit Reports",10,ShieldCheck],["Performance Reports",8,BarChart3],["Registry Reports",14,BookOpenCheck],["Custom Reports","Create New",Plus]].map(([n,c,I]:any)=><article className="erp-report-card" key={n}><I size={25}/><strong>{n}</strong><span>{c} {typeof c==="number"?"Reports":""}</span></article>)}</div>;
  return <><div className="erp-metrics"><Metric label={kind==="staff"?"TOTAL STAFF":kind==="finance"?"TOTAL REVENUE":"TOTAL REQUESTS"} value={kind==="staff"?"342":kind==="finance"?"₦45.6M":"128"}/><Metric label="PENDING" value={kind==="finance"?"₦23.8M":"45"} tone="gold"/><Metric label="APPROVED" value={kind==="finance"?"₦21.8M":"72"} tone="green"/><Metric label={kind==="staff"?"INACTIVE":"REJECTED"} value={kind==="staff"?"26":"11"} tone="red"/><Metric label={kind==="finance"?"CASH BALANCE":"COMPLETED"} value={kind==="finance"?"₦12.4M":"86"} tone="violet"/></div>{kind==="dashboard"||kind==="finance"?<div className="erp-analytics-grid"><section className="erp-panel"><div className="erp-panel-head"><div><h3>PERFORMANCE OVERVIEW</h3><p>Seven-day operational trend</p></div></div><div className="erp-chart"><span style={{height:"35%"}}/><span style={{height:"58%"}}/><span style={{height:"44%"}}/><span style={{height:"74%"}}/><span style={{height:"62%"}}/><span style={{height:"86%"}}/><span style={{height:"71%"}}/><span style={{height:"92%"}}/></div></section><section className="erp-panel"><div className="erp-panel-head"><div><h3>WORKFLOW DISTRIBUTION</h3><p>Current business workload</p></div></div><div className="erp-donut"><div><strong>68%</strong><span>UTILIZED</span></div></div><div className="erp-legend"><span>Operations 45%</span><span>Finance 25%</span><span>HR 15%</span><span>Others 15%</span></div></section></div>:null}<DataTable kind={kind}/></>;
}

export default function LegacyERP({module}:{module:string}){
  const pathname=usePathname();
  const active=useMemo(()=>modules.find(m=>m.key===module)||modules[0],[module]);
  const [collapsed,setCollapsed]=useState(false); const [mobile,setMobile]=useState(false); const [profile,setProfile]=useState(false);
  const Icon=active.icon;
  return <div className={`erp-shell ${collapsed?"erp-collapsed":""}`}><a className="erp-skip-link" href="#erp-main-content">Skip to main content</a>
    <aside className={`erp-sidebar ${mobile?"erp-mobile-open":""}`}>
      <div className="erp-brand"><Image src="/iet-logo.png" alt="IET" width={40} height={40}/><div><strong>REQGEN</strong><span>ERP 2.0</span></div><button className="erp-mobile-close" onClick={()=>setMobile(false)}><X size={20}/></button></div>
      <nav>{modules.filter(m=>!["profile","notifications"].includes(m.key)).map(m=>{const N=m.icon; return <Link href={`/erp-2/${m.key}`} className={pathname.endsWith(m.key)?"active":""} key={m.key}><N size={19}/><span>{m.label}</span></Link>})}</nav>
      <div className="erp-sidebar-foot"><span>PRODUCTION</span><small>ReqGen ERP v2.0</small></div>
    </aside>
    <div className="erp-workspace">
      <header className="erp-topbar"><div className="erp-topbar-left"><button className="erp-menu-button" onClick={()=>{ if(innerWidth<900)setMobile(true); else setCollapsed(!collapsed)}}><Menu size={21}/></button><HeaderGreeting section={active.title.replaceAll("&", "and")} /></div><div className="erp-clock"><Clock/></div><div className="erp-topbar-actions"><Link href="/erp-2/notifications" className="erp-icon-button erp-bell"><Bell size={19}/><i>5</i></Link><div className="erp-profile"><button onClick={()=>setProfile(!profile)}><span className="erp-avatar">I</span><span><strong>Isallaah360</strong><small>Super Administrator</small></span><ChevronDown size={15}/></button>{profile&&<div className="erp-profile-menu"><Link href="/erp-2/profile"><UserRound size={16}/>My Profile</Link><Link href="/erp-2/settings"><Settings size={16}/>Settings</Link><Link href="/login"><LogOut size={16}/>Logout</Link></div>}</div></div></header>
      <main className="erp-main" id="erp-main-content"><div className="erp-watermark"><Image src="/be-logo.png" alt="" fill sizes="70vw"/></div><div className="erp-page-head"><div><span className="erp-eyebrow"><Icon size={15}/>{active.label}</span><h1>{active.title}</h1><p>{active.subtitle}</p></div><div className="erp-page-actions"><button className="erp-button erp-button-secondary"><Download size={16}/>Export</button>{active.action&&<button className="erp-button erp-button-gold"><Plus size={16}/>{active.action}</button>}</div></div><div className="erp-toolbar"><div className="erp-search"><Search size={17}/><input placeholder={`Search ${active.label.toLowerCase()}...`}/></div><select><option>All Categories</option></select><select><option>All Status</option></select><select><option>This Month</option></select><button className="erp-button erp-button-secondary"><SlidersHorizontal size={16}/>Filter</button></div><DashboardContent kind={active.key}/></main>
      <footer className="erp-footer"><span>© 2026 Barderian Enterprises. All rights reserved.</span><span>ReqGen ERP 2.0 · Production</span></footer>
    </div>
  </div>;
}
