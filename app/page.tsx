import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f8fafc] px-4">
      <section className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center py-10">
        <div className="absolute left-1/2 top-8 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-200/30 blur-3xl" />
        <div className="absolute bottom-10 right-0 h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl" />

        <div className="relative w-full overflow-hidden rounded-[2.25rem] border border-white/80 bg-white/85 shadow-2xl shadow-slate-200/70 backdrop-blur">
          <div className="grid min-h-[680px] items-center gap-8 px-6 py-10 md:px-12 lg:grid-cols-[1fr_0.9fr] lg:px-16">
            <div className="text-center lg:text-left">
              <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-100/60 lg:mx-0 md:h-56 md:w-56">
                <img
                  src="/iet-logo.png"
                  alt="Islamic Education Trust Logo"
                  className="h-full w-full object-contain"
                />
              </div>

              <div className="mt-8 inline-flex rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-blue-700">
                Islamic Education Trust
              </div>

              <h1 className="mt-5 text-5xl font-black tracking-tight text-slate-950 md:text-7xl">
                ReqGen
              </h1>

              <p className="mt-3 text-xl font-extrabold text-slate-500 md:text-2xl">
                Request Management System
              </p>

              <p className="mx-auto mt-5 max-w-2xl text-base font-semibold leading-8 text-slate-600 lg:mx-0">
                A secure digital platform for request submission, approvals, finance processing,
                records and institutional workflow management.
              </p>

              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                <Link
                  href="/login"
                  className="rounded-2xl bg-blue-700 px-8 py-4 text-center text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-800"
                >
                  Login to ReqGen
                </Link>

                <Link
                  href="/forgot-password"
                  className="rounded-2xl border border-slate-200 bg-white px-8 py-4 text-center text-sm font-black text-slate-900 shadow-sm transition hover:bg-slate-50"
                >
                  Forgot Password
                </Link>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-100 bg-slate-950 p-6 text-white shadow-2xl shadow-slate-300/60 md:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.25em] text-blue-300">
                    Version
                  </div>
                  <div className="mt-1 text-3xl font-black">1.1.0</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-black text-white">
                  Secure Access
                </div>
              </div>

              <div className="mt-10 space-y-4">
                <CleanPoint text="Role-based request workflow" />
                <CleanPoint text="Two-factor authentication protection" />
                <CleanPoint text="Digital signature verification" />
                <CleanPoint text="Finance, registry and approval tracking" />
              </div>

              <div className="mt-10 rounded-3xl border border-white/10 bg-white/10 p-5">
                <div className="text-xs font-black uppercase tracking-[0.25em] text-slate-300">
                  Developed by
                </div>

                <div className="mt-4 flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white p-2">
                    <img
                      src="/be-logo.svg"
                      alt="Barderian Enterprises Logo"
                      className="h-full w-full object-contain"
                    />
                  </div>

                  <div>
                    <div className="text-lg font-black text-white">
                      Barderian Enterprises
                    </div>
                    <div className="text-sm font-semibold text-slate-300">
                      Digital Solutions & Workflow Systems
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-2 text-sm font-semibold text-slate-300">
                  <a
                    href="https://barderian.com.ng"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white"
                  >
                    barderian.com.ng
                  </a>

                  <a href="mailto:info@barderian.com.ng" className="hover:text-white">
                    info@barderian.com.ng
                  </a>
                </div>
              </div>
            </div>
          </div>

          <footer className="border-t border-slate-100 bg-white/70 px-6 py-5 text-center text-xs font-bold text-slate-500">
            © 2026 Islamic Education Trust (IET). Powered by ReqGen.
          </footer>
        </div>
      </section>
    </main>
  );
}

function CleanPoint({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-black text-white">
        ✓
      </span>
      <span className="text-sm font-bold text-slate-100">{text}</span>
    </div>
  );
}