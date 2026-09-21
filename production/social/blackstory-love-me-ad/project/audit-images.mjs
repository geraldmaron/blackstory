// Which historical media actually paints? Anything that does not is not a shot.
import { launch, newPage, settle } from './browser.mjs';
import fs from 'node:fs';
const ROUTES = [
  '/stories',
  '/stories/the-count',
  '/stories/buying-a-home',
  '/stories/the-gap-that-never-closed',
  '/stories/george-washington',
  '/stories/john-adams',
  '/stories/thomas-jefferson',
  '/stories/james-madison',
  '/lives',
  '/lives/explorer',
  '/data',
  '/law',
  '/books',
  '/records',
  '/place/o-street-market',
  '/place/industrial-bank-of-washington',
  '/place/gardner-bishop-barber-shop',
  '/entity/civil-rights-leaders-nathan-mossell',
];
const browser = await launch();
const { ctx, page } = await newPage(browser);
const rows = [];
for (const route of ROUTES) {
  try {
    await page.goto('http://localhost:3048' + route, { waitUntil: 'commit', timeout: 120000 });
    await settle(page, { extra: 2000 });
    await page.evaluate(async () => {
      const H = document.documentElement.scrollHeight;
      for (let y = 0; y < H; y += 400) {
        scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 55));
      }
      scrollTo(0, 0);
    });
    await page.waitForTimeout(6000);
    const imgs = await page.evaluate(() => {
      const Y = (el) => Math.round(el.getBoundingClientRect().top + scrollY);
      const b = document.body,
        k = b.style.transform;
      b.style.transform = 'none';
      const r = [...document.images]
        .filter((i) => {
          const bb = i.getBoundingClientRect();
          return bb.width > 280 && bb.height > 140;
        })
        .map((i) => ({
          y: Y(i),
          ok: i.complete && i.naturalWidth > 300,
          nat: `${i.naturalWidth}x${i.naturalHeight}`,
          box: [
            Math.round(i.getBoundingClientRect().width),
            Math.round(i.getBoundingClientRect().height),
          ],
          alt: (i.alt || i.currentSrc.split('/').pop()).slice(0, 72),
          host: (() => {
            try {
              return new URL(i.currentSrc).hostname;
            } catch {
              return '?';
            }
          })(),
        }));
      b.style.transform = k;
      return r;
    });
    rows.push({ route, imgs });
    console.error(`\n== ${route}`);
    imgs.forEach((i) =>
      console.error(
        `  ${i.ok ? 'OK ' : 'BAD'} y=${String(i.y).padStart(6)} ${i.nat.padEnd(11)} box=${String(i.box)} ${i.host.slice(0, 22).padEnd(22)} ${i.alt}`,
      ),
    );
    if (!imgs.length) console.error('  (no large images)');
  } catch (e) {
    console.error(`FAIL ${route} ${String(e).slice(0, 90)}`);
  }
}
fs.writeFileSync('../captures/_inspect/image-audit.json', JSON.stringify(rows, null, 1));
await ctx.close();
await browser.close();
