import Link from "next/link";
import { BrandLockup, FeatureIcon, PublicPageShell } from "./components/ui/PublicPageShell";

const features = [
  { icon: "workflow" as const, title: "Structured Approvals", text: "Move requests through defined institutional approval stages with clear accountability." },
  { icon: "shield" as const, title: "Secure Access", text: "Role-based permissions, MFA protection and controlled access for authorised users." },
  { icon: "finance" as const, title: "Finance Control", text: "Connect approvals, vouchers, transactions, ledgers and reports in one workflow." },
  { icon: "records" as const, title: "Reliable Records", text: "Maintain searchable institutional records, histories and audit-ready documentation." },
];

export default function HomePage() {
  return (
    <PublicPageShell>
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="reqgen-rise flex items-center justify-between rounded-3xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl sm:px-6">
          <BrandLockup compact />
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-xl px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10">Login</Link>
            <Link href="/signup" className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-300">Create Account</Link>
          </div>
        </header>

        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.05fr_.95fr] lg:py-16">
          <div className="reqgen-rise-delay">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
              <span className="h-2 w-2 rounded-full bg-cyan-300" /> ReqGen 1.1.0
            </div>
            <h1 className="mt-6 max-w-4xl text-5xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
              Institutional requests, managed with <span className="text-cyan-300">clarity and control.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base font-medium leading-8 text-slate-300 sm:text-lg">
              ReqGen is the Islamic Education Trust digital workflow platform for request submission, approvals, finance processing, registry control and accountable institutional records.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-7 py-4 text-sm font-black text-white shadow-xl shadow-blue-950/40 transition hover:-translate-y-0.5 hover:bg-blue-500">
                <FeatureIcon name="lock" /> Login Securely
              </Link>
              <Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-7 py-4 text-sm font-black text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/10">
                <FeatureIcon name="user" /> Create Staff Account
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-3 text-xs font-bold text-slate-300">
              {['Role-based workflow', 'MFA security', 'Digital records', 'Finance integration'].map((item) => (
                <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-2">✓ {item}</span>
              ))}
            </div>
          </div>

          <div className="reqgen-rise-delay-2 relative">
            <div className="reqgen-pulse absolute -inset-6 rounded-[3rem] bg-blue-500/15 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2.25rem] border border-white/15 bg-white/95 p-5 shadow-2xl shadow-black/30 sm:p-7">
              <div className="flex items-center justify-between rounded-3xl bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 p-5 text-white">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Control Centre</p>
                  <h2 className="mt-2 text-2xl font-black">One platform. One workflow.</h2>
                </div>
                <div className="reqgen-float h-20 w-20 rounded-2xl bg-white p-2 shadow-xl"><img src="/iet-logo.png" alt="IET logo" className="h-full w-full object-contain" /></div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {features.map((feature) => (
                  <div key={feature.title} className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-1 hover:border-blue-200 hover:bg-white hover:shadow-lg">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white"><FeatureIcon name={feature.icon} /></div>
                    <h3 className="mt-4 font-black text-slate-950">{feature.title}</h3>
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{feature.text}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Developed by</div>
                  <div className="mt-1 font-black text-slate-950">Barderian Enterprises</div>
                </div>
                <img src="/be-logo.png" alt="Barderian Enterprises logo" className="h-12 w-12 object-contain" />
              </div>
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-white/10 py-5 text-center text-xs font-semibold text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <span>© 2026 Islamic Education Trust. All rights reserved.</span>
          <span>Powered by Barderian Enterprises</span>
        </footer>
      </div>
    </PublicPageShell>
  );
}
