import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP = path.join(ROOT, 'app');
const OUT = path.join(ROOT, 'audit-output', 'responsive-ui-audit.json');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const files = walk(APP).filter((file) => /\.(tsx|ts|css)$/.test(file));
const rules = [
  { key: 'fixed-width', regex: /\b(?:w|min-w|max-w)-\[(?:[4-9]\d\d|\d{4,})px\]/g, severity: 'warning' },
  { key: 'fixed-height', regex: /\b(?:h|min-h|max-h)-\[(?:[6-9]\d\d|\d{4,})px\]/g, severity: 'warning' },
  { key: 'horizontal-overflow-risk', regex: /\boverflow-x-visible\b/g, severity: 'warning' },
  { key: 'nowrap-risk', regex: /\bwhitespace-nowrap\b/g, severity: 'info' },
  { key: 'truncate-risk', regex: /\btruncate\b/g, severity: 'info' },
  { key: 'desktop-only-grid', regex: /\bgrid-cols-(?:5|6|7|8|9|10|11|12)\b(?![^"'\n]*\b(?:sm|md|lg|xl|2xl):grid-cols-)/g, severity: 'warning' },
  { key: 'absolute-layout', regex: /\babsolute\b/g, severity: 'info' },
];

const findings = [];
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const rule of rules) {
      const matches = [...line.matchAll(rule.regex)];
      for (const match of matches) {
        findings.push({
          file: path.relative(ROOT, file).replaceAll('\\', '/'),
          line: index + 1,
          rule: rule.key,
          severity: rule.severity,
          match: match[0],
          excerpt: line.trim().slice(0, 220),
        });
      }
    }
  });
}

const summary = {
  scannedFiles: files.length,
  findings: findings.length,
  warnings: findings.filter((item) => item.severity === 'warning').length,
  info: findings.filter((item) => item.severity === 'info').length,
  generatedAt: new Date().toISOString(),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ summary, findings }, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (summary.warnings > 0) {
  console.log(`Responsive audit completed with ${summary.warnings} review warnings.`);
}
