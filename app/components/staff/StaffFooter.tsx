"use client";

import { useEffect, useState } from "react";

function formatNow(date: Date) {
  return {
    date: date.toLocaleDateString("en-NG", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("en-NG", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }),
  };
}

export default function StaffFooter() {
  const [now, setNow] = useState(() => formatNow(new Date()));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(formatNow(new Date())), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <footer className="mt-8 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white/90 shadow-sm backdrop-blur">
      <div className="grid gap-5 px-5 py-6 md:grid-cols-[1fr_auto_1fr] md:items-center md:px-7">
        <div className="flex items-center gap-3">
          <img src="/iet-logo.png" alt="Islamic Education Trust logo" className="h-14 w-14 rounded-xl bg-white object-contain p-1 shadow-sm" />
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Islamic Education Trust</p>
            <p className="mt-1 text-sm font-bold text-slate-600">ReqGen Staff Workspace</p>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-3 text-center">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">{now.date}</p>
          <p className="mt-1 text-xl font-black text-slate-950">{now.time}</p>
        </div>

        <div className="flex items-center gap-3 md:justify-end">
          <img src="/be-logo.png" alt="Barderian Enterprises logo" className="h-12 w-auto max-w-[96px] object-contain" />
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Developed by</p>
            <p className="font-black text-slate-950">Barderian Enterprises</p>
            <p className="text-xs font-semibold text-slate-500">Secure • Reliable • Accountable</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-950 px-5 py-3 text-center text-xs font-bold text-slate-200 sm:flex-row sm:items-center sm:justify-between sm:text-left md:px-7">
        <span>© {new Date().getFullYear()} Islamic Education Trust</span>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:justify-end">
          <a href="https://barderians.com.ng" target="_blank" rel="noreferrer" className="transition hover:text-cyan-300">barderians.com.ng</a>
          <a href="mailto:info@barderians.com.ng" className="transition hover:text-cyan-300">info@barderians.com.ng</a>
        </div>
      </div>
    </footer>
  );
}
