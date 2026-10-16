import { defineConfig } from '@playwright/test';
import { VIEWPORTS } from './src/visual/routes.ts';

const PORT = Number(process.env.KIT_PORT ?? 8090);

/**
 * Visual baseline for the design kit gallery (apps/site `/kit`), the one page that renders every kit
 * component in both themes. Separate from playwright.config.ts, which targets the Next app on 3048.
 *
 * The gallery shows light and dark side by side, so the viewport is the only project axis; the spec
 * screenshots each theme block. Mobile and desktop only: the kit is responsive between them and the
 * tablet width adds pixels, not information. Attaches to a server already on KIT_PORT, else exports the site
 * with the preview flag and serves it with the production server entry (the Expo dev server runs out of
 * memory under repeated loads). The installed Chrome version is not pinned (see
 * playwright.config.ts), so a Chrome update can need a re-baseline.
 */
export default defineConfig({
  testDir: './src/kit-visual',
  testMatch: '**/*.spec.ts',
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{projectName}/{arg}{ext}',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [['list']],
  expect: {
    toHaveScreenshot: { maxDiffPixels: 150, animations: 'disabled', caret: 'hide' },
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome',
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
  },
  projects: (['mobile', 'desktop'] as const).map((vp) => ({
    name: vp,
    use: { viewport: VIEWPORTS[vp] },
  })),
  webServer: {
    command: `EXPO_PUBLIC_SITE_KIT_PREVIEW=1 npm run export && EXPO_PUBLIC_SITE_KIT_PREVIEW=1 PORT=${PORT} node server/entry.cjs`,
    cwd: '../../apps/site',
    url: `http://localhost:${PORT}/kit`,
    reuseExistingServer: true,
    timeout: 240_000,
  },
});
