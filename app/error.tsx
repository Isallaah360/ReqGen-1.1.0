"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("ReqGen application error:", error); }, [error]);
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4"><section className="w-full max-w-xl rounded-[2rem] border border-rose-200 bg-white p-8 text-center shadow-2xl"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-3xl">!</div><h1 className="mt-5 text-2xl font-black text-slate-950">ReqGen encountered an unexpected error</h1><p className="mt-3 text-sm font-semibold leading-6 text-slate-600">The error has been isolated from the rest of the application. Try the operation again or return to the dashboard.</p><div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center"><button type="button" onClick={reset} className="rounded-xl bg-blue-700 px-5 py-3 font-black text-white shadow-md hover:bg-blue-800">Try Again</button><a href="/dashboard" className="rounded-xl bg-slate-700 px-5 py-3 font-black text-white shadow-md hover:bg-slate-800">Return to Dashboard</a></div>{error.digest ? <p className="mt-5 text-xs font-bold text-slate-400">Reference: {error.digest}</p> : null}</section></main>;
}
