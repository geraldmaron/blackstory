/**
 * Download a curated set of rights-cleared entity primary images into
 * apps/web/public/brand/collage/tiles for the missing-image archive collage.
 *
 * Prefers already-promoted GCS public-media objects from the Commons dry-run
 * auto_propose set (we hold display rights via the promote path).
 *
 * Usage (repo root):
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/build-archive-collage-tiles.ts
 */
import { createWriteStream, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const USER_AGENT =
  'BlackStoryCommonsEnrichment/1.0 (https://blackstory.app; collage-tiles; mailto:ops@blackstory.app)';
const BUCKET = 'black-book-efaaf-public-media';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const dryRunPath = join(scriptDir, '../fixtures/release-artifacts/commons-media-dry-run.json');
const outDir = join(scriptDir, '../../../apps/web/public/brand/collage/tiles');
const TILE_COUNT = 24;

type Propose = {
  readonly outcome: string;
  readonly entityId: string;
  readonly rightsStatus?: string;
};

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function download(url: string, dest: string): Promise<boolean> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'image/*,*/*' },
    redirect: 'follow',
  });
  if (response.status === 429 || response.status === 503) {
    await sleep(2000);
    return download(url, dest);
  }
  if (!response.ok || !response.body) return false;
  mkdirSync(dirname(dest), { recursive: true });
  await pipeline(Readable.fromWeb(response.body as never), createWriteStream(dest));
  return true;
}

async function main(): Promise<void> {
  if (!existsSync(dryRunPath)) {
    console.error(`Missing dry-run JSON: ${dryRunPath}`);
    process.exit(2);
  }
  const payload = JSON.parse(readFileSync(dryRunPath, 'utf8')) as {
    readonly proposes: readonly Propose[];
  };
  const autos = payload.proposes.filter(
    (p) => p.outcome === 'auto_propose' && p.rightsStatus === 'public_domain',
  );
  // Prefer public_domain tiles for the shared collage texture.
  const selected = autos.slice(0, TILE_COUNT);
  if (selected.length < TILE_COUNT) {
    const licensed = payload.proposes.filter((p) => p.outcome === 'auto_propose');
    for (const p of licensed) {
      if (selected.length >= TILE_COUNT) break;
      if (!selected.some((s) => s.entityId === p.entityId)) selected.push(p);
    }
  }

  mkdirSync(outDir, { recursive: true });
  const manifest: { index: string; entityId: string; url: string }[] = [];

  let i = 0;
  for (const propose of selected) {
    i += 1;
    const index = String(i).padStart(2, '0');
    const dest = join(outDir, `${index}.jpg`);
    const url = `https://storage.googleapis.com/${BUCKET}/public/entities/${propose.entityId}/primary.jpg`;
    const ok = await download(url, dest);
    if (!ok) {
      // try .png
      const pngUrl = url.replace(/\.jpg$/, '.png');
      const pngDest = join(outDir, `${index}.jpg`);
      const okPng = await download(pngUrl, pngDest);
      if (!okPng) {
        console.warn(`skip ${propose.entityId}`);
        i -= 1;
        continue;
      }
    }
    manifest.push({ index, entityId: propose.entityId, url });
    console.log(`${index} ← ${propose.entityId}`);
    await sleep(150);
  }

  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ tiles: manifest }, null, 2));
  console.log(`Wrote ${manifest.length} tiles → ${outDir}`);
  if (manifest.length < 12) {
    console.error('Too few tiles downloaded; collage will look sparse.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
