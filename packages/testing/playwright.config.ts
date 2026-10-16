import { defineConfig } from '@playwright/test';
import { THEMES, VIEWPORTS } from './src/visual/routes.ts';

const PORT = Number(process.env.PORT ?? 3048);

/**
 * Visual baseline + rendered-page rules for the web app.
 *
 * Uses the installed Google Chrome (`channel: 'chrome'`) so no browser download is needed and the
 * WebGL map paints. Attaches to a server already listening on PORT (the developer's own, per
 * CLAUDE.md "Web local QA") and starts `pnpm run dev:web` only when nothing is there.
 *
 * Snapshots are platform-suffixed by Playwright, so a baseline captured on macOS is not compared
 * against Linux CI output. Data is the live published catalog; see visual.spec.ts for masking.
 */
export default defineConfig({
  testDir: './src/visual',
  testMatch: '**/*.spec.ts',
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [['list']],
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled', caret: 'hide' },
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome',
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
    launchOptions: { args: ['--use-angle=metal'] },
  },
  projects: Object.entries(VIEWPORTS).flatMap(([vp, viewport]) =>
    THEMES.map((theme) => ({
      name: `${vp}-${theme}`,
      metadata: { theme },
      use: { viewport, colorScheme: theme },
    })),
  ),
  webServer: {
    command: 'pnpm run dev:web',
    cwd: '../..',
    url: `http://localhost:${PORT}/faq`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
