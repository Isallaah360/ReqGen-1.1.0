import { useEffect, type ReactNode } from "react";
import { buzz } from "../lib/native";
import { Body, useNav } from "../ui";

/** The success moment: a drawn tick, the request number and who was told. */
export default function Sent({ title, no, line, children, openNode }: { title: string; no: string; line?: string; children?: ReactNode; openNode: ReactNode }) {
  const { popAll, replace } = useNav();
  useEffect(() => { buzz.ok(); }, []);
  return (
    <Body className="center">
      <svg className="tick" width="110" height="110" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" /><path d="M14 25l7 7 13-15" /></svg>
      <p className="title" role="status">{title}</p>
      <p className="h">{no}</p>
      {line ? <p className="mu" style={{ maxWidth: 340 }}>{line}</p> : null}
      {children}
      <div style={{ display: "flex", gap: 8, width: "100%" }}>
        <button type="button" className="btn bs" style={{ flex: 1 }} onClick={popAll}>Home</button>
        <button type="button" className="btn bp" style={{ flex: 1 }} onClick={() => replace(openNode)}>Open it</button>
      </div>
    </Body>
  );
}
