"use client";

import { useEffect } from "react";
import Icon from "@/app/components/v4/Icon";

/** ReqGen v4.6.12: the error box in IET colours (Kit K2 look). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("ReqGen application error:", error); }, [error]);
  return (
    <main className="v4-ui k-fallback">
      <section className="k-fallback-card" role="alert">
        <span className="k-fallback-ic k-bad" aria-hidden="true"><Icon name="alert" /></span>
        <h1>Something went wrong on this page</h1>
        <p>The rest of ReqGen is not affected. Try again, or go back to Home.</p>
        <div className="k-fallback-actions">
          <a href="/dashboard" className="v4-btn v4-btn-secondary">Go to Home</a>
          <button type="button" onClick={reset} className="v4-btn v4-btn-primary"><Icon name="returned" />Try again</button>
        </div>
        {error.digest ? <p className="k-fallback-ref">Reference: {error.digest}</p> : null}
      </section>
    </main>
  );
}
