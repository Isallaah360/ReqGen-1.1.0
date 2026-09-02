export type AccessMode = "allow" | "deny" | "authenticated";

export const ACCESS_MATRIX_ROLES = [
  "admin",
  "auditor",
  "dg",
  "director",
  "account",
  "accountofficer",
  "hr",
  "registrar",
  "generalsecretary",
  "deanadmin",
  "registry",
  "staff",
] as const;

export type AccessMatrixRole = (typeof ACCESS_MATRIX_ROLES)[number];

export type AccessMatrixRow = {
  route: string;
  label: string;
} & Record<AccessMatrixRole, AccessMode>;

const coreAuthenticated = {
  admin: "authenticated",
  auditor: "authenticated",
  dg: "authenticated",
  director: "authenticated",
  account: "authenticated",
  accountofficer: "authenticated",
  hr: "authenticated",
  registrar: "authenticated",
  generalsecretary: "authenticated",
  deanadmin: "authenticated",
  registry: "authenticated",
  staff: "authenticated",
} as const;

const financeAccess = {
  admin: "allow",
  auditor: "allow",
  dg: "deny",
  director: "deny",
  account: "allow",
  accountofficer: "allow",
  hr: "deny",
  registrar: "deny",
  generalsecretary: "deny",
  deanadmin: "deny",
  registry: "deny",
  staff: "deny",
} as const;

const auditAccess = {
  admin: "allow",
  auditor: "allow",
  dg: "deny",
  director: "deny",
  account: "deny",
  accountofficer: "deny",
  hr: "deny",
  registrar: "deny",
  generalsecretary: "deny",
  deanadmin: "deny",
  registry: "deny",
  staff: "deny",
} as const;

export const ACCESS_MATRIX: AccessMatrixRow[] = [
  { route: "/dashboard", label: "Dashboard", ...coreAuthenticated },
  { route: "/requests", label: "Requests", ...coreAuthenticated },
  { route: "/approvals", label: "Approvals", ...coreAuthenticated },
  { route: "/finance", label: "Finance Control Centre", ...financeAccess },
  { route: "/payment-vouchers", label: "Payment Voucher Centre", ...financeAccess },
  {
    route: "/registry",
    label: "Registry Centre",
    admin: "allow",
    auditor: "allow",
    dg: "deny",
    director: "deny",
    account: "deny",
    accountofficer: "deny",
    hr: "deny",
    registrar: "allow",
    generalsecretary: "deny",
    deanadmin: "deny",
    registry: "allow",
    staff: "deny",
  },
  { route: "/reports", label: "Reports & Analytics", ...auditAccess },
  { route: "/audit-centre", label: "Audit Centre", ...auditAccess },
  {
    route: "/admin",
    label: "Administration Centre",
    admin: "allow",
    auditor: "deny",
    dg: "deny",
    director: "deny",
    account: "deny",
    accountofficer: "deny",
    hr: "deny",
    registrar: "deny",
    generalsecretary: "deny",
    deanadmin: "deny",
    registry: "deny",
    staff: "deny",
  },
  { route: "/admin/security", label: "Admin Security Read-only Oversight", ...auditAccess },
  { route: "/workflow", label: "Workflow Intelligence", ...auditAccess },
];
