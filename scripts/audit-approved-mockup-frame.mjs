import fs from 'node:fs';
import path from 'node:path';

const specs = JSON.parse(fs.readFileSync(path.join(process.cwd(),'docs','20260829_SECTIONS_5_TO_12_APPROVED_MOCKUP_SPECS.json'),'utf8'));
const frame = fs.readFileSync(path.join(process.cwd(),'app','components','ApprovedMockupFrame.tsx'),'utf8');
const shell = fs.readFileSync(path.join(process.cwd(),'app','components','GovernmentAppShell.tsx'),'utf8');
const registry = fs.readFileSync(path.join(process.cwd(),'lib','approvedMockupSpecs.ts'),'utf8');
const routeTypes = fs.readFileSync(path.join(process.cwd(),'lib','mockupRouteTypes.ts'),'utf8');
const css = fs.readFileSync(path.join(process.cwd(),'app','globals.css'),'utf8');

const failures=[];
if (!shell.includes('<ApprovedMockupFrame>{children}</ApprovedMockupFrame>')) failures.push('GovernmentAppShell does not wrap protected content with ApprovedMockupFrame.');
if (!frame.includes('Workspace Summary')) failures.push('Approved frame is missing Workspace Summary composition.');
if (!css.includes('SECTIONS 5-12 — APPROVED MOCKUP FRAME V1')) failures.push('Approved Sections 5-12 CSS lock is missing.');

for (const spec of specs) {
  if (!registry.includes(`route: ${JSON.stringify(spec.route)}`)) failures.push(`Missing approved registry entry: ${spec.route}`);
  const escaped = spec.route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('\\[id\\]','[^/]+');
  // source-level presence is sufficient here; route audit separately verifies filesystem routes.
  const routeFragment = spec.route.replace('[id]','');
  if (!routeTypes.includes(spec.section) || !routeTypes.includes(spec.type)) failures.push(`Missing route type metadata: ${spec.route}`);
}

const report={specs:specs.length,failures,passed:failures.length===0};
fs.writeFileSync(path.join(process.cwd(),'audit-output','approved-mockup-frame-audit.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if (failures.length) process.exit(1);
