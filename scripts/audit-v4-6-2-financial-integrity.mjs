import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const summary = readFileSync(new URL('../lib/v4/summaries.ts', import.meta.url), 'utf8');
const version = readFileSync(new URL('../lib/version.ts', import.meta.url), 'utf8');
assert.match(summary, /sum\(sub, \(r\) => r\.expenditure\)/, 'Dashboard source must remain traceable');
assert.match(summary, /Recorded expenditure/, 'Do not label unreconciled aggregates as verified spend');
assert.match(summary, /reconcile with transactions/, 'Show reconciliation qualification');
assert.match(version, /REQGEN_SEMVER = "4\.6\.2"/);
console.log('PASS: v4.6.2 dashboard disclosure and version assertions (4 checks)');
