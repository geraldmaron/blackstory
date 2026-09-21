// Visit every candidate surface, screenshot it, and report what is actually there.
import fs from 'node:fs';
import path from 'node:path';
import { launch, newPage, settle } from './browser.mjs';

const OUT = path.resolve('../captures/_inspect');
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'https://blackstory.app';

const TARGETS = [
  ['door', '/'],
  ['explore', '/explore'],
  ['records', '/records'],
  ['stories', '/stories'],
  ['lives', '/lives'],
  ['lives-explorer', '/lives/explorer'],
  ['data', '/data'],
  ['memorial', '/memorial'],
  ['rooms', '/rooms'],
  ['law', '/law'],
  ['books', '/books'],
  ['search', '/search?q=tulsa'],
  ['place-onest', '/place/o-street-market'],
  ['entity-mossell', '/entity/civil-rights-leaders-nathan-mossell'],
  ['invention', '/invention/laserphaco-probe'],
];

const browser = await launch();
const { ctx, page } = await newPage(browser);
const report = [];

for (const [name, route] of TARGETS) {
  const url = BASE + route;
  try {
    const resp = await page.goto(url, { waitUntil: 'commit', timeout: 45000 });
    await settle(page, { extra: 2500 });
    const info = await page.evaluate(() => ({
      title: document.title,
      h1: [...document.querySelectorAll('h1,h2')]
        .slice(0, 6)
        .map((e) => e.textContent.trim().slice(0, 90)),
      scrollH: document.documentElement.scrollHeight,
      canvases: [...document.querySelectorAll('canvas')].map((c) => `${c.width}x${c.height}`),
      imgs: document.images.length,
      bg: getComputedStyle(document.body).backgroundColor,
      font: getComputedStyle(document.body).fontFamily,
      text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 320),
    }));
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    report.push({ name, route, status: resp?.status(), ...info });
    console.error(
      `ok   ${name.padEnd(18)} ${resp?.status()}  scrollH=${info.scrollH} canvas=${info.canvases.join(',') || '-'} imgs=${info.imgs}`,
    );
  } catch (e) {
    report.push({ name, route, error: String(e).slice(0, 160) });
    console.error(`FAIL ${name.padEnd(18)} ${String(e).slice(0, 120)}`);
  }
}

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
await ctx.close();
await browser.close();
console.error(`\nwrote ${OUT}/report.json`);
