import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP = path.join(ROOT, 'app');
const OUT = path.join(ROOT, 'audit-output', 'print-readiness.json');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const files = walk(APP).filter((file) => /\.(tsx|css)$/.test(file));
const printCandidates = files.filter((file) => {
  const rel = path.relative(ROOT, file).replaceAll('\\', '/').toLowerCase();
  const content = fs.readFileSync(file, 'utf8').toLowerCase();
  return rel.includes('/print/') || rel.includes('print-centre') || rel.includes('/output/') || content.includes('window.print') || content.includes('@media print');
});

const results = printCandidates.map((file) => {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file).replaceAll('\\', '/');
  return {
    file: rel,
    hasPrintCall: /window\.print\s*\(/.test(content),
    hasPrintCss: /@media\s+print/.test(content) || /print:/.test(content),
    hasNoPrintClass: /no-print/.test(content),
    hasA4: /A4|210mm|297mm/i.test(content),
    hasPageBreakControl: /break-(?:before|after|inside)|page-break-/i.test(content),
    hasLogoReference: /iet-logo\.png|\/iet-logo/i.test(content),
  };
});

const summary = {
  candidates: results.length,
  withPrintCall: results.filter((r) => r.hasPrintCall).length,
  withPrintCss: results.filter((r) => r.hasPrintCss).length,
  withA4: results.filter((r) => r.hasA4).length,
  withLogo: results.filter((r) => r.hasLogoReference).length,
  generatedAt: new Date().toISOString(),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ summary, results }, null, 2));
console.log(JSON.stringify(summary, null, 2));
