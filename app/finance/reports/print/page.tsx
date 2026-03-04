"use client";

import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PrintInner() {
  const router = useRouter();
  const sp = useSearchParams();

  // Example expected params:
  // ?from=2026-01-01&to=2026-01-31&dept=all&subhead=all
  const from = sp.get("from") || "";
  const to = sp.get("to") || "";
  const dept = sp.get("dept") || "all";
  const subhead = sp.get("subhead") || "all";

  const title = useMemo(() => {
    const a = from ? from : "—";
    const b = to ? to : "—";
    return `Finance Report (${a} to ${b})`;
  }, [from, to]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .sheet { box-shadow: none !important; border: none !important; margin: 0 !important; }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>

      <div className="mx-auto max-w-4xl">
        <div className="no-print flex items-center justify-between mb-4">
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
            Print
          </button>
        </div>

        <div className="sheet bg-white border shadow-sm rounded-2xl px-8 py-8">
          <div className="flex items-center gap-4">
            <img
              src="/iet-logo.png"
              alt="IET Logo"
              className="h-14 w-14 object-contain"
            />
            <div className="flex-1 text-center">
              <div className="text-lg font-extrabold tracking-tight">
                ISLAMIC EDUCATION TRUST
              </div>
              <div className="text-xs text-slate-700">
                IW2, Ilmi Avenue Intermediate Housing Estate
              </div>
              <div className="text-xs text-slate-700">
                PMB 229, Minna, Niger State - Nigeria
              </div>
            </div>
            <div className="w-14" />
          </div>

          <div className="mt-6">
            <div className="text-sm font-extrabold text-slate-900">{title}</div>
            <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-slate-700">
              <div><b>From:</b> {from || "—"}</div>
              <div><b>To:</b> {to || "—"}</div>
              <div><b>Department:</b> {dept}</div>
              <div><b>Subhead:</b> {subhead}</div>
            </div>
          </div>

          {/* Replace this block with your computed report table */}
          <div className="mt-6 rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
            This page is now build-safe ✅ and will print correctly.
            <br />
            Next step: we plug in the report data table here.
          </div>

          <div className="mt-8 text-center text-xs text-slate-500 italic">
            Building Bridges
          </div>
        </div>
      </div>
    </main>
  );
}

export default function PrintFinanceReportPage() {
  // ✅ This Suspense boundary fixes the build error
  return (
    <Suspense fallback={<div className="min-h-screen p-10 text-slate-600">Loading...</div>}>
      <PrintInner />
    </Suspense>
  );
}