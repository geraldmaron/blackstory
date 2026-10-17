import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { MIN_TARGET_PX, VISUAL_ROUTES } from './routes.ts';
import { collectErrors, openStable } from './page.ts';

/**
 * Rendered-page rules, run in every viewport/theme project:
 *   hard   no horizontal overflow; exactly the SEO head (title, canonical, og:title);
 *          at most one <h1>.
 *   ratchet  count of interactive targets under 44px per route+project may not rise above
 *          src/visual/rules-baseline.json. Update with VISUAL_UPDATE=1 after paying debt down.
 */
const BASELINE_PATH = join(dirname(fileURLToPath(import.meta.url)), 'rules-baseline.json');
const update = process.env.VISUAL_UPDATE === '1';
const baseline: Record<string, number> = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  : {};
const measured: Record<string, number> = {};

for (const route of VISUAL_ROUTES) {
  test(`rules ${route.name}`, async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await openStable(page, testInfo, route.path);

    const facts = await page.evaluate((min) => {
      const rendered = (el: Element) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none';
      };
      const small = [
        ...document.querySelectorAll<HTMLElement>(
          'a[href],button,input,select,textarea,[role=button]',
        ),
      ]
        .filter(rendered)
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.height < min || r.width < min;
        });
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        h1: document.querySelectorAll('h1').length,
        title: document.title,
        canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? '',
        ogTitle:
          document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content ?? '',
        canonicalCount: document.querySelectorAll('link[rel="canonical"]').length,
        titleCount: document.querySelectorAll('head > title').length,
        small: small.length,
      };
    }, MIN_TARGET_PX);

    expect(facts.overflow, 'horizontal overflow (px)').toBeLessThanOrEqual(0);
    expect(facts.title, 'document title').not.toBe('');
    expect(facts.canonical, 'canonical href').toMatch(/^https?:\/\//);
    expect(facts.canonicalCount, 'canonical count').toBe(1);
    expect(facts.titleCount, 'title count').toBe(1);
    expect(facts.ogTitle, 'og:title content').not.toBe('');
    expect(errors, 'uncaught page or console errors').toEqual([]);
    expect(facts.h1, 'h1 count').toBeLessThanOrEqual(1);

    const key = `${testInfo.project.name}:${route.name}`;
    measured[key] = facts.small;
    if (!update) {
      const allowed = baseline[key];
      expect(allowed, `no baseline for ${key}; run with VISUAL_UPDATE=1`).toBeDefined();
      expect(facts.small, `targets under ${MIN_TARGET_PX}px`).toBeLessThanOrEqual(allowed ?? 0);
    }
  });
}

test.afterAll(() => {
  if (update) {
    const merged = { ...baseline, ...measured };
    const sorted = Object.fromEntries(
      Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)),
    );
    writeFileSync(BASELINE_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
  }
});
