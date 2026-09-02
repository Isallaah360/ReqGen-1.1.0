"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Printer, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentAuthContext } from "@/lib/auth";
import { hasAnyRole, REPORT_ACCESS_ROLES } from "@/lib/roles";
import { AnyRow, Department, canonicalBalance, daysOld, downloadCsv, isOpenVoucher, isRequestCompleted, isRequestRejected, money, numberValue, outflowValue, text, yearOf } from "@/app/components/reports/section7Data";
import styles from "../reports.module.css";

type Data = { requests: AnyRow[]; departments: Department[]; subheads: AnyRow[]; transactions: AnyRow[]; vouchers: AnyRow[]; accounts: AnyRow[]; registry: AnyRow[] };
const EMPTY: Data = { requests: [], departments: [], subheads: [], transactions: [], vouchers: [], accounts: [], registry: [] };

function Question({ no, q, value, note }: { no:number; q:string; value:string; note:string }) { return <article className={styles.question}><div className={styles.questionNo}>{no}</div><div className={styles.questionText}>{q}</div><div className={styles.questionValue}>{value}</div><div className={styles.questionNote}>{note}</div></article>; }

export default function ExecutiveAnalyticsPage() {
  const router = useRouter(); const currentYear = new Date().getFullYear();
  const [data, setData] = useState<Data>(EMPTY); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [issue, setIssue] = useState<string | null>(null); const [year, setYear] = useState(currentYear); const [compareYear, setCompareYear] = useState(currentYear - 1);
  const load = useCallback(async (silent=false) => {
    silent ? setRefreshing(true) : setLoading(true); setIssue(null);
    try {
      const auth = await getCurrentAuthContext(); if (!auth) { router.replace("/login?next=%2Freports%2Fenterprise-analytics"); return; }
      if (!hasAnyRole(auth.roleSet, [...REPORT_ACCESS_ROLES])) { router.replace("/unauthorized?from=%2Freports%2Fenterprise-analytics"); return; }
      const [rq, dp, sh, tx, pv, ac, rg] = await Promise.all([
        supabase.from("requests").select("*").order("created_at",{ascending:false}).limit(5000), supabase.from("departments").select("id,name").order("name").limit(1000),
        supabase.from("subheads").select("*").order("code").limit(5000), supabase.from("finance_transactions").select("*").order("transaction_date",{ascending:false}).limit(5000),
        supabase.from("payment_vouchers").select("*").order("created_at",{ascending:false}).limit(5000), supabase.from("iet_accounts").select("*").order("name").limit(1000),
        supabase.from("registry_correspondence").select("*").order("created_at",{ascending:false}).limit(5000),
      ]);
      const errors=[rq.error,dp.error,sh.error,tx.error,pv.error,ac.error,rg.error].filter(Boolean).map(e=>e?.message).filter(Boolean);
      setData({requests:(rq.data||[]) as AnyRow[],departments:(dp.data||[]) as Department[],subheads:(sh.data||[]) as AnyRow[],transactions:(tx.data||[]) as AnyRow[],vouchers:(pv.data||[]) as AnyRow[],accounts:(ac.data||[]) as AnyRow[],registry:(rg.data||[]) as AnyRow[]});
      if(errors.length)setIssue(`Some authorised analytics sources could not be loaded: ${errors.join(" | ")}`);
    } finally { setLoading(false); setRefreshing(false); }
  },[router]); useEffect(()=>{queueMicrotask(()=>{void load();});},[load]);

  const years=useMemo(()=>{const ys=new Set<number>([currentYear,currentYear-1]); data.transactions.forEach(r=>{const y=yearOf(r);if(y)ys.add(y)}); data.requests.forEach(r=>{const y=yearOf(r);if(y)ys.add(y)}); data.vouchers.forEach(r=>{const y=yearOf(r);if(y)ys.add(y)}); return Array.from(ys).sort((a,b)=>b-a);},[data,currentYear]);
  const deptName=useMemo(()=>new Map(data.departments.map(d=>[d.id,d.name])),[data.departments]);
  const allocation=data.subheads.reduce((s,r)=>s+numberValue(r.approved_allocation),0), reserved=data.subheads.reduce((s,r)=>s+numberValue(r.reserved_amount),0), expenditure=data.subheads.reduce((s,r)=>s+numberValue(r.expenditure),0), available=data.subheads.reduce((s,r)=>s+canonicalBalance(r),0);
  const utilisation=allocation>0?expenditure/allocation*100:0;
  const currentTx=data.transactions.filter(r=>yearOf(r)===year); const compareTx=data.transactions.filter(r=>yearOf(r)===compareYear); const ytdSpend=currentTx.reduce((s,r)=>s+outflowValue(r),0); const compareSpend=compareTx.reduce((s,r)=>s+outflowValue(r),0); const trendPct=compareSpend>0?(ytdSpend-compareSpend)/compareSpend*100:null;
  const deptSpend=useMemo(()=>data.departments.map(d=>{const sub=data.subheads.filter(s=>text(s.dept_id)===d.id);return{name:d.name,allocation:sub.reduce((a,r)=>a+numberValue(r.approved_allocation),0),spend:sub.reduce((a,r)=>a+numberValue(r.expenditure),0)}}).sort((a,b)=>b.spend-a.spend),[data.departments,data.subheads]);
  const topDept=deptSpend[0]??{name:"No data",allocation:0,spend:0}; const maxDept=Math.max(1,...deptSpend.map(d=>d.spend));
  const risks: Array<AnyRow & { util: number }> = data.subheads.map((r): AnyRow & { util: number } => ({...r, util:numberValue(r.approved_allocation)>0?numberValue(r.expenditure)/numberValue(r.approved_allocation)*100:0})).filter(r=>r.util>=85).sort((a,b)=>b.util-a.util);
  const pending=data.requests.filter(r=>!isRequestCompleted(r)&&!isRequestRejected(r)); const ageing=pending.filter(r=>(daysOld(r.created_at)??0)>7); const openPvs=data.vouchers.filter(isOpenVoucher); const oldPvs=openPvs.filter(r=>(daysOld(r.created_at)??0)>7); const overdueRegistry=data.registry.filter(r=>/dispatch|await|pending/i.test(text(r.status))&&(daysOld(r.updated_at??r.created_at)??0)>3);
  const cash=data.accounts.filter(r=>r.is_active!==false).reduce((s,r)=>s+numberValue(r.available_balance),0);
  const avgApprovalDays=(()=>{const completed=data.requests.filter(isRequestCompleted).map(r=>daysOld(r.created_at)).filter((x):x is number=>x!==null);return completed.length?completed.reduce((a,b)=>a+b,0)/completed.length:null;})();
  const alerts=[{text:`${risks.filter(r=>r.util>=95).length} subheads ≥95% utilisation`,critical:true},{text:`${deptSpend.filter(d=>d.allocation>0&&d.spend/d.allocation>=.85).length} departments ≥85% budget`,critical:false},{text:`${ageing.length} pending requests >7 days`,critical:false},{text:`${oldPvs.length} payment vouchers >7 days`,critical:true},{text:`${overdueRegistry.length} registry items overdue dispatch`,critical:false}];
  const monthly=Array.from({length:12},(_,m)=>({month:new Date(year,m,1).toLocaleString("en",{month:"short"}),value:currentTx.filter(r=>{const d=new Date(String(r.transaction_date??r.created_at));return !Number.isNaN(d.getTime())&&d.getMonth()===m;}).reduce((s,r)=>s+outflowValue(r),0)})); const maxMonth=Math.max(1,...monthly.map(m=>m.value));

  function exportAnalytics(){downloadCsv(`reqgen-executive-analytics-${year}.csv`,[["Metric","Value"],["Approved Allocation",allocation],["Reserved",reserved],["Expenditure",expenditure],["Available Balance",available],["YTD Transaction Outflow",ytdSpend],["Cash Position",cash],["Pending Requests >7 Days",ageing.length],["PV >7 Days",oldPvs.length],["Registry Dispatch Exceptions",overdueRegistry.length],...deptSpend.map(d=>[`Department: ${d.name}`,d.spend])]);}
  if(loading)return <div className={styles.page}><div className={styles.loading}>Loading authorised executive analytics…</div></div>;
  return <main className={styles.page}>
    <header className={styles.head}><div><div className={styles.eyebrow}>Reports</div><h1 className={styles.title}>Executive Analytics</h1><p className={styles.subtitle}>Strategic analytics for Admin and Auditor decision-support reporting. DG has no system access; authorised reports may be printed for management.</p></div><div className={styles.actions}><select className={styles.select} value={year} onChange={e=>setYear(Number(e.target.value))}>{years.map(y=><option key={y} value={y}>FY {y}</option>)}</select><select className={styles.select} value={compareYear} onChange={e=>setCompareYear(Number(e.target.value))}>{years.filter(y=>y!==year).map(y=><option key={y} value={y}>Compare FY {y}</option>)}</select><button className={styles.button} onClick={()=>void load(true)}><RefreshCw size={14}/>{refreshing?"Refreshing…":"Refresh"}</button><button className={styles.button} onClick={exportAnalytics}><Download size={14}/>Export</button><button className={styles.primary} onClick={()=>window.print()}><Printer size={14}/>Print / PDF</button></div></header>
    {issue?<div className={`${styles.notice} ${styles.error}`}>{issue}</div>:null}
    <section className={styles.questionGrid}>
      <Question no={1} q="Are we spending within approved budget?" value={`${utilisation.toFixed(1)}%`} note={`${money(expenditure)} of ${money(allocation)}`}/>
      <Question no={2} q="Which department is spending the most?" value={topDept.name} note={`${money(topDept.spend)} spent`}/>
      <Question no={3} q="Which subheads are under greatest pressure?" value={`${risks.length} Subheads`} note="At or above 85% utilisation"/>
      <Question no={4} q="How is expenditure trending over time?" value={money(ytdSpend)} note={trendPct===null?`No comparable FY ${compareYear} outflow data`:`${trendPct>=0?"+":""}${trendPct.toFixed(1)}% vs FY ${compareYear}`}/>
      <Question no={5} q="Where are requests & approvals slowing down?" value={avgApprovalDays===null?"No data":`${avgApprovalDays.toFixed(1)} Days`} note={`${ageing.length} open requests older than 7 days`}/>
      <Question no={6} q="What are our current bank account positions?" value={money(cash)} note={`${data.accounts.filter(r=>r.is_active!==false).length} active IET accounts`}/>
      <Question no={7} q="What exceptions need management action?" value={String(alerts.reduce((s,a)=>s+Number(a.text.split(" ")[0]||0),0))} note="Operational exception indicators"/>
    </section>
    <section className={styles.analyticsGrid}>
      <article className={styles.card}><h2 className={styles.cardTitle}>Expenditure Trend · FY {year}</h2><div className={styles.bars}>{monthly.map(m=><div className={styles.barRow} key={m.month}><span className={styles.barLabel}>{m.month}</span><div className={styles.barTrack}><i className={styles.barFill} style={{width:`${m.value/maxMonth*100}%`}}/></div><strong className={styles.barValue}>{money(m.value)}</strong></div>)}</div><div className={styles.notice} style={{marginTop:12,marginBottom:0}}>Trend uses actual classified outflows from <strong>finance_transactions</strong>. No synthetic months are drawn.</div></article>
      <article className={styles.card}><h2 className={styles.cardTitle}>Expenditure by Department</h2><div className={styles.bars}>{deptSpend.map(d=><div className={styles.barRow} key={d.name}><span className={styles.barLabel}>{d.name}</span><div className={styles.barTrack}><i className={styles.barFill} style={{width:`${d.spend/maxDept*100}%`}}/></div><strong className={styles.barValue}>{money(d.spend)}</strong></div>)}</div>{!deptSpend.length?<div className={styles.empty}>No departments are available.</div>:null}</article>
      <article className={styles.card}><h2 className={styles.cardTitle}>Subheads at Risk · ≥85% Utilisation</h2><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Subhead</th><th>Department</th><th>Approved</th><th>Expenditure</th><th>Available</th><th>Utilisation</th></tr></thead><tbody>{risks.length?risks.map(r=><tr key={text(r.id)}><td className={styles.strong}>{text(r.code)} · {text(r.name)}</td><td>{deptName.get(text(r.dept_id))||"—"}</td><td>{money(r.approved_allocation)}</td><td>{money(r.expenditure)}</td><td>{money(canonicalBalance(r))}</td><td className={r.util>=95?styles.risk:styles.warning}>{r.util.toFixed(1)}%</td></tr>):<tr><td colSpan={6} className={styles.empty}>No subheads are at or above the 85% threshold.</td></tr>}</tbody></table></div></article>
    </section>
    <article className={styles.card}><h2 className={styles.cardTitle}>Exception Alerts</h2><div className={styles.alerts}>{alerts.map((a,i)=><span key={i} className={`${styles.alert} ${a.critical?styles.alertCritical:""}`}>{a.text}</span>)}</div><div className={styles.summaryRow}><span>Approved Allocation</span><strong>{money(allocation)}</strong></div><div className={styles.summaryRow}><span>Reserved</span><strong>{money(reserved)}</strong></div><div className={styles.summaryRow}><span>Recognised Expenditure</span><strong>{money(expenditure)}</strong></div><div className={styles.summaryRow}><span>Available Balance</span><strong>{money(available)}</strong></div></article>
  </main>;
}
