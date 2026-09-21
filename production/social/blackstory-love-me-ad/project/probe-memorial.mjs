import { launch, newPage, settle } from './browser.mjs';
const b = await launch();
const { ctx, page } = await newPage(b);
await page.goto('http://localhost:3048/memorial', { waitUntil: 'commit', timeout: 180000 });
await settle(page, { extra: 3000 });
const r = await page.evaluate(() =>
  [...document.querySelectorAll('body *')]
    .filter((e) => {
      const s = getComputedStyle(e);
      return (
        (s.position === 'fixed' || s.position === 'sticky') &&
        e.getBoundingClientRect().height > 300
      );
    })
    .map((e) => ({
      tag: e.tagName,
      cls: String(e.className).slice(0, 80),
      pos: getComputedStyle(e).position,
      z: getComputedStyle(e).zIndex,
      op: getComputedStyle(e).opacity,
      h: e.getBoundingClientRect().height,
      t: e.textContent.slice(0, 60),
    })),
);
console.log(JSON.stringify(r, null, 1));
await page.evaluate(() => scrollTo(0, 6000));
await page.waitForTimeout(1200);
console.log(
  'after real scroll:',
  JSON.stringify(
    await page.evaluate(() =>
      [...document.querySelectorAll('body *')]
        .filter(
          (e) => getComputedStyle(e).position === 'fixed' && e.getBoundingClientRect().height > 300,
        )
        .map((e) => ({
          cls: String(e.className).slice(0, 60),
          op: getComputedStyle(e).opacity,
          vis: getComputedStyle(e).visibility,
        })),
    ),
  ),
);
await ctx.close();
await b.close();
