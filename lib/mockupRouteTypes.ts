export type MockupRouteMeta = { section: string; type: string };

const ROUTES: Array<{ pattern: RegExp; meta: MockupRouteMeta }> = [
  { pattern: new RegExp("^/reports/enterprise\-analytics/?$"), meta: { section: "reports", type: "dashboard" } },
  { pattern: new RegExp("^/payment\-vouchers/[^/]+/print/?$"), meta: { section: "payment-vouchers", type: "print" } },
  { pattern: new RegExp("^/payment\-vouchers/settings/?$"), meta: { section: "payment-vouchers", type: "settings" } },
  { pattern: new RegExp("^/payment\-vouchers/reports/?$"), meta: { section: "payment-vouchers", type: "redirect" } },
  { pattern: new RegExp("^/payment\-vouchers/[^/]+/?$"), meta: { section: "payment-vouchers", type: "detail" } },
  { pattern: new RegExp("^/admin/account\-routing/?$"), meta: { section: "admin", type: "settings" } },
  { pattern: new RegExp("^/registry/operations/?$"), meta: { section: "registry", type: "dashboard" } },
  { pattern: new RegExp("^/registry/dispatch/?$"), meta: { section: "registry", type: "dashboard" } },
  { pattern: new RegExp("^/registry/incoming/?$"), meta: { section: "registry", type: "dashboard" } },
  { pattern: new RegExp("^/registry/outgoing/?$"), meta: { section: "registry", type: "dashboard" } },
  { pattern: new RegExp("^/admin/departments/?$"), meta: { section: "admin", type: "settings" } },
  { pattern: new RegExp("^/payment\-vouchers/?$"), meta: { section: "payment-vouchers", type: "hybrid" } },
  { pattern: new RegExp("^/registry/archive/?$"), meta: { section: "registry", type: "dashboard" } },
  { pattern: new RegExp("^/admin/security/?$"), meta: { section: "admin", type: "dashboard" } },
  { pattern: new RegExp("^/admin/settings/?$"), meta: { section: "admin", type: "settings" } },
  { pattern: new RegExp("^/audit\-centre/?$"), meta: { section: "audit-centre", type: "dashboard" } },
  { pattern: new RegExp("^/admin/roles/?$"), meta: { section: "admin", type: "hybrid" } },
  { pattern: new RegExp("^/admin/users/?$"), meta: { section: "admin", type: "dashboard" } },
  { pattern: new RegExp("^/registry/?$"), meta: { section: "registry", type: "dashboard" } },
  { pattern: new RegExp("^/workflow/?$"), meta: { section: "workflow", type: "hybrid" } },
  { pattern: new RegExp("^/reports/?$"), meta: { section: "reports", type: "dashboard" } },
  { pattern: new RegExp("^/admin/?$"), meta: { section: "admin", type: "dashboard" } },
];

export function getMockupRouteMeta(pathname: string): MockupRouteMeta | null {
  return ROUTES.find((item) => item.pattern.test(pathname))?.meta ?? null;
}
