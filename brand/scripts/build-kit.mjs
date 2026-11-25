/**
 * Builds the whole BlackStory brand kit from its definition (`brand-geometry.mjs`).
 *
 *   node brand/scripts/build-kit.mjs            write the kit under brand/
 *   node brand/scripts/build-kit.mjs --apps     also replace each app's served copies
 *   node brand/scripts/build-kit.mjs --check    build in memory and fail if any file differs
 *
 * Needs only the repo's own dev dependencies (sharp, opentype.js) and the font in brand/fonts.
 * No network, no design application. Every output is listed in `outputs()` below; nothing in
 * the kit is made any other way. See brand/README.md for what each file is for.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import {
  LOCKUP_SIZE,
  LOCKUP_SYMBOL,
  MARK_COLORS,
  ROOT,
  SYMBOL_BOX,
  SYMBOL_SIZE,
  lockupSvg,
  symbolShapes,
  symbolSilhouette,
  liveLockupMetrics,
  symbolSvg,
  wordmarkPath,
} from './brand-geometry.mjs';

const require = createRequire(resolve(ROOT, 'package.json'));
const sharp = require('sharp');

const THEMES = ['dark', 'light'];
/** The ground each theme's mark is made for (docs/ui/brand.md, brand/tokens/colors.json). */
const GROUND = { dark: '#0A0A0A', light: '#F4EFE5' };

/** Rasterizes an SVG at exactly this size: the size is written into the SVG, so nothing is resampled. */
async function png(svg, width, height = width) {
  const sized = svg.replace('<svg ', `<svg width="${width}" height="${height}" `);
  return sharp(Buffer.from(sized)).png({ compressionLevel: 9 }).toBuffer();
}

const shapes = (theme) =>
  symbolShapes(theme)
    .map((shape) => `<path d="${shape.d}" fill="${shape.fill}"/>`)
    .join('');

/**
 * The symbol on a square tile. `fill` is the symbol's height as a share of the tile; `radius`
 * the tile's corner radius as a share of its side (0 for a full-bleed square, which is what an
 * operating system masks itself); `ground` null for a transparent tile.
 */
function tileSvg(theme, { fill, radius = 0, ground = GROUND[theme] }) {
  const size = 1000;
  const box = SYMBOL_BOX;
  const scale = (size * fill) / (box.bottom - box.top);
  const x = (size - (box.right - box.left) * scale) / 2 - box.left * scale;
  const y = (size - (box.bottom - box.top) * scale) / 2 - box.top * scale;
  const back = ground
    ? `<rect width="${size}" height="${size}" rx="${size * radius}" fill="${ground}"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">${back}<g transform="translate(${x} ${y}) scale(${scale})">${shapes(theme)}</g></svg>`;
}

/** The symbol in one color with the pin cut out (Android's themed icon). */
function monochromeSvg(fill) {
  const size = 1000;
  const box = SYMBOL_BOX;
  const scale = (size * fill) / (box.bottom - box.top);
  const x = (size - (box.right - box.left) * scale) / 2 - box.left * scale;
  const y = (size - (box.bottom - box.top) * scale) / 2 - box.top * scale;
  const s = symbolSilhouette();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><g transform="translate(${x} ${y}) scale(${scale})" fill="#FFFFFF"><path d="${s.solid}"/><path fill-rule="evenodd" d="${s.cover}"/></g></svg>`;
}

/** The lockup's ink box in lockup units. */
function lockupInk() {
  const word = wordmarkPath().ink;
  const s = LOCKUP_SYMBOL;
  return {
    left: s.x + SYMBOL_BOX.left * s.scale,
    top: s.y + SYMBOL_BOX.top * s.scale,
    right: word.right,
    bottom: s.y + SYMBOL_BOX.bottom * s.scale,
  };
}

/** The lockup cropped to its ink plus `pad` (a share of its height), on an optional ground. */
function lockupCroppedSvg(theme, { width, height, inkWidth, ground = null }) {
  const ink = lockupInk();
  const scale = inkWidth / (ink.right - ink.left);
  const x = (width - inkWidth) / 2 - ink.left * scale;
  const y = (height - (ink.bottom - ink.top) * scale) / 2 - ink.top * scale;
  const inner = lockupSvg(theme)
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '');
  const back = ground ? `<rect width="${width}" height="${height}" fill="${ground}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${back}<g transform="translate(${x} ${y}) scale(${scale})">${inner}</g></svg>`;
}

