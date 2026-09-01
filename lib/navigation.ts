export type NavigationItem = {
  href: string;
  label: string;
  section: string;
  description: string;
  keywords?: string[];
};

/**
 * ReqGen's user-facing route catalogue.
 * Keep this list intentionally explicit: it powers system-wide navigation search
 * and prevents valid pages from becoming unreachable when a module dashboard changes.
 */
export const NAVIGATION_ITEMS: NavigationItem[] = [
  { href: "/dashboard", label: "Main Dashboard", section: "General", description: "System overview and personal workflow summary.", keywords: ["home"] },
  { href: "/dashboard/activity", label: "Dashboard Activity", section: "General", description: "Recent system and workflow activity." },

  { href: "/requests", label: "Requests", section: "Requests", description: "Browse and manage authorised requests." },
  { href: "/approvals", label: "Approvals Inbox", section: "Approvals", description: "Requests currently requiring attention or approval." },

  { href: "/finance", label: "Finance Control Centre", section: "Finance", description: "Finance command centre and operational overview." },
  { href: "/finance/manage-accounts", label: "IET Bank Accounts", section: "Finance · Accounts", description: "Manage IET bank names, funds and account status.", keywords: ["bank accounts", "banks"] },
  { href: "/finance/manage-accounts/assign", label: "Assign Bank to Officer", section: "Finance · Accounts", description: "Assign IET bank accounts to authorised Accounting Officers." },
  { href: "/finance/accounts", label: "Accounts Setup (Legacy)", section: "Finance · Accounts", description: "Legacy account setup utility retained for continuity." },
  { href: "/finance/assign-account", label: "Account Assignment (Legacy)", section: "Finance · Accounts", description: "Legacy IET account assignment utility." },
  { href: "/finance/account-ledger", label: "Account Ledger", section: "Finance · Accounting", description: "Debit, credit and running balances for IET accounts." },
  { href: "/finance/account-transfers", label: "Account Transfers", section: "Finance · Accounting", description: "Controlled transfers between authorised IET accounts." },
  { href: "/finance/subheads", label: "Finance Subheads", section: "Finance · Budget", description: "Manage finance subheads and bank allocations." },
  { href: "/finance/subhead-ledger", label: "Subhead Ledger", section: "Finance · Budget", description: "Allocation, reservation, expenditure and balance history." },
  { href: "/finance/departments", label: "Finance Departments", section: "Finance · Budget", description: "Finance department setup and budget context." },
  { href: "/finance/manual-voucher", label: "Manual Voucher", section: "Finance · Transactions", description: "Create authorised manual finance vouchers." },
  { href: "/finance/vouchers", label: "Finance Vouchers", section: "Finance · Transactions", description: "Finance voucher register and controls." },
  { href: "/finance/transactions", label: "Finance Transactions", section: "Finance · Transactions", description: "Consolidated finance transaction register." },
  { href: "/finance/reports", label: "Finance Reports", section: "Finance · Reports", description: "Finance reporting workspace." },
  { href: "/finance/reports/monthly", label: "Monthly Finance Reports", section: "Finance · Reports", description: "Monthly finance reporting and analysis." },
  { href: "/finance/reports/annual", label: "Annual Finance Reports", section: "Finance · Reports", description: "Annual finance reporting and analysis." },
  { href: "/finance/reports/print", label: "Finance Report Print", section: "Finance · Reports", description: "Print or save finance reports as PDF." },
  { href: "/finance/print-centre", label: "Finance Print Centre", section: "Finance · Reports", description: "Central finance printing workspace." },
  { href: "/finance/export-centre", label: "Finance Export Centre", section: "Finance · Reports", description: "Export authorised finance registers and reports." },
  { href: "/finance/audit", label: "Finance Audit", section: "Finance · Governance", description: "Finance audit summaries and controls." },
  { href: "/finance/audit-trail", label: "Finance Audit Trail", section: "Finance · Governance", description: "Inspect finance record changes and actors." },
  { href: "/finance/activity-history", label: "Finance Activity History", section: "Finance · Governance", description: "Chronological finance activity history." },
  { href: "/finance/settings", label: "Finance Settings", section: "Finance · Governance", description: "Finance numbering, fiscal-year and workflow settings." },

  { href: "/payment-vouchers", label: "Payment Voucher Centre", section: "Payment Vouchers", description: "Create, review and manage payment vouchers." },
  { href: "/payment-vouchers/new", label: "Create Voucher", section: "Payment Vouchers", description: "Open the controlled payment-voucher creation workflow." },
  { href: "/payment-vouchers/pending", label: "Pending Vouchers", section: "Payment Vouchers", description: "Review vouchers still moving through approval or payment processing." },
  { href: "/payment-vouchers/approved", label: "Approved Vouchers", section: "Payment Vouchers", description: "Review vouchers approved and ready for payment or printing." },
  { href: "/payment-vouchers/history", label: "Voucher History", section: "Payment Vouchers", description: "Historical register of completed, paid and closed vouchers." },
  { href: "/payment-vouchers/print-centre", label: "Voucher Print Centre", section: "Payment Vouchers", description: "Locate and print authorised payment vouchers." },
  { href: "/payment-vouchers/reports", label: "Payment Voucher Reports", section: "Payment Vouchers", description: "Payment voucher reporting workspace." },
  { href: "/payment-vouchers/settings", label: "Payment Voucher Settings", section: "Payment Vouchers", description: "Payment voucher configuration." },


  { href: "/registry", label: "Registry Desk", section: "Registry", description: "Registry command centre and file movement overview." },
  { href: "/registry/operations", label: "Registry Operations", section: "Registry", description: "Central registry operations workspace." },
  { href: "/registry/incoming", label: "Incoming Register", section: "Registry", description: "Register and track incoming records." },
  { href: "/registry/outgoing", label: "Outgoing Register", section: "Registry", description: "Register and track outgoing records." },
  { href: "/registry/dispatch", label: "Registry Dispatch", section: "Registry", description: "Dispatch and movement control." },
  { href: "/registry/archive", label: "Registry Archive", section: "Registry", description: "Archived registry records." },

  { href: "/reports", label: "Reports & Analytics", section: "Reports", description: "Institutional reporting and analytics centre." },
  { href: "/reports/enterprise-analytics", label: "Analytics", section: "Reports", description: "Cross-module analytical view." },
  { href: "/output", label: "Output Centre", section: "Reports", description: "Printable and exportable system output." },


  { href: "/audit-centre", label: "Audit Centre", section: "Governance", description: "Audit oversight." },
  { href: "/workflow", label: "Workflow Intelligence", section: "Governance", description: "Workflow intelligence and process monitoring." },

  { href: "/admin", label: "Administration Centre", section: "Administration", description: "System administration command centre." },
  { href: "/admin/users", label: "User Management", section: "Administration", description: "Manage ReqGen users." },
  { href: "/admin/roles", label: "Role Management", section: "Administration", description: "Manage roles and access assignments." },
  { href: "/admin/departments", label: "Department Management", section: "Administration", description: "Manage IET departments." },
  { href: "/admin/account-routing", label: "Account Routing", section: "Administration", description: "Configure department-to-account routing." },
  { href: "/admin/security", label: "Security Centre", section: "Administration", description: "Security configuration and oversight." },
  { href: "/admin/settings", label: "System Settings", section: "Administration", description: "ReqGen administrative settings." },

  { href: "/profile", label: "My Profile", section: "Account", description: "Personal ReqGen profile." },
  { href: "/profile/access", label: "My Access", section: "Account", description: "View assigned and active access context." },
  { href: "/profile/activity", label: "My Activity", section: "Account", description: "View personal ReqGen activity." },
  { href: "/profile/security", label: "Profile Security", section: "Account", description: "Manage personal security settings." },
  { href: "/change-password", label: "Change Password", section: "Account", description: "Change the signed-in user's password." },
  { href: "/output", label: "Output Centre", section: "Reports", description: "Generate authorised IET A4 reports and protected print outputs." },
];

