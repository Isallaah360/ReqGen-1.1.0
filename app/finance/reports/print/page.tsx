"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

type Dept = { id: string; name: string };
type Subhead = {
  id: string;
  dept_id: string;
  code: string | null;
  name: string;
  approved_allocation: number | null;
  expenditure: number | null;
  balance: number | null;
};

type ReqMini = { id: string; amount: number | null; status: string | null; created_at: string };

function naira(n: number) {
  return "₦ " + Math.round(n).toLocaleString();
}

function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function FinanceReportsPrintPage() {
  const sp = useSearchParams();
  const year = Number(sp.get("year") || new Date().getFullYear());
  const dept = sp.get("dept") || "ALL";
  const from = sp.get("from") || `${year}-01-01`;
  const to = sp.get("to") || `${year}-12-31`;

  const [loading, setLoading] = useState(true);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [subs, setSubs] = useState<Subhead[]>([]);
  const [approvedReqs, setApprovedReqs] = useState<ReqMini[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: drows } = await supabase.from("departments").select("id,name");
      setDepts((drows || []) as Dept[]);

      const { data: srows } = await supabase
        .from("subheads")
        .select("id,dept_id,code,name,approved_allocation,expenditure,balance");
      setSubs((srows || []) as Subhead[]);

      const toPlusOne = ymd(new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000));

      let q = supabase
        .from("requests")
        .select("id,amount,status,created_at")
        .ilike("status", "%approve%")
        .gte("created_at", from)
        .lt("created_at", toPlusOne);

      if (dept !== "ALL") q = (q as any).eq("dept_id", dept);

      const { data: rrows } = await q;
      setApprovedReqs((rrows || []) as ReqMini[]);

      setLoading(false);

      setTimeout(() => window.print(), 700);
    }

    load();
  }, [dept, from, to]);

  const deptMap = useMemo(() => {
    const m: Record<string, string> = {};
    depts.forEach((d) => (m[d.id] = d.name));
    return m;
  }, [depts]);

  const filteredSubs = useMemo(() => {
    if (dept === "ALL") return subs;
    return subs.filter((s) => s.dept_id === dept);
  }, [subs, dept]);

  const annualBudget = useMemo(
    () => filteredSubs.reduce((a, s) => a + Number(s.approved_allocation || 0), 0),
    [filteredSubs]
  );

  const totalExp = useMemo(
    () => filteredSubs.reduce((a, s) => a + Number(s.expenditure || 0), 0),
    [filteredSubs]
  );

  const remaining = useMemo(
    () => filteredSubs.reduce((a, s) => a + Number(s.balance || 0), 0),
    [filteredSubs]
  );

  const monthly = useMemo(() => {
    const arr = Array.from({ length: 12 }, (_, i) => ({ m: i, total: 0 }));
    approvedReqs.forEach((r) => {
      const dt = new Date(r.created_at);
      arr[dt.getMonth()].total += Number(r.amount || 0);
    });
    return arr;
  }, [approvedReqs]);

  if (loading) return <div className="p-10">Preparing report...</div>;

  return (
    <main className="bg-white text-black">
      <div className="mx-auto w-[900px] p-8 text-[12px] leading-tight">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-3">
            <img src="/iet-logo.png" className="h-12" />
            <div>
              <div className="font-extrabold text-lg">IET Finance Reports</div>
              <div className="text-xs text-gray-700">
                Government-style budget & expenditure summary
              </div>
            </div>
          </div>
          <div className="text-right text-xs">
            <div><b>Department:</b> {dept === "ALL" ? "All" : (deptMap[dept] || dept)}</div>
            <div><b>Range:</b> {from} → {to}</div>
            <div><b>Year:</b> {year}</div>
          </div>
        </div>

        {/* KPI */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Kpi title="Annual Budget" value={naira(annualBudget)} />
          <Kpi title="Total Expenditure" value={naira(totalExp)} />
          <Kpi title="Remaining Balance" value={naira(remaining)} />
        </div>

        {/* Monthly summary (compact for 1-page) */}
        <div className="mt-5">
          <div className="font-bold">Monthly Expenditure (Approved)</div>
          <table className="mt-2 w-full border text-xs">
            <thead className="bg-gray-100">
              <tr>
                {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m) => (
                  <th key={m} className="border p-1">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {monthly.map((x) => (
                  <td key={x.m} className="border p-1 text-right">{naira(x.total)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Subheads detail (compact) */}
        <div className="mt-5">
          <div className="font-bold">Subhead Breakdown</div>
          <table className="mt-2 w-full border text-xs">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2 text-left">Department</th>
                <th className="border p-2 text-left">Code</th>
                <th className="border p-2 text-left">Subhead</th>
                <th className="border p-2 text-right">Allocation</th>
                <th className="border p-2 text-right">Expenditure</th>
                <th className="border p-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubs
                .slice()
                .sort((a, b) => Number(b.expenditure || 0) - Number(a.expenditure || 0))
                .slice(0, 35) // keep 1-page
                .map((s) => (
                  <tr key={s.id}>
                    <td className="border p-2">{deptMap[s.dept_id] || s.dept_id}</td>
                    <td className="border p-2">{s.code || "—"}</td>
                    <td className="border p-2">{s.name}</td>
                    <td className="border p-2 text-right">{naira(Number(s.approved_allocation || 0))}</td>
                    <td className="border p-2 text-right">{naira(Number(s.expenditure || 0))}</td>
                    <td className="border p-2 text-right">{naira(Number(s.balance || 0))}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <div className="mt-2 text-[10px] text-gray-600">
            Note: Printed report shows top 35 subheads to keep a single page. Use CSV export for full list.
          </div>
        </div>

        <div className="mt-6 text-center text-[10px] text-gray-600">
          Islamic Education Trust — Finance Report • Generated by ReqGen
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body { margin: 0; }
          table { page-break-inside: avoid; }
        }
      `}</style>
    </main>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="border rounded-lg p-3">
      <div className="text-xs text-gray-700 font-semibold">{title}</div>
      <div className="text-lg font-extrabold">{value}</div>
      <div className="text-[10px] text-gray-600">NGN</div>
    </div>
  );
}