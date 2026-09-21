// Capture runner. `node capture.mjs [name ...]` captures a subset; no args = all.
import fs from 'node:fs';
import path from 'node:path';
import { SHOTS } from './shots.mjs';
import { renderShot } from './capture-lib.mjs';
import { launch } from './browser.mjs';

const only = process.argv.slice(2);
const list = only.length ? SHOTS.filter((s) => only.includes(s.name)) : SHOTS;
const SURFACE_DIR = {
  'map-a': 'map',
  'map-b': 'map',
  'map-c': 'map',
  'map-d': 'map',
  'map-wide': 'map',
  'brand-bg': 'map',
  'map-out1': 'map',
  'map-out2': 'map',
  'map-out3': 'map',
  'map-out4': 'map',
  'map-out5': 'map',
  'map-out6': 'map',
  'place-title': 'records',
  'place-hist': 'records',
  evidence: 'evidence',
  trust: 'evidence',
  'place-out': 'records',
  records: 'records',
  entity: 'entities',
  'entity-out': 'entities',
  'punch-ms': 'map',
  'punch-atl': 'map',
  'punch-tulsa': 'map',
  'tulsa-1921': 'stories',
  lbj: 'stories',
  lives: 'lives',
  'lives-plate': 'lives',
  data: 'data',
  'memorial-a': 'memorial',
  'memorial-b': 'memorial',
  'brand-fg': 'door',
};
const OUT = path.resolve('../captures');
const manifestPath = path.join(OUT, 'manifest.json');
// Read directly and fall back on ENOENT: an exists-then-read check can race.
let manifest = {};
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath));
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}

console.error(
  `capturing ${list.length} shot(s), ${list.reduce((a, s) => a + s.frames + 2 * (s.handle ?? 12), 0)} frames\n`,
);
const browser = await launch();
const failures = [];
for (const shot of list) {
  const dir = path.join(OUT, SURFACE_DIR[shot.name] ?? 'misc');
  try {
    const r = await renderShot(shot, dir, { browser });
    manifest[shot.name] = {
      ...r,
      in: shot.in,
      out: shot.out,
      audio: shot.audio ?? null,
      surface: shot.surface,
      action: shot.action,
      file: path.relative(OUT, r.out),
      capturedAt: new Date().toISOString(),
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
  } catch (e) {
    console.error(`  !! ${shot.name} FAILED: ${String(e).slice(0, 300)}`);
    failures.push(shot.name);
  }
}
await browser.close();
console.error(`\ndone. ${list.length - failures.length}/${list.length} captured.`);
if (failures.length) {
  console.error('FAILED:', failures.join(', '));
  process.exitCode = 1;
}
