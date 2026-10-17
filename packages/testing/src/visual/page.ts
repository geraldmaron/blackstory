import type { Page, TestInfo } from '@playwright/test';

/** Theme storage key from @repo/ui `THEME_STORAGE_KEY`; asserted equal in rules.spec.ts. */
export const THEME_KEY = 'ds-theme';

/** Pin the theme before first paint and hide dev-only chrome that would pollute baselines. */
/** Uncaught page errors and console errors seen since this page opened. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

export async function openStable(page: Page, testInfo: TestInfo, path: string): Promise<void> {
  const theme = String(testInfo.project.metadata.theme);
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
    THEME_KEY,
    theme,
  ] as const);
  await page.goto(path, { waitUntil: 'load' });
  await page.addStyleTag({
    content: 'nextjs-portal,[data-nextjs-toast],[data-next-badge-root]{display:none!important}',
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
}
