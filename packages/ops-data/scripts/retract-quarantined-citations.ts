/**
 * repo-ppeu — retract published claims whose cited document has since been quarantined.
 *
 * `audit-evidence-identity.ts` re-adjudicates stored evidence and moves rows that fail the
 * tightened identity gate from 'captured' to 'quarantined'. That protects everything drafted or
 * published AFTER it runs, and nothing published before: a live record keeps citing the document
 * regardless, because the projection in `bb_public.release_entities` is a snapshot, not a view.
 *
 * Found on the first audit run: Mount Sinai School carried a 'source states' claim citing an
 * hmdb.org RESULTS page — a list of every marker in Prattville, Alabama — under the citation label
 * "Touch for a list and map". The quoted sentence is genuinely on that page, so no quote validator
 * would ever have objected. It is still not a source about the school.
 *
 * Why not just republish the affected records: `publish-release-entities-incremental.ts` re-derives
 * from landscape and runs the full publish gate, and a record that loses a document routinely falls
 * below the confidence floor — so the republish is refused and the stale claim stays live. (That is
 * exactly what happened to Mount Sinai School.) This pass edits the published projection directly,
 * which is the only route that reaches a record the gate would now reject.
 *
 * `researchCoverage` is recomputed from the surviving claims with the real function from
 * @repo/domain, in BOTH denormalized copies (projection and search_index.facets), because dropping
 * a document is precisely the kind of change that moves a record's coverage tier down.
 *
 * Default is dry-run. Production writes require:
 *   DRY_RUN=0 RETRACT_CITATIONS_APPLY=1 DATABASE_URL=postgresql://...
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/retract-quarantined-citations.ts
 */
import {
  computeReleaseResearchCoverage,
  type ReleaseClaimProjection,
  type ReleaseResearchCoverage,
} from '@repo/domain';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.RETRACT_CITATIONS_APPLY === '1';

type LiveRow = {
  readonly entity_id: string;
  readonly display_name: string;
  readonly claims: unknown;
  readonly projection: Record<string, unknown>;
  readonly facet_coverage: string | null;
};

/** Same normalization the coverage builder uses, so "same document" means the same thing here. */
function documentKey(href: string): string | null {
  try {
    const url = new URL(href);
    return `${url.hostname.replace(/^www\./iu, '')}${url.pathname}${url.search}`
      .toLowerCase()
      .replace(/\/$/u, '');
  } catch {
    return null;
  }
}

