"use client";

import Link from "next/link";
import { Download, Eye, FileSpreadsheet, FileText, Plus, Search } from "lucide-react";
import { FinancePageFrame } from "./FinancePageFrame";

type DirectoryMode = "vouchers" | "reports" | "monthly" | "annual";
type DirectoryConfig = {
  title: string;
  description: string;
  icon: string;
  action: string;
  href: string;
  metrics: string[][];
  rows: string[][];
};

const config = {
  vouchers: {
    title: "Finance Vouchers", description: "View, manage and track all finance vouchers.", icon: "▤", action: "Create New Voucher", href: "/payment-vouchers/new",
    metrics: [["Total Vouchers","Live register"],["Posted Vouchers","Approved"],["Draft Vouchers","In progress"],["Cancelled Vouchers","Controlled"]],
    rows: [["Payment Vouchers","Payment / disbursement records","Finance","Posted"],["Receipt Vouchers","Receipts and income records","Finance","Posted"],["Manual Vouchers","Controlled manual entries","Finance","Available"],["Voucher Register","Enterprise voucher register","Finance","Available"]],
  },
  reports: {
    title: "Finance Reports", description: "Generate and download detailed finance reports.", icon: "▧", action: "Generate New Report", href: "/reports#finance-and-workflow",
    metrics: [["Finance Reports","Live reporting"],["Ledger Reports","Available"],["Voucher Reports","Available"],["Exports","PDF / Excel"]],
    rows: [["Account Ledger Summary","Ledger","Detailed","Available"],["Subhead Ledger Report","Ledger","Detailed","Available"],["Transactions Register","Transactions","Detailed","Available"],["Voucher Summary","Vouchers","Summary","Available"]],
  },
  monthly: {
    title: "Monthly Reports", description: "View, manage and download monthly financial reports.", icon: "▦", action: "Generate Monthly Report", href: "/reports#finance-and-workflow",
    metrics: [["Current Year","2026"],["Monthly Periods","12"],["Report Engine","Ready"],["Formats","PDF / Excel"]],
    rows: [["August 2026","Monthly Financial Summary","All Departments","Ready"],["July 2026","Monthly Financial Summary","All Departments","Ready"],["June 2026","Monthly Financial Summary","All Departments","Ready"],["May 2026","Monthly Financial Summary","All Departments","Ready"]],
  },
  annual: {
    title: "Annual Reports", description: "Generate, manage and download comprehensive annual financial reports.", icon: "▥", action: "Generate Annual Report", href: "/reports#finance-and-workflow",
    metrics: [["Current Year","2026"],["Annual Summary","Available"],["Audit Output","Supported"],["Formats","PDF / Excel"]],
    rows: [["2026","Annual Financial Summary","All Departments","Current"],["2025","Annual Financial Summary","All Departments","Archive"],["2024","Annual Financial Summary","All Departments","Archive"],["2023","Annual Financial Summary","All Departments","Archive"]],
  },
} satisfies Record<DirectoryMode, DirectoryConfig>;

export default function FinanceDirectoryPage({ mode }: { mode: DirectoryMode }) {
  const c = config[mode];
  return <FinancePageFrame eyebrow="Finance" title={c.title} description={c.description} icon={c.icon} actions={<Link className="finance-mock-primary" href={c.href}><Plus size={14}/>{c.action}</Link>}>
    <section className="rg-directory-kpis">{c.metrics.map(([label,value]: string[]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>ReqGen Finance Control Centre</small></article>)}</section>
    <section className="rg-directory-panel">
      <div className="rg-directory-tabs"><button className="is-active">All</button><button>Active</button><button>Completed</button><button>Archive</button></div>
      <div className="rg-directory-filters"><label><Search size={15}/><input placeholder={`Search ${c.title.toLowerCase()}...`}/></label><select defaultValue="all"><option value="all">All Types</option></select><select defaultValue="status"><option value="status">All Status</option></select><Link href={c.href} className="rg-directory-export"><Download size={14}/> Export</Link></div>
      <div className="rg-directory-table-wrap"><table className="rg-directory-table"><thead><tr><th>#</th><th>Name / Period</th><th>Category / Type</th><th>Scope</th><th>Status</th><th>Format</th><th>Actions</th></tr></thead><tbody>{c.rows.map((row: string[],i: number)=><tr key={`${row[0]}-${i}`}><td>{i+1}</td><td><strong>{row[0]}</strong></td><td>{row[1]}</td><td>{row[2]}</td><td><span className="rg-status-success">{row[3]}</span></td><td><span className="rg-format"><FileText size={13}/>PDF</span> <span className="rg-format"><FileSpreadsheet size={13}/>Excel</span></td><td><div className="rg-row-actions"><Link href={c.href} aria-label="View"><Eye size={14}/></Link><Link href={c.href} aria-label="Download"><Download size={14}/></Link></div></td></tr>)}</tbody></table></div>
      <div className="rg-directory-pagination"><span>Showing 1 to {c.rows.length} entries</span><div><button className="is-active">1</button></div></div>
    </section>
  </FinancePageFrame>;
}
