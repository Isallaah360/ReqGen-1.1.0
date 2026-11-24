import { ExternalLink, Lock } from "lucide-react";
import { Body, Head, Note } from "../ui";
import { WEBSITE, openOutside } from "../lib/core";

/**
 * 3.0.0: an office page that is not yet drawn natively opens the same page of the website,
 * signed in with the same rules (positions and RLS decide what shows). Each office moves
 * into the app one by one, with the Blueprint 07 screens.
 */
export function screenFor(href: string, title: string) {
  return <WebOffice href={href} title={title} />;
}

function WebOffice({ href, title }: { href: string; title: string }) {
  return (
    <>
      <Head title={title} />
      <Body>
        <div className="card" style={{ alignItems: "center", textAlign: "center", gap: 12, padding: 22 }}>
          <span className="av lg" aria-hidden="true"><Lock size={22} /></span>
          <b style={{ fontSize: 17 }}>{title}</b>
          <p className="mu">This office opens on the ReqGen website, with the same sign-in rules and the same view of the data as your position allows.</p>
          <button type="button" className="btn bp block" onClick={() => openOutside(`${WEBSITE}${href}`)}><ExternalLink size={18} />Open {title}</button>
        </div>
        <Note tone="in">Requests, approvals, direct messages and vouchers already work inside the app.</Note>
      </Body>
    </>
  );
}
