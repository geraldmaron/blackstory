/**
 * Rendered surface audit (docs/ui/experience-standard.md). For every public route at 390, 768 and
 * 1440 in light and dark it records the type sizes in use, oversize text (non-h1 text at 32px or
 * more, or an h2 at 48px or more), WCAG contrast failures, targets under 24px, horizontal
 * overflow, glyphs in the header and site footer, band art, and tall sections with no art, image
 * or map. Full-page screenshots land beside results.json.
 *
 * It reports; it does not gate. Heuristic flags need a look: display numerals are exempt, but a
 * fixed map plate behind a section reads as "bare", and visually hidden text reports 1:1 contrast.
 *
 *   node scripts/surface-audit.mjs <outDir>      (dev server on :3048)
 *   BASE=… ONLY=rooms,law SHAPES=p390,d1440 CHROMIUM=/path/to/chrome node scripts/surface-audit.mjs out
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(new URL('../packages/testing/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const out = process.argv[2];
mkdirSync(out, { recursive: true });
const base = process.env.BASE || 'http://localhost:3048';
const ROUTES = [
  ['home', '/'],
  ['explore', '/explore'],
  ['records', '/records'],
  ['records-chrono', '/records?layout=chronology'],
  ['search', '/search?q=church'],
  ['stories', '/stories'],
  ['story', '/stories/the-count'],
  ['story-credits', '/stories/mosaic-credits'],
  ['law', '/law'],
  ['law-detail', '/law/fair-housing-act-1968'],
  ['books', '/books'],
  ['book', '/books/all-american-boys'],
  ['rooms', '/rooms'],
  ['data', '/data'],
  ['lives', '/lives'],
  ['lives-region', '@lives'],
  ['lives-explorer', '/lives/explorer'],
  ['memorial', '/memorial'],
  ['about', '/about'],
  ['methodology', '/methodology'],
  ['how-it-works', '/how-it-works'],
  ['sources', '/sources'],
  ['apparatus', '/apparatus'],
  ['submit', '/submit'],
  ['corrections', '/corrections'],
  ['corrections-status', '/corrections/status'],
  ['faq', '/faq'],
  ['support', '/support'],
  ['errata', '/errata'],
  ['privacy', '/privacy'],
  ['terms', '/terms'],
  ['entity', '/entity/ent_benjamin_banneker_001'],
  ['place', '/place/great-dismal-swamp-maroon-communities'],
  ['invention', '@invention'],
  ['not-found', '/no-such-page-xyz'],
].filter(([n]) => !process.env.ONLY || process.env.ONLY.split(',').includes(n));
const SHAPES = [
  ['p390', 390, 844],
  ['t768', 768, 1024],
  ['d1440', 1440, 900],
].filter(([n]) => !process.env.SHAPES || process.env.SHAPES.split(',').includes(n));
const browser = await chromium.launch({
  ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

async function resolve(path) {
  if (!path.startsWith('@')) return path;
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const from = path === '@lives' ? '/lives' : '/records?q=invention';
  const prefix = path === '@lives' ? '/lives/' : '/invention/';
  await p.goto(base + from, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);
  const href = await p.evaluate(
    (pre) =>
      [...document.querySelectorAll('a[href]')]
        .map((a) => a.getAttribute('href'))
        .find((h) => h.startsWith(pre) && h !== '/lives/explorer'),
    prefix,
  );
  await ctx.close();
  return href || null;
}

function probe() {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return (
      r.width > 0 &&
      r.height > 0 &&
      s.visibility !== 'hidden' &&
      s.display !== 'none' &&
      +s.opacity > 0.05
    );
  };
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1]
      .split(/[ ,/]+/)
      .filter(Boolean)
      .map(Number);
    return { r, g, b, a };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const bgOf = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.backgroundImage !== 'none' && !s.backgroundImage.includes('mask')) return null;
      const c = parse(s.backgroundColor);
      if (c && c.a > 0.9) return c;
    }
    return parse(getComputedStyle(document.body).backgroundColor);
  };
  const label = (el) =>
    `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`;
  const textEls = [...document.querySelectorAll('body *')].filter(
    (el) =>
      [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1) &&
      vis(el) &&
      !el.closest('[aria-hidden="true"],svg,canvas,.maplibregl-map'),
  );
  const sizes = {};
  const oversize = [];
  const contrast = [];
  for (const el of textEls) {
    const s = getComputedStyle(el);
    const fs = Math.round(parseFloat(s.fontSize));
    sizes[fs] = (sizes[fs] || 0) + 1;
    const isH1 = !!el.closest('h1');
    const decorative = !!el.closest('[data-decorative],.ds-numeral');
    const isH = !!el.closest('h1,h2');
    if (!isH1 && !decorative && (fs >= 48 || (!isH && fs >= 32)))
      oversize.push(`${fs}px ${label(el)} "${el.textContent.trim().slice(0, 40)}"`);
    const fg = parse(s.color);
    const bg = bgOf(el);
    if (fg && bg && fg.a > 0.5) {
      const L1 = lum(fg),
        L2 = lum(bg);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const large = fs >= 24 || (fs >= 19 && +s.fontWeight >= 700);
      if (ratio < (large ? 3 : 4.5))
        contrast.push(
          `${ratio.toFixed(2)} ${fs}px ${label(el)} "${el.textContent.trim().slice(0, 30)}"`,
        );
    }
  }
  const targets = [...document.querySelectorAll('a[href],button,[role="button"],input,select')]
    .filter(vis)
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return (
        (r.height < 24 || r.width < 24) &&
        !el.closest('p,li p,figcaption,.ds-prose') &&
        !el.matches('.ds-skip-link')
      );
    })
    .map(
      (el) =>
        `${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)} ${label(el)} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 25)}"`,
    );
  const svgIn = (sel) => {
    const root = document.querySelector(sel);
    return root ? root.querySelectorAll('svg').length : null;
  };
  const doc = document.documentElement;
  const sections = [
    ...document.querySelectorAll('main section, main [data-ground], main .ds-block'),
  ]
    .filter(vis)
    .filter((el) => el.getBoundingClientRect().height > 240);
  const bare = sections
    .filter(
      (el) =>
        ![
          ...el.querySelectorAll(
            '.ds-band-art,.ds-band-rule,canvas,img,svg,video,.maplibregl-map,[class*="mosaic"],[class*="atmosphere"]',
          ),
        ].some((a) => {
          const r = a.getBoundingClientRect();
          return (r.width > 96 && r.height > 96) || a.matches('.ds-band-art,.ds-band-rule');
        }),
    )
    .map((el) => `${label(el)} h=${Math.round(el.getBoundingClientRect().height)}`);
  const main = document.querySelector('main') || document.body;
  const mr = main.getBoundingClientRect();
  const firstText = textEls.find((el) => el.closest('main'));
  return {
    title: document.title,
    theme: doc.dataset.theme || null,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    overflowX: doc.scrollWidth - doc.clientWidth,
    height: doc.scrollHeight,
    sizes,
    distinctSizes: Object.keys(sizes).length,
    oversize: oversize.slice(0, 12),
    oversizeCount: oversize.length,
    contrast: contrast.slice(0, 12),
    contrastCount: contrast.length,
    smallTargets: targets.slice(0, 10),
    smallTargetCount: targets.length,
    icons: {
      header: svgIn('header'),
      footer: svgIn('footer.ds-shell-footer'),
      main: main.querySelectorAll('svg').length,
    },
    art: document.querySelectorAll('.ds-band-art,.ds-band-rule').length,
    bareSections: bare.slice(0, 8),
    bareCount: bare.length,
    gutterLeft: firstText ? Math.round(firstText.getBoundingClientRect().left - mr.left) : null,
    h1: [...document.querySelectorAll('h1')].map(
      (h) =>
        `${Math.round(parseFloat(getComputedStyle(h).fontSize))}px "${h.textContent.trim().slice(0, 40)}"`,
    ),
  };
}

const results = [];
const jobs = [];
for (const [name, raw] of ROUTES)
  for (const [shape, w, h] of SHAPES)
    for (const theme of ['light', 'dark']) jobs.push({ name, raw, shape, w, h, theme });
const resolved = {};
for (const [name, raw] of ROUTES) resolved[name] = await resolve(raw);
async function run(job) {
  const path = resolved[job.name];
  if (!path) {
    results.push({ ...job, error: 'unresolved' });
    return;
  }
  const ctx = await browser.newContext({
    viewport: { width: job.w, height: job.h },
    colorScheme: job.theme,
    reducedMotion: 'reduce',
  });
  await ctx.addInitScript((t) => {
    try {
      localStorage.setItem('ds-theme', t);
    } catch {
      // Storage can be blocked; the page then keeps its default theme.
    }
  }, job.theme);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
  try {
    const resp = await p.goto(base + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(job.name === 'explore' || job.name === 'home' ? 5000 : 2500);
    const total = await p.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < Math.min(total, 8000); y += job.h) {
      await p.evaluate((y) => window.scrollTo(0, y), y);
      await p.waitForTimeout(150);
    }
    await p.evaluate(() => window.scrollTo(0, 0));
    const m = await p.evaluate(probe);
    if (job.shape !== 't768')
      await p
        .screenshot({
          path: `${out}/${job.name}.${job.shape}.${job.theme}.jpg`,
          fullPage: true,
          type: 'jpeg',
          quality: 55,
        })
        .catch(() =>
          p.screenshot({
            path: `${out}/${job.name}.${job.shape}.${job.theme}.jpg`,
            type: 'jpeg',
            quality: 55,
          }),
        );
    results.push({ ...job, path, status: resp?.status(), errs, ...m });
  } catch (e) {
    results.push({ ...job, path, error: String(e).slice(0, 200) });
  }
  await ctx.close();
}
const queue = [...jobs];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (queue.length) await run(queue.shift());
  }),
);
await browser.close();
writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 1));
for (const r of results.sort((a, b) => a.name.localeCompare(b.name)))
  console.log(
    [
      r.name,
      r.shape,
      r.theme,
      r.error || '',
      'ovx=' + r.overflowX,
      'sizes=' + r.distinctSizes,
      'big=' + r.oversizeCount,
      'contrast=' + r.contrastCount,
      'tgt=' + r.smallTargetCount,
      'art=' + r.art,
      'bare=' + r.bareCount,
      'ico=' + JSON.stringify(r.icons),
    ].join(' '),
  );