/** The lockup cropped exactly to its ink: no built-in margin, so a page sets its own space. */
function lockupTightSvg(theme) {
  const ink = lockupInk();
  const box = [ink.left, ink.top, ink.right - ink.left, ink.bottom - ink.top].map(
    (v) => +v.toFixed(2),
  );
  return lockupSvg(theme).replace(/viewBox="[^"]*"/, `viewBox="${box.join(' ')}"`);
}

/**
 * The lockup's ink inside its canvas, for a page that crops the full-canvas artwork itself: the
 * box in canvas units, its width over its height, and how much to trim from each side as a
 * share of the canvas height (the header sets the artwork by height).
 */
function lockupCanvasMetrics() {
  const ink = lockupInk();
  const { width, height } = LOCKUP_SIZE;
  const r = (v) => +v.toFixed(4);
  return {
    canvas: { width, height },
    ink: { left: r(ink.left), top: r(ink.top), right: r(ink.right), bottom: r(ink.bottom) },
    aspect: r((ink.right - ink.left) / (ink.bottom - ink.top)),
    trim: {
      top: r(ink.top / height),
      bottom: r((height - ink.bottom) / height),
      left: r(ink.left / height),
      right: r((width - ink.right) / height),
    },
  };
}

/** `live-lockup.json` as custom properties on the element that sets the wordmark as text. */
function liveLockupCss() {
  const m = liveLockupMetrics();
  const em = (value) => `${+value.toFixed(4)}em`;
  return [
    '/* Generated by brand/scripts/build-kit.mjs from the brand definition. Do not edit: change',
    '   brand/scripts/brand-geometry.mjs and rebuild. The values are brand/tokens/live-lockup.json',
    '   resolved for a line of height 1. */',
    '.ds-scene__closing {',
    `  --lockup-weight: ${m.weight};`,
    `  --lockup-tracking: ${em(m.tracking)};`,
    "  /* Half of what the symbol adds at the word's left, so the lockup is what gets centered. */",
    `  --lockup-shift: ${em((-m.symbol.inkLeft - m.sideBearing) / 2)};`,
    `  --lockup-symbol-size: ${em(m.symbol.size)};`,
    `  --lockup-symbol-left: ${em(m.symbol.left + m.sideBearing)};`,
    `  --lockup-symbol-top: ${em(m.baseline + m.symbol.top)};`,
    '}',
    '',
  ].join('\n');
}

