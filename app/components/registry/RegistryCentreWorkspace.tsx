"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, FilePlus2, Flag, Inbox, RefreshCw, Search, Send, Truck, type LucideIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import styles from "@/app/registry/registry.module.css";

type Raw = Record<string, unknown>;
type Department = { id: string; name: string };
type ViewKey = "overview" | "incoming" | "outgoing" | "dispatch" | "all";

type Correspondence = {
  id: string; referenceNo: string; subject: string; direction: string; departmentId: string; department: string;
  priority: string; status: string; createdAt: string; updatedAt: string; party: string; dispatchMethod: string;
};

const VIEWS: Array<{ key: ViewKey; label: string }> = [
  { key: "overview", label: "Overview" }, { key: "incoming", label: "Incoming Register" },
  { key: "outgoing", label: "Outgoing Register" }, { key: "dispatch", label: "Dispatch" }, { key: "all", label: "All Operations" },
];
const COLORS = ["#1263f3", "#11a676", "#ffb11b", "#e65566", "#7656e8", "#0aa2b8", "#f07822", "#718096", "#0c75d8", "#2f9e44", "#d9485f", "#8b5cf6"];
function s(v: unknown, fallback = "") { return typeof v === "string" && v.trim() ? v.trim() : fallback; }
function dateValue(v: string) { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; }
function dateText(v: string) { const d = dateValue(v); return d ? d.toLocaleString(undefined, { year:"numeric", month:"short", day:"2-digit", hour:"2-digit", minute:"2-digit" }) : "—"; }
function isToday(v: string) { const d=dateValue(v), n=new Date(); return !!d && d.toDateString()===n.toDateString(); }
function mapRow(row: Raw, names: Map<string,string>): Correspondence {
  const departmentId=s(row.department_id, s(row.dept_id));
  return {
    id:s(row.id), referenceNo:s(row.reference_no,"Unnumbered"), subject:s(row.subject,"Untitled correspondence"),
    direction:s(row.direction,"Incoming"), departmentId, department:s(row.department_name, names.get(departmentId)||"Unassigned"),
    priority:s(row.priority,"Normal"), status:s(row.status,"Pending"), createdAt:s(row.created_at), updatedAt:s(row.updated_at,s(row.created_at)),
    party:s(row.from_to, s(row.sender_name, s(row.recipient_name, s(row.sender, s(row.recipient, s(row.source, s(row.destination,"—"))))))),
    dispatchMethod:s(row.dispatch_method, s(row.delivery_method,"—")),
  };
}
function statusTone(value:string) { const x=value.toLowerCase(); if(/delivered|complete|collected|closed/.test(x))return {bg:"#e9fbf3",color:"#087247"}; if(/await|pending|draft/.test(x))return {bg:"#fff6dd",color:"#9a6200"}; if(/overdue|reject|cancel|missing/.test(x))return {bg:"#fff0f0",color:"#b4232f"}; if(/dispatch/.test(x))return {bg:"#f3efff",color:"#6842c2"}; return {bg:"#eef5ff",color:"#1459b5"}; }
function priorityTone(value:string){ return /urgent|high/i.test(value)?{bg:"#fff0f0",color:"#c02b38"}:/low/i.test(value)?{bg:"#eef5ff",color:"#2762b3"}:{bg:"#fff6dd",color:"#936100"}; }

