import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const original='/mnt/data/reqgen_s5_s10/orig';
const sections=[
  {section:5,name:'Payment Vouchers',dir:'payment-vouchers',routes:['/payment-vouchers','/payment-vouchers/reports','/payment-vouchers/settings','/payment-vouchers/[id]','/payment-vouchers/[id]/print']},
  {section:6,name:'Registry',dir:'registry',routes:['/registry','/registry/incoming','/registry/outgoing','/registry/dispatch','/registry/operations','/registry/archive']},
  {section:7,name:'HR',dir:'hr',routes:null},
  {section:8,name:'Reports',dir:'reports',routes:['/reports','/reports/enterprise-analytics']},
  {section:9,name:'Audit Centre',dir:'audit-centre',routes:['/audit-centre']},
  {section:10,name:'Workflow',dir:'workflow',routes:['/workflow']},
];
function pages(dir){
 const base=path.join(root,'app',dir); const out=[];
 function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name==='page.tsx')out.push(p)}}
 if(fs.existsSync(base))walk(base);return out.sort();
}
function routeOf(file){return '/'+path.relative(path.join(root,'app'),path.dirname(file)).replaceAll(path.sep,'/').replace(/^$/,'');}
function calls(base,dir){
 const all=[]; const b=path.join(base,'app',dir); if(!fs.existsSync(b))return all;
 function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(/\.(tsx|ts)$/.test(e.name)){const s=fs.readFileSync(p,'utf8');for(const m of s.matchAll(/\.(?:from|rpc)\(\s*["']([^"']+)["']/g))all.push(m[1])}}}
 walk(b);return [...new Set(all)].sort();
}
const adoptedFiles=['app/components/enterprise/EnterpriseUI.tsx','app/components/ui/PaymentVoucherUI.tsx','app/components/hr/HREnterprisePage.tsx','app/components/ui/ReportsUI.tsx','app/components/GovernmentAppShell.tsx','app/globals.css'];
const results=[];
for(const s of sections){
 const files=pages(s.dir); const routes=files.map(routeOf); const expected=s.routes||routes;
 const missing=expected.filter(r=>!routes.includes(r));
 const before=calls(original,s.dir), after=calls(root,s.dir);
 const contractPass=JSON.stringify(before)===JSON.stringify(after);
 results.push({section:s.section,name:s.name,pageRoutes:routes,count:routes.length,missing,dataContractsPreserved:contractPass,beforeContracts:before,afterContracts:after});
}
const shared=adoptedFiles.map(f=>({file:f,exists:fs.existsSync(path.join(root,f))}));
const globalCss=fs.readFileSync(path.join(root,'app/globals.css'),'utf8');
const cssPass=globalCss.includes('REQGEN SECTIONS 5–10 — ADOPTED SHELL ENFORCEMENT');
const conflicts=[];for(const s of sections){for(const f of pages(s.dir)){const src=fs.readFileSync(f,'utf8');if(/^(<<<<<<<|=======|>>>>>>>)/m.test(src))conflicts.push(path.relative(root,f));}}
const passedChecks=results.reduce((n,r)=>n+(r.missing.length===0?1:0)+(r.dataContractsPreserved?1:0),0)+shared.filter(x=>x.exists).length+(cssPass?1:0)+(conflicts.length===0?1:0);
const totalChecks=results.length*2+shared.length+2;
const overall=Math.round(passedChecks/totalChecks*100);
const report={generatedAt:new Date().toISOString(),scope:'ReqGen Sections 5-10 adopted-shell source/function audit',overall,totalChecks,passedChecks,cssPass,conflicts,shared,sections:results};
fs.mkdirSync(path.join(root,'audit-output'),{recursive:true});fs.writeFileSync(path.join(root,'audit-output','sections-5-to-10-audit.json'),JSON.stringify(report,null,2));
const md=['# ReqGen Sections 5–10 Adopted Shell Audit','',`Source/function conformance: **${overall}%**`,'',`Data contracts preserved: **${results.every(r=>r.dataContractsPreserved)?'YES':'NO'}**  `,`Missing expected routes: **${results.reduce((n,r)=>n+r.missing.length,0)}**  `,`Merge-conflict files: **${conflicts.length}**  `,`Adopted-shell enforcement CSS: **${cssPass?'PRESENT':'MISSING'}**`,'','| Section | Module | Pages | Routes complete | Data contracts unchanged |','|---:|---|---:|---|---|',...results.map(r=>`| ${r.section} | ${r.name} | ${r.count} | ${r.missing.length===0?'PASS':'FAIL'} | ${r.dataContractsPreserved?'PASS':'FAIL'} |`),'','## Important visual-certification note','Source conformance is not a substitute for browser screenshot comparison. Pixel-for-pixel certification remains a rendered-browser acceptance gate before production deployment.'];
fs.writeFileSync(path.join(root,'docs','SECTIONS_5_TO_10_ADOPTED_SHELL_AUDIT.md'),md.join('\n'));
console.log(JSON.stringify({overall,cssPass,conflicts:conflicts.length,sections:results.map(r=>({section:r.section,name:r.name,pages:r.count,missing:r.missing.length,contracts:r.dataContractsPreserved}))},null,2));