function toClaimProjections(claims: readonly Record<string, unknown>[]): ReleaseClaimProjection[] {
  return claims.map((claim, index) => {
    const href = claim.citationHref;
    return {
      id: typeof claim.id === 'string' ? claim.id : `claim_${index}`,
      predicate: typeof claim.predicate === 'string' ? claim.predicate : '',
      object: typeof claim.object === 'string' ? claim.object : '',
      confidenceLevel:
        claim.confidenceLevel === 'high' || claim.confidenceLevel === 'medium'
          ? claim.confidenceLevel
          : 'low',
      citationSource: typeof claim.citationSource === 'string' ? claim.citationSource : '',
      ...(typeof href === 'string' && href.length > 0 ? { citationHref: href } : {}),
      citationLabel: typeof claim.citationLabel === 'string' ? claim.citationLabel : '',
    };
  });
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');
  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));

  // Per ENTITY, not per URL. A quarantine says "this document does not corroborate THIS row" — it
  // is not a global verdict on the URL. Keying the rejection set on the URL alone (the first cut of
  // this script) proposed deleting the registry 'listing' and 'significant for' claims from records
  // across the corpus, because a reference-hop walk had fetched that same catalog.archives.gov page
  // for some other entity and had it quarantined there. The dry-run is why that is a paragraph in a
  // comment rather than a data-loss incident.
  //
  // A document still captured for the entity also wins over a quarantined row for the same URL:
  // the same document can be reached by two collectors and adjudicated differently.
  const quarantined = await pool.query<{ entity_id: string; source_url: string; status: string }>(
    `SELECT entity_id, source_url, status FROM bb_research.entity_evidence`,
  );
  const rejected = new Set<string>();
  const stillCaptured = new Set<string>();
  for (const row of quarantined.rows) {
    const key = documentKey(row.source_url);
    if (key === null) continue;
    (row.status === 'captured' ? stillCaptured : rejected).add(`${row.entity_id}|${key}`);
  }
  for (const key of stillCaptured) rejected.delete(key);
  console.log(`Quarantined (entity, document) pairs: ${rejected.size}`);

  const live = await pool.query<LiveRow>(
    `SELECT e.entity_id, e.display_name, e.claims, e.projection,
            s.facets->>'researchCoverage' AS facet_coverage
       FROM bb_public.release_entities e
       JOIN bb_public.active_release a ON a.release_id = e.release_id
       LEFT JOIN bb_public.search_index s ON s.entity_id = e.entity_id
      ORDER BY e.entity_id`,
  );

  const retractions: {
    entityId: string;
    displayName: string;
    dropped: { predicate: string; citationLabel: string; citationHref: string }[];
    keptClaims: Record<string, unknown>[];
    coverageBefore: string;
    coverageAfter: ReleaseResearchCoverage;
    facetBefore: string | null;
  }[] = [];

  for (const row of live.rows) {
    if (!Array.isArray(row.claims)) continue;
    const claims = row.claims as Record<string, unknown>[];
    const kept: Record<string, unknown>[] = [];
    const dropped: { predicate: string; citationLabel: string; citationHref: string }[] = [];
    for (const claim of claims) {
      // Only evidence-derived claims are retractable. `buildReleaseSourceFromLandscape` emits those
      // with the predicate 'source states', one per captured document; 'listing' and 'significant
      // for' come from the registry row itself and are the record's baseline facts, not research.
      // A reference-hop walk routinely fetches an entity's OWN catalog.archives.gov page and gets
      // it quarantined (a NARA metadata stub is not a source about the property) — matching on URL
      // alone would then delete the registry claims and leave the record with nothing at all.
      if (claim.predicate !== 'source states') {
        kept.push(claim);
        continue;
      }
      const href = typeof claim.citationHref === 'string' ? claim.citationHref : '';
      const key = href.length > 0 ? documentKey(href) : null;
      if (key !== null && rejected.has(`${row.entity_id}|${key}`)) {
        dropped.push({
          predicate: String(claim.predicate ?? ''),
          citationLabel: String(claim.citationLabel ?? ''),
          citationHref: href,
        });
      } else {
        kept.push(claim);
      }
    }
    if (dropped.length === 0) continue;
    retractions.push({
      entityId: row.entity_id,
      displayName: row.display_name,
      dropped,
      keptClaims: kept,
      coverageBefore: String(row.projection?.researchCoverage ?? ''),
      coverageAfter: computeReleaseResearchCoverage(toClaimProjections(kept)),
      facetBefore: row.facet_coverage,
    });
  }

  console.log(`\nLive records citing a quarantined document: ${retractions.length}`);
  for (const item of retractions) {
    console.log(`  ${item.displayName} (${item.entityId})`);
    for (const claim of item.dropped) {
      console.log(`      drop "${claim.predicate}" — ${claim.citationLabel}`);
      console.log(`           ${claim.citationHref}`);
    }
    console.log(
      `      claims ${item.keptClaims.length + item.dropped.length} -> ${item.keptClaims.length}, ` +
        `coverage ${item.coverageBefore} -> ${item.coverageAfter}`,
    );
  }

  if (DRY_RUN || !APPLY) {
    console.log('\nDRY_RUN=1 (default): no writes. Set DRY_RUN=0 RETRACT_CITATIONS_APPLY=1.');
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of retractions) {
      await client.query(
        `UPDATE bb_public.release_entities
            SET claims = $2::jsonb,
                projection = jsonb_set(
                  jsonb_set(projection, '{claims}', $2::jsonb, true),
                  '{researchCoverage}', to_jsonb($3::text), true)
          WHERE entity_id = $1`,
        [item.entityId, JSON.stringify(item.keptClaims), item.coverageAfter],
      );
      if (item.facetBefore !== null && item.facetBefore !== item.coverageAfter) {
        await client.query(
          `UPDATE bb_public.search_index
              SET facets = jsonb_set(facets, '{researchCoverage}', to_jsonb($2::text), true)
            WHERE entity_id = $1`,
          [item.entityId, item.coverageAfter],
        );
      }
    }
    await client.query('COMMIT');
    console.log(`\nApplied: ${retractions.length} record(s) had a quarantined citation retracted.`);
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