/** The wordmark alone, cropped to its ink. */
function wordmarkSvg(theme) {
  const { d, ink } = wordmarkPath();
  const pad = 8;
  const fill = theme === 'dark' ? MARK_COLORS.paper : MARK_COLORS.ink;
  const w = ink.right - ink.left + pad * 2;
  const h = ink.bottom - ink.top + pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="BlackStory" viewBox="${ink.left - pad} ${ink.top - pad} ${+w.toFixed(2)} ${+h.toFixed(2)}"><path d="${d}" fill="${fill}"/></svg>\n`;
}

/**
 * Every file the kit owns: `[path, () => contents]`. Paths under brand/ are the kit; the rest are
 * each app's served copies, written only with --apps.
 */
function outputs() {
  const kit = [];
  const apps = [];
  const symbol = (theme, size) => () => png(symbolSvg(theme), size);
  const lockup = (theme, width) => () =>
    png(lockupSvg(theme), width, Math.round((width * LOCKUP_SIZE.height) / LOCKUP_SIZE.width));
  const tile = (theme, size, options) => () => png(tileSvg(theme, options), size);
  const banner = (theme) => () =>
    png(
      lockupCroppedSvg(theme, { width: 1200, height: 630, inkWidth: 560, ground: GROUND[theme] }),
      1200,
      630,
    );
  // Full-bleed square for a launcher; rounded for a browser tab; smaller inside a maskable icon.
  const APP = { fill: 0.6 };
  const TAB = { fill: 0.74, radius: 0.22 };
  const MASKABLE = { fill: 0.5 };

  for (const theme of THEMES) {
    // Vector masters.
    kit.push([`brand/vector/BlackStory-symbol-${theme}.svg`, () => symbolSvg(theme)]);
    kit.push([`brand/vector/BlackStory-lockup-${theme}.svg`, () => lockupSvg(theme)]);
    kit.push([`brand/vector/BlackStory-wordmark-${theme}.svg`, () => wordmarkSvg(theme)]);
    kit.push([`brand/vector/BlackStory-lockup-${theme}-tight.svg`, () => lockupTightSvg(theme)]);
    // Raster exports, same names and sizes the kit has always had.
    kit.push([
      `brand/logos/${theme}/BlackStory-primary-lockup-${theme}-transparent.png`,
      lockup(theme, 1672),
    ]);
    kit.push([
      `brand/symbols/${theme}/BlackStory-symbol-${theme}-transparent.png`,
      symbol(theme, SYMBOL_SIZE),
    ]);
    for (const size of [512, 1024, 2048]) {
      kit.push([
        `brand/symbols/${theme}/BlackStory-symbol-${theme}-transparent-${size}.png`,
        symbol(theme, size),
      ]);
    }
    for (const size of [16, 32, 64, 128, 180, 256, 512, 1024]) {
      kit.push([
        `brand/app-icons/${theme}/BlackStory-app-icon-${theme}-${size}.png`,
        tile(theme, size, APP),
      ]);
    }
    kit.push([`brand/social/${theme}/BlackStory-avatar-${theme}-512.png`, tile(theme, 512, APP)]);
    kit.push([
      `brand/social/${theme}/BlackStory-social-banner-${theme}-1200x630.png`,
      banner(theme),
    ]);

    // Web and docs: role-named copies (packages/config BRAND_ASSETS).
    for (const app of ['apps/web/public/brand', 'apps/docs/public/brand']) {
      apps.push([`${app}/lockup-${theme}.png`, lockup(theme, 1600)]);
      apps.push([`${app}/symbol-${theme}.png`, symbol(theme, 512)]);
      apps.push([`${app}/lockup-${theme}.svg`, () => lockupSvg(theme)]);
      apps.push([`${app}/lockup-tight-${theme}.svg`, () => lockupTightSvg(theme)]);
      apps.push([`${app}/symbol-${theme}.svg`, () => symbolSvg(theme)]);
      for (const size of [16, 32, 48]) {
        apps.push([`${app}/favicon-${theme}-${size}.png`, tile(theme, size, TAB)]);
      }
      apps.push([`${app}/apple-touch-icon-${theme}-180.png`, tile(theme, 180, APP)]);
      apps.push([`${app}/open-graph-${theme}-1200x630.png`, banner(theme)]);
    }
    // Mobile: the app's own copies of the kit files it bundles.
    apps.push([
      `apps/mobile/assets/brand/logos/${theme}/BlackStory-primary-lockup-${theme}-transparent.png`,
      lockup(theme, 1672),
    ]);
    apps.push([
      `apps/mobile/assets/brand/symbols/${theme}/BlackStory-symbol-${theme}-transparent-1024.png`,
      symbol(theme, 1024),
    ]);
  }

  // Web install icons: on Archive Paper, with a dark maskable variant.
  const web = 'apps/web/public/brand';
  apps.push([`${web}/icon-192.png`, tile('light', 192, APP)]);
  apps.push([`${web}/icon-512.png`, tile('light', 512, APP)]);
  apps.push([`${web}/icon-maskable-512.png`, tile('light', 512, MASKABLE)]);
  apps.push([`${web}/icon-maskable-dark-512.png`, tile('dark', 512, MASKABLE)]);
  // Email: the light lockup cropped tight, at twice the 320 by 98 it is shown at most.
  apps.push([
    `${web}/email-lockup.png`,
    () => png(lockupCroppedSvg('light', { width: 640, height: 196, inkWidth: 600 }), 640, 196),
  ]);

  // What a page needs to set the wordmark as live text (the front page's last scene does). The
  // site's display face is the wordmark's own, so the page needs only these numbers.
  kit.push([
    'brand/tokens/live-lockup.json',
    () => `${JSON.stringify({ ...liveLockupMetrics(), lockup: lockupCanvasMetrics() }, null, 2)}\n`,
  ]);

  // The same numbers as CSS for the one page that sets the wordmark as live text, so that page
  // carries no copy of them to fall out of step.
  apps.push(['apps/web/src/app/front/live-lockup.css', () => liveLockupCss()]);

  // Mobile launcher icons.
  const mobile = 'apps/mobile/assets/images';
  // icon.png is the app's icon everywhere; iOS also takes icon-dark.png for a dark home screen.
  apps.push([`${mobile}/icon.png`, tile('light', 1024, APP)]);
  apps.push([`${mobile}/icon-dark.png`, tile('dark', 1024, APP)]);
  apps.push([`${mobile}/favicon.png`, tile('light', 48, TAB)]);
  // Android adaptive: the foreground keeps inside the middle two thirds the launcher shows.
  apps.push([
    `${mobile}/android-icon-foreground.png`,
    tile('light', 512, { fill: 0.44, ground: null }),
  ]);
  apps.push([
    `${mobile}/android-icon-background.png`,
    () =>
      png(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="${GROUND.light}"/></svg>`,
        512,
      ),
  ]);
  apps.push([`${mobile}/android-icon-monochrome.png`, () => png(monochromeSvg(0.44), 432)]);

  return { kit, apps };
}