export function getContextTips(pathname: string): string[] {
  if (pathname.startsWith("/finance/manage-accounts")) {
    return [
      "Store only the IET account label and bank name here; bank account numbers are intentionally excluded.",
      "New bank codes are generated automatically to prevent duplicate-code errors.",
      "Use Set Bank Fund for balances and Assign to Officer for responsibility routing.",
      "Use the system search to jump directly to any authorised finance page.",
    ];
  }
  if (pathname.startsWith("/finance")) {
    return [
      "Use IET Bank Accounts for institutional bank names and funding sources.",
      "Use Account Ledger and Subhead Ledger to trace movements before changing balances.",
      "Finance pages shown in search are filtered to your active role.",
    ];
  }
  if (pathname.startsWith("/registry")) {
    return [
      "Use Incoming and Outgoing registers for record direction; Dispatch is for movement control.",
      "Search can open any Registry page permitted by your active role.",
    ];
  }
  if (pathname.startsWith("/admin")) {
    return [
      "Use Role Management for assignments and Access Audit to verify effective navigation.",
      "System Health and Release Readiness are useful before a production deployment.",
      "Search results never expose pages your active role cannot access.",
    ];
  }
  return [
    "Use the system search to find pages, modules and functions by name.",
    "Only pages allowed for your currently active role appear in search results.",
    "Switch active role when you need to work in a different authorised responsibility.",
  ];
}
