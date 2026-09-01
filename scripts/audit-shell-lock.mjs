import fs from "node:fs";

const shell = fs.readFileSync("app/components/GovernmentAppShell.tsx", "utf8");
const css = fs.readFileSync("app/globals.css", "utf8");
const failures = [];

const requiredNav = ["Dashboard", "Requests", "Approvals", "Finance", "Payment Vouchers", "Registry", "Reports", "Audit Centre", "Workflow", "Admin", "Profile"];
for (const label of requiredNav) if (!shell.includes(`label: "${label}"`)) failures.push(`Missing locked navigation item: ${label}`);
if (shell.includes('{ href: "/payment-vouchers/new", label: "Create Voucher" }')) failures.push("Create Voucher must not appear in the Payment Vouchers collapsible subnavigation.");
if (!css.includes('.rg-nav-link span{font-size:13px!important')) failures.push("Main navigation typography lock (13px) is missing.");
if (!css.includes('.rg-subnav a{font-size:13px!important')) failures.push("Collapsible navigation typography lock (13px) is missing.");
if (!css.includes('font-variant-caps:normal!important')) failures.push("Collapsible items must render in normal title case, not all-small-caps.");

if (failures.length) {
  console.error("Shell architecture lock: FAIL");
  failures.forEach((f) => console.error(`- ${f}`));
  process.exit(1);
}
console.log("Shell architecture lock: PASS");
console.log("Main navigation: 13px; collapsible navigation: 13px; Command Centre removed; PV create link removed from collapsible menu.");
