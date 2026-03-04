"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient"; // ✅ FIXED PATH

type Dept = { id: string; name: string };
type Subhead = { id: string; code: string | null; name: string };

type Row = {
  dept_name: string;
  subhead_code: string;
  subhead_name: string;
  allocation: number;
  expenditure: number;
  balance: number;
};

function money(n: any) {
  return `₦${Number(n || 0).toLocaleString()}`;
}

export default function FinanceReportPrintPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  // ✅ filters from localStorage (no useSearchParams)
  const [deptId, setDeptId] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const [dept, setDept] = useState<Dept | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const totals = useMemo(() => {
    const allocation = rows.reduce((a, r) => a + Number(r.allocation || 0), 0);
    const expenditure = rows.reduce((a, r) => a + Number(r.expenditure || 0), 0);
    const balance = rows.reduce((a, r) => a + Number(r.balance || 0), 0);
    return { allocation, expenditure, balance };
  }, [rows]);

  useEffect(() => {
    const raw =
      typeof window !== "undefined" ? localStorage.getItem("fin_print_filters") : null;

    if (raw) {
      try {
        const f = JSON.parse(raw);
        setDeptId(f?.deptId || "ALL");
        setDateFrom(f?.dateFrom || "");
        setDateTo(f?.dateTo || "");
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg(null);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }

      try {
        // Dept info (optional)
        if (deptId && deptId !== "ALL") {
          const { data: d, error: dErr } = await supabase
            .from("departments")
            .select("id,name")
            .eq("id", deptId)
            .single();
          if (!dErr) setDept((d as any) || null);
          else setDept(null);
        } else {
          setDept(null);
        }

        // MAIN: snapshot from subheads
        let q = supabase
          .from("subheads")
          .select("id,dept_id,code,name,approved_allocation,expenditure,balance,departments(name)")
          .order("code", { ascending: true });

        if (deptId && deptId !== "ALL") q = (q as any).eq("dept_id", deptId);

        const { data, error } = await q;
        if (error) throw new Error(error.message);

        const list = (data || []).map((x: any) => ({
          dept_name: x?.departments?.name || "—",
          subhead_code: x.code || "—",
          subhead_name: x.name || "",
          allocation: Number(x.approved_allocation || 0),
          expenditure: Number(x.expenditure || 0),
          balance: Number(x.balance || 0),
        })) as Row[];

        setRows(list);
        setLoading(false);
      } catch (e: any) {
        setMsg("❌ Failed to load report: " + (e?.message || "Unknown error"));
        setLoading(false);
      }
    }

    load();
  }, [router, deptId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-4xl py-10 text-slate-600">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .sheet { box-shadow: none !important; border: none !important; margin: 0 !important; }
          @page { size: A4; margin: 10mm; }
        }
        /* ✅ Force 1 page */
        .sheet-inner {
          height: calc(297mm - 20mm);
          overflow: hidden;
        }
        .avoid-break { break-inside: avoid; page-break-inside: avoid; }
      `}</style>

      <div className="mx-auto max-w-4xl">
        <div className="no-print flex items-center justify-between mb-3">
          <button
            onClick={() => router.back()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Back
          </button>

          <button
            onClick={() => window.print()}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Print / Save PDF
          </button>
        </div>

        {msg && (
          <div className="no-print mb-3 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">
            {msg}
          </div>
        )}

        <div className="sheet bg-white border shadow-sm rounded-2xl">
          <div className="sheet-inner px-8 py-6">
            {/* ✅ LOGO CENTER (must be /public/iet-logo.png) */}
            <div className="text-center avoid-break">
              <img
                src="/iet-logo.png"
                alt="IET Logo"
                className="mx-auto h-16 w-16 object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
              <div className="mt-2 text-[15px] font-extrabold tracking-tight">
                ISLAMIC EDUCATION TRUST
              </div>
              <div className="text-[11px] text-slate-700">
                IW2, Ilmi Avenue Intermediate Housing Estate
              </div>
              <div className="text-[11px] text-slate-700">
                PMB 229, Minna, Niger State - Nigeria
              </div>
            </div>

            <div className="mt-4 text-center text-sm font-extrabold tracking-wide avoid-break">
              FINANCE REPORT (PRINT OUT)
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm avoid-break">
              <Box label="Department" value={dept?.name || "All Departments"} />
              <Box
                label="Date Range"
                value={dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : "Current Snapshot"}
              />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 text-sm avoid-break">
              <Box label="Total Allocation" value={money(totals.allocation)} strong />
              <Box label="Total Expenditure" value={money(totals.expenditure)} strong />
              <Box label="Remaining Balance" value={money(totals.balance)} strong />
            </div>

            {/* ✅ NO EXTRA LINES/SPACES, keep tight for 1-page */}
            <div className="mt-4 avoid-break">
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="grid grid-cols-12 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700">
                  <div className="col-span-3">DEPARTMENT</div>
                  <div className="col-span-3">SUBHEAD</div>
                  <div className="col-span-2 text-right">ALLOCATION</div>
                  <div className="col-span-2 text-right">EXPENDITURE</div>
                  <div className="col-span-2 text-right">BALANCE</div>
                </div>

                {rows.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-slate-600">No records.</div>
                ) : (
                  rows.slice(0, 12).map((r, idx) => (
                    <div key={idx} className="grid grid-cols-12 px-4 py-2 text-xs border-t">
                      <div className="col-span-3 text-slate-800">{r.dept_name}</div>
                      <div className="col-span-3 text-slate-800">
                        {r.subhead_code} — {r.subhead_name}
                      </div>
                      <div className="col-span-2 text-right">{money(r.allocation)}</div>
                      <div className="col-span-2 text-right">{money(r.expenditure)}</div>
                      <div className="col-span-2 text-right">{money(r.balance)}</div>
                    </div>
                  ))
                )}
              </div>

              {rows.length > 12 && (
                <div className="mt-2 text-[11px] text-slate-500 italic">
                  Showing first 12 rows to keep A4 one-page. Use CSV export for full list.
                </div>
              )}
            </div>

            <div className="mt-4 text-center text-xs text-slate-500 italic avoid-break">
              Building Bridges
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Box({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className={`mt-1 text-sm ${strong ? "font-extrabold" : "font-semibold"} text-slate-900`}>
        {value}
      </div>
    </div>
  );
}