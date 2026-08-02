export default function StaffLoading() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="h-64 animate-pulse rounded-[2rem] bg-slate-300" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-slate-200" />)}</div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />)}</div>
      </div>
    </main>
  );
}
