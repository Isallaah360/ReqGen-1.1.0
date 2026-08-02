import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP = path.join(ROOT, 'app');
const LIB = path.join(ROOT, 'lib');
const OUT = path.join(ROOT, 'audit-output', 'performance-audit.json');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const files = [...walk(APP), ...walk(LIB)].filter((file) => /\.(tsx|ts)$/.test(file));
const findings = [];
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file).replaceAll('\\', '/');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    const checks = [
      ['select-star', /\.select\(\s*["'`]\*["'`]\s*\)/g, 'warning'],
      ['large-limit', /\.limit\(\s*(?:[5-9]\d{2}|\d{4,})\s*\)/g, 'info'],
      ['realtime-channel', /\.channel\(/g, 'info'],
      ['browser-print', /window\.print\s*\(/g, 'info'],
      ['full-array-sort', /\.sort\s*\(/g, 'info'],
    ];
    for (const [rule, regex, severity] of checks) {
      for (const match of line.matchAll(regex)) {
        findings.push({ file: rel, line: index + 1, rule, severity, match: match[0], excerpt: line.trim().slice(0, 220) });
      }
    }
  });
}

const summary = {
  scannedFiles: files.length,
  findings: findings.length,
  selectStarQueries: findings.filter((f) => f.rule === 'select-star').length,
  realtimeChannels: findings.filter((f) => f.rule === 'realtime-channel').length,
  generatedAt: new Date().toISOString(),
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ summary, findings }, null, 2));
console.log(JSON.stringify(summary, null, 2));
