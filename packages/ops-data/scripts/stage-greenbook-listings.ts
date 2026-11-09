/**
 * Stage Green Book listings as listing-tier records (see listingReviewApproved in
 * lib/incremental-publish.ts). Picks business listings in the thin-coverage states whose source
 * entry matches the row exactly and whose coordinates agree with the source, then writes the
 * summary, a single-fact summaryClaims entry and the payload.listingReview marker.
 *
 * Dry run by default (READ ONLY). DRY_RUN=0 writes the picked rows only.
 *
 * Usage (from repo root):
 *   cd apps/web && set -a && . ./.env.local && set +a && cd - && export DATABASE_SSL=1
 *   node --conditions development --import tsx packages/ops-data/scripts/stage-greenbook-listings.ts \
 *     --source-dir=<dir with geojson/1947.geojson-style copies: 1947.geojson, greenbook_1956.json> \
 *     [--limit=20] [--state-cap=4] [--out=<plan.json>]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { connectWithDeadline, normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  listingClaim,
  listingQuotes,
  listingSummary,
  stateName,
  type ListingFacts,
} from './lib/greenbook-registry.ts';

const WRITE = process.env.DRY_RUN === '0';
const THIN_STATES = new Set([
  'Michigan',
  'Illinois',
  'Pennsylvania',
  'New Jersey',
  'Wisconsin',
  'California',
]);
const PLAIN_ADDRESS = /^\d{1,5} [A-Za-z0-9 .'-]+$/u;

function flag(name: string, fallback?: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  if (fallback !== undefined) return fallback;
  throw new Error(`--${name}= is required`);
}

type Row = {
  id: string;
  display_name: string;
  lat: number;
  lng: number;
  provenance: Record<string, string | number>;
};

const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-5;

async function main(): Promise<void> {
  const dir = flag('source-dir');
  const limit = Number(flag('limit', '20'));
  const stateCap = Number(flag('state-cap', '4'));
  const text: Record<number, string> = {
    1947: readFileSync(join(dir, '1947.geojson'), 'utf8'),
    1956: readFileSync(join(dir, 'greenbook_1956.json'), 'utf8'),
  };
  const features = (
    JSON.parse(text[1947] as string) as {
      features: { properties: Record<string, any>; geometry: { coordinates: number[] } }[];
    }
  ).features;
  const rows1956 = (
    JSON.parse(text[1956] as string) as { rows: [string, string, string, string, number[]][] }
  ).rows;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');
  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));
  const client = await connectWithDeadline<pg.PoolClient>(pool);
  try {
    await client.query(WRITE ? 'BEGIN' : 'BEGIN READ ONLY');
    const { rows } = await client.query<Row>(
      `SELECT l.id, l.display_name, l.lat, l.lng, l.provenance
         FROM research.landscape_candidates l
        WHERE l.lane = 'greenbook' AND l.status = 'pending' AND l.lat IS NOT NULL
          AND NOT (l.payload ? 'listingReview')
          AND l.provenance->>'sourceCategory' IN ('Hotel', 'Restaurant')
          AND l.display_name !~ '^(Mrs?\\.|Mr\\.|Dr\\.|Miss)'
          AND NOT EXISTS (SELECT 1 FROM published.release_entities p
                           WHERE lower(p.display_name) = lower(l.display_name))
        ORDER BY md5(l.id)`,
    );
    const picked: {
      id: string;
      summary: string;
      claim: string;
      sourceUrl: string;
      geo: string;
      facts: ListingFacts;
    }[] = [];
    const perState = new Map<string, number>();
    const skipped = new Map<string, number>();
    const skip = (why: string) => skipped.set(why, (skipped.get(why) ?? 0) + 1);
    for (const row of rows) {
      if (picked.length >= limit) break;
      const p = row.provenance;
      const facts: ListingFacts = {
        name: row.display_name,
        address: String(p.historicAddress ?? '')
          .split(',')[0]!
          .trim(),
        category: String(p.sourceCategory ?? ''),
        year: Number(p.editionYear),
        city: String(p.sourceCity ?? '').trim(),
        state: stateName(String(p.sourceState ?? '')),
      };
      if (!THIN_STATES.has(facts.state)) {
        skip('state');
        continue;
      }
      if ((perState.get(facts.state) ?? 0) >= stateCap) {
        skip('state cap');
        continue;
      }
      // The projection schema floors a summary at 120 characters; nothing pads a short one.
      if (listingSummary(facts).length < 120) {
        skip('summary under 120 characters');
        continue;
      }
      if (!PLAIN_ADDRESS.test(facts.address)) {
        skip('address not plain');
        continue;
      }
      if (listingQuotes(text[facts.year] ?? '', facts) === null) {
        skip('no exact source match');
        continue;
      }
      let geo: string;
      if (facts.year === 1947) {
        // capture_uuid is the page image, shared by every listing on that page: match on name and address.
        const feature = features.find(
          (f) => f.properties.name === facts.name && f.properties.address === facts.address,
        );
        const props = feature?.properties;
        const number = facts.address.split(' ')[0] as string;
        const ok =
          feature !== undefined &&
          near(feature.geometry.coordinates[1] as number, row.lat) &&
          near(feature.geometry.coordinates[0] as number, row.lng) &&
          Number(props?.geocoded_confidence) >= 0.9 &&
          String(props?.geocoded_address ?? '')
            .toLowerCase()
            .includes(facts.city.toLowerCase()) &&
          String(props?.geocoded_address ?? '').startsWith(`${number} `);
        if (!ok) {
          skip('geo mismatch');
          continue;
        }
        geo = `geocoder agrees (confidence ${Number(props?.geocoded_confidence).toFixed(3)}): ${props?.geocoded_address}`;
      } else {
        const entry = rows1956.find(([n, a]) => n === facts.name && a.startsWith(facts.address));
        if (
          !entry ||
          !near(entry[4][0] as number, row.lat) ||
          !near(entry[4][1] as number, row.lng)
        ) {
          skip('geo mismatch');
          continue;
        }
        geo = 'coordinates equal the source file; not independently geocoded';
      }
      perState.set(facts.state, (perState.get(facts.state) ?? 0) + 1);
      picked.push({
        id: row.id,
        summary: listingSummary(facts),
        claim: listingClaim(facts),
        sourceUrl: String(p.sourceUrl),
        geo,
        facts,
      });
    }

    const review = {
      approved: true,
      approvedBy: 'owner (slice decision 2026-11-08, applied by session)',
      approvedAt: new Date().toISOString(),
      basis:
        'Hotel or restaurant listing with no personal name and a plain street address, in a thin-coverage state; source entry and coordinates checked against the NYPL file.',
    };
    if (WRITE) {
      for (const item of picked) {
        const result = await client.query(
          `UPDATE research.landscape_candidates
              SET summary = $2,
                  payload = payload || jsonb_build_object('summaryClaims', $3::jsonb, 'listingReview', $4::jsonb),
                  provenance = provenance || jsonb_build_object('generatedBy', 'stage-greenbook-listings.ts'),
                  updated_at = now()
            WHERE id = $1 AND lane = 'greenbook' AND status = 'pending'`,
          [
            item.id,
            item.summary,
            JSON.stringify([{ object: item.claim, citationHref: item.sourceUrl }]),
            JSON.stringify(review),
          ],
        );
        if (result.rowCount !== 1) throw new Error(`expected to update one row for ${item.id}`);
      }
    }
    await client.query(WRITE ? 'COMMIT' : 'ROLLBACK');
    const out = flag('out', '');
    if (out) writeFileSync(out, `${JSON.stringify({ review, picked }, null, 2)}\n`);
    console.log(
      JSON.stringify(
        {
          mode: WRITE ? 'written' : 'dry-run',
          picked: picked.length,
          perState: Object.fromEntries(perState),
          skipped: Object.fromEntries(skipped),
          ids: picked.map((i) => i.id),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
