export default function FinanceLoading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="animate-pulse space-y-6">
        <div className="h-32 rounded-3xl bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-36 rounded-3xl bg-slate-200" />
          ))}
        </div>
        <div className="h-96 rounded-3xl bg-slate-200" />
      </div>
    </main>
  );
}
