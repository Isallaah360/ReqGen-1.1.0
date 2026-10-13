"use client";

import { downloadXlsx } from "@/lib/v4/xlsx";
import { CELL_TEXT, MATRIX, MATRIX_COLUMNS } from "@/lib/v4/admin";
import { Card, Notice, PageHead, V4Page } from "@/app/components/v4/ui";

const CLS = { y: "v4-y", route: "v4-o", own: "v4-o", view: "v4-o", n: "v4-n" } as const;

/**
 * Administration › Permissions Matrix (mock-up 84): what each position can see
 * and do. It is the rules ReqGen enforces (page rules and the database), so it
 * is changed only by a release — nobody can widen their own access by mistake.
 */
export default function PermissionsPage() {
  const exportRows = () => downloadXlsx("Permissions_Matrix", [{
    name: "Permissions", title: "ReqGen — Permissions matrix",
    rows: MATRIX.flatMap((g) => g.rows.map((r) => ({ Group: g.group, Action: r.action, ...Object.fromEntries(MATRIX_COLUMNS.map((c, i) => [c, CELL_TEXT[r.cells[i]]])) }))),
  }]);
  return (
    <V4Page>
      <PageHead title="Permissions Matrix" sub="What each position can see and do. This is the only place permissions are shown."
        actions={[{ label: "Export Excel", icon: "download", kind: "secondary", onClick: exportRows }]} />
      <Notice tone="blue">These are the rules ReqGen enforces on every page and in the database. They change only with a release from the Developer, after the Trust agrees — so nobody can widen their own access by mistake.</Notice>
      <Card>
        <div className="v4-matrix-wrap">
          <table className="v4-matrix">
            <thead><tr><th>Action</th>{MATRIX_COLUMNS.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {MATRIX.map((g) => [
                <tr key={g.group} className="v4-grp"><td colSpan={MATRIX_COLUMNS.length + 1}>{g.group}</td></tr>,
                ...g.rows.map((r) => (
                  <tr key={r.action}><td>{r.action}</td>{r.cells.map((c, i) => <td key={MATRIX_COLUMNS[i]}><span className={CLS[c]}>{CELL_TEXT[c]}</span></td>)}</tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
        <div className="v4-mlegend">
          <span><b className="v4-y" style={{ color: "var(--v4-green)" }}>✓</b> Allowed</span>
          <span><b style={{ color: "#B26A00" }}>route</b> Only when the request is routed to them</span>
          <span><b style={{ color: "#B26A00" }}>own</b> Only their own</span>
          <span><b style={{ color: "#B26A00" }}>view</b> Can look, not change</span>
          <span><b style={{ color: "#B8C1CF" }}>—</b> Not allowed</span>
          <span>GS = General Secretary (acts for the DG when away) · PA = PA to the DG · HRC = HR Coordinator · Rgy = Registry · SA = Super Admin · Dev = Developer</span>
        </div>
      </Card>
    </V4Page>
  );
}