const sha = (buffer) => createHash('sha256').update(buffer).digest('hex');

/**
 * Whether a built file matches the one on disk. Text (SVG, JSON, CSS) has to match byte for
 * byte. A PNG is compared as decoded pixels with a small allowance, because the encoder and the
 * rasterizer are native libraries whose bytes differ between platforms and versions while the
 * picture does not.
 */
async function matches(file, built) {
  if (!existsSync(file)) return false;
  const onDisk = readFileSync(file);
  if (sha(onDisk) === sha(built)) return true;
  if (!file.endsWith('.png')) return false;
  const [a, b] = await Promise.all(
    [onDisk, built].map((buffer) =>
      sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    ),
  );
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) return false;
  let total = 0;
  for (let i = 0; i < a.data.length; i += 1) total += Math.abs(a.data[i] - b.data[i]);
  // Mean difference per channel, out of 255. A moved edge or a changed color is far above this.
  return total / a.data.length < 0.5;
}

const TEXT = /\.(svg|json|css)$/;

const args = new Set(process.argv.slice(2));
const { kit, apps } = outputs();
const wanted = args.has('--apps') || args.has('--check') ? [...kit, ...apps] : kit;
const checksums = {};
const stale = [];
for (const [path, make] of wanted) {
  const made = await make();
  const buffer = typeof made === 'string' ? Buffer.from(made) : made;
  const file = resolve(ROOT, path);
  if (path.startsWith('brand/')) checksums[path.slice('brand/'.length)] = sha(buffer);
  if (args.has('--check')) {
    if (!(await matches(file, buffer))) stale.push(path);
    continue;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, buffer);
}

const manifestFile = resolve(ROOT, 'brand/qa/checksums.json');
if (args.has('--check')) {
  // The manifest lists every kit file, and its hashes for the text files are exact.
  const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {};
  const listed = Object.keys(manifest).sort().join('\n');
  const expected = Object.keys(checksums).sort().join('\n');
  const textDrift = Object.keys(checksums).some(
    (key) => TEXT.test(key) && manifest[key] !== checksums[key],
  );
  if (listed !== expected || textDrift) stale.push('brand/qa/checksums.json');
  if (stale.length > 0) {
    console.error(
      `Brand kit is out of date (${stale.length} files). Run: node brand/scripts/build-kit.mjs --apps`,
    );
    for (const path of stale) console.error(`  ${path}`);
    process.exit(1);
  }
  console.log(`Brand kit is current: ${wanted.length} files match their definition.`);
} else {
  const sorted = Object.fromEntries(
    Object.entries(checksums).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(manifestFile, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(
    `Wrote ${wanted.length} files${args.has('--apps') ? ' (kit and app copies)' : ' (kit only; --apps also replaces served copies)'}.`,
  );
}
