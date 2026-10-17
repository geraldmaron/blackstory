import { expect, test } from '@playwright/test';

/**
 * One screenshot per theme block of /kit. The kit components are static, so these pin color, spacing
 * and wrapping per theme and width. They do not cover hover, focus or click behavior.
 */
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/kit', { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('heading', { name: 'light theme' })).toBeVisible({ timeout: 60_000 });
  // Tamagui applies each Theme after mount. Until then both blocks paint with the root theme, so a
  // screenshot taken now would bake a light "dark" block into the baseline.
  await page.waitForFunction(() => {
    const bg = (name: string) => {
      const heading = [...document.querySelectorAll('h2')].find((h) => h.textContent === name);
      return heading?.parentElement ? getComputedStyle(heading.parentElement).backgroundColor : '';
    };
    const [light, dark] = [bg('light theme'), bg('dark theme')];
    return (
      Boolean(light) && Boolean(dark) && light !== dark && !document.querySelector('.t_unmounted')
    );
  });
  expect(errors, 'the gallery renders without page errors').toEqual([]);
});

for (const theme of ['light', 'dark'] as const) {
  test(`kit ${theme} theme`, async ({ page }) => {
    const block = page.getByRole('heading', { name: `${theme} theme` }).locator('xpath=..');
    await expect(block).toHaveScreenshot(`kit-${theme}.png`);
  });
}
