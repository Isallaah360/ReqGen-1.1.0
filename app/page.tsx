import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <section className="mx-auto max-w-7xl py-8">
        <div className="overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-sm">
          <div className="grid gap-8 p-6 md:p-10 lg:grid-cols-[1.1fr_0.9fr] lg:p-12">
            <div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-blue-100 bg-blue-50 p-2">
                  <img
                    src="/iet-logo.png"
                    alt="Islamic Education Trust Logo"
                    className="h-full w-full object-contain"
                  />
                </div>

                <div>
                  <div className="text-xs font-black uppercase tracking-[0.25em] text-blue-700">
                    Islamic Education Trust
                  </div>
                  <h1 className="mt-1 text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
                    ReqGen <span className="text-slate-400">1.1.0</span>
                  </h1>
                </div>
              </div>

              <p className="mt-6 max-w-3xl text-lg font-semibold leading-8 text-slate-700">
                ReqGen is the official request generation, approval, finance and filing workflow
                platform for Islamic Education Trust. It helps staff submit requests, officers review
                them through the approved chain, and finance/admin teams keep every action traceable.
              </p>

              <div className="mt-6 rounded-3xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm leading-6 text-emerald-900">
                <b>Bismillah.</b> Built to support accountability, amanah, timely approvals,
                financial discipline and proper institutional records.
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className="rounded-2xl bg-blue-600 px-6 py-4 text-center text-sm font-black text-white shadow-sm transition hover:bg-blue-700"
                >
                  Login to ReqGen
                </Link>

                <Link
                  href="/signup"
                  className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-center text-sm font-black text-slate-900 transition hover:bg-slate-100"
                >
                  Create Account
                </Link>

                <Link
                  href="/forgot-password"
                  className="rounded-2xl border border-blue-100 bg-blue-50 px-6 py-4 text-center text-sm font-black text-blue-700 transition hover:bg-blue-100"
                >
                  Forgot Password
                </Link>
              </div>

              <p className="mt-4 text-xs font-semibold text-slate-500">
                Secure access is protected with password login, authenticator app 2FA, digital
                signature checks and role-based permissions.
              </p>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <div className="text-sm font-black uppercase tracking-wide text-slate-500">
                  Workflow Coverage
                </div>

                <div className="mt-4 space-y-3">
                  <FeatureLine
                    title="Official Requests"
                    text="Departmental requests routed through the correct approval chain before finance treatment."
                  />
                  <FeatureLine
                    title="Personal Requests"
                    text="Fund, Leave, Contract Renewal, Resignation and Other personal request categories."
                  />
                  <FeatureLine
                    title="Finance & Subheads"
                    text="Allocation, reservation, expenditure, balance tracking and payment voucher support."
                  />
                  <FeatureLine
                    title="Registry Monitoring"
                    text="Daily submission summary, department movement dashboard and DG reminder support."
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MiniStat title="Routing" value="Role Based" />
                <MiniStat title="Security" value="2FA + Signature" />
                <MiniStat title="Finance" value="Subhead Control" />
                <MiniStat title="Records" value="Audit Trail" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <ModuleCard
            title="For Staff"
            text="Submit official or personal requests with details, amount where applicable, and required signature."
          />

          <ModuleCard
            title="For Approvers"
            text="Treat requests assigned to PO, DOD, DIN Admin, Registrar, HOD, HR, DG and AccountOfficer stages."
          />

          <ModuleCard
            title="For Finance"
            text="Manage departments, subheads, bank accounts, payment vouchers, reports and audit reconciliation."
          />

          <ModuleCard
            title="For Registry"
            text="Monitor request movement across departments, prepare summaries and support follow-up reminders."
          />
        </div>

        <div className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <h2 className="text-2xl font-black text-slate-900">
                Standard IET Request Workflow
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                ReqGen supports department-specific routing, multiple user roles, exact actor
                tracking, digital signatures and final print-ready request records.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <WorkflowPill text="Staff → DOD/HOD/PO" />
              <WorkflowPill text="DIN Admin → Registrar" />
              <WorkflowPill text="HR → DG → AccountOfficer" />
              <WorkflowPill text="HR Filing → Completed" />
            </div>
          </div>
        </div>

        <footer className="mt-10 border-t border-slate-200 py-6 text-center text-xs font-semibold text-slate-500">
          © 2026 Islamic Education Trust (IET). Powered by ReqGen 1.1.0.
        </footer>
      </section>
    </main>
  );
}

function FeatureLine({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
      <div className="text-sm font-black text-slate-900">{title}</div>
      <div className="mt-1 text-xs font-semibold leading-5 text-slate-600">{text}</div>
    </div>
  );
}

function MiniStat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-black uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-2 text-sm font-black text-blue-700">{value}</div>
    </div>
  );
}

function ModuleCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="text-lg font-black text-slate-900">{title}</div>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function WorkflowPill({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-black text-blue-800">
      {text}
    </div>
  );
}