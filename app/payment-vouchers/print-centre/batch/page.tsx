"use client";

import { logPrint } from "@/lib/v4/reports";
import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { printA4Sheet } from "@/lib/printA4";
import { VoucherPrintView } from "@/app/payment-vouchers/[id]/print/VoucherPrintView";

export default function BatchPrintPage() {
  return <Suspense fallback={null}><BatchPrint /></Suspense>;
}

/** Print Centre › several fully signed vouchers together, one A4 page each. */
function BatchPrint() {
  const params = useSearchParams();
  const ids = (params.get("ids") || "").split(",").map((s) => s.trim()).filter((s) => /^[0-9a-f-]{36}$/i.test(s)).slice(0, 30);
  const box = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  async function printAll() {
    setBusy(true);
    const pages = Array.from(box.current?.querySelectorAll<HTMLElement>("[data-pv-sheet]") || []);
    await Promise.all(Array.from(box.current?.querySelectorAll<HTMLElement>("article[data-pv-no]") || []).map((a) => logPrint("voucher", a.dataset.pvId || null, a.dataset.pvNo || "")));
    await printA4Sheet(pages, `${ids.length} payment vouchers — ReqGen`);
    setBusy(false);
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-4">
      <div className="mx-auto w-full max-w-4xl">
        <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2">
          <Link href="/payment-vouchers/print-centre" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100">Back to Print Centre</Link>
          <button type="button" onClick={() => void printAll()} disabled={busy || !ids.length} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {busy ? "Preparing print…" : `Print ${ids.length} voucher${ids.length === 1 ? "" : "s"}`}
          </button>
        </div>
        <div className="no-print mb-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900">
          Each voucher prints on its own A4 page. A combined transfer adds its Transfer Schedule page. Only authorised or paid vouchers are printed.
        </div>
        <div ref={box} className="rg-a4-stage" style={{ display: "grid", gap: 16 }}>
          {ids.map((id) => <VoucherPrintView key={id} voucherId={id} embedded />)}
        </div>
      </div>
    </main>
  );
}
