import type { ReactNode } from "react";

export type StaffStatTone =
  | "blue"
  | "cyan"
  | "emerald"
  | "violet"
  | "amber"
  | "rose"
  | "slate";

const tones: Record<StaffStatTone, string> = {
  blue: "from-blue-800 to-blue-600",
  cyan: "from-cyan-700 to-sky-500",
  emerald: "from-emerald-700 to-teal-500",
  violet: "from-violet-800 to-purple-600",
  amber: "from-amber-600 to-orange-500",
  rose: "from-rose-700 to-red-500",
  slate: "from-slate-950 to-slate-700",
};

type StaffStatItem = {
  label: string;
  value: ReactNode;
  note?: string;
  tone?: StaffStatTone;
  icon?: ReactNode;
};

export default function StaffStats({ items }: { items: StaffStatItem[] }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <article
          key={item.label}
          className="overflow-hidden rounded-2xl border border-white/70 bg-white/90 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className={`h-1.5 bg-gradient-to-r ${tones[item.tone || "blue"]}`} />
          <div className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                {item.label}
              </p>
              <div className="mt-2 text-3xl font-black text-slate-950">{item.value}</div>
              {item.note ? (
                <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{item.note}</p>
              ) : null}
            </div>
            {item.icon ? (
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-950 text-white shadow-sm">
                {item.icon}
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </section>
  );
}
