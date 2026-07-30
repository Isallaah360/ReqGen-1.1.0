"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function UnauthorizedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const requestedPath =
    searchParams.get("from") ||
    searchParams.get("path") ||
    "the requested page";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto flex min-h-[75vh] max-w-3xl items-center justify-center">
        <section className="w-full overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl">
          <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 px-6 py-10 text-center text-white sm:px-10">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-8 w-8"
                aria-hidden="true"
              >
                <path d="M12 3 4.5 6v5.2c0 4.8 3 8.1 7.5 9.8 4.5-1.7 7.5-5 7.5-9.8V6L12 3Z" />
                <path d="m9.5 12 1.7 1.7 3.7-4" />
              </svg>
            </div>

            <p className="text-sm font-medium uppercase tracking-[0.25em] text-cyan-200">
              ReqGen Access Control
            </p>

            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
              Access Restricted
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-blue-100 sm:text-base">
              Your account does not currently have permission to access{" "}
              <span className="font-semibold text-white">{requestedPath}</span>.
            </p>
          </div>

          <div className="space-y-6 px-6 py-8 sm:px-10">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="font-semibold text-amber-950">
                Permission required
              </h2>

              <p className="mt-2 text-sm leading-6 text-amber-800">
                Return to your dashboard or contact the system administrator if
                you believe your assigned role should permit access.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="reqgen-btn reqgen-btn-slate inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-200"
              >
                Return to Dashboard
              </button>

              <button
                type="button"
                onClick={() => router.back()}
                className="reqgen-btn reqgen-btn-slate inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-slate-200"
              >
                Go Back
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function UnauthorizedLoading() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto flex min-h-[75vh] max-w-3xl items-center justify-center">
        <div className="w-full animate-pulse overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl">
          <div className="h-72 bg-gradient-to-br from-slate-900 via-blue-950 to-blue-800 opacity-80 blur-[1px]" />

          <div className="space-y-4 p-8">
            <div className="h-20 rounded-2xl bg-slate-200" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-12 rounded-xl bg-slate-200" />
              <div className="h-12 rounded-xl bg-slate-200" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function UnauthorizedPage() {
  return (
    <Suspense fallback={<UnauthorizedLoading />}>
      <UnauthorizedContent />
    </Suspense>
  );
}