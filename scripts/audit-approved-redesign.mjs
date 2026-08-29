import fs from 'node:fs';
import path from 'node:path';
const cwd=process.cwd();
const sections=['payment-vouchers','registry','hr','reports','audit-centre','workflow','staff','admin'];
const failures=[]; const counts={};
function pages(dir){const out=[]; if(!fs.existsSync(dir))return out; for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name); if(ent.isDirectory())out.push(...pages(p)); else if(ent.name==='page.tsx')out.push(p);} return out;}
for(const section of sections){const list=pages(path.join(cwd,'app',section)); counts[section]=list.length; for(const file of list){const txt=fs.readFileSync(file,'utf8'); if(/bg-gradient-to-(?:r|br)[^\n"]*(?:from-slate-9|from-blue-9|from-indigo-9|from-purple-9)/.test(txt)) failures.push(`Legacy dark hero remains: ${path.relative(cwd,file)}`);}}
const shell=fs.readFileSync(path.join(cwd,'app/components/GovernmentAppShell.tsx'),'utf8');
if(shell.includes('<ApprovedMockupFrame>{children}</ApprovedMockupFrame>')) failures.push('Synthetic ApprovedMockupFrame still wraps live pages.');
if(!shell.includes('data-route={pathname}')) failures.push('Government shell is missing route-scoped adopted-shell marker.');
const pvNav=['/payment-vouchers','/payment-vouchers/new','/payment-vouchers/pending','/payment-vouchers/approved','/payment-vouchers/print-centre','/payment-vouchers/history','/payment-vouchers/settings'];
for(const route of pvNav){if(!shell.includes(`href: "${route}"`)) failures.push(`Payment Voucher navigation missing ${route}`);}
const requiredPv=['new','pending','approved','print-centre','history']; for(const name of requiredPv){const file=path.join(cwd,'app/payment-vouchers',name,'page.tsx'); if(!fs.existsSync(file)) failures.push(`Missing approved Payment Voucher page: ${name}`);}
const savePages=['app/payment-vouchers/settings/page.tsx','app/admin/account-routing/page.tsx','app/admin/departments/page.tsx','app/admin/settings/page.tsx','app/admin/roles/page.tsx','app/workflow/page.tsx','app/staff/leave/new/page.tsx'];
for(const rel of savePages){const file=path.join(cwd,rel); if(!fs.existsSync(file)){failures.push(`Missing action page: ${rel}`);continue;} const txt=fs.readFileSync(file,'utf8'); if(!/(save|saving|submit|update|create|assign|add)/i.test(txt)) failures.push(`No explicit persisted action found: ${rel}`);}
const css=fs.readFileSync(path.join(cwd,'app/globals.css'),'utf8');
for(const token of ['FINAL APPROVED SHELL','rg-module-header','rg-stat-card','rg-section-card','color:#fff!important']) if(!css.includes(token)) failures.push(`Global adopted-shell token missing: ${token}`);
let braces=0; for(const c of css){if(c==='{')braces++; else if(c==='}')braces--;} if(braces!==0) failures.push(`globals.css brace imbalance: ${braces}`);
const report={sections:counts,totalPages:Object.values(counts).reduce((a,b)=>a+b,0),failures,passed:failures.length===0};
fs.mkdirSync(path.join(cwd,'audit-output'),{recursive:true}); fs.writeFileSync(path.join(cwd,'audit-output/approved-redesign-audit.json'),JSON.stringify(report,null,2)); console.log(JSON.stringify(report,null,2)); if(failures.length)process.exit(1);
