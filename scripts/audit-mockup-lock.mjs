import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const specs = [
  {section:1,page:'1',route:'/dashboard',file:'app/dashboard/page.tsx',required:['Pending Approvals','Completed / Paid','Total Disbursed','Overdue','Request Trend','Recent Activities','Requests by Category','Requests by Status','Quick Actions','Security Tip'],forbidden:['ERP 2.0']},
  {section:2,page:'1',route:'/requests',file:'app/requests/page.tsx',required:['Total Requests','Active Workflow','Completed / Paid','Official Requests','Rejected / Deleted','All Requests','Personal Fund','Personal Other','New Request'],forbidden:['Requests Trend','Requests by Type']},
  {section:2,page:'2',route:'/requests/new',file:'app/requests/new/page.tsx',required:['Create New Request'],forbidden:['Enterprise']},
  {section:3,page:'1',route:'/approvals',file:'app/approvals/page.tsx',required:['Approvals Overview','Action Centre'],forbidden:['Enterprise']},
  {section:3,page:'2',route:'/approvals/action-centre',file:'app/approvals/action-centre/page.tsx',required:['Action Centre','Pending Requests','Request Details','Approval Workflow','Quick Actions','Approval Notifications'],forbidden:['Enterprise']},
  {section:4,page:'1',route:'/finance',file:'app/finance/page.tsx',required:['Finance Overview','Total Budget','Total Expenditure'],forbidden:['Enterprise']},
  {section:4,page:'2',route:'/finance/manage-accounts',file:'app/finance/manage-accounts/page.tsx',required:['IET Bank Accounts','account numbers are not stored'],forbidden:['Enterprise']},
  {section:4,page:'3',route:'/finance/manage-accounts/assign',file:'app/finance/manage-accounts/assign/page.tsx',required:['Assign Bank to Officer'],forbidden:['Enterprise']},
  {section:4,page:'4',route:'/finance/subheads',file:'app/finance/subheads/page.tsx',required:['Finance Subheads'],forbidden:['Enterprise']},
  {section:4,page:'5',route:'/finance/departments',file:'app/finance/departments/page.tsx',required:['Finance Departments','With Subheads'],forbidden:['departmentType(','Department Type','Manage Department Types','Enterprise']},
  {section:4,page:'6',route:'/finance/account-ledger',file:'app/finance/_components/FinanceOperationsWorkspace.tsx',required:['Account Ledger','Opening Balance','Total Debit','Total Credit','Closing Balance'],forbidden:['Enterprise']},
  {section:4,page:'7',route:'/finance/subhead-ledger',file:'app/finance/_components/FinanceOperationsWorkspace.tsx',required:['Subhead Ledger','Opening Balance','Total Debit','Total Credit','Closing Balance'],forbidden:['Enterprise']},
  {section:4,page:'8',route:'/finance/account-transfers',file:'app/finance/_components/FinanceOperationsWorkspace.tsx',required:['Account Transfers','New Transfer','post_account_transfer'],forbidden:['Enterprise']},
  {section:4,page:'9',route:'/finance/transactions',file:'app/finance/_components/FinanceOperationsWorkspace.tsx',required:['Transactions Register','Total Transactions','Total Debit','Total Credit'],forbidden:['Enterprise']},
  {section:4,page:'10',route:'/finance/manual-voucher',file:'app/finance/manual-voucher/page.tsx',required:['Manual Voucher Centre','save_manual_payment_voucher','post_manual_payment_voucher'],forbidden:['Enterprise']},
  {section:4,page:'11',route:'/finance/vouchers',file:'app/finance/_components/FinanceOperationsWorkspace.tsx',required:['Finance Vouchers','Create Voucher'],forbidden:['Enterprise']},
  {section:4,page:'12',route:'/finance/reports',file:'app/finance/_components/FinanceOperationsWorkspace.tsx',required:['Finance Reports','Popular Reports'],forbidden:['Enterprise']},
  {section:4,page:'13',route:'/finance/reports/monthly',file:'app/finance/_components/FinanceOperationsWorkspace.tsx',required:['Monthly Reports','Monthly Summary'],forbidden:['Enterprise']},
];

const shellFiles = ['app/components/GovernmentAppShell.tsx','app/globals.css','app/components/staff/StaffFooter.tsx','app/components/ActiveRoleSwitcher.tsx'];
const results=[];
for (const spec of specs){
  const full=path.join(root,spec.file);
  const exists=fs.existsSync(full);
  const src=exists?fs.readFileSync(full,'utf8'):'';
  const required=spec.required.map(x=>({check:x,pass:src.includes(x)}));
  const forbidden=spec.forbidden.map(x=>({check:x,pass:!src.includes(x)}));
  const checks=[{check:'file exists',pass:exists},...required,...forbidden];
  const passed=checks.filter(x=>x.pass).length;
  results.push({...spec,passed,total:checks.length,percent:Math.round(passed/checks.length*100),checks});
}
const shellChecks=shellFiles.map(f=>({file:f,pass:fs.existsSync(path.join(root,f))}));
const allFiles=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()&&!['node_modules','.next'].includes(e.name))walk(p);else if(e.isFile()&&/\.(tsx|ts|css)$/.test(e.name))allFiles.push(p)}}
walk(path.join(root,'app')); walk(path.join(root,'lib'));
let conflicts=0,badHidden=0,enterprise=0;
for(const f of allFiles){const s=fs.readFileSync(f,'utf8');if(/^(<<<<<<<|=======|>>>>>>>)/m.test(s))conflicts++;if(f.endsWith('.css') && /(^|[,}])\s*[^,{]+:hidden(?:\s*[,\{]|$)/m.test(s))badHidden++;if(/Enterprise Audit|Enterprise Finance|Enterprise HR|Enterprise Registry/.test(s))enterprise++;}
const totals=results.reduce((a,r)=>({passed:a.passed+r.passed,total:a.total+r.total}),{passed:0,total:0});
const overall=Math.round(totals.passed/totals.total*100);
const report={generatedAt:new Date().toISOString(),scope:'ReqGen adopted-shell approved mockups Sections 1-4',overall,totals,shellChecks,global:{conflicts,badHidden,enterprise},pages:results};
fs.mkdirSync(path.join(root,'audit-output'),{recursive:true});
fs.writeFileSync(path.join(root,'audit-output','mockup-lock-audit.json'),JSON.stringify(report,null,2));
const md=['# ReqGen Sections 1-4 Mockup-Lock Audit','',`Overall source/spec conformance: **${overall}%**`,'',`Merge-conflict files: **${conflicts}**  `,`Invalid :hidden selectors: **${badHidden}**  `,`Prohibited Enterprise module labels: **${enterprise}**`,'','| Section | Page | Route | Score |','|---:|---:|---|---:|',...results.map(r=>`| ${r.section} | ${r.page} | ${r.route} | ${r.percent}% |`),'','## Failed checks',...results.flatMap(r=>r.checks.filter(c=>!c.pass).map(c=>`- S${r.section} P${r.page} ${r.route}: ${c.check}`))];
fs.writeFileSync(path.join(root,'docs','SECTIONS_1_TO_4_MOCKUP_LOCK_AUDIT.md'),md.join('\n'));
console.log(JSON.stringify({overall,failed:results.flatMap(r=>r.checks.filter(c=>!c.pass).map(c=>`${r.route}: ${c.check}`)),global:report.global},null,2));
