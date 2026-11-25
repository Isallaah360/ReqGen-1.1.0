import type { ReactElement } from "react";
import Coming from "../screens/Coming";
import { GenerateVoucher, ManualVoucher, Signatories, VoucherList } from "../screens/office/Vouchers";
import { BankAccounts, FinanceProcessing, FinanceSettings, Integrity, Ledgers, OfficerAssignment, Subheads, Transfers } from "../screens/office/Finance";
import { Archive, Correspondence, Dispatch, Filing, Tracking } from "../screens/office/Registry";
import { Compliance, Executive, FinanceStatements, PrintRegister, RegistryReport, RequestReport, TransactionsReport, VoucherReport } from "../screens/office/Reports";
import { AuditLog, Backup, Reconciliation, WorkflowTrace } from "../screens/office/Audit";
import { Departments, Diagnostics, FinanceReset, Permissions, Positions, Routing, SecurityCentre, StaffList, SystemAccounts } from "../screens/office/Admin";
import { DevActivity, DevModules, DevReleases } from "../screens/office/Developer";
import { MyActivity, MyAccess, SetupGuide } from "../screens/office/Mine";

/**
 * App 4.1.0: the app screen for each office page (the same list as the website's menu). Every office
 * is an app screen of its own; the app never opens a website page.
 */
const SCREENS: Record<string, (title: string) => ReactElement> = {
  "/payment-vouchers/centre": () => <VoucherList mode="centre" />,
  "/payment-vouchers/new": () => <GenerateVoucher />,
  "/payment-vouchers/manual": () => <ManualVoucher />,
  "/payment-vouchers/pending": () => <VoucherList mode="tracker" />,
  "/payment-vouchers/approved": () => <VoucherList mode="ready" />,
  "/payment-vouchers/history": () => <VoucherList mode="history" />,
  "/payment-vouchers/print-centre": () => <VoucherList mode="print" />,
  "/payment-vouchers/settings": () => <Signatories />,
  "/approvals/vouchers": () => <VoucherList mode="mine" />,
  "/finance/processing": () => <FinanceProcessing />,
  "/finance/manage-accounts": () => <BankAccounts />,
  "/finance/manage-accounts/assign": () => <OfficerAssignment />,
  "/finance/subheads": () => <Subheads />,
  "/finance/transactions": () => <Ledgers />,
  "/finance/account-transfers": () => <Transfers />,
  "/finance/transactions-centre": () => <Ledgers centre />,
  "/finance/integrity": () => <Integrity />,
  "/finance/settings": () => <FinanceSettings />,
  "/registry/tracking": () => <Tracking />,
  "/registry/incoming": () => <Correspondence direction="incoming" />,
  "/registry/outgoing": () => <Correspondence direction="outgoing" />,
  "/registry/dispatch": () => <Dispatch />,
  "/registry/archive": () => <Archive />,
  "/registry/filing": () => <Filing />,
  "/reports/transactions": () => <TransactionsReport />,
  "/reports/requests": () => <RequestReport />,
  "/reports/finance-statements": () => <FinanceStatements />,
  "/reports/vouchers": () => <VoucherReport />,
  "/reports/registry": () => <RegistryReport />,
  "/reports/enterprise-analytics": () => <Executive />,
  "/requests/printable": () => <PrintRegister />,
  "/reports/compliance": () => <Compliance />,
  "/audit-centre/logs": () => <AuditLog />,
  "/workflow": () => <WorkflowTrace />,
  "/audit-centre/reconciliation": () => <Reconciliation />,
  "/audit-centre/backup": () => <Backup />,
  "/admin/system-accounts": () => <SystemAccounts />,
  "/admin/users": () => <StaffList />,
  "/admin/positions": () => <Positions />,
  "/admin/roles": () => <Permissions />,
  "/admin/departments": () => <Departments />,
  "/admin/routing": () => <Routing />,
  "/admin/security": () => <SecurityCentre />,
  "/admin/system-health": () => <Diagnostics />,
  "/admin/finance-reset": () => <FinanceReset />,
  "/developer/modules": () => <DevModules />,
  "/developer/releases": () => <DevReleases />,
  "/developer/accounts": () => <SystemAccounts />,
  "/developer/activity": () => <DevActivity />,
  "/profile/access": () => <MyAccess />,
  "/profile/activity": () => <MyActivity />,
  "/profile/setup": () => <SetupGuide />,
};

export function screenFor(href: string, title: string) {
  const make = SCREENS[href.split(/[?#]/)[0]];
  return make ? make(title) : <Coming title={title} />;
}
export const hasScreen = (href: string) => !!SCREENS[href.split(/[?#]/)[0]];