export default function RegistryCentreWorkspace() {
  const router=useRouter(); const params=useSearchParams();
  const requestedView=(params.get("view")||"overview") as ViewKey;
  const view:ViewKey=VIEWS.some(v=>v.key===requestedView)?requestedView:"overview";
  const [rows,setRows]=useState<Correspondence[]>([]); const [departments,setDepartments]=useState<Department[]>([]);
  const [loading,setLoading]=useState(true); const [message,setMessage]=useState<string|null>(null); const [showForm,setShowForm]=useState(false);
  const [query,setQuery]=useState(""); const [direction,setDirection]=useState("all"); const [department,setDepartment]=useState("all");
  const [status,setStatus]=useState("all"); const [priority,setPriority]=useState("all"); const [dateFrom,setDateFrom]=useState(""); const [dateTo,setDateTo]=useState("");
  const [page,setPage]=useState(1); const pageSize=10;
  const [form,setForm]=useState({referenceNo:"",subject:"",direction:"Incoming",departmentId:"",priority:"Normal",status:"Received / Logged",party:""});
  const [saving,setSaving]=useState(false);

  const load=useCallback(async()=>{
    setLoading(true); setMessage(null);
    const [deptResult, registryResult]=await Promise.all([
      supabase.from("departments").select("id,name").order("name",{ascending:true}),
      supabase.from("registry_correspondence").select("*").order("created_at",{ascending:false}).limit(2000),
    ]);
    if(deptResult.error) setMessage(`Departments: ${deptResult.error.message}`);
    const depts=(deptResult.data||[]) as Department[]; setDepartments(depts); const names=new Map(depts.map(d=>[d.id,d.name]));
    if(registryResult.error){ setRows([]); setMessage((m)=>m||`Registry: ${registryResult.error.message}`); }
    else setRows(((registryResult.data||[]) as Raw[]).map(r=>mapRow(r,names)));
    setLoading(false);
  },[]);
  useEffect(()=>{ queueMicrotask(()=>{void load();}); },[load]);

  const statuses=useMemo(()=>Array.from(new Set(rows.map(r=>r.status))).filter(Boolean).sort(),[rows]);
  const priorities=useMemo(()=>Array.from(new Set(rows.map(r=>r.priority))).filter(Boolean).sort(),[rows]);
  const scoped=useMemo(()=>rows.filter(r=>view==="incoming"?r.direction.toLowerCase()==="incoming":view==="outgoing"?r.direction.toLowerCase()==="outgoing":view==="dispatch"?/dispatch|awaiting collection|collected|delivered|courier|ack/i.test(`${r.status} ${r.dispatchMethod}`):true),[rows,view]);
  const filtered=useMemo(()=>scoped.filter(r=>{
    const q=query.trim().toLowerCase(); const d=dateValue(r.createdAt);
    return (!q||[r.referenceNo,r.subject,r.party,r.department,r.status].some(x=>x.toLowerCase().includes(q))) &&
      (direction==="all"||r.direction.toLowerCase()===direction) && (department==="all"||r.departmentId===department) &&
      (status==="all"||r.status===status) && (priority==="all"||r.priority===priority) &&
      (!dateFrom||!!d&&d>=new Date(`${dateFrom}T00:00:00`)) && (!dateTo||!!d&&d<=new Date(`${dateTo}T23:59:59`));
  }),[scoped,query,direction,department,status,priority,dateFrom,dateTo]);
  const pageCount=Math.max(1,Math.ceil(filtered.length/pageSize));
  const safePage=Math.min(page,pageCount);
  const paged=filtered.slice((safePage-1)*pageSize,safePage*pageSize);

  const stats=useMemo(()=>({
    total:rows.length, incomingToday:rows.filter(r=>r.direction.toLowerCase()==="incoming"&&isToday(r.createdAt)).length,
    outgoingToday:rows.filter(r=>r.direction.toLowerCase()==="outgoing"&&isToday(r.createdAt)).length,
    pendingDispatch:rows.filter(r=>/pending dispatch|awaiting dispatch|ready for dispatch/i.test(r.status)).length,
    awaitingAck:rows.filter(r=>/await.*ack|acknowledg|awaiting collection/i.test(r.status)).length,
    high:rows.filter(r=>/high|urgent/i.test(r.priority)).length,
  }),[rows]);
  const depStats=useMemo(()=>departments.map(d=>({name:d.name,value:rows.filter(r=>r.departmentId===d.id).length})).filter(x=>x.value>0).sort((a,b)=>b.value-a.value),[departments,rows]);
  const statusStats=useMemo(()=>Array.from(new Set(rows.map(r=>r.status))).map(name=>({name,value:rows.filter(r=>r.status===name).length})).filter(x=>x.value>0).sort((a,b)=>b.value-a.value),[rows]);
  const trend=useMemo(()=>{
    const today=new Date(); return Array.from({length:6},(_,idx)=>{ const start=new Date(today); start.setDate(today.getDate()-(5-idx)*7-6); start.setHours(0,0,0,0); const end=new Date(start); end.setDate(start.getDate()+6); end.setHours(23,59,59,999);
      const rs=rows.filter(r=>{const d=dateValue(r.createdAt);return !!d&&d>=start&&d<=end;}); return {label:start.toLocaleDateString(undefined,{day:"2-digit",month:"short"}),incoming:rs.filter(r=>r.direction.toLowerCase()==="incoming").length,outgoing:rs.filter(r=>r.direction.toLowerCase()==="outgoing").length}; });
  },[rows]);
  const maxTrend=Math.max(1,...trend.flatMap(t=>[t.incoming,t.outgoing])); const points=(key:"incoming"|"outgoing")=>trend.map((t,i)=>`${10+i*(180/(trend.length-1))},${90-(t[key]/maxTrend)*75}`).join(" ");
  const donut=(items:{name:string,value:number}[])=>{ const total=items.reduce((a,b)=>a+b.value,0)||1; let at=0; return `conic-gradient(${items.map((x,i)=>{const start=at; at+=x.value/total*360; return `${COLORS[i%COLORS.length]} ${start}deg ${at}deg`;}).join(",")})`; };

  async function saveNew(){
    if(!form.referenceNo.trim()||!form.subject.trim()){setMessage("Reference number and subject are required.");return;}
    setSaving(true); setMessage(null);
    const base:Record<string,unknown>={reference_no:form.referenceNo.trim(),subject:form.subject.trim(),direction:form.direction,priority:form.priority,status:form.status};
    if(form.departmentId)base.department_id=form.departmentId;
    let result=await supabase.from("registry_correspondence").insert({...base,from_to:form.party.trim()||null});
    if(result.error && /column|schema|from_to/i.test(result.error.message)) result=await supabase.from("registry_correspondence").insert(base);
    if(result.error)setMessage(`Unable to create correspondence: ${result.error.message}`); else {setMessage("Correspondence created successfully.");setShowForm(false);setForm({referenceNo:"",subject:"",direction:"Incoming",departmentId:"",priority:"Normal",status:"Received / Logged",party:""});await load();}
    setSaving(false);
  }

  return <main className={styles.page}><div className={styles.shell}>
    <section className={styles.hero}><div><div className={styles.breadcrumb}>Home › Registry › Registry Centre</div><h1 className={styles.title}>Registry Centre</h1><p className={styles.subtitle}>Manage incoming and outgoing correspondence, dispatch tracking and all registry operations.</p></div><div className={styles.actions}><button className={styles.buttonSecondary} onClick={()=>void load()}><RefreshCw size={16}/>Refresh</button><button className={styles.button} onClick={()=>setShowForm(v=>!v)}><FilePlus2 size={16}/>{showForm?"Close Form":"New Correspondence"}</button></div></section>
    {message&&<div className={`${styles.notice} ${/unable|required/i.test(message)?styles.error:styles.success}`}>{message}</div>}
    <nav className={styles.tabs}>{VIEWS.map(v=><button key={v.key} className={`${styles.tab} ${view===v.key?styles.tabActive:""}`} onClick={()=>{setPage(1);router.replace(`/registry?view=${v.key}`);}}>{v.label}</button>)}</nav>
    {showForm&&<section className={styles.form}><div><h2 className={styles.cardTitle}>New Correspondence</h2><p className={styles.cardNote}>Create the core registry record. The live Registry table remains the authoritative source.</p></div><div className={styles.formGrid}>
      <label className={styles.field}><span className={styles.label}>Reference No. *</span><input className={styles.input} value={form.referenceNo} onChange={e=>setForm(f=>({...f,referenceNo:e.target.value}))}/></label>
      <label className={styles.field}><span className={styles.label}>Direction</span><select className={styles.select} value={form.direction} onChange={e=>setForm(f=>({...f,direction:e.target.value}))}><option>Incoming</option><option>Outgoing</option></select></label>
      <label className={styles.field}><span className={styles.label}>Department</span><select className={styles.select} value={form.departmentId} onChange={e=>setForm(f=>({...f,departmentId:e.target.value}))}><option value="">Unassigned</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      <label className={styles.field}><span className={styles.label}>Subject *</span><input className={styles.input} value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))}/></label>
      <label className={styles.field}><span className={styles.label}>From / To</span><input className={styles.input} value={form.party} onChange={e=>setForm(f=>({...f,party:e.target.value}))}/></label>
      <label className={styles.field}><span className={styles.label}>Priority</span><select className={styles.select} value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}><option>Low</option><option>Normal</option><option>Medium</option><option>High</option><option>Urgent</option></select></label>
      <label className={styles.field}><span className={styles.label}>Status</span><select className={styles.select} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}><option>Received / Logged</option><option>In Progress</option><option>Awaiting Dispatch</option><option>Dispatched</option><option>Awaiting Acknowledgement</option><option>Delivered</option><option>Closed / Completed</option></select></label>
    </div><div className={styles.formActions}><button className={styles.buttonSecondary} onClick={()=>setShowForm(false)}>Cancel</button><button className={styles.button} disabled={saving} onClick={()=>void saveNew()}>{saving?"Saving...":"Save Correspondence"}</button></div></section>}
    {view==="overview"&&<>
      <section className={styles.kpis}>{([
        ["Total Correspondence",stats.total,"All registry records",Inbox],["Incoming Today",stats.incomingToday,"Received today",ArrowDownToLine],["Outgoing Today",stats.outgoingToday,"Sent today",ArrowUpFromLine],["Pending Dispatch",stats.pendingDispatch,"Awaiting dispatch",Truck],["Awaiting Acknowledgement",stats.awaitingAck,"Pending response",Send],["High Priority",stats.high,"Requires attention",Flag]
      ] as Array<[string, number, string, LucideIcon]>).map(([label,value,note,Icon])=><div className={styles.kpi} key={label}><span className={styles.kpiIcon}><Icon size={19}/></span><div className={styles.kpiLabel}>{label}</div><div className={styles.kpiValue}>{loading?"—":value.toLocaleString()}</div><div className={styles.kpiNote}>{note}</div></div>)}</section>
      <section className={styles.grid3}><div className={styles.card}><h2 className={styles.cardTitle}>Incoming vs Outgoing Trend</h2><p className={styles.cardNote}>Six-week live correspondence trend.</p>{rows.length?<svg className={styles.chart} viewBox="0 0 200 100" preserveAspectRatio="none"><g stroke="#e6edf5" strokeWidth=".6">{[20,40,60,80].map(y=><line key={y} x1="8" y1={y} x2="194" y2={y}/>)}</g><polyline fill="none" stroke="#1263f3" strokeWidth="2" points={points("incoming")}/><polyline fill="none" stroke="#11a676" strokeWidth="2" points={points("outgoing")}/></svg>:<div className={styles.empty}>No Registry trend data yet.</div>}<div className={styles.legend}><div className={styles.legendRow}><i className={styles.dot} style={{background:"#1263f3"}}/><span>Incoming</span><strong>{trend.reduce((a,b)=>a+b.incoming,0)}</strong></div><div className={styles.legendRow}><i className={styles.dot} style={{background:"#11a676"}}/><span>Outgoing</span><strong>{trend.reduce((a,b)=>a+b.outgoing,0)}</strong></div></div></div>
      <div className={styles.card}><h2 className={styles.cardTitle}>Correspondence by Department</h2><p className={styles.cardNote}>All departments represented from live Registry records.</p>{depStats.length?<div className={styles.donutWrap}><div className={styles.donut} style={{background:donut(depStats)}}/><div className={styles.legend}>{depStats.map((x,i)=><div key={x.name} className={styles.legendRow}><i className={styles.dot} style={{background:COLORS[i%COLORS.length]}}/><span>{x.name}</span><strong>{x.value}</strong></div>)}</div></div>:<div className={styles.empty}>No department correspondence yet.</div>}</div>
      <div className={styles.card}><h2 className={styles.cardTitle}>Correspondence by Status</h2><p className={styles.cardNote}>Current movement status across all records.</p>{statusStats.length?<div className={styles.donutWrap}><div className={styles.donut} style={{background:donut(statusStats)}}/><div className={styles.legend}>{statusStats.map((x,i)=><div key={x.name} className={styles.legendRow}><i className={styles.dot} style={{background:COLORS[i%COLORS.length]}}/><span>{x.name}</span><strong>{x.value}</strong></div>)}</div></div>:<div className={styles.empty}>No status data yet.</div>}</div></section>
    </>}
    <section className={styles.card}><div className={styles.filters}>
      <label className={styles.field}><span className={styles.label}>Search</span><div style={{position:"relative"}}><Search size={15} style={{position:"absolute",left:12,top:14,color:"#70839c"}}/><input className={styles.input} style={{paddingLeft:34}} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Reference no., subject, sender/recipient..."/></div></label>
      <label className={styles.field}><span className={styles.label}>Direction</span><select className={styles.select} value={direction} onChange={e=>setDirection(e.target.value)}><option value="all">All Directions</option><option value="incoming">Incoming</option><option value="outgoing">Outgoing</option></select></label>
      <label className={styles.field}><span className={styles.label}>Department</span><select className={styles.select} value={department} onChange={e=>setDepartment(e.target.value)}><option value="all">All Departments</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      <label className={styles.field}><span className={styles.label}>Status</span><select className={styles.select} value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All Statuses</option>{statuses.map(x=><option key={x}>{x}</option>)}</select></label>
      <label className={styles.field}><span className={styles.label}>Priority</span><select className={styles.select} value={priority} onChange={e=>setPriority(e.target.value)}><option value="all">All Priorities</option>{priorities.map(x=><option key={x}>{x}</option>)}</select></label>
      <label className={styles.field}><span className={styles.label}>Date Range</span><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}><input type="date" className={styles.input} value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/><input type="date" className={styles.input} value={dateTo} onChange={e=>setDateTo(e.target.value)}/></div></label>
    </div></section>
    <section className={styles.tableCard}><div className={styles.tableHeader}><div><h2 className={styles.cardTitle}>{view==="overview"?"Recent Correspondence":VIEWS.find(v=>v.key===view)?.label}</h2><p className={styles.cardNote}>{filtered.length.toLocaleString()} matching record(s)</p></div><span className={styles.badge} style={{background:"#eef5ff",color:"#1459b5"}}>{loading?"Loading...":`${filtered.length} records`}</span></div><div className={styles.tableWrap}>{paged.length?<table><thead><tr><th>Ref. No.</th><th>Date</th><th>Direction</th><th>Subject</th><th>From / To</th><th>Department</th><th>Priority</th><th>Status</th><th>Last Action</th></tr></thead><tbody>{paged.map(r=><tr key={r.id}><td className={styles.ref}>{r.referenceNo}</td><td>{dateText(r.createdAt)}</td><td><span className={styles.badge} style={{background:r.direction.toLowerCase()==="incoming"?"#eef5ff":"#e9fbf3",color:r.direction.toLowerCase()==="incoming"?"#1459b5":"#087247"}}>{r.direction}</span></td><td>{r.subject}</td><td>{r.party}</td><td>{r.department}</td><td><span className={styles.badge} style={priorityTone(r.priority)}>{r.priority}</span></td><td><span className={styles.badge} style={statusTone(r.status)}>{r.status}</span></td><td>{dateText(r.updatedAt)}</td></tr>)}</tbody></table>:<div className={styles.empty}>{loading?"Loading Registry records...":"No correspondence matches this view."}</div>}</div><div className={styles.pager}><span>Showing {paged.length?((safePage-1)*pageSize+1):0}–{Math.min(safePage*pageSize,filtered.length)} of {filtered.length}</span><div className={styles.pageButtons}>{Array.from({length:Math.min(pageCount,7)},(_,i)=>i+1).map(p=><button key={p} onClick={()=>setPage(p)} className={`${styles.pageButton} ${p===safePage?styles.pageButtonActive:""}`}>{p}</button>)}</div></div></section>
  </div></main>;
}
