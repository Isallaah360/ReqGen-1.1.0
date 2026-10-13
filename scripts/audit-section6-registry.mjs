import fs from 'node:fs';
const read=(p)=>fs.readFileSync(p,'utf8');
const checks=[]; const ok=(name,pass)=>checks.push([name,pass]);
const shell=(read("app/components/GovernmentAppShell.tsx") + read("app/components/v4/AppFrame.tsx") + read("app/components/v4/Bell.tsx") + read("lib/v4/modules.ts"));
const centre=read('app/components/registry/RegistryCentreWorkspace.tsx');
const archive=read('app/components/registry/RegistryArchiveWorkspace.tsx');
const perms=read('lib/permissions.ts');
// v4.5 (mock-up 68): Tracking, Incoming, Outgoing, Dispatch, Archive, Filing — the old Centre forwards to /registry
ok('Registry mother page tiles: Tracking, Incoming, Outgoing, Dispatch, Archive, Filing', ['/registry/tracking', '/registry/incoming', '/registry/outgoing', '/registry/dispatch', '/registry/archive', '/registry/filing'].every((h) => shell.includes(`href: "${h}"`)));
ok('Registry Centre uses live registry_correspondence', centre.includes('from("registry_correspondence")'));
ok('Registry Centre uses live departments', centre.includes('from("departments")'));
ok('Registry Centre has all five consolidated views', ['overview','incoming','outgoing','dispatch','all'].every(x=>centre.includes(`"${x}"`)));
ok('Registry Archive uses live registry_correspondence', archive.includes('from("registry_correspondence")'));
ok('Registry Archive supports authorised restoration', archive.includes('restore(') && archive.includes('Restored'));
ok('Registrar route access enabled', perms.includes('"registry", "registrar"'));
ok('13px Registry baseline', read('app/registry/registry.module.css').includes('font-size: 13px') || read('app/registry/registry.module.css').includes('font-size:13px'));
ok('13px Archive baseline', read('app/registry/archive/archive.module.css').includes('font-size:13px'));
let fail=0; for(const [name,pass] of checks){console.log(`${pass?'PASS':'FAIL'} ${name}`); if(!pass)fail++;}
if(fail){console.error(`Section 6 Registry audit failed: ${fail}`);process.exit(1);} console.log(`Section 6 Registry audit passed: ${checks.length}/${checks.length}`);
