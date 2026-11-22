import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PublicFoot } from "@/app/components/PublicAuthShell";
import { CREDITS } from "@/lib/credits";
import { REQGEN_VERSION } from "@/lib/version";

export const metadata: Metadata = { title: "Open-source credits", description: "The open-source software used in ReqGen for the Islamic Education Trust." };

/** ReqGen v4.6.12 (Kit K14): open-source credits. Linked from the footer and from Me › About in the app. */
export default function CreditsPage() {
  return (
    <main className="v4-ui v4-public">
      <section className="v4-auth-card" aria-labelledby="credits-title" style={{ paddingTop: 32 }}>
        <div className="v4-auth-logo v4-small"><Image src="/v4/iet-logo.png" alt="Islamic Education Trust logo" width={92} height={92} /></div>
        <h1 id="credits-title" className="v4-auth-title">Open-source credits</h1>
        <p className="v4-auth-sub">ReqGen {REQGEN_VERSION} is built with this open-source software. Thank you to everyone who makes it.</p>
        <ul className="k-credits" style={{ listStyle: "none", margin: "8px 0 0", padding: 0, textAlign: "left" }}>
          {CREDITS.map((c) => (
            <li key={c.pkg}>
              <a className="k-credit-row" href={c.url} target="_blank" rel="noreferrer">
                <span><b>{c.name}</b><small>{c.what}</small></span>
                <span className="v4-chip v4-chip-grey">{c.licence}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="v4-muted" style={{ fontSize: 13, margin: "14px 0 0", textAlign: "left" }}>
          The full licence texts are in <a href="/THIRD-PARTY-LICENSES.txt">THIRD-PARTY-LICENSES.txt</a>. The icons are Lucide. The success tick and the empty-state drawing were made for ReqGen.
        </p>
        <div style={{ marginTop: 18 }}><Link className="v4-btn v4-btn-secondary v4-btn-block" href="/">ReqGen home</Link></div>
        <PublicFoot />
      </section>
    </main>
  );
}
