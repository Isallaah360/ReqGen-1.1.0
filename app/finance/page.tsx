import Link from "next/link";

type FinanceModuleCardProps = {
  title: string;
  description: string;
  icon: string;
  href?: string;
  status?: "active" | "planned";
  accent:
  | "blue"
  | "amber"
  | "violet"
  | "emerald"
  | "cyan"
  | "indigo"
  | "rose"
  | "slate";
};

const accentStyles = {
  blue: {
    card: "border-blue-200 bg-gradient-to-br from-white to-blue-50",
    icon: "bg-blue-100 text-blue-800",
    label: "text-blue-700",
    button: "bg-blue-700 text-white hover:bg-blue-800",
  },

  amber: {
    card: "border-amber-200 bg-gradient-to-br from-white to-amber-50",
    icon: "bg-amber-100 text-amber-800",
    label: "text-amber-700",
    button: "bg-amber-600 text-white hover:bg-amber-700",
  },

  violet: {
    card: "border-violet-200 bg-gradient-to-br from-white to-violet-50",
    icon: "bg-violet-100 text-violet-800",
    label: "text-violet-700",
    button: "bg-violet-700 text-white hover:bg-violet-800",
  },

  emerald: {
    card: "border-emerald-200 bg-gradient-to-br from-white to-emerald-50",
    icon: "bg-emerald-100 text-emerald-800",
    label: "text-emerald-700",
    button: "bg-emerald-700 text-white hover:bg-emerald-800",
  },

  cyan: {
    card: "border-cyan-200 bg-gradient-to-br from-white to-cyan-50",
    icon: "bg-cyan-100 text-cyan-800",
    label: "text-cyan-700",
    button: "bg-cyan-700 text-white hover:bg-cyan-800",
  },

  indigo: {
    card: "border-indigo-200 bg-gradient-to-br from-white to-indigo-50",
    icon: "bg-indigo-100 text-indigo-800",
    label: "text-indigo-700",
    button: "bg-indigo-700 text-white hover:bg-indigo-800",
  },

  rose: {
    card: "border-rose-200 bg-gradient-to-br from-white to-rose-50",
    icon: "bg-rose-100 text-rose-800",
    label: "text-rose-700",
    button: "bg-rose-700 text-white hover:bg-rose-800",
  },

  slate: {
    card: "border-slate-200 bg-gradient-to-br from-white to-slate-50",
    icon: "bg-slate-100 text-slate-800",
    label: "text-slate-600",
    button: "bg-slate-800 text-white hover:bg-slate-900",
  },
};

