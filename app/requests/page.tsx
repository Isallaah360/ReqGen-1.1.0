"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3, FileText, Landmark, Search, XCircle, Eye, Pencil, MoreVertical, Download, Plus, Printer, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import styles from "./requests.module.css";

type Row = { id:string; request_no:string; title:string; amount:number; status:string; current_stage:string; created_at:string; request_type?:string|null; personal_category?:string|null; dept_id?:string|null; };
type DepartmentLite = { id: string; name: string | null };
type TypeFilter = "ALL"|"OFFICIAL"|"PERSONAL_FUND"|"PERSONAL_OTHER";
type StatusFilter = "ALL"|"ACTIVE"|"COMPLETED"|"REJECTED";

type TabKey = "ALL"|"ACTIVE"|"COMPLETED"|"REJECTED"|"OFFICIAL"|"PERSONAL_FUND"|"PERSONAL_OTHER";

function text(v?:string|null){return String(v||"").trim().toLowerCase()}
function isRejected(r:Row){const s=text(r.status);return /reject|delete|cancel|fail/.test(s)}
function isCompleted(r:Row){const s=text(r.status);return /approved|paid|complete|closed/.test(s)}
function isActive(r:Row){return !isRejected(r)&&!isCompleted(r)}
function requestGroup(r:Row):TypeFilter{const rt=String(r.request_type||"").toUpperCase();const pc=String(r.personal_category||"").toUpperCase();if(rt.includes("OFFICIAL"))return"OFFICIAL";if(rt.includes("PERSONAL")&&pc.includes("FUND"))return"PERSONAL_FUND";if(rt.includes("PERSONAL"))return"PERSONAL_OTHER";return"ALL"}
function requestTypeLabel(r:Row){const g=requestGroup(r);return g==="OFFICIAL"?"Official":g==="PERSONAL_FUND"?"Personal Fund":g==="PERSONAL_OTHER"?"Personal Other":r.request_type||"Other"}
function naira(v:number){return `₦${Math.round(Number(v||0)).toLocaleString("en-NG")}`}
function statusClass(r:Row){return isRejected(r)?styles.rejected:isCompleted(r)?styles.approved:/pending/i.test(r.status||"")?styles.pending:styles.progress}
function statusLabel(r:Row){return isRejected(r)?"Rejected":isCompleted(r)?"Approved":r.status||r.current_stage||"In Progress"}

