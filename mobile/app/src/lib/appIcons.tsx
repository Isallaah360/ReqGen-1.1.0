import type { ReactNode } from "react";
import {
  Activity, FileText, FilePlus2, ClipboardList, FileCheck2, PenLine, History, Banknote, Landmark, UserCog, PiggyBank, BookOpen, ArrowLeftRight,
  ReceiptText, Scale, SlidersHorizontal, Receipt, FileOutput, FilePen, Timer, Wallet, CalendarCheck, Printer, Stamp, Route, Inbox, ArrowUpFromLine,
  Truck, Archive, FolderArchive, TrendingUp, FileBarChart, FileSpreadsheet, PieChart, BarChart3, Gauge, ShieldCheck, ScrollText, Workflow, GitCompare,
  DatabaseBackup, ShieldHalf, UsersRound, IdCard, Grid3x3, Building2, Lock, Stethoscope, RotateCcw, CircleUserRound, Signature, LockKeyhole, KeyRound,
  ListChecks, ToggleRight, Rocket, Code, Briefcase, SearchCheck, MapPinned,
} from "lucide-react";

/**
 * 4.2.2: one picture per page, so every icon says what it opens (owner, 26 Nov 2026).
 * Settings is always a gear and Profile is always a person; nothing else uses them.
 */
const S = 28;
const BY_TITLE: Record<string, ReactNode> = {
  "Recent Activity": <Activity size={S} />, "My Requests": <FileText size={S} />, "New Request": <FilePlus2 size={S} />,
  "Print Register": <ClipboardList size={S} />, "Requests to Approve": <FileCheck2 size={S} />, "Vouchers to Sign": <PenLine size={S} />,
  "Treated by Me": <History size={S} />, "Finance Processing": <Banknote size={S} />, "Bank Accounts": <Landmark size={S} />,
  "Officer Assignment": <UserCog size={S} />, "Budget & Subheads": <PiggyBank size={S} />, Ledgers: <BookOpen size={S} />,
  Transfers: <ArrowLeftRight size={S} />, "Transaction Centre": <ReceiptText size={S} />, "Finance Integrity": <Scale size={S} />,
  "Finance Settings": <SlidersHorizontal size={S} />, "Voucher Centre": <Receipt size={S} />, "Generate from Requests": <FileOutput size={S} />,
  "Manual Voucher": <FilePen size={S} />, "Signing Tracker": <Timer size={S} />, "Ready to Pay": <Wallet size={S} />,
  "Paid History": <CalendarCheck size={S} />, "Print Centre": <Printer size={S} />, Signatories: <Stamp size={S} />,
  "Request Tracking": <MapPinned size={S} />, Incoming: <Inbox size={S} />, Outgoing: <ArrowUpFromLine size={S} />, Dispatch: <Truck size={S} />,
  Archive: <Archive size={S} />, "Registry Filing": <FolderArchive size={S} />, "Transactions + Analysis": <TrendingUp size={S} />,
  "Request Reports": <FileBarChart size={S} />, "Finance Statements": <FileSpreadsheet size={S} />, "Voucher Reports": <PieChart size={S} />,
  "Registry Reports": <BarChart3 size={S} />, "Executive Analytics": <Gauge size={S} />, Compliance: <ShieldCheck size={S} />,
  "Audit Log": <ScrollText size={S} />, "Workflow Trace": <Workflow size={S} />, "Finance Reconciliation": <GitCompare size={S} />,
  "Master Backup": <DatabaseBackup size={S} />, "System Accounts": <ShieldHalf size={S} />, "Staff & Positions": <UsersRound size={S} />,
  Positions: <IdCard size={S} />, "Permissions Matrix": <Grid3x3 size={S} />, Departments: <Building2 size={S} />, "Routing Engine": <Route size={S} />,
  "Security Centre": <Lock size={S} />, Diagnostics: <Stethoscope size={S} />, "Financial Reset": <RotateCcw size={S} />,
  Profile: <CircleUserRound size={S} />, "Signature & Photo": <Signature size={S} />, "Security & Devices": <LockKeyhole size={S} />,
  "My Access": <KeyRound size={S} />, "My Activity": <History size={S} />, "Setup Guide": <ListChecks size={S} />, Modules: <ToggleRight size={S} />,
  Releases: <Rocket size={S} />, "Developer Activity": <Code size={S} />,
};
const BY_OFFICE: Record<string, ReactNode> = {
  finance: <Banknote size={S} />, vouchers: <Receipt size={S} />, "payment-vouchers": <Receipt size={S} />, registry: <Archive size={S} />,
  reports: <BarChart3 size={S} />, audit: <SearchCheck size={S} />, administration: <Briefcase size={S} />, admin: <Briefcase size={S} />, developer: <Code size={S} />,
};
export const pageIcon = (title: string, fallback: ReactNode) => <span className="app-svg">{BY_TITLE[title] || fallback}</span>;
export const officeIcon = (key: string, fallback: ReactNode) => <span className="app-svg">{BY_OFFICE[key] || fallback}</span>;
