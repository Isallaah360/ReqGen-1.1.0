import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50 px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-8 h-80 w-80 rounded-full bg-blue-200/45 blur-3xl" />
        <div className="absolute -right-20 bottom-8 h-80 w-80 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 blur-3xl" />
      </div>

      <section className="relative mx-auto flex min-h-screen max-w-5xl items-center justify-center py-10">
        <div className="w-full text-center">
          <div className="animate-logo-float mx-auto flex h-64 w-64 items-center justify-center rounded-[2.75rem] border border-white bg-white/95 p-6 shadow-2xl shadow-blue-200/60 backdrop-blur md:h-80 md:w-80">
            <img
              src="/iet-logo.png"
              alt="Islamic Education Trust logo"
              className="h-full w-full object-contain"
            />
          </div>

          <div className="animate-content-rise">
            <p className="mt-9 text-xs font-black uppercase tracking-[0.32em] text-blue-700 sm:text-sm">
              Islamic Education Trust
            </p>

            <h1 className="mt-4 text-5xl font-black tracking-tight text-slate-950 sm:text-6xl md:text-7xl">
              Welcome to ReqGen
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-base font-semibold leading-7 text-slate-600 sm:text-lg">
              A secure and simple request management system for IET staff.
            </p>

            <div className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/login"
                className="reqgen-btn reqgen-btn-blue inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-700 px-8 py-4 text-sm font-black text-white shadow-lg shadow-blue-200 transition duration-300 hover:-translate-y-0.5 hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-200"
              >
                <LockIcon />
                Login
              </Link>

              <Link
                href="/signup"
                className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-8 py-4 text-sm font-black text-slate-900 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                <UserPlusIcon />
                Sign Up
              </Link>
            </div>

            <div className="mt-10 flex items-center justify-center gap-3 text-xs font-bold text-slate-500">
              <span className="h-px w-10 bg-slate-200" />
              Secure • Reliable • Accountable
              <span className="h-px w-10 bg-slate-200" />
            </div>
          </div>

          <footer className="mt-14 flex flex-col items-center gap-3 text-xs font-semibold text-slate-500">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/85 px-4 py-2 shadow-sm backdrop-blur">
              <img src="/be-logo.png" alt="Barderian Enterprises logo" className="h-9 w-auto object-contain" />
              <span>Powered by Barderian Enterprises</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              <a href="https://barderians.com.ng" target="_blank" rel="noreferrer" className="transition hover:text-blue-700">barderians.com.ng</a>
              <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:block" />
              <a href="mailto:info@barderians.com.ng" className="transition hover:text-blue-700">info@barderians.com.ng</a>
            </div>
            <span>© 2026 Islamic Education Trust</span>
          </footer>
        </div>
      </section>

      <style>{`
        @keyframes logoFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(0.5deg); }
        }

        @keyframes contentRise {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-logo-float {
          animation: logoFloat 4.5s ease-in-out infinite;
        }

        .animate-content-rise {
          animation: contentRise 700ms ease-out both;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-logo-float,
          .animate-content-rise {
            animation: none;
          }
        }
      `}</style>
    </main>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function UserPlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 19a6 6 0 0 0-12 0" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M16 11h6" />
    </svg>
  );
}
