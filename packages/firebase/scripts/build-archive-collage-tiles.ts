/**
 * Download a curated set of rights-cleared entity primary images into
 * apps/web/public/brand/collage/tiles for archive collage mosaics (story masts
 * and the about-page living mosaic).
 *
 * Prefers already-promoted GCS public-media objects from the Commons dry-run
 * auto_propose set (we hold display rights via the promote path). Also regenerates
 * apps/web/src/components/atmosphere/tile-credits.ts from the written manifest.
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
import { execFileSync } from 'node:child_process';

const USER_AGENT =
  'BlackStoryCommonsEnrichment/1.0 (https://blackstory.app; collage-tiles; mailto:ops@blackstory.app)';
const BUCKET = 'black-book-efaaf-public-media';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const dryRunPath = join(scriptDir, '../fixtures/release-artifacts/commons-media-dry-run.json');
const outDir = join(scriptDir, '../../../apps/web/public/brand/collage/tiles');
const tileCreditsPath = join(
  scriptDir,
  '../../../apps/web/src/components/atmosphere/tile-credits.ts',
);
/** Broader pool for story masts + about living mosaic (was 24). */
const TILE_COUNT = 48;

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
    normalizeTileJpeg(dest);
    console.log(`${index} ← ${propose.entityId}`);
    await sleep(150);
  }

  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ tiles: manifest }, null, 2));
  writeFileSync(tileCreditsPath, renderTileCreditsTs(manifest));
  console.log(`Wrote ${manifest.length} tiles → ${outDir}`);
  console.log(`Wrote tile credits → ${tileCreditsPath}`);
  if (manifest.length < 12) {
    console.error('Too few tiles downloaded; collage will look sparse.');
    process.exit(1);
  }
}

function normalizeTileJpeg(dest: string): void {
  // Mosaic cells are small; cap long edge and force JPEG so browsers never get TIFF/PNG-as-.jpg.
  try {
    execFileSync('sips', ['-s', 'format', 'jpeg', '-Z', '800', dest, '--out', dest], {
      stdio: 'ignore',
    });
  } catch {
    console.warn(`normalize skipped for ${dest}`);
  }
}

function renderTileCreditsTs(
  manifest: readonly { index: string; entityId: string; url: string }[],
): string {
  const entries = manifest
    .map(
      (tile) => `  {
    index: '${tile.index}',
    entityId: '${tile.entityId}',
    path: '/brand/collage/tiles/${tile.index}.jpg',
    sourceUrl:
      '${tile.url}',
  }`,
    )
    .join(',\n');

  return `/**
 * Typed catalog of rights-cleared archive collage tiles used by atmosphere planes.
 * Paths are local copies under /brand/collage/tiles — sourced from Commons promotions
 * (see packages/firebase/scripts/build-archive-collage-tiles.ts).
 *
 * Regenerated by the collage build script — do not hand-edit the tile list.
 */
export type AtmosphereTileCredit = {
  readonly index: string;
  readonly entityId: string;
  /** Local static path served by the web app. */
  readonly path: string;
  /** Original GCS URL recorded in the collage manifest (attribution / rebuild). */
  readonly sourceUrl: string;
};

/** ${manifest.length}-tile pool — index order matches public/brand/collage/tiles/manifest.json. */
export const ATMOSPHERE_TILE_CREDITS: readonly AtmosphereTileCredit[] = [
${entries},
] as const;

export const ATMOSPHERE_ATTRIBUTION_HREF = '/stories/mosaic-credits';
`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
