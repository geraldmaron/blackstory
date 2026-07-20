/**
 * Export `censusCountyDecades` into the Explore map static index
 * `apps/web/public/geo/county-population-decades.json`.
 *
 * Operator-only (Admin SDK → production Firestore). Never run in CI.
 *
 *   APP_FIREBASE_ALLOW_PRODUCTION=1 FIREBASE_PROJECT_ID=black-book-efaaf \
 *     GOOGLE_CLOUD_QUOTA_PROJECT=black-book-efaaf \
 *     node --conditions development --import tsx \
 *     packages/firebase/scripts/export-county-population-index.ts
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'black-book-efaaf';
const OUT_PATH = resolve(
  process.cwd(),
  'apps/web/public/geo/county-population-decades.json',
);

if (getApps().length === 0) {
  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
}

const db = getFirestore();
const snap = await db
  .collection('censusCountyDecades')
  .select('fips5', 'decade', 'totalPopulation', 'blackPopulation')
  .get();

const counties: Record<string, Record<string, { total: number; black: number }>> = {};
const decades = new Set<string>();
for (const doc of snap.docs) {
  const data = doc.data() as {
    fips5?: string;
    decade?: string;
    totalPopulation?: number;
    blackPopulation?: number;
  };
  if (!data.fips5 || !data.decade) continue;
  if (typeof data.totalPopulation !== 'number' || typeof data.blackPopulation !== 'number') {
    continue;
  }
  decades.add(data.decade);
  counties[data.fips5] ??= {};
  counties[data.fips5]![data.decade] = {
    total: data.totalPopulation,
    black: data.blackPopulation,
  };
}

const vintages = (['2000', '2010', '2020'] as const).filter((v) => decades.has(v));
const payload = { vintages, counties };
writeFileSync(OUT_PATH, JSON.stringify(payload));
console.log(
  JSON.stringify(
    {
      out: OUT_PATH,
      counties: Object.keys(counties).length,
      vintages,
      docs: snap.size,
      bytes: Buffer.byteLength(JSON.stringify(payload)),
    },
    null,
    2,
  ),
);
