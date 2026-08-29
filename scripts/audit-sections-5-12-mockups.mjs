import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const specs=JSON.parse(fs.readFileSync(path.join(root,'docs/20260829_SECTIONS_5_TO_12_APPROVED_MOCKUP_SPECS.json'),'utf8'));
const failures=[]; const sections=new Map();
for(const spec of specs){
  const key=spec.section; sections.set(key,(sections.get(key)||0)+1);
  const route=spec.route;
  const parts=route.split('/').filter(Boolean).map(x=>x.startsWith('[')?x:x);
  const page=path.join(root,'app',...parts,'page.tsx');
  if(!fs.existsSync(page)) failures.push(`${route}: route file missing`);
  if(spec.redirect===null && fs.existsSync(page)){
    const src=fs.readFileSync(page,'utf8');
    for(const rpc of spec.rpcs||[]) if(!src.includes(rpc) && !src.includes('redirect(')) failures.push(`${route}: RPC/function ${rpc} not found in source`);
    for(const table of spec.tables||[]) if(!src.includes(table) && !src.includes('redirect(')) failures.push(`${route}: table/source ${table} not found in source`);
  }
}
const shell=fs.readFileSync(path.join(root,'app/components/GovernmentAppShell.tsx'),'utf8');
if(!shell.includes('data-route={pathname}')) failures.push('GovernmentAppShell: data-route hook missing');
const css=fs.readFileSync(path.join(root,'app/globals.css'),'utf8');
if(!css.includes('REQGEN SECTIONS 5-12 FUNCTION-LOCKED MOCKUP IMPLEMENTATION')) failures.push('globals.css: S5-12 design lock missing');
for(const f of ['app/components/admin/AdminNavigation.tsx','app/components/staff/StaffNavigation.tsx','app/components/registry/RegistryNavigation.tsx','app/components/hr/HRNavigation.tsx']){
  const src=fs.readFileSync(path.join(root,f),'utf8'); if(!src.includes('return null')) failures.push(`${f}: duplicate local navigation still renders`);
}
console.log(JSON.stringify({specs:specs.length,sections:Object.fromEntries(sections),failures,passed:failures.length===0},null,2));
if(failures.length) process.exit(1);
