// Shared browser setup for inspection and capture.
// The map surfaces are WebGL, so the GPU flags are not optional.
import { chromium } from 'playwright';

export const VIEW = { width: 1080, height: 1920 };
export const DSF = 2; // device scale factor -> 2160x3840 capture

export async function launch({ headless = true } = {}) {
  return chromium.launch({
    headless,
    args: [
      '--use-angle=metal',
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--enable-unsafe-webgpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=' + DSF,
      '--force-color-profile=srgb',
      '--disable-lcd-text',
      '--font-render-hinting=none',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-features=CalculateNativeWinOcclusion,IsolateOrigins',
    ],
  });
}

export async function newPage(browser) {
  const ctx = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: DSF,
    isMobile: false,
    hasTouch: false,
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();
  // Kill scrollbars and any residual caret/selection that would show on camera.
  await page
    .addStyleTag({
      content: `
    ::-webkit-scrollbar { width:0 !important; height:0 !important; display:none !important }
    * { scrollbar-width: none !important; -webkit-tap-highlight-color: transparent !important }
    ::selection { background: transparent !important }
  `,
    })
    .catch(() => {});
  return { ctx, page };
}

// Wait until fonts, images in view, and network have all stopped moving.
export async function settle(page, { extra = 0 } = {}) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page
    .evaluate(async () => {
      await document.fonts.ready.catch(() => {});
      const imgs = [...document.images].filter((i) => !i.complete);
      await Promise.all(
        imgs.map(
          (i) =>
            new Promise((r) => {
              i.addEventListener('load', r, { once: true });
              i.addEventListener('error', r, { once: true });
              setTimeout(r, 4000);
            }),
        ),
      );
    })
    .catch(() => {});
  if (extra) await page.waitForTimeout(extra);
}
