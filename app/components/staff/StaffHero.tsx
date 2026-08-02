import type { ReactNode } from "react";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

type StaffHeroProps = {
  name: string;
  designation?: string;
  description: string;
  actions?: ReactNode;
  roleSwitcher?: ReactNode;
};

export default function StaffHero({
  name,
  designation,
  description,
  actions,
  roleSwitcher,
}: StaffHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-800 px-5 py-8 text-white shadow-2xl sm:px-8 lg:px-10">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />

      <div className="relative grid gap-7 lg:grid-cols-[1fr_360px] lg:items-center">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.28em] text-cyan-200 sm:text-base">
            {greeting()}
          </p>
          <h1 className="mt-3 break-words text-4xl font-black uppercase leading-[0.95] tracking-tight text-white sm:text-5xl lg:text-6xl">
            {name}
          </h1>
          <p className="mt-4 inline-flex rounded-full border border-cyan-200/30 bg-cyan-300/15 px-4 py-2 text-sm font-black uppercase tracking-[0.15em] text-cyan-50">
            {designation || "IET Staff Member"}
          </p>
          <p className="mt-5 max-w-2xl text-sm font-semibold leading-7 text-blue-100 sm:text-base">
            {description}
          </p>
          {actions ? <div className="mt-6 flex flex-wrap gap-3">{actions}</div> : null}
        </div>

        {roleSwitcher ? <div className="lg:justify-self-end">{roleSwitcher}</div> : null}
      </div>
    </section>
  );
}
