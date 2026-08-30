import { redirect } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default async function DiagnosticsPage() {
  if (process.env.NODE_ENV === "production") {
    redirect("/admin/system-health");
  }

  const { data, error } = await supabase
    .from("departments")
    .select("name,is_active")
    .order("name", { ascending: true });

  return (
    <main className="mx-auto max-w-4xl space-y-4 py-8">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
        Development diagnostic only. This route is redirected to System Health in production.
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-black text-slate-950">Department Diagnostics</h1>
        {error ? <pre className="mt-4 overflow-auto rounded-xl bg-red-50 p-4 text-xs text-red-800">{JSON.stringify(error, null, 2)}</pre> : (
          <div className="mt-4 grid gap-2">
            {(data || []).map((department) => (
              <div key={department.name} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                <strong>{department.name}</strong>
                <span className={department.is_active ? "text-emerald-700" : "text-slate-500"}>{department.is_active ? "Active" : "Inactive"}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
