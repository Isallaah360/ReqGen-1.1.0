import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f8fafc] px-4">
      <div className="mx-auto max-w-5xl py-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* If you have a logo later, uncomment:
            <img src="/iet-logo.png" alt="IET" className="h-10 w-auto" />
            */}
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                ReqGen <span className="text-slate-400">1.1.0</span>
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Islamic Education Trust (IET) — Request Management System
              </p>
            </div>
          </div>
        </div>

        {/* Main card */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* About */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">About the App</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              ReqGen helps IET staff generate and track requests with proper approvals
              through the official workflow (Director → HOD → Registry → DG → Account/HR).
            </p>

            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li>✅ Secure login and role-based approvals</li>
              <li>✅ Digital signatures on submissions and actions</li>
              <li>✅ Fast routing and tracking of request stages</li>
              <li>✅ Monthly reporting support for Accounts & Audit</li>
            </ul>

            <div className="mt-5 text-xs text-slate-500">
              Tip: Create your account first, then upload your signature in Profile.
            </div>
          </div>

          {/* Actions */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Get Started</h2>
            <p className="mt-2 text-sm text-slate-600">
              Sign up if you are a new staff, or login if you already have an account.
            </p>

            <div className="mt-6 grid gap-3">
              <Link
                href="/signup"
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-slate-800"
              >
                Create Account (Sign Up)
              </Link>

              <Link
                href="/login"
                className="w-full rounded-xl border px-4 py-3 text-center text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                Login
              </Link>

              <Link
                href="/about"
                className="w-full rounded-xl border px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Learn More (About)
              </Link>
            </div>

            <p className="mt-6 text-xs text-slate-500">
              Version: ReqGen 1.1.0 — Test Deployment
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Islamic Education Trust (IET). Powered by ReqGen.
        </div>
      </div>
    </main>
  );
}