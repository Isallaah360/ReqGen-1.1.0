import type { ReactNode } from "react";

export function PublicPageShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute right-[-8rem] top-1/4 h-96 w-96 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-1/3 h-[28rem] w-[28rem] rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:38px_38px]" />
      </div>
      <div className="relative z-10">{children}</div>
      <style>{`
        @keyframes reqgenFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes reqgenRise {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes reqgenPulse {
          0%, 100% { opacity: .45; transform: scale(1); }
          50% { opacity: .75; transform: scale(1.08); }
        }
        .reqgen-float { animation: reqgenFloat 4.5s ease-in-out infinite; }
        .reqgen-rise { animation: reqgenRise .7s ease-out both; }
        .reqgen-rise-delay { animation: reqgenRise .7s .12s ease-out both; }
        .reqgen-rise-delay-2 { animation: reqgenRise .7s .22s ease-out both; }
        .reqgen-pulse { animation: reqgenPulse 5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .reqgen-float, .reqgen-rise, .reqgen-rise-delay, .reqgen-rise-delay-2, .reqgen-pulse {
            animation: none !important;
          }
        }
      `}</style>
    </main>
  );
}

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`${compact ? "h-12 w-12" : "h-16 w-16"} rounded-2xl border border-white/15 bg-white p-2 shadow-xl shadow-blue-950/30`}>
        <img src="/iet-logo.png" alt="Islamic Education Trust logo" className="h-full w-full object-contain" />
      </div>
      <div>
        <div className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">Islamic Education Trust</div>
        <div className={`${compact ? "text-xl" : "text-2xl"} font-black tracking-tight text-white`}>ReqGen</div>
      </div>
    </div>
  );
}

export function FeatureIcon({ name }: { name: "shield" | "workflow" | "finance" | "records" | "mail" | "lock" | "user" | "building" | "phone" | "eye" }) {
  const common = "h-5 w-5";
  const paths: Record<string, ReactNode> = {
    shield: <path d="M12 3 5 6v5c0 4.6 2.9 8.2 7 10 4.1-1.8 7-5.4 7-10V6l-7-3Zm-3 9 2 2 4-4" />,
    workflow: <path d="M7 4h10v5H7zM4 15h6v5H4zM14 15h6v5h-6zM12 9v3m0 0H7v3m5-3h5v3" />,
    finance: <path d="M4 20h16M6 17V9m4 8V9m4 8V9m4 8V9M3 7l9-4 9 4H3Z" />,
    records: <path d="M6 3h9l3 3v15H6zM9 11h6M9 15h6M15 3v4h4" />,
    mail: <path d="M4 6h16v12H4zM4 7l8 6 8-6" />,
    lock: <path d="M7 10V8a5 5 0 0 1 10 0v2m-11 0h12v10H6zM12 14v2" />,
    user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0" />,
    building: <path d="M4 21h16M6 21V5h12v16M9 9h2m2 0h2m-6 4h2m2 0h2m-6 4h2m2 0h2" />,
    phone: <path d="M7 4 4 7c1.5 6.3 6.7 11.5 13 13l3-3-4-3-2 2c-2.4-1-5-3.6-6-6l2-2-3-4Z" />,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
  };

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={common} aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
