"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export type DirectorateWorkspaceItem = {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
  gradient: string;
  badge?: string;
};

type Props = {
  title?: string;
  subtitle?: string;
  items: DirectorateWorkspaceItem[];
};

export default function DirectorateWorkspaceMenu({
  title = "Workspace Menu",
  subtitle = "Open an authorised operational workspace.",
  items,
}: Props) {
  const pathname = usePathname();

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-[0_18px_55px_rgba(15,23,42,0.08)] sm:p-5">
      <div className="mb-4 flex items-start gap-3 px-1">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white shadow-lg">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="2" />
            <rect x="14" y="3" width="7" height="7" rx="2" />
            <rect x="3" y="14" width="7" height="7" rx="2" />
            <rect x="14" y="14" width="7" height="7" rx="2" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-black uppercase tracking-tight text-slate-950">{title}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {items.map((item) => {
          const active = item.href === "/hr" ? pathname === item.href : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`group relative min-h-[154px] overflow-hidden rounded-3xl bg-gradient-to-br ${item.gradient} p-4 text-white shadow-[0_14px_30px_rgba(15,23,42,0.16)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_20px_38px_rgba(15,23,42,0.24)] focus:outline-none focus:ring-4 focus:ring-cyan-200 ${
                active ? "ring-4 ring-cyan-200" : ""
              }`}
            >
              <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10 blur-sm transition group-hover:scale-110" />
              <div className="relative flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/20 bg-white/15 text-white shadow-inner backdrop-blur-sm">
                    {item.icon}
                  </div>
                  {item.badge ? (
                    <span className="rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur-sm">
                      {item.badge}
                    </span>
                  ) : null}
                </div>

                <h3 className="mt-4 text-sm font-black uppercase leading-tight tracking-wide text-white">{item.title}</h3>
                <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-5 text-white/80">{item.description}</p>
                <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-black uppercase tracking-wider text-white">
                  Open Centre
                  <svg viewBox="0 0 24 24" className="h-4 w-4 transition group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="M5 12h14" />
                    <path d="m13 6 6 6-6 6" />
                  </svg>
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
