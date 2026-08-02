"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import HRNavigation from "./HRNavigation";

export type Tone = "blue" | "cyan" | "emerald" | "violet" | "amber" | "rose" | "slate";

const toneMap: Record<Tone, string> = {
  blue: "from-blue-600 to-indigo-700",
  cyan: "from-cyan-500 to-blue-700",
  emerald: "from-emerald-500 to-teal-700",
  violet: "from-violet-600 to-fuchsia-700",
  amber: "from-amber-500 to-orange-600",
  rose: "from-rose-500 to-red-700",
  slate: "from-slate-700 to-slate-950",
};

export function StrategicHero({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-800 p-7 text-white shadow-2xl lg:p-9">
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-300/15 blur-3xl" />
      <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight lg:text-5xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-blue-100 lg:text-base">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </section>
  );
}

export function StrategicShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">{children}</div>
    </main>
  );
}

export function StrategicNavigation() {
  const pathname = usePathname();
  if (pathname.startsWith("/hr/registrar")) return null;
  return <HRNavigation />;
}

export function StatCard({ label, value, note, tone = "blue" }: { label: string; value: string | number; note: string; tone?: Tone }) {
  return (
    <article className={`rounded-3xl bg-gradient-to-br ${toneMap[tone]} p-5 text-white shadow-lg`}>
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/75">{label}</p>
      <p className="mt-3 text-3xl font-black">{value}</p>
      <p className="mt-2 text-xs font-semibold text-white/75">{note}</p>
    </article>
  );
}

export function SectionCard({ title, eyebrow, action, children }: { title: string; eyebrow?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {eyebrow ? <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">{eyebrow}</p> : null}
          <h2 className="mt-1 text-2xl font-black text-slate-950">{title}</h2>
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function PrimaryButton({ children, onClick, disabled = false, tone = "blue", type = "button" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; tone?: Tone; type?: "button" | "submit" }) {
  const buttonTone: Record<Tone, string> = {
    blue: "bg-blue-700 hover:bg-blue-800 focus:ring-blue-200",
    cyan: "bg-cyan-600 hover:bg-cyan-700 focus:ring-cyan-200",
    emerald: "bg-emerald-700 hover:bg-emerald-800 focus:ring-emerald-200",
    violet: "bg-violet-700 hover:bg-violet-800 focus:ring-violet-200",
    amber: "bg-orange-600 hover:bg-orange-700 focus:ring-orange-200",
    rose: "bg-rose-700 hover:bg-rose-800 focus:ring-rose-200",
    slate: "bg-slate-800 hover:bg-slate-900 focus:ring-slate-200",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${buttonTone[tone]}`}
    >
      {children}
    </button>
  );
}

export function TextInput({ label, value, onChange, type = "text", placeholder, required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-800">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}

export function SelectInput({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-800">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
      <p className="font-black text-slate-900">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm font-semibold text-slate-500">{description}</p>
    </div>
  );
}

export function StatusBadge({ value }: { value: string | null | undefined }) {
  const key = (value || "draft").toLowerCase();
  const style = key.includes("complete") || key.includes("approved") || key.includes("active")
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : key.includes("reject") || key.includes("cancel") || key.includes("closed")
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : key.includes("progress") || key.includes("review")
        ? "border-blue-200 bg-blue-50 text-blue-800"
        : "border-amber-200 bg-amber-50 text-amber-800";
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black capitalize ${style}`}>{(value || "draft").replace(/_/g, " ")}</span>;
}

export function ModuleLink({ href, label, tone = "blue" }: { href: string; label: string; tone?: Tone }) {
  const colors: Record<Tone, string> = {
    blue: "bg-blue-700 hover:bg-blue-800",
    cyan: "bg-cyan-600 hover:bg-cyan-700",
    emerald: "bg-emerald-700 hover:bg-emerald-800",
    violet: "bg-violet-700 hover:bg-violet-800",
    amber: "bg-orange-600 hover:bg-orange-700",
    rose: "bg-rose-700 hover:bg-rose-800",
    slate: "bg-slate-800 hover:bg-slate-900",
  };
  return <Link href={href} className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 ${colors[tone]}`}>{label}</Link>;
}
