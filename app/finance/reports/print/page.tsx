// app/finance/reports/print/page.tsx
export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabaseClient";

function naira(n: number) {
  return "₦" + Math.round(n).toLocaleString();
}

export default async function FinanceReportPrintPage({
  searchParams,
}: {
  searchParams: { year?: string; dept?: string; from?: string; to?: string };
}) {
  const year = Number(searchParams.year || new Date().getFullYear());
  const dept = searchParams.dept || "ALL";
  const from = searchParams.from || `${year}-01-01`;
  const to = searchParams.to || `${year}-12-31`;

  // NOTE: supabase client-side auth isn't available here (server component).
  // So keep print as simple "visual print" from client page OR move to client component.
  // For now, we render a safe static print layout only.
  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
        }
      `}</style>

      <h1 style={{ margin: 0 }}>IET Finance Report</h1>
      <div style={{ marginTop: 8, color: "#444" }}>
        Year: <b>{year}</b> • Dept: <b>{dept}</b> • Range: <b>{from}</b> → <b>{to}</b>
      </div>

      <div style={{ marginTop: 20, padding: 12, border: "1px solid #ddd" }}>
        This print page is now build-safe on Vercel.
        <br />
        Next step: we’ll render the report data here from a server-safe endpoint (API route)
        or from client page and pass it in.
      </div>

      <div style={{ marginTop: 24 }}>
        <button onClick={() => window.print()}>Print / Save as PDF</button>
      </div>
    </main>
  );
}