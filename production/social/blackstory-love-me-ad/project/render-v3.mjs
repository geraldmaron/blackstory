// Render every motion card in the v003 edit, plus the captures v003 adds or
// changes. Cards are rendered by the same deterministic engine as captures.
import fs from 'node:fs';
import path from 'node:path';
import { TIMELINE } from './edit-v3.mjs';
import { byName } from './shots.mjs';
import { renderShot } from './capture-lib.mjs';
import { launch } from './browser.mjs';

const only = process.argv.slice(2);
const CARD = 'file://' + path.resolve('../assets/card.html');
const OUT = path.resolve('../captures');
const mf = path.join(OUT, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(mf));
const want = (s) => !only.length || only.includes(s.name);

const jobs = [];
for (const s of TIMELINE.filter(want)) {
  if (!s.card) continue;
  jobs.push({
    dir: 'cards',
    shot: {
      name: s.name,
      url: CARD,
      frames: s.frames,
      handle: 8,
      settleMs: 1500,
      surface: 'Motion card',
      action:
        [s.card.name, s.card.place, s.card.year].filter(Boolean).join(' · ') ||
        (s.card.line || ['citations'])[0],
      setup: async ({ page }) => {
        await page.waitForFunction(() => window.__ready, null, { timeout: 30000 });
        await page.evaluate(async (spec) => window.__setup(spec), {
          ...s.card,
          frames: s.frames,
          seed: s.in,
        });
      },
      step: async ({ page, i }) => {
        await page.evaluate((i) => window.__frame(i), i);
      },
    },
  });
}
for (const n of ['map-reveal', 'data'])
  if (!only.length || only.includes(n))
    jobs.push({ dir: n === 'data' ? 'data' : 'map', shot: byName[n] });

const browser = await launch();
const failed = [];
for (const j of jobs) {
  try {
    const r = await renderShot(j.shot, path.join(OUT, j.dir), { browser });
    manifest[j.shot.name] = {
      ...r,
      file: path.relative(OUT, r.out),
      capturedAt: new Date().toISOString(),
    };
    fs.writeFileSync(mf, JSON.stringify(manifest, null, 1));
  } catch (e) {
    console.error(`  !! ${j.shot.name}: ${String(e).slice(0, 240)}`);
    failed.push(j.shot.name);
  }
}
await browser.close();
console.error(
  `done ${jobs.length - failed.length}/${jobs.length}`,
  failed.length ? 'FAILED ' + failed : '',
);
