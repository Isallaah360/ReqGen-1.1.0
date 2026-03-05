export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#f8fafc] px-4">
      <div className="mx-auto max-w-3xl py-10">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">About ReqGen</h1>
          <p className="mt-3 text-sm text-slate-700 leading-6">
            ReqGen is the internal request generation and approval system for
            Islamic Education Trust (IET). It supports structured approvals,
            digital signatures, and tracking for personal and official requests.
          </p>

          <h2 className="mt-6 text-lg font-bold text-slate-900">Core Features</h2>
          <ul className="mt-2 space-y-2 text-sm text-slate-700">
            <li>• Secure authentication and user profiles</li>
            <li>• Signature-backed submissions and approvals</li>
            <li>• Department-based routing and approvals</li>
            <li>• Audit-ready history and monthly reporting</li>
          </ul>

          <h2 className="mt-6 text-lg font-bold text-slate-900">Developer</h2>
          <p className="mt-2 text-sm text-slate-700">
            Built for IET internal operations. Developed by BARDERIAN ENTERPRISES.
          </p>
        </div>
      </div>
    </main>
  );
}