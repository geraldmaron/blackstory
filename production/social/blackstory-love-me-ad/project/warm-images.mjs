// Next's image optimiser is slow in dev on very large originals (one source here
// is 7258x8785). First paint can therefore leave a reserved-but-empty box, which
// would land in the edit as a blank frame. Fetching each optimised URL once puts
// it in the dev image cache so the capture run paints it immediately.
import { launch, newPage, settle } from './browser.mjs';
const ROUTES = process.argv.slice(2);
const browser = await launch();
const { ctx, page } = await newPage(browser);
for (const route of ROUTES) {
  await page.goto('http://localhost:3048' + route, { waitUntil: 'commit', timeout: 180000 });
  await settle(page, { extra: 2500 });
  await page.evaluate(async () => {
    const H = document.documentElement.scrollHeight;
    for (let y = 0; y < H; y += 400) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    scrollTo(0, 0);
  });
  const urls = await page.evaluate(() => {
    const out = new Set();
    for (const i of document.images) {
      if (i.currentSrc) out.add(i.currentSrc);
      if (i.src) out.add(i.src);
      for (const s of (i.srcset || '').split(',')) {
        const u = s.trim().split(' ')[0];
        if (u) out.add(new URL(u, location.href).href);
      }
    }
    return [...out].filter((u) => /_next\/image|\.(jpe?g|png|webp|avif)/i.test(u));
  });
  console.error(`${route}: ${urls.length} image urls`);
  let ok = 0,
    fail = 0;
  for (const u of urls) {
    const r = await page
      .evaluate(async (u) => {
        try {
          const t = Date.now();
          const res = await fetch(u, { cache: 'force-cache' });
          const b = await res.blob();
          return { s: res.status, kb: Math.round(b.size / 1024), ms: Date.now() - t };
        } catch (e) {
          return { s: 0, err: String(e).slice(0, 60) };
        }
      }, u)
      .catch(() => ({ s: 0 }));
    if (r.s === 200) {
      ok++;
      if (r.kb > 150) console.error(`   warmed ${r.kb}KB in ${r.ms}ms  ${u.slice(-70)}`);
    } else {
      fail++;
      console.error(`   FAIL ${r.s} ${u.slice(-80)}`);
    }
  }
  console.error(`   -> ok=${ok} fail=${fail}`);
}
await ctx.close();
await browser.close();
