"use client";

export default function StaffError({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <div className="max-w-lg rounded-[2rem] border border-rose-200 bg-white p-8 text-center shadow-xl">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-600">Staff Workspace Error</p>
        <h1 className="mt-3 text-2xl font-black text-slate-950">The workspace could not be loaded.</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">Your session remains protected. Retry the page, and contact the administrator if the problem continues.</p>
        <button onClick={reset} className="mt-6 rounded-xl bg-gradient-to-r from-blue-800 to-cyan-600 px-5 py-3 text-sm font-black text-white shadow-md">Try Again</button>
      </div>
    </main>
  );
}
