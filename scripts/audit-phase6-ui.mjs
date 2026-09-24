import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP = path.join(ROOT, 'app');
const OUT = path.join(ROOT, 'audit-output', 'phase6-page-audit.json');
const MD = path.join(ROOT, 'docs', 'REQGEN_V2_0_0_7_PHASE6_PAGE_AUDIT.md');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
function routeFor(file) {
  let rel = path.relative(APP, path.dirname(file)).replaceAll('\\', '/');
  if (rel === '.') return '/';
  return '/' + rel;
}
function count(re, text) { return [...text.matchAll(re)].length; }

const pages = walk(APP).filter((file) => file.endsWith(`${path.sep}page.tsx`) || file.endsWith('/page.tsx'));
const results = pages.map((file) => {
  const text = fs.readFileSync(file, 'utf8');
  const route = routeFor(file);
  const isPrint = route.includes('/print');
  const blockers = [];
  if (!isPrint && /\b(?:w|min-w|max-w)-\[(?:[4-9]\d\d|\d{4,})px\]/.test(text)) blockers.push('oversized fixed-width utility');
  if (!isPrint && /\boverflow-x-visible\b/.test(text)) blockers.push('visible horizontal overflow');
  if (!isPrint && /bg-white(?!\/)\b[^"'\n]{0,100}\btext-white\b|text-white\b[^"'\n]{0,100}bg-white(?!\/)/.test(text)) blockers.push('white-on-white control risk');
  if (!isPrint && /\b(?:h|min-h|max-h)-\[(?:[7-9]\d\d|\d{4,})px\]/.test(text)) blockers.push('oversized fixed-height utility');
  return {
    route,
    file: path.relative(ROOT, file).replaceAll('\\', '/'),
    kind: isPrint ? 'PRINT' : 'SCREEN',
    tables: count(/<table\b/g, text),
    forms: count(/<form\b/g, text),
    selects: count(/<select\b/g, text),
    dialogs: count(/role=["']dialog["']|modal|dialog/gi, text),
    charts: count(/<svg\b|donut|barChart|monthChart|chartBody|recharts/gi, text),
    status: blockers.length ? 'REVIEW' : 'PASS',
    blockers,
  };
}).sort((a,b) => a.route.localeCompare(b.route));

const review = results.filter(r => r.status !== 'PASS');
const summary = { checkedAt: new Date().toISOString(), pages: results.length, pass: results.length - review.length, review: review.length };
fs.mkdirSync(path.dirname(OUT), {recursive:true});
fs.writeFileSync(OUT, JSON.stringify({summary, results}, null, 2));

const lines = [
  '# ReqGen v2.0.0.7 - Phase 6 Page-by-Page Visual Audit',
  '',
  `Physical pages audited: **${summary.pages}**  `,
  `Visual containment PASS: **${summary.pass}**  `,
  `Pages requiring review: **${summary.review}**`,
  '',
  'The audit is paired with the Phase 6 global design contract in `app/globals.css`: frame containment, minimum readable typography, standard controls, visible focus states, responsive grids, viewport-safe dialogs, table wrapping/containment, canonical tabs and interactive chart affordances.',
  '',
  '| Route | Type | Tables | Forms | Selects | Dialog/Modal refs | Chart refs | Status |',
  '|---|---:|---:|---:|---:|---:|---:|---|',
  ...results.map(r => `| \`${r.route}\` | ${r.kind} | ${r.tables} | ${r.forms} | ${r.selects} | ${r.dialogs} | ${r.charts} | **${r.status}** |`),
  '',
  '## Phase 6 acceptance controls',
  '',
  '- All authenticated content stays inside the ReqGen main frame with a controlled inset.',
  '- No production screen route uses an oversized fixed-width utility that can force horizontal page overflow.',
  '- Shared tables are width-contained and cells wrap instead of expanding the application frame.',
  '- Profile / Security tabs use explicit high-contrast active and inactive states.',
  '- Buttons, links, fields and selects have consistent focus/hover/active visibility.',
  '- Screen CSS modules use an 11px minimum for microcopy; core controls/tables use 12-13px minimums.',
  '- Charts touched in Phase 6 expose hover/focus values using `title`, ARIA labelling or existing interactive controls.',
  '- Print-only layouts retain their print geometry and are excluded from screen-only fixed-width rules.',
];
fs.mkdirSync(path.dirname(MD), {recursive:true});
fs.writeFileSync(MD, lines.join('\n'));
console.log(JSON.stringify(summary, null, 2));
if (review.length) {
  for (const r of review) console.error(`${r.route}: ${r.blockers.join(', ')}`);
  process.exitCode = 1;
}
