export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-4xl py-12">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
          ReqGen <span className="text-slate-400">1.1.0</span>
        </h1>

        <p className="mt-3 text-slate-600">
          Islamic Education Trust (IET) — Request Management System
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">About the App</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li>✅ Secure login & role-based approvals</li>
              <li>✅ Digital signatures on actions</li>
              <li>✅ Workflow routing (Director → HOD → Registry → DG → Account/HR)</li>
              <li>✅ Audit trail for reconciliation</li>
            </ul>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Get Started</h2>
            <p className="mt-2 text-sm text-slate-600">
              Create an account or login to continue.
            </p>

            <div className="mt-5 flex flex-col gap-3">
              <a
                href="/signup"
                className="rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                Sign Up
              </a>
              <a
                href="/login"
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                Login
              </a>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              Version: ReqGen 1.1.0 — Test Deployment
            </p>
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-slate-500">
          © 2026 Islamic Education Trust (IET). Powered by ReqGen.
        </p>
      </div>
    </main>
  );
}