function FinanceModuleCard({
  title,
  description,
  icon,
  href,
  status = "planned",
  accent,
}: FinanceModuleCardProps) {
  const styles = accentStyles[accent];
  const isActive = status === "active" && Boolean(href);

  const content = (
    <article
      className={`flex h-full flex-col rounded-3xl border p-5 shadow-sm transition ${styles.card} ${isActive
          ? "hover:-translate-y-1 hover:shadow-lg"
          : "opacity-75"
        }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${styles.icon}`}
          aria-hidden="true"
        >
          {icon}
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-xs font-black ${isActive
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-slate-200 bg-slate-100 text-slate-600"
            }`}
        >
          {isActive ? "Active" : "Planned"}
        </span>
      </div>

      <p
        className={`mt-5 text-xs font-black uppercase tracking-[0.16em] ${styles.label}`}
      >
        Finance Module
      </p>

      <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">
        {title}
      </h3>

      <p className="mt-2 flex-1 text-sm font-semibold leading-6 text-slate-600">
        {description}
      </p>

      <span
        className={`mt-5 inline-flex w-fit rounded-xl px-4 py-2.5 text-sm font-black transition ${isActive
            ? styles.button
            : "cursor-not-allowed bg-slate-200 text-slate-500"
          }`}
      >
        {isActive ? "Open Module →" : "Coming Soon"}
      </span>
    </article>
  );

  if (!isActive || !href) {
    return content;
  }

  return (
    <Link
      href={href}
      className="block h-full rounded-3xl focus:outline-none focus:ring-4 focus:ring-blue-200"
    >
      {content}
    </Link>
  );
}

function FinanceSection({
  label,
  title,
  description,
  children,
}: {
  label: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
            {label}
          </p>

          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
            {title}
          </h2>
        </div>

        <p className="max-w-2xl text-sm font-semibold leading-6 text-slate-500">
          {description}
        </p>
      </div>

      {children}
    </section>
  );
}

export default function FinancePage() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:py-8">
      {/* ROUTE VERIFICATION BANNER */}

      <section className="mb-6 rounded-3xl border-4 border-emerald-400 bg-emerald-50 p-5 shadow-lg">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
              Route Verification Successful
            </p>

            <h1 className="mt-2 text-2xl font-black text-emerald-950 sm:text-3xl">
              NEW FINANCE PAGE — BUILD FCC-2026-01
            </h1>

            <p className="mt-2 font-semibold leading-7 text-emerald-900">
              This page is rendered directly from{" "}
              <code className="rounded bg-emerald-100 px-2 py-1 font-black">
                app/finance/page.tsx
              </code>
              . No Supabase query is running on this diagnostic page.
            </p>
          </div>

          <div className="w-fit rounded-2xl bg-emerald-700 px-5 py-4 text-center text-white">
            <p className="text-xs font-black uppercase tracking-wider">
              Diagnostic Status
            </p>

            <p className="mt-1 text-xl font-black">PAGE ACTIVE</p>
          </div>
        </div>
      </section>

      {/* TOP NAVIGATION */}

      <nav className="mb-6 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-100"
          >
            ← Main Dashboard
          </Link>

          <Link
            href="/finance/manual-voucher"
            className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-amber-700"
          >
            + Manual Voucher
          </Link>

          <Link
            href="/finance/vouchers"
            className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-violet-800"
          >
            Voucher Register
          </Link>

          <Link
            href="/finance/transactions"
            className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-800"
          >
            Transactions Register
          </Link>
        </div>

        <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-800">
          Finance Route Confirmed
        </span>
      </nav>

      {/* HERO */}

      <section className="overflow-hidden rounded-3xl border border-blue-900/20 bg-gradient-to-br from-slate-950 via-blue-950 to-violet-950 p-6 text-white shadow-xl sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
              ReqGen 1.1.0 · Islamic Education Trust
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
              Finance Control Centre
            </h2>

            <p className="mt-4 max-w-3xl font-semibold leading-7 text-slate-300">
              The central workspace for finance operations, accounting,
              reporting, audit controls and institutional financial
              administration.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/finance/manual-voucher"
                className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-400"
              >
                Create Manual Voucher
              </Link>

              <Link
                href="/finance/vouchers"
                className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
              >
                Open Voucher Register
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
              Diagnostic Build
            </p>

            <p className="mt-2 text-3xl font-black text-white">
              FCC-2026-01
            </p>

            <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
              This unique build marker confirms whether the correct Finance
              route has reached production.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-black text-emerald-200">
                No Database Query
              </span>

              <span className="rounded-full bg-blue-400/15 px-3 py-1.5 text-xs font-black text-blue-200">
                Static Verification
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* STATUS CARDS */}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
            Finance Route
          </p>

          <p className="mt-2 text-2xl font-black text-emerald-950">
            Connected
          </p>

          <p className="mt-1 text-xs font-bold text-emerald-700">
            app/finance/page.tsx
          </p>
        </article>

        <article className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">
            Operations
          </p>

          <p className="mt-2 text-2xl font-black text-blue-950">
            4 Modules
          </p>

          <p className="mt-1 text-xs font-bold text-blue-700">
            Core finance workflows
          </p>
        </article>

        <article className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
            Accounting
          </p>

          <p className="mt-2 text-2xl font-black text-violet-950">
            3 Modules
          </p>

          <p className="mt-1 text-xs font-bold text-violet-700">
            Ledgers and transfers
          </p>
        </article>

        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">
            Database Status
          </p>

          <p className="mt-2 text-2xl font-black text-amber-950">
            Paused
          </p>

          <p className="mt-1 text-xs font-bold text-amber-700">
            Safe route verification
          </p>
        </article>
      </section>

      {/* OPERATIONS */}

      <FinanceSection
        label="Operations"
        title="Daily Finance Operations"
        description="Core tools for request processing, voucher preparation and transaction inspection."
      >
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <FinanceModuleCard
            title="Pending Finance Requests"
            description="Review approved requests routed to Finance and continue their payment processing workflow."
            icon="📝"
            accent="blue"
            status="planned"
          />

          <FinanceModuleCard
            title="Manual Voucher Centre"
            description="Create and manage manual payment vouchers outside the request-generated workflow."
            icon="💳"
            href="/finance/manual-voucher"
            accent="amber"
            status="active"
          />

          <FinanceModuleCard
            title="Payment Voucher Register"
            description="Review payment vouchers generated from approved requests and manual finance entries."
            icon="📄"
            href="/finance/vouchers"
            accent="violet"
            status="active"
          />

          <FinanceModuleCard
            title="Transactions Register"
            description="Inspect posted finance transactions, transaction numbers, dates, references and amounts."
            icon="💰"
            href="/finance/transactions"
            accent="emerald"
            status="active"
          />
        </div>
      </FinanceSection>

      {/* ACCOUNTING */}

      <FinanceSection
        label="Accounting"
        title="Ledgers and Fund Movement"
        description="Accounting controls for institutional accounts, subheads and internal fund transfers."
      >
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <FinanceModuleCard
            title="Account Ledger"
            description="View debit, credit and balance movements for every IET bank account."
            icon="🏦"
            accent="cyan"
          />

          <FinanceModuleCard
            title="Subhead Ledger"
            description="Review allocation, reservation, expenditure and balance history for each subhead."
            icon="📚"
            accent="blue"
          />

          <FinanceModuleCard
            title="Account Transfers"
            description="Manage authorised transfers between IET accounts with full transaction references."
            icon="🔄"
            accent="indigo"
          />
        </div>
      </FinanceSection>

      {/* REPORTS */}

      <FinanceSection
        label="Reports"
        title="Reports and Export Centre"
        description="Management reports, printing and downloadable finance records."
      >
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <FinanceModuleCard
            title="Monthly Reports"
            description="Generate monthly summaries of transactions, vouchers and account movements."
            icon="📊"
            accent="blue"
          />

          <FinanceModuleCard
            title="Annual Reports"
            description="Generate consolidated annual financial reports for management review."
            icon="📈"
            accent="emerald"
          />

          <FinanceModuleCard
            title="Print Centre"
            description="Print vouchers, registers, schedules and official finance reports."
            icon="🖨️"
            accent="slate"
          />

          <FinanceModuleCard
            title="PDF / Excel Export"
            description="Export financial registers and management reports in standard formats."
            icon="📑"
            accent="violet"
          />
        </div>
      </FinanceSection>

      {/* ADMINISTRATION */}

      <FinanceSection
        label="Administration"
        title="Governance and Administrative Controls"
        description="Configuration, audit inspection and chronological finance activity monitoring."
      >
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <FinanceModuleCard
            title="Finance Settings"
            description="Configure finance numbering, workflow preferences and operational controls."
            icon="⚙️"
            accent="slate"
          />

          <FinanceModuleCard
            title="Audit Trail"
            description="Inspect traceable records of voucher preparation, posting and financial actions."
            icon="📋"
            accent="rose"
          />

          <FinanceModuleCard
            title="Activity History"
            description="Review chronological finance activity by user, record, date and action."
            icon="📜"
            accent="indigo"
          />
        </div>
      </FinanceSection>

      {/* FINAL VERIFICATION */}

      <section className="mt-10 rounded-3xl border border-emerald-300 bg-gradient-to-r from-emerald-50 to-cyan-50 p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
          Production Verification
        </p>

        <h2 className="mt-2 text-2xl font-black text-emerald-950">
          ReqGen Finance Page FCC-2026-01
        </h2>

        <p className="mt-2 max-w-3xl font-semibold leading-7 text-emerald-900">
          When this exact section appears on the production website, we will
          have conclusively confirmed that Vercel is deploying and rendering
          the correct Finance route.
        </p>
      </section>
    </main>
  );
}