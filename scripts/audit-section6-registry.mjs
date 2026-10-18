import fs from 'node:fs';
const read=(p)=>fs.readFileSync(p,'utf8');
const checks=[]; const ok=(name,pass)=>checks.push([name,pass]);
const shell=(read("app/components/GovernmentAppShell.tsx") + read("app/components/v4/AppFrame.tsx") + read("app/components/v4/Bell.tsx") + read("lib/v4/modules.ts"));
// v4.6.3: the v3 Registry Centre / Archive workspaces are deleted; the checks follow the v4 Registry pages
const centre=read('lib/v4/registry.ts')+read('app/components/v4/Correspondence.tsx')+read('app/registry/dispatch/page.tsx');
const archive=read('app/registry/archive/page.tsx');
const perms=read('lib/permissions.ts');
// v4.5 (mock-up 68): Tracking, Incoming, Outgoing, Dispatch, Archive, Filing — the old Centre forwards to /registry
ok('Registry mother page tiles: Tracking, Incoming, Outgoing, Dispatch, Archive, Filing', ['/registry/tracking', '/registry/incoming', '/registry/outgoing', '/registry/dispatch', '/registry/archive', '/registry/filing'].every((h) => shell.includes(`href: "${h}"`)));
ok('Registry uses live registry_correspondence', centre.includes('from("registry_correspondence")'));
ok('Registry uses live departments', centre.includes('from("departments")'));
ok('Registry has incoming, outgoing and dispatch', ['incoming','outgoing'].every(x=>centre.includes(`"${x}"`)) && centre.includes('rpc("reqgen_registry_dispatch"'));
ok('Registry Archive uses the live archive', archive.includes('from("reqgen_registry_archive")'));
ok('Registry Archive supports authorised restoration', archive.includes('rpc("reqgen_registry_archive_restore"'));
ok('Registrar route access enabled', perms.includes('"registry", "registrar"'));
ok('Registry pages use the v4 kit', ['app/registry/tracking/page.tsx','app/registry/dispatch/page.tsx','app/registry/archive/page.tsx','app/registry/filing/page.tsx'].every((f)=>read(f).includes('<V4Page')));
let fail=0; for(const [name,pass] of checks){console.log(`${pass?'PASS':'FAIL'} ${name}`); if(!pass)fail++;}
if(fail){console.error(`Section 6 Registry audit failed: ${fail}`);process.exit(1);} console.log(`Section 6 Registry audit passed: ${checks.length}/${checks.length}`);
