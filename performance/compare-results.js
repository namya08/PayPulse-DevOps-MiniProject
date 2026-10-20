#!/usr/bin/env node
'use strict';

// Parses JMeter CSV/JTL result files and writes a Markdown comparison table
// with real measurements only (no estimates, no invented numbers).
//
// Usage:
//   node performance/compare-results.js performance/results/load-*.jtl
//
// Output:
//   performance/results/comparison.md  (+ table printed to stdout)

const fs = require('fs');
const path = require('path');

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node compare-results.js <results1.jtl> [results2.jtl ...]');
  process.exit(1);
}

function parseJtl(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) return null;

  const header = splitCsvLine(lines[0]).map((h) => h.trim());
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  for (const col of ['timeStamp', 'elapsed', 'success', 'responseCode']) {
    if (idx[col] === undefined) {
      console.error(`Skipping ${file}: missing column "${col}" (is this a JMeter JTL CSV?)`);
      return null;
    }
  }

  const samples = [];
  let minTs = Infinity;
  let maxTs = -Infinity;
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const elapsed = Number(cols[idx.elapsed]);
    const ts = Number(cols[idx.timeStamp]);
    const success = String(cols[idx.success]).toLowerCase() === 'true';
    const code = String(cols[idx.responseCode]);
    if (Number.isNaN(elapsed) || Number.isNaN(ts)) continue;
    samples.push({ elapsed, success, code, ts });
    if (ts < minTs) minTs = ts;
    if (ts > maxTs) maxTs = ts;
  }
  if (samples.length === 0) return null;

  const durations = samples.map((s) => s.elapsed).sort((a, b) => a - b);
  const errors = samples.filter((s) => !s.success).length;
  const windowSec = Math.max((maxTs - minTs) / 1000, 0.001);

  return {
    file: path.basename(file),
    label: (file.match(/load-(\d+)/) || [, path.basename(file)])[1],
    total: samples.length,
    errors,
    errorPct: (errors / samples.length) * 100,
    avg: durations.reduce((a, b) => a + b, 0) / durations.length,
    p50: percentile(durations, 50),
    p90: percentile(durations, 90),
    p95: percentile(durations, 95),
    p99: percentile(durations, 99),
    max: durations[durations.length - 1],
    windowSec,
    rps: samples.length / windowSec
  };
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

// Handles quoted CSV fields (JMeter writes quoted thread names containing commas).
function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

const rows = files.map(parseJtl).filter(Boolean).sort((a, b) => Number(a.label) - Number(b.label));
if (rows.length === 0) {
  console.error('No usable JTL files found.');
  process.exit(1);
}

const md = [
  '# Load test comparison',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  '| VUs | Requests | Errors | Error % | Avg (ms) | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Max (ms) | Throughput (req/s) | Window (s) |',
  '|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ...rows.map(
    (r) =>
      `| ${r.label} | ${r.total} | ${r.errors} | ${r.errorPct.toFixed(2)}% | ${r.avg.toFixed(1)} | ${r.p50.toFixed(1)} | ${r.p90.toFixed(1)} | ${r.p95.toFixed(1)} | ${r.p99.toFixed(1)} | ${r.max.toFixed(1)} | ${r.rps.toFixed(1)} | ${r.windowSec.toFixed(1)} |`
  ),
  '',
  'Source files: ' + rows.map((r) => `\`${r.file}\``).join(', '),
  ''
].join('\n');

const outFile = path.join(path.dirname(files[0]), 'comparison.md');
fs.writeFileSync(outFile, md, 'utf8');
console.log(md);
console.log(`Written to ${outFile}`);
