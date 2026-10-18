"use client";

import { useCallback, useEffect, useState } from "react";
import { REQGEN_VERSION } from "@/lib/version";
import { loadReleases, whenText, type Release } from "@/lib/v4/developer";
import { useIdentity } from "@/app/components/v4/useIdentity";
import { Card, Chip, Notice, PageHead, Skeleton, V4Page } from "@/app/components/v4/ui";

/** What's new (v4.6.6): the releases the Developer published, newest first. Open to everyone. */
export default function WhatsNewPage() {
  const me = useIdentity();
  const [rows, setRows] = useState<Release[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { const r = await loadReleases(); setRows(r.rows); setError(r.error); }, []);
  useEffect(() => { if (me.ready) queueMicrotask(() => { void load(); }); }, [me.ready, load]);

  return (
    <V4Page>
      <PageHead title="What's new" sub={`You are using ReqGen ${REQGEN_VERSION}. Each update from Barderian Enterprises is listed here.`} />
      {error ? <Notice tone="amber">{error}</Notice> : null}
      <Card>
        {rows === null ? <div className="v4-card-body"><Skeleton lines={5} /></div> : rows.length ? rows.map((r) => (
          <article key={r.id} className="v4-release">
            <h3><span className="v4-mono">{r.version}</span> · {r.title} {r.version === REQGEN_VERSION ? <Chip tone="green">You are using this</Chip> : null}</h3>
            <small className="v4-muted">{whenText(r.published_at)}</small>
            <p>{r.notes}</p>
          </article>
        )) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>No update has been published yet.</p>}
      </Card>
    </V4Page>
  );
}
