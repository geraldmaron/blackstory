import { expect, test } from '@playwright/test';
import { VISUAL_ROUTES } from './routes.ts';
import { openStable } from './page.ts';

/**
 * Above-the-fold screenshot per route, per viewport and theme (the project).
 * WebGL map canvases are masked: they paint nondeterministically and are covered by the
 * map-specific tests, not this baseline.
 */
for (const route of VISUAL_ROUTES) {
  test(`visual ${route.name}`, async ({ page }, testInfo) => {
    await openStable(page, testInfo, route.path);
    const mask = [page.locator('canvas'), page.locator('.maplibregl-map')];
    await expect(page).toHaveScreenshot(`${route.name}.png`, { mask });
  });
}
