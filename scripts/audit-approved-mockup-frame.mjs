import fs from 'node:fs';
import path from 'node:path';

const cwd=process.cwd();
const specs=JSON.parse(fs.readFileSync(path.join(cwd,'docs','20260829_SECTIONS_5_TO_12_APPROVED_MOCKUP_SPECS.json'),'utf8'));
const frame=fs.readFileSync(path.join(cwd,'app','components','ApprovedMockupFrame.tsx'),'utf8');
const shell=fs.readFileSync(path.join(cwd,'app','components','GovernmentAppShell.tsx'),'utf8');
const registry=fs.readFileSync(path.join(cwd,'lib','approvedMockupSpecs.ts'),'utf8');
const css=fs.readFileSync(path.join(cwd,'app','globals.css'),'utf8');
const failures=[];

if(!shell.includes('<ApprovedMockupFrame>{children}</ApprovedMockupFrame>')) failures.push('GovernmentAppShell does not wrap protected content with ApprovedMockupFrame.');
for(const token of ['rg-approved-kpis','rg-approved-filterbar','rg-approved-primary','Workspace Summary']) if(!frame.includes(token)) failures.push(`Approved frame missing ${token}.`);
if(!css.includes('APPROVED MOCKUP PIXEL-LOCK V2')) failures.push('Pixel-lock V2 CSS is missing.');
if(!css.includes('color:#fff!important')) failures.push('Contrast hardening rule is missing.');

for(const spec of specs){
  const a=`\"route\":\"${spec.route.replaceAll('\\','\\\\').replaceAll('"','\\"')}\"`;
  const b=`route: ${JSON.stringify(spec.route)}`;
  if(!registry.includes(a)&&!registry.includes(b)) failures.push(`Missing approved registry entry: ${spec.route}`);
}

const settings=specs.filter(s=>['settings','form'].includes(s.type)&&!s.redirect&&!s.route.includes('[id]'));
for(const spec of settings){
  const file=path.join(cwd,'app',...spec.route.split('/').filter(Boolean),'page.tsx');
  if(!fs.existsSync(file)){failures.push(`Missing settings/form page: ${spec.route}`);continue;}
  const text=fs.readFileSync(file,'utf8');
  if(!/(save|saving|submit|update|create|add)/i.test(text)) failures.push(`No explicit save/submit action found for ${spec.route}`);
}

for(const nav of ['app/components/admin/AdminNavigation.tsx','app/components/hr/HRNavigation.tsx','app/components/registry/RegistryNavigation.tsx']){
  const text=fs.readFileSync(path.join(cwd,nav),'utf8');
  if(!/return null/.test(text)) failures.push(`Legacy local navigation still renders: ${nav}`);
}

const report={specs:specs.length,settingsChecked:settings.length,failures,passed:failures.length===0};
fs.writeFileSync(path.join(cwd,'audit-output','approved-mockup-frame-audit.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(failures.length) process.exit(1);
