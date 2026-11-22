import Link from "next/link";
import Icon from "@/app/components/v4/Icon";

/** ReqGen v4.6.12: page not found, in IET colours. */
export default function NotFound() {
  return (
    <main className="v4-ui k-fallback">
      <section className="k-fallback-card">
        <span className="k-fallback-ic" aria-hidden="true"><Icon name="search" /></span>
        <h1>Page not found</h1>
        <p>This ReqGen page does not exist or has moved.</p>
        <div className="k-fallback-actions">
          <Link href="/dashboard" className="v4-btn v4-btn-primary"><Icon name="dashboard" />Go to Home</Link>
        </div>
      </section>
    </main>
  );
}
