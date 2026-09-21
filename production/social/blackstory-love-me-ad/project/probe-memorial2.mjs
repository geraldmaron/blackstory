import { launch, newPage, settle } from './browser.mjs';
const b = await launch();
const { ctx, page } = await newPage(b);
await page.goto('http://localhost:3048/memorial', { waitUntil: 'commit', timeout: 180000 });
await settle(page, { extra: 3000 });
const r = await page.evaluate(() => {
  const hits = [...document.querySelectorAll('body *')].filter(
    (e) => e.children.length < 4 && /reminder/i.test(e.textContent || ''),
  );
  return hits.slice(-4).map((e) => {
    let a = e,
      chain = [];
    for (let i = 0; i < 6 && a; i++) {
      const s = getComputedStyle(a);
      chain.push(
        `${a.tagName}.${String(a.className).slice(0, 50)}[${s.position},${s.transform !== 'none' ? 'T' : ''},anim:${s.animationName}]`,
      );
      a = a.parentElement;
    }
    return { text: e.textContent.slice(0, 120), chain };
  });
});
console.log(JSON.stringify(r, null, 1));
await ctx.close();
await b.close();
