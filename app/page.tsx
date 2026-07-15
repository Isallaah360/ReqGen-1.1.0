import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-slate-50 px-4">
      <section className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center py-10">
        <div className="absolute left-0 top-10 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="absolute bottom-10 right-0 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70 blur-3xl" />

        <div className="relative w-full overflow-hidden rounded-[2.5rem] border border-white bg-white/90 shadow-2xl shadow-slate-200/70 backdrop-blur">
          <div className="grid min-h-[660px] items-center gap-10 px-6 py-10 md:px-12 lg:grid-cols-[0.95fr_1.05fr] lg:px-16">
            <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
              <div className="animate-soft-float flex h-52 w-52 items-center justify-center rounded-[2.25rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-100/70 md:h-64 md:w-64">
                <img
                  src="/iet-logo.png"
                  alt="Islamic Education Trust Logo"
                  className="h-full w-full object-contain"
                />
              </div>

              <div className="mt-8 inline-flex rounded-full border border-blue-100 bg-blue-50 px-5 py-2 text-xs font-black uppercase tracking-[0.3em] text-blue-700">
                Islamic Education Trust
              </div>

              <h1 className="mt-5 text-5xl font-black tracking-tight text-slate-950 md:text-7xl">
                ReqGen
              </h1>

              <p className="mt-3 text-xl font-extrabold text-slate-600 md:text-2xl">
                Request Management System
              </p>

              <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-slate-600">
                Welcome to IET’s secure digital platform for request submission, approval workflow,
                finance processing, records and institutional request management.
              </p>

              <div className="mt-8 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row lg:justify-start">
                <Link
                  href="/login"
                  className="rounded-2xl bg-blue-700 px-10 py-4 text-center text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-800"
                >
                  Login
                </Link>

                <Link
                  href="/signup"
                  className="rounded-2xl border border-slate-200 bg-white px-10 py-4 text-center text-sm font-black text-slate-900 shadow-sm transition hover:bg-slate-100"
                >
                  Sign Up
                </Link>
              </div>
            </div>

            <div className="rounded-[2.25rem] border border-slate-200 bg-slate-50 p-6 shadow-sm md:p-8">
              <div className="rounded-[2rem] border border-white bg-white p-6 shadow-sm">
                <div className="text-xs font-black uppercase tracking-[0.3em] text-blue-700">
                  About the App
                </div>

                <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
                  Built for secure institutional workflow.
                </h2>

                <p className="mt-4 text-sm font-semibold leading-7 text-slate-600">
                  ReqGen helps Islamic Education Trust manage official and personal staff requests
                  through proper approval stages, secure access, digital signatures and accountable
                  record keeping.
                </p>

                <div className="mt-6 grid gap-3">
                  <CleanPoint text="Role-based request workflow" />
                  <CleanPoint text="Two-factor authentication protection" />
                  <CleanPoint text="Digital signature verification" />
                  <CleanPoint text="Finance, registry and approval tracking" />
                </div>
              </div>

              <div className="mt-5 rounded-[2rem] border border-blue-100 bg-blue-50 p-6">
                <div className="text-xs font-black uppercase tracking-[0.3em] text-blue-700">
                  Developed by
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white p-2 shadow-sm">
                    <img
                      src="/be-logo.png"
                      alt="BELogo"
                      className="h-full w-full object-contain"
                    />
                  </div>

                  <div>
                    <div className="text-xl font-black text-slate-950">
                      Barderian Enterprises
                    </div>
                    <div className="text-sm font-bold text-slate-600">
                      Digital Solutions & Workflow Systems
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-2 text-sm font-bold text-slate-700">
                  <a
                    href="https://barderians.com.ng"
                    target="_blank"
                    rel="noreferrer"
                    className="w-fit text-blue-700 hover:underline"
                  >
                    barderians.com.ng
                  </a>

                  <a
                    href="mailto:info@barderians.com.ng"
                    className="w-fit text-blue-700 hover:underline"
                  >
                    info@barderians.com.ng
                  </a>
                </div>
              </div>
            </div>
          </div>

          <footer className="border-t border-slate-100 bg-white/80 px-6 py-5 text-center text-xs font-bold text-slate-500">
            © 2026 Islamic Education Trust (IET) ReqGen. Powered by Barderian Enterprises.
          </footer>
        </div>
      </section>

      <style>{`
        @keyframes softFloat {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .animate-soft-float {
          animation: softFloat 4s ease-in-out infinite;
        }
      `}</style>
    </main>
  );
}

function CleanPoint({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
        ✓
      </span>
      <span className="text-sm font-bold text-slate-800">{text}</span>
    </div>
  );
}