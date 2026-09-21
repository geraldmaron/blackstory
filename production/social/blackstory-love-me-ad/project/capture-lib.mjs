// Deterministic frame renderer.
//
// For each frame we compute the exact page/camera state from an authored easing
// function, apply it, screenshot, and pipe the PNG straight into ffmpeg. Nothing
// is recorded in real time, so dropped frames, scroll jank and animation drift
// are structurally impossible rather than merely unlikely.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { launch, newPage, settle, VIEW } from './browser.mjs';

export const FPS_N = 60000,
  FPS_D = 1001; // 59.94
export const FPS = FPS_N / FPS_D;
export const secToFrames = (s) => Math.round(s * FPS);

const CHROME_KILL = `
  nextjs-portal, [data-next-badge-root], #__next-build-watcher,
  [data-nextjs-toast], .nextjs-toast, [data-nextjs-dev-tools-button] { display:none !important }
  ::-webkit-scrollbar { width:0 !important; height:0 !important }
  * { scrollbar-width:none !important; caret-color:transparent !important }
  ::selection { background:transparent !important }
`;

function ffmpegSink(outFile, { crf = 12, alpha = false } = {}) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  // Alpha shots (the brand lockup) go to QTRLE, which is lossless and carries a
  // real alpha channel; everything else goes to near-all-intra H.264 so that
  // cutting on any frame is exact and re-encoding loss stays negligible.
  const vf = `scale=${VIEW.width}:${VIEW.height}:flags=lanczos`;
  const args = alpha
    ? ['-vf', `${vf},format=rgba`, '-c:v', 'qtrle']
    : [
        '-vf',
        `${vf},format=yuv420p`,
        '-c:v',
        'libx264',
        '-preset',
        'slow',
        '-crf',
        String(crf),
        '-x264-params',
        'keyint=2:min-keyint=2:scenecut=0',
      ];
  const ff = spawn(
    'ffmpeg',
    [
      '-v',
      'error',
      '-y',
      '-f',
      'image2pipe',
      '-c:v',
      'png',
      '-framerate',
      `${FPS_N}/${FPS_D}`,
      '-i',
      'pipe:0',
      ...args,
      '-r',
      `${FPS_N}/${FPS_D}`,
      outFile,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  );
  return ff;
}

const write = (stream, buf) =>
  new Promise((res, rej) => {
    if (stream.write(buf)) return res();
    stream.once('drain', res);
    stream.once('error', rej);
  });

/**
 * Render one shot.
 *
 * @param {object} shot
 * @param {string} shot.name      capture id, also the output filename stem
 * @param {string} shot.url       route to open
 * @param {number} shot.frames    frames to render (already includes handles)
 * @param {(ctx)=>Promise} [shot.setup]   run once after load, before rendering
 * @param {(ctx)=>Promise} [shot.prewarm] run once to force tiles/images/reveals
 * @param {(ctx)=>Promise} shot.step      position the page for frame i
 * @param {string} outDir
 */
