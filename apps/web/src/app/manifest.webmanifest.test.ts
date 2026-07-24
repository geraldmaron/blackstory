/**
 * Guards the public web app manifest used for Add to Home Screen / installability.
 * Online-first only: no service worker claim.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST_PATH = join(APP_ROOT, 'public/manifest.webmanifest');
const LAYOUT_PATH = join(APP_ROOT, 'src/app/layout.tsx');

test('manifest names BlackStory, standalone display, and brand theme colors', () => {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as {
    name: string;
    short_name: string;
    display: string;
    background_color: string;
    theme_color: string;
    icons: Array<{ src: string; sizes: string; purpose?: string }>;
  };

  assert.equal(manifest.name, 'BlackStory');
  assert.equal(manifest.short_name, 'BlackStory');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.background_color, '#F4EFE5');
  assert.equal(manifest.theme_color, '#F4EFE5');

  const sizes = new Set(manifest.icons.map((icon) => icon.sizes));
  assert.ok(sizes.has('192x192'));
  assert.ok(sizes.has('512x512'));
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'));

  for (const icon of manifest.icons) {
    const absolute = join(APP_ROOT, 'public', icon.src.replace(/^\//, ''));
    assert.ok(readFileSync(absolute).byteLength > 0, `missing icon ${icon.src}`);
  }
});

test('root layout wires manifest and Apple web-app metadata', () => {
  const layout = readFileSync(LAYOUT_PATH, 'utf8');
  assert.match(layout, /manifest:\s*'\/manifest\.webmanifest'/);
  assert.match(layout, /appleWebApp:\s*\{/);
  assert.match(layout, /capable:\s*true/);
  assert.match(layout, /#F4EFE5/);
  assert.match(layout, /#0A0A0A/);
  assert.doesNotMatch(layout, /serviceWorker|navigator\.serviceWorker|workbox/i);
});
