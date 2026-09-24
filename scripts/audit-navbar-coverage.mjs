import fs from "node:fs";
import path from "node:path";

const pages = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name === "page.tsx") {
      let route = "/" + path.relative("app", path.dirname(full)).split(path.sep).join("/");
      if (route === "/." || route === "/") route = "/";
      pages.push(route);
    }
  }
}
walk("app");

const publicRoutes = new Set(["/", "/login", "/signup", "/forgot-password", "/reset-password", "/mfa", "/mfa/setup", "/unauthorized"]);
const mainNav = ["/dashboard", "/requests", "/approvals", "/finance", "/payment-vouchers", "/registry", "/reports", "/audit-centre", "/admin", "/profile"];
const contextualParents = [
  ["/change-password", "/profile"],
  ["/output", "/reports"],
  ["/workflow", "/audit-centre"],
  ["/hr", "/approvals"],
  ["/staff", "/dashboard"],
  ["/docs", "/dashboard"],
  ["/about", "/dashboard"],
  ["/test-supabase", "/admin"],
  ["/executive", "/admin"],
];

function parentFor(route) {
  const contextual = contextualParents.find(([prefix]) => route === prefix || route.startsWith(`${prefix}/`));
  if (contextual) return contextual[1];
  return mainNav.find((prefix) => route === prefix || route.startsWith(`${prefix}/`)) || null;
}

const missing = pages.filter((route) => !publicRoutes.has(route) && !parentFor(route));
console.log(`ReqGen NavBar coverage audit: ${pages.length} physical pages inspected.`);
if (missing.length) {
  console.error(`Pages without a deliberate NavBar parent: ${missing.length}`);
  for (const route of missing) console.error(` - ${route}`);
  process.exit(1);
}
console.log("Pages without a deliberate NavBar parent: 0");
console.log("NavBar coverage readiness: PASSED");