export async function renderShot(shot, outDir, { browser } = {}) {
  const own = !browser;
  browser ||= await launch();
  const { ctx, page } = await newPage(browser);
  // QTRLE (alpha) is only valid in a QuickTime container.
  const out = path.join(outDir, `${shot.name}.${shot.alpha ? 'mov' : 'mp4'}`);
  const t0 = Date.now();
  const log = [];
  page.on('pageerror', (e) => log.push(String(e).slice(0, 200)));

  try {
    await page.goto(shot.url, { waitUntil: 'commit', timeout: 180000 });
    await page.addStyleTag({ content: CHROME_KILL }).catch(() => {});
    if (shot.css) await page.addStyleTag({ content: shot.css }).catch(() => {});
    await settle(page, { extra: shot.settleMs ?? 3000 });
    await page.addStyleTag({ content: CHROME_KILL }).catch(() => {});
    if (shot.css) await page.addStyleTag({ content: shot.css }).catch(() => {});
    if (shot.needsMap) await page.evaluate(() => window.scrollTo(0, 0));

    const api = { page, frames: shot.frames };
    if (shot.needsMap) {
      await page.waitForFunction(() => window.__bpMapStage && window.__bpMapStage.loaded(), null, {
        timeout: 120000,
      });
      await page.evaluate(
        () =>
          new Promise((r) => {
            const m = window.__bpMapStage;
            // Silence the map's own inertia: every move in this piece is authored.
            m.dragPan?.disable?.();
            m.scrollZoom?.disable?.();
            m.stop?.();
            m.areTilesLoaded() ? r() : m.once('idle', r);
            setTimeout(r, 15000);
          }),
      );
    }

    if (shot.setup) await shot.setup(api);

    // Runs after setup: setup sweeps the page, which is what trips the lazy
    // loader for images far down a long page. Historical media is hotlinked from wikimedia/LoC and loads slowly and
    // sometimes not at all. A shot built on an image must not render until that
    // image has real pixels, or the edit silently gains a blank frame.
    if (shot.requireAlt) {
      let loaded = false;
      for (let attempt = 1; attempt <= 3 && !loaded; attempt++) {
        loaded = await page
          .waitForFunction(
            (needle) => {
              const i = [...document.images].find((x) =>
                (x.alt || '').toLowerCase().includes(needle),
              );
              return !!(i && i.complete && i.naturalWidth > 300);
            },
            shot.requireAlt.toLowerCase(),
            { timeout: 45000, polling: 400 },
          )
          .then(() => true)
          .catch(() => false);
        if (!loaded) {
          console.error(
            `    image "${shot.requireAlt}" not painted (attempt ${attempt}) — reloading`,
          );
          await page.reload({ waitUntil: 'commit', timeout: 120000 }).catch(() => {});
          await page.addStyleTag({ content: CHROME_KILL }).catch(() => {});
          await settle(page, { extra: 4000 });
          if (shot.setup) await shot.setup(api);
        }
      }
      if (!loaded)
        throw new Error(`REQUIRED IMAGE NEVER PAINTED: "${shot.requireAlt}" on ${shot.url}`);
      await page.evaluate((needle) => {
        const i = [...document.images].find((x) => (x.alt || '').toLowerCase().includes(needle));
        return i?.decode?.().catch(() => {});
      }, shot.requireAlt.toLowerCase());
    }

    if (shot.prewarm) {
      await shot.prewarm(api);
      await page.waitForTimeout(shot.prewarmSettleMs ?? 1200);
    }

    const ff = ffmpegSink(out, { crf: shot.crf, alpha: shot.alpha });
    const done = new Promise((r) => ff.on('close', r));

    // Handle frames: the shot is rendered past both ends of its edit length by
    // extrapolating t outside [0,1], so the cut can be slid by a few frames in
    // the fine cut without recapturing.
    const H = shot.handle ?? 12;
    const N = shot.frames;
    for (let i = -H; i < N + H; i++) {
      const t = N === 1 ? 0 : i / (N - 1);
      await shot.step({ ...api, i, t });
      if (shot.needsMap && shot.waitTiles !== false) {
        await page
          .evaluate(
            () =>
              new Promise((r) => {
                const m = window.__bpMapStage;
                if (!m || m.areTilesLoaded()) return r();
                const to = setTimeout(r, 400);
                m.once('idle', () => {
                  clearTimeout(to);
                  r();
                });
              }),
          )
          .catch(() => {});
      }
      const buf = await page.screenshot({
        type: 'png',
        animations: 'disabled',
        caret: 'hide',
        omitBackground: !!shot.alpha,
      });
      await write(ff.stdin, buf);
      if ((i + H) % 60 === 0) process.stderr.write(`\r  ${shot.name}: ${i + H}/${N + 2 * H}   `);
    }
    ff.stdin.end();
    await done;

    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const total = N + 2 * H;
    process.stderr.write(
      `\r  ${shot.name}: ${total} frames (${N} + ${H} handles each end) in ${secs}s\n`,
    );
    if (log.length) console.error(`    [page errors] ${log.slice(0, 3).join(' | ')}`);
    return {
      name: shot.name,
      out,
      frames: N,
      handle: H,
      totalFrames: total,
      seconds: +secs,
      url: shot.url,
      surface: shot.surface ?? null,
      action: shot.action ?? null,
      errors: log.slice(0, 5),
    };
  } finally {
    await ctx.close().catch(() => {});
    if (own) await browser.close().catch(() => {});
  }
}
