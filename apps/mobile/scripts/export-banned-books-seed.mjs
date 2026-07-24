/**
 * One-shot export: write web banned-books seed snapshot to mobile JSON catalog.
 * Run from repo root: node --conditions=development apps/mobile/scripts/export-banned-books-seed.mjs
 * (Requires tsx register or running via pnpm exec tsx with development condition.)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const seedPath = resolve(here, '../../../apps/web/src/data/banned-books-seed.ts');
const outPath = resolve(here, '../src/features/books/catalog-seed.json');

const { getBannedBooksListingSnapshot } = await import(pathToFileURL(seedPath).href);
const snapshot = getBannedBooksListingSnapshot();

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(
  `Wrote ${outPath} (${snapshot.books.length} books, version ${snapshot.version})`,
);
