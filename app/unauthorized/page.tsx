"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function UnauthorizedPage() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from");

  return (
    <main className="min-h-[calc(100vh-72px)] bg-slate-50 px-4 py-12">
      <section className="mx-auto max-w-3xl overflow-hidden rounded-[2.25rem] border border-blue-100 bg-white shadow-xl">
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-950 via-blue-800 to-cyan-700 px-7 py-10 text-white sm:px-10">
          <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3 5 6v5c0 5 3.5 8.5 7 10 3.5-1.5 7-5 7-10V6l-7-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M12 8v5M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h1 className="text-3xl font-black tracking-tight">Access restricted</h1>
            <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-blue-100 sm:text-base">
              Your account is authenticated, but your current role does not permit access to this module.
            </p>
          </div>
        </div>

        <div className="px-7 py-8 sm:px-10">
          {from && (
            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Restricted route: <span className="font-bold text-slate-900">{from}</span>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-blue-700 to-cyan-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5"
            >
              Return to Dashboard
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Go to Welcome Page
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
