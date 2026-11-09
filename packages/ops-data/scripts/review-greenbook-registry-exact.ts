/**
 * Registry-exact claim review for staged Green Book listings, in one process: load each staged
 * row's claim and its stored NYPL capture, decide by exact match, and (only when asked) write the
 * approvals to the review ledger. No model and no packet files.
 *
 * A claim is approved when it is exactly the claim the row's imported facts produce and the
 * capture states those facts exactly once (lib/greenbook-registry.ts). The quotes it records are
 * checked word for word again by the ledger writer. A listing missing from a capture that hit the
 * safe-fetch text cap gets no verdict instead of a rejection. Actor: script:registry-exact.
 *
 * Dry run by default (READ ONLY). Writes need DRY_RUN=0 CLAIM_REVIEW_APPLY=1.
 *
 * Usage (from repo root):
 *   cd apps/web && set -a && . ./.env.local && set +a && cd - && export DATABASE_SSL=1
 *   node --conditions development --import tsx packages/ops-data/scripts/review-greenbook-registry-exact.ts
 *   [--ids=a,b,c]   default: every staged pending lane=greenbook row (payload.listingReview) that
 *                   has no registry-exact approval yet
 *   [--print-ids]   print every staged id (reviewed or not) comma-separated and exit
 */
import pg from 'pg';
import { connectWithDeadline, normalizePgConnectionString } from './lib/pg-connection.ts';
import { loadReviewClaims, runClaimReview, type Verdict } from './lib/claim-review-ledger.ts';
import { listingClaim, listingFactsFromRow, listingQuotes } from './lib/greenbook-registry.ts';

export const REGISTRY_EXACT_ACTOR = 'script:registry-exact';
const REVIEWER = { actorId: REGISTRY_EXACT_ACTOR, modelFamily: 'deterministic-script' } as const;
// Text exactly this long was cut off by the safe-fetch cap (100,000 for pages, 3,000,000 for JSON).
const CAPTURE_TEXT_CAPS = new Set([100_000, 3_000_000]);
const WRITE = process.env.DRY_RUN === '0' && process.env.CLAIM_REVIEW_APPLY === '1';

async function main(): Promise<void> {
  const idsFlag = process.argv.find((arg) => arg.startsWith('--ids='));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');
  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));
  const client = await connectWithDeadline<pg.PoolClient>(pool);
  try {
    await client.query(WRITE ? 'BEGIN' : 'BEGIN READ ONLY');
    if (WRITE) await client.query('SET LOCAL ROLE service_role');
    const staged = `SELECT l.id FROM research.landscape_candidates l
              WHERE l.lane = 'greenbook' AND l.status = 'pending' AND l.payload ? 'listingReview'`;
    const unreviewed = `${staged} AND NOT EXISTS (
                SELECT 1 FROM research.artifacts a JOIN research.review_decisions r ON r.artifact_id = a.id
                 WHERE a.artifact_type = 'claim-review-packet' AND a.extensions->>'entityId' = l.id
                   AND r.reviewer_actor_id = '${REGISTRY_EXACT_ACTOR}' AND r.decision = 'approve')`;
    const query = process.argv.includes('--print-ids') ? staged : unreviewed;
    const entityIds = idsFlag
      ? idsFlag
          .slice('--ids='.length)
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : (await client.query<{ id: string }>(`${query} ORDER BY l.id`)).rows.map((row) => row.id);

    if (process.argv.includes('--print-ids')) {
      await client.query('ROLLBACK');
      console.log(entityIds.join(','));
      return;
    }
    const { prepared, blocked } = await loadReviewClaims(client, entityIds);
    let noVerdict = 0;
    const verdicts: Verdict[] = [];
    for (const claim of prepared) {
      const base = {
        packetId: claim.packet.packetId,
        packetHash: claim.packet.packetHash,
        reviewerActorId: REGISTRY_EXACT_ACTOR,
      };
      const facts = listingFactsFromRow(claim.row.display_name, claim.row.provenance);
      if (claim.claim.object !== listingClaim(facts)) {
        verdicts.push({
          ...base,
          decision: 'reject',
          supportReason:
            'Registry-exact check failed: the claim is not the one these listing facts produce.',
        });
        continue;
      }
      const quotes = listingQuotes(claim.capture.text, facts);
      if (!quotes) {
        // A miss in a capture that hit the text cap says nothing about the listing.
        if (CAPTURE_TEXT_CAPS.has(claim.capture.text.length)) noVerdict += 1;
        else
          verdicts.push({
            ...base,
            decision: 'reject',
            supportReason:
              'Registry-exact check failed: the capture does not state this name, address, category and year exactly once.',
          });
        continue;
      }
      const locator =
        facts.year === 1947
          ? 'feature properties in the 1947 geojson'
          : 'row in the 1956 rows array';
      verdicts.push({
        ...base,
        decision: 'approve',
        fitness: 'strong',
        quotes: quotes.map((exact) => ({ exact, locator })),
        fitnessReason:
          'The source is NYPL’s structured transcription of the printed Green Book listing, the registry that makes this claim.',
        supportReason:
          `The capture states the name, street address, category and ${facts.year} edition for this listing, ` +
          'and the city appears in the same entry; checked by exact match, not by a model.',
      });
    }

    const report = await runClaimReview(client, {
      entityIds,
      verdicts,
      reviewer: REVIEWER,
      write: WRITE,
    });
    await client.query(WRITE ? 'COMMIT' : 'ROLLBACK');
    console.log(
      JSON.stringify(
        {
          mode: WRITE ? 'applied' : 'dry-run',
          staged: entityIds.length,
          claims: prepared.length,
          blockedBeforeReview: blocked.length,
          approved: report.approved.length,
          rejected: report.rejected.length,
          refused: report.refused.length,
          noVerdictCaptureTruncated: noVerdict,
          written: report.written.length,
          publishable: report.publishable.length,
        },
        null,
        2,
      ),
    );
    if (!WRITE)
      console.log('\nDRY_RUN (default): nothing written. DRY_RUN=0 CLAIM_REVIEW_APPLY=1 writes.');
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