export default function RequestsPage(){
 const router=useRouter(); const [showCreateDrawer,setShowCreateDrawer]=useState(false); const [editDrawerId,setEditDrawerId]=useState<string|null>(null); const [rows,setRows]=useState<Row[]>([]); const [departments,setDepartments]=useState<Record<string,string>>({}); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null); const [query,setQuery]=useState(""); const [status,setStatus]=useState<StatusFilter>("ALL"); const [type,setType]=useState<TypeFilter>("ALL"); const [department,setDepartment]=useState("ALL"); const [tab,setTab]=useState<TabKey>("ALL"); const [page,setPage]=useState(1);
 const load=useCallback(async()=>{setLoading(true);setError(null);const{data:auth}=await supabase.auth.getUser();if(!auth.user){router.push("/login");return}const{data,error:reqError}=await supabase.from("requests").select("id,request_no,title,amount,status,current_stage,created_at,request_type,personal_category,dept_id").eq("created_by",auth.user.id).order("created_at",{ascending:false});if(reqError){setError(reqError.message);setRows([]);setLoading(false);return}const requestRows=(data||[]) as Row[];setRows(requestRows);const ids=Array.from(new Set(requestRows.map(r=>r.dept_id).filter(Boolean))) as string[];if(ids.length){const{data:deptRows}=await supabase.from("departments").select("id,name").in("id",ids);setDepartments(Object.fromEntries(((deptRows||[]) as DepartmentLite[]).map((d)=>[String(d.id),String(d.name||"Unassigned")])))}else setDepartments({});setLoading(false)},[router]);
 useEffect(()=>{queueMicrotask(()=>{void load();});},[load]);
 useEffect(()=>{
  const onMessage=(event:MessageEvent)=>{
   if(event.origin!==window.location.origin)return;
   const type=event.data?.type;
   if(type==="reqgen-request-created"){setShowCreateDrawer(false);void load();}
   if(type==="reqgen-request-edit-saved"){setEditDrawerId(null);void load();}
   if(type==="reqgen-form-cancel"){setShowCreateDrawer(false);setEditDrawerId(null);}
  };
  window.addEventListener("message",onMessage);
  return()=>window.removeEventListener("message",onMessage);
 },[load]);
 const counts=useMemo(()=>({total:rows.length,active:rows.filter(isActive).length,completed:rows.filter(isCompleted).length,rejected:rows.filter(isRejected).length,official:rows.filter(r=>requestGroup(r)==="OFFICIAL").length,fund:rows.filter(r=>requestGroup(r)==="PERSONAL_FUND").length,other:rows.filter(r=>requestGroup(r)==="PERSONAL_OTHER").length}),[rows]);
 const recentRows=useMemo(()=>rows.slice(0,5),[rows]);
 const departmentStats=useMemo(()=>{const map=new Map<string,number>();rows.forEach(r=>{const name=r.dept_id?departments[r.dept_id]||"Unassigned":"Unassigned";map.set(name,(map.get(name)||0)+1)});return Array.from(map.entries()).sort((a,b)=>b[1]-a[1]).slice(0,5)},[rows,departments]);
 const maxDepartmentCount=Math.max(1,...departmentStats.map(([,count])=>count));
 const statusGradient=useMemo(()=>{if(!counts.total)return "conic-gradient(#dbe7f6 0deg 360deg)";const activeDeg=counts.active/counts.total*360;const completedDeg=counts.completed/counts.total*360;return `conic-gradient(#f59e0b 0deg ${activeDeg}deg,#16a36a ${activeDeg}deg ${activeDeg+completedDeg}deg,#ef4b5f ${activeDeg+completedDeg}deg 360deg)`},[counts]);
 const filtered=useMemo(()=>rows.filter(r=>{const q=query.trim().toLowerCase();if(tab==="ACTIVE"&&!isActive(r))return false;if(tab==="COMPLETED"&&!isCompleted(r))return false;if(tab==="REJECTED"&&!isRejected(r))return false;if(["OFFICIAL","PERSONAL_FUND","PERSONAL_OTHER"].includes(tab)&&requestGroup(r)!==tab)return false;if(status==="ACTIVE"&&!isActive(r))return false;if(status==="COMPLETED"&&!isCompleted(r))return false;if(status==="REJECTED"&&!isRejected(r))return false;if(type!=="ALL"&&requestGroup(r)!==type)return false;if(department!=="ALL"&&r.dept_id!==department)return false;if(!q)return true;return[r.request_no,r.title,r.status,r.current_stage,requestTypeLabel(r),r.dept_id?departments[r.dept_id]:""].join(" ").toLowerCase().includes(q)}),[rows,query,status,type,department,departments,tab]);
 useEffect(()=>{queueMicrotask(()=>setPage(1));},[query,status,type,department,tab]); const pageSize=8; const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize)); const currentPage=Math.min(page,totalPages); const paged=filtered.slice((currentPage-1)*pageSize,currentPage*pageSize);
 const tabs:[TabKey,string,number][]=[["ALL","All Requests",counts.total],["ACTIVE","Active Workflow",counts.active],["COMPLETED","Completed / Paid",counts.completed],["REJECTED","Rejected / Deleted",counts.rejected],["OFFICIAL","Official",counts.official],["PERSONAL_FUND","Personal Fund",counts.fund],["PERSONAL_OTHER","Personal Other",counts.other]];
 function exportCsv(){const lines=[["Request Code","Title","Department","Type","Amount","Status","Requested On"],...filtered.map(r=>[r.request_no,r.title,r.dept_id?departments[r.dept_id]||"Unassigned":"Unassigned",requestTypeLabel(r),String(r.amount||0),statusLabel(r),new Date(r.created_at).toLocaleString("en-NG")])].map(row=>row.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([lines],{type:"text/csv"}));a.download="reqgen-requests.csv";a.click();URL.revokeObjectURL(a.href)}
 if(showCreateDrawer){return <main className={`${styles.page} ${styles.formMode}`}>
  <section className={styles.fullFormWorkspace} aria-label="Create Request">
   <header className={styles.fullFormHeader}><div><span className={styles.eyebrow}>Requests</span><strong>Create New Request</strong><p>Complete, save, sign and submit your request in one full workspace.</p></div><button type="button" onClick={()=>setShowCreateDrawer(false)}><X size={18}/> Back to Requests</button></header>
   <iframe className={styles.fullFormFrame} title="Create Request Form" src="/requests/new?embedded=1"/>
  </section>
 </main>}
 if(editDrawerId){return <main className={`${styles.page} ${styles.formMode}`}>
  <section className={styles.fullFormWorkspace} aria-label="Edit Request">
   <header className={styles.fullFormHeader}><div><span className={styles.eyebrow}>Requests</span><strong>Edit Request</strong><p>Update the request while preserving its workflow, reservations and audit history.</p></div><button type="button" onClick={()=>setEditDrawerId(null)}><X size={18}/> Back to Requests</button></header>
   <iframe className={styles.fullFormFrame} title="Edit Request Form" src={`/requests/${editDrawerId}/edit?embedded=1`}/>
  </section>
 </main>}
 return <main className={styles.page}>
  <header className={styles.header}><div><span className={styles.eyebrow}>Requests</span><h1>Requests Overview</h1><p>Track all your requests from creation to final decision in one workspace.</p></div><button className={styles.primary} onClick={()=>setShowCreateDrawer(true)} data-tip="Open the Create Request form without leaving the Requests workspace."><Plus size={17}/> New Request</button></header>
  <section className={styles.kpis}>
   <Kpi tone="blue" icon={<FileText/>} label="Total Requests" value={counts.total} note="All submitted requests"/>
   <Kpi tone="orange" icon={<Clock3/>} label="Active Workflow" value={counts.active} note="Currently in progress"/>
   <Kpi tone="green" icon={<CheckCircle2/>} label="Completed / Paid" value={counts.completed} note="Successfully completed"/>
   <Kpi tone="purple" icon={<Landmark/>} label="Official Requests" value={counts.official} note={`${counts.total?Math.round(counts.official/counts.total*100):0}% of total`}/>
   <Kpi tone="red" icon={<XCircle/>} label="Rejected / Deleted" value={counts.rejected} note="Closed without completion"/>
  </section>
  <section className={styles.insightGrid} aria-label="Request overview insights">
   <article className={styles.insightCard}>
    <div className={styles.cardHeading}><div><strong>Requests by Status</strong><span>Live workflow distribution</span></div></div>
    <div className={styles.statusVisual}>
      <div className={styles.donut} style={{background:statusGradient}}><div><b>{counts.total}</b><span>Total</span></div></div>
      <div className={styles.legend}><span><i className={styles.legendPending}/>In Progress <b>{counts.active}</b></span><span><i className={styles.legendApproved}/>Completed <b>{counts.completed}</b></span><span><i className={styles.legendRejected}/>Rejected <b>{counts.rejected}</b></span></div>
    </div>
   </article>
   <article className={styles.insightCard}>
    <div className={styles.cardHeading}><div><strong>Recent Requests</strong><span>Your latest request activity</span></div><button type="button" onClick={()=>{setTab("ALL");setQuery("")}}>View All</button></div>
    <div className={styles.recentList}>{recentRows.length?recentRows.map(r=><Link key={r.id} href={`/requests/${r.id}`} className={styles.recentRow}><span><b>{r.title||"Untitled request"}</b><small>{r.request_no}</small></span><span>{r.current_stage||"—"}</span><em className={`${styles.statusPill} ${statusClass(r)}`}>{statusLabel(r)}</em></Link>):<div className={styles.miniEmpty}>No requests yet.</div>}</div>
   </article>
  </section>
  <section className={styles.secondaryGrid}>
   <article className={styles.insightCard}><div className={styles.cardHeading}><div><strong>Requests by Department</strong><span>Top request destinations</span></div></div><div className={styles.departmentBars}>{departmentStats.length?departmentStats.map(([name,count])=><div key={name}><div><span>{name}</span><b>{count}</b></div><i><span style={{width:`${Math.max(8,count/maxDepartmentCount*100)}%`}}/></i></div>):<div className={styles.miniEmpty}>No department activity yet.</div>}</div></article>
   <article className={styles.insightCard}><div className={styles.cardHeading}><div><strong>Quick Actions</strong><span>Common request tasks</span></div></div><div className={styles.quickActions}><button type="button" onClick={()=>setShowCreateDrawer(true)}><Plus size={15}/>Create New Request</button><button type="button" onClick={()=>{setTab("ACTIVE");setQuery("")}}><Clock3 size={15}/>Active Requests</button><button type="button" onClick={exportCsv}><Download size={15}/>Export Register</button></div></article>
   <article className={styles.insightCard}><div className={styles.cardHeading}><div><strong>Request Types</strong><span>Current request mix</span></div></div><div className={styles.typeSummary}><span><b>Official</b><strong>{counts.official}</strong></span><span><b>Personal Fund</b><strong>{counts.fund}</strong></span><span><b>Personal Other</b><strong>{counts.other}</strong></span></div></article>
  </section>
  <section className={styles.registerCard}>
   <nav className={styles.tabs} aria-label="Request views">{tabs.map(([key,label,count])=><button key={key} className={tab===key?styles.activeTab:""} onClick={()=>setTab(key)}>{label}<b>{count}</b></button>)}</nav>
   <div className={styles.filters}>
    <div className={styles.search}><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search requests..."/></div>
    <select value={status} onChange={e=>setStatus(e.target.value as StatusFilter)}><option value="ALL">All Status</option><option value="ACTIVE">Active</option><option value="COMPLETED">Completed</option><option value="REJECTED">Rejected</option></select>
    <select value={department} onChange={e=>setDepartment(e.target.value)}><option value="ALL">All Departments</option>{Object.entries(departments).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>
    <select value={type} onChange={e=>setType(e.target.value as TypeFilter)}><option value="ALL">All Request Types</option><option value="OFFICIAL">Official</option><option value="PERSONAL_FUND">Personal Fund</option><option value="PERSONAL_OTHER">Personal Other</option></select>
    <button className={styles.exportBtn} onClick={exportCsv}><Download size={15}/> Export</button>
   </div>
   {error?<div className={styles.alert}>{error}</div>:loading?<div className={styles.loading}>Loading requests…</div>:<div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Req Code</th><th>Title</th><th>Department</th><th>Type</th><th>Amount (₦)</th><th>Status</th><th>Requested On</th><th>Actions</th></tr></thead><tbody>{paged.length?paged.map(r=><tr key={r.id}><td className={styles.code}>{r.request_no||"—"}</td><td>{r.title||"Untitled request"}</td><td>{r.dept_id?departments[r.dept_id]||"Unassigned":"Unassigned"}</td><td><span className={styles.typePill}>{requestTypeLabel(r)}</span></td><td>{naira(r.amount)}</td><td><span className={`${styles.statusPill} ${statusClass(r)}`}>{statusLabel(r)}</span></td><td>{new Date(r.created_at).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"})}</td><td><div className={styles.actions}>
      <Link title="View request" aria-label={`View ${r.request_no||"request"}`} href={`/requests/${r.id}`}><Eye size={14}/></Link>
      <button type="button" title="Edit request" aria-label={`Edit ${r.request_no||"request"}`} onClick={()=>setEditDrawerId(r.id)}><Pencil size={14}/></button>
      <details className={styles.moreMenu}>
        <summary title="More actions" aria-label={`More actions for ${r.request_no||"request"}`}><MoreVertical size={14}/></summary>
        <div className={styles.moreMenuPanel}>
          <Link href={`/requests/${r.id}`}><Eye size={14}/> View Details</Link>
          <Link href={`/requests/${r.id}/edit`}><Pencil size={14}/> Edit Request</Link>
          <Link href={`/requests/${r.id}/print`}><Printer size={14}/> Print / PDF</Link>
        </div>
      </details>
    </div></td></tr>):<tr><td colSpan={8} className={styles.empty}>No matching requests.</td></tr>}</tbody></table></div>}
   <div className={styles.pagination}><span>Showing {filtered.length?((currentPage-1)*pageSize)+1:0} to {Math.min(currentPage*pageSize,filtered.length)} of {filtered.length} entries</span><div><button disabled={currentPage===1} onClick={()=>setPage(p=>Math.max(1,p-1))}>‹</button>{Array.from({length:Math.min(totalPages,4)},(_,i)=>i+1).map(n=><button key={n} className={n===currentPage?styles.current:""} onClick={()=>setPage(n)}>{n}</button>)}{totalPages>4&&<span>…</span>}<button disabled={currentPage===totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>›</button></div></div>
  </section>
 </main>
}
function Kpi({tone,icon,label,value,note}:{tone:"blue"|"orange"|"green"|"purple"|"red";icon:React.ReactNode;label:string;value:number;note:string}){return <article className={styles.kpi}><span className={`${styles.kpiIcon} ${styles[tone]}`}>{icon}</span><div><small>{label}</small><strong>{value.toLocaleString()}</strong><p>{note}</p></div></article>}
