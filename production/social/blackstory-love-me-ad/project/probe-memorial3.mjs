import { launch, newPage, settle } from './browser.mjs';
const b = await launch();
const { ctx, page } = await newPage(b);
for (const base of ['https://blackstory.app', 'http://localhost:3048']) {
  await page.goto(base + '/memorial', { waitUntil: 'commit', timeout: 180000 });
  await settle(page, { extra: 3000 });
  const g = await page.evaluate(() => {
    const w = document.querySelector('.ds-memorial-wall'),
      m = document.querySelector('.ds-memorial-wall__message-field'),
      l = [...document.querySelectorAll('h2')].find((h) => /^A\d/.test(h.textContent.trim()));
    const R = (e) =>
      e && {
        top: Math.round(e.getBoundingClientRect().top + scrollY),
        h: Math.round(e.getBoundingClientRect().height),
      };
    return { wall: R(w), msg: R(m), listA: R(l), docH: document.documentElement.scrollHeight };
  });
  await page.evaluate(() => scrollTo(0, 4200));
  await page.waitForTimeout(1500);
  const shot = `/tmp/mem-${base.includes('local') ? 'dev' : 'prod'}.png`;
  await page.screenshot({ path: shot });
  console.log(base, JSON.stringify(g), shot);
}
await ctx.close();
await b.close();
