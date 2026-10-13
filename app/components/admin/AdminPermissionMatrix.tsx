"use client";

import { CheckCircle2, MinusCircle, XCircle } from "lucide-react";
import { canAccessPath } from "@/lib/permissions";

const CANONICAL_ROLES = [
  ["admin", "Admin"],
  ["auditor", "Auditor"],
  ["accountofficer", "Account Officer"],
  ["registrar", "Registrar"],
  ["director", "Director"],
  ["dg", "DG"],
  ["hr", "HR"],
  ["generalsecretary", "General Secretary"],
  ["dinadmin", "DIN Admin"],
  ["staff", "Staff"],
] as const;

const MODULES = [
  ["/dashboard", "Dashboard"],
  ["/requests", "Requests"],
  ["/approvals", "Approvals"],
  ["/finance", "Finance"],
  ["/payment-vouchers", "Payment Vouchers"],
  ["/registry", "Registry"],
  ["/reports", "Reports"],
  ["/audit-centre", "Audit Centre"],
  ["/admin/users", "Admin · Users"],
  ["/admin/departments", "Admin · Departments"],
  ["/admin/settings", "System Settings"],
] as const;

function access(role: string, path: string) {
  return canAccessPath(path, new Set([role]));
}

export default function AdminPermissionMatrix() {
  return (
    <section className="admin-permission-card" aria-labelledby="admin-permission-title">
      <div className="admin-permission-head">
        <div>
          <h2 id="admin-permission-title">Route Access Matrix</h2>
          <p>Live representation of ReqGen&apos;s canonical route policies. Action-level rules remain enforced inside each workspace.</p>
        </div>
        <div className="admin-permission-legend"><span><CheckCircle2 size={14}/> Access</span><span><XCircle size={14}/> No access</span><span><MinusCircle size={14}/> Contextual/action rules</span></div>
      </div>
      <div className="admin-permission-scroll">
        <table className="admin-permission-table">
          <thead>
            <tr><th>Module</th>{CANONICAL_ROLES.map(([, label]) => <th key={label}>{label}</th>)}</tr>
          </thead>
          <tbody>
            {MODULES.map(([path, label]) => (
              <tr key={path}>
                <td><strong>{label}</strong></td>
                {CANONICAL_ROLES.map(([role, roleLabel]) => {
                  const allowed = access(role, path);
                  return <td key={`${path}-${role}`} aria-label={`${roleLabel}: ${allowed ? "access" : "no access"}`}>{allowed ? <CheckCircle2 className="is-yes" size={16}/> : <XCircle className="is-no" size={16}/>}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
