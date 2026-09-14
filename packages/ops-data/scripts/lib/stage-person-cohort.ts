/**
 * Stage a hand-authored cohort of PERSON records as landscape candidates, so the incremental
 * publisher can admit them.
 *
 * This is the machinery `stage-inventor-cohort.ts` grew, extracted so a second cohort does not
 * become a second copy of it. Everything here was load-bearing in that script and every comment
 * below records why, because each rule was added after something went wrong without it.
 *
 * THE PERSON REVIEW GATE. `personReviewApproved` in `./incremental-publish.ts` blocks every person
 * row from incremental publish until `payload.personReview` carries approved/approvedBy/
 * approvedAt/basis. This writes that marker, and the `basis` it records is the cohort's own
 * per-record `reviewBasis` — a named death date and where it is published — not a bare "reviewed".
 * The gate exists to catch a living-person privacy interest; recording the specific fact that
 * rules one out is what makes the approval checkable rather than ceremonial.
 *
 * `approvedBy` comes from PERSON_REVIEW_APPROVED_BY, so an approval stays attributable to whoever
 * ran the apply rather than to a string committed in a file. Applying without it throws BEFORE any
 * write: an approval with nobody's name on it is not a review.
 *
 * WHY `personReview` IS EXEMPT FROM THE OWNED-KEY MERGE. On conflict, keys the cohort owns are
 * refreshed from the incoming row and every other key survives a re-stage untouched (see
 * `landscape-candidate-upsert.ts`). `personReview` cannot work that way, because this writes a
 * fresh `approvedAt` on every run: if it won on every re-stage, correcting one sibling record
 * would make every already-reviewed row in the cohort look freshly edited. So a stored
 * `personReview` wins whenever one is present, and only an absent one gets this run's. Setting
 * PERSON_REVIEW_REWRITE=1 overrides that, for the case where the recorded `basis` text itself
 * needs correcting.
 *
 * It also has to be stripped from the INCOMING side of the merge, not just left out of the owned
 * list: jsonb `||` always prefers its right operand for a key present on both sides, so without
 * `excludeFromIncoming` this run's timestamp would win regardless of ownership.
 *
 * Dry-run unless DRY_RUN=0 and APPLY=1.
 */
import pg from 'pg';
import { isValidTopicId } from '@repo/domain';
import { SUMMARY_MAX_CHARS, SUMMARY_MIN_CHARS } from './entity-enrichment-llm.ts';
import { distinctEvidenceLineages } from './invention-cohort-validate.ts';
import { mergedPayloadSql, statusOnConflictSql } from './landscape-candidate-upsert.ts';
import { normalizePgConnectionString } from './pg-connection.ts';

/** The shape a cohort record must carry to be stageable as a person. */
export type PersonCohortRecord = {
  readonly id: string;
  readonly displayName: string;
  readonly summary: string;
  readonly historicalContext: string;
  readonly city: string;
  readonly state: string;
  readonly lat: number;
  readonly lng: number;
  readonly era: string;
  readonly canonicalUrl: string;
  /**
   * Same shape the inventor cohort uses, and `quote` is required for the same reason: a citation
   * that carries no quoted text is a link, and a link is not evidence that the source says what
   * the record claims.
   */
  readonly evidence: readonly {
    readonly sourceUrl: string;
    readonly title: string;
    readonly quote: string;
  }[];
  readonly reviewBasis: string;
  readonly topicIds?: readonly string[];
  readonly livingStatus?: string;
  readonly keywords?: readonly string[];
  readonly mentionedEntityIds?: readonly string[];
  /** Inventor-cohort concept: the invention records that name this person. Optional. */
  readonly namedOn?: readonly string[];
};

export type PersonCohortConfig = {
  readonly runId: string;
  readonly programId: string;
  readonly programName: string;
  readonly lane: string;
  /** Applied to any record that does not carry its own topicIds. */
  readonly defaultTopicIds: readonly string[];
  readonly confidence: number;
  readonly sourceCategory: string;
};

const OWNED_PAYLOAD_KEYS = [
  'city',
  'state',
  'historicalContext',
  'topicIds',
  'eraBuckets',
  'confidence',
  'geocode',
  'evidenceCitations',
  'namedOn',
  'keywords',
  'mentionedEntityIds',
] as const;

function assertCohortBounds(
  cohort: readonly PersonCohortRecord[],
  approvedBy: string,
  willWrite: boolean,
): void {
  if (willWrite && approvedBy.length === 0) {
    throw new Error(
      'PERSON_REVIEW_APPROVED_BY is required to apply (it is recorded as the approver)',
    );
  }
  for (const row of cohort) {
    if (row.summary.length < SUMMARY_MIN_CHARS || row.summary.length > SUMMARY_MAX_CHARS) {
      throw new Error(
        `${row.id} summary length ${row.summary.length} outside ${SUMMARY_MIN_CHARS}..${SUMMARY_MAX_CHARS}`,
      );
    }
    if (row.historicalContext.trim().length === 0) {
      throw new Error(`${row.id} is missing historicalContext`);
    }
    if (row.evidence.length === 0) {
      throw new Error(`${row.id} has no evidence citation`);
    }
    const unresolvedTopics = (row.topicIds ?? []).filter((id) => !isValidTopicId(id));
    if (unresolvedTopics.length > 0) {
      throw new Error(
        `${row.id} topicIds do not resolve against TOPIC_REGISTRY: ${unresolvedTopics.join(', ')}`,
      );
    }
  }
}

export async function stagePersonCohort(
  cohort: readonly PersonCohortRecord[],
  config: PersonCohortConfig,
): Promise<void> {
  const dryRun = process.env.DRY_RUN !== '0';
  const apply = process.env.APPLY === '1';
  const approvedBy = process.env.PERSON_REVIEW_APPROVED_BY?.trim() || '';
  const personReviewRewrite = process.env.PERSON_REVIEW_REWRITE === '1';
  const willWrite = !dryRun && apply;

  assertCohortBounds(cohort, approvedBy, willWrite);

  const payloadMergeWithoutPersonReview = mergedPayloadSql(OWNED_PAYLOAD_KEYS, {
    excludeFromIncoming: ['personReview'],
  });
  const personReviewOnConflict = personReviewRewrite
    ? "EXCLUDED.payload->'personReview'"
    : `CASE
               WHEN landscape_candidates.payload ? 'personReview' THEN landscape_candidates.payload->'personReview'
               ELSE EXCLUDED.payload->'personReview'
             END`;
  const payloadOnConflict = `(${payloadMergeWithoutPersonReview}) || jsonb_build_object('personReview', ${personReviewOnConflict})`;
  const statusOnConflict = statusOnConflictSql(OWNED_PAYLOAD_KEYS, undefined, payloadOnConflict);

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');

  const { connectionString: cs, ssl, ...bounds } = normalizePgConnectionString(connectionString);
  const client = new pg.Client({ connectionString: cs, ...(ssl ? { ssl } : {}), ...bounds });
  await client.connect();
  try {
    console.log(`${config.programName}: ${cohort.length} records`);
    console.log(willWrite ? 'apply' : 'dry-run');

    if (willWrite) {
      await client.query(
        `INSERT INTO bb_research.source_program_runs
          (id, lane, source_program_id, source_program_name, retrieved_at, rows_fetched, candidate_count, summary, updated_at)
         VALUES ($1, 'other', $2, $3, now(), $4, $4, $5::jsonb, now())
         ON CONFLICT (id) DO UPDATE SET
           rows_fetched = EXCLUDED.rows_fetched,
           candidate_count = EXCLUDED.candidate_count,
           summary = EXCLUDED.summary,
           updated_at = now()`,
        [
          config.runId,
          config.programId,
          config.programName,
          cohort.length,
          JSON.stringify({ lane: config.lane, kind: 'person' }),
        ],
      );
    }

    for (const row of cohort) {
      const lineages = distinctEvidenceLineages(row).length;
      console.log(
        `  ${row.id}  ${row.summary.length}c  ${row.displayName}  ${lineages} lineage${lineages === 1 ? '' : 's'}`,
      );
      if (!willWrite) continue;
      await client.query(
        `INSERT INTO bb_research.landscape_candidates
          (id, run_id, lane, source_program_id, source_item_id, display_name, kind, summary,
           lat, lng, canonical_url, research_lane_only, status, provenance, payload, discovered_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,'person',$7,$8,$9,$10,true,'pending',$11::jsonb,$12::jsonb,now(),now())
         ON CONFLICT (lane, source_item_id) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           kind = EXCLUDED.kind,
           summary = EXCLUDED.summary,
           lat = EXCLUDED.lat,
           lng = EXCLUDED.lng,
           canonical_url = EXCLUDED.canonical_url,
           status = ${statusOnConflict},
           provenance = EXCLUDED.provenance,
           payload = ${payloadOnConflict},
           updated_at = now()`,
        [
          row.id,
          config.runId,
          config.lane,
          config.programId,
          row.id,
          row.displayName,
          row.summary,
          row.lat,
          row.lng,
          row.canonicalUrl,
          JSON.stringify({
            sourceCity: row.city,
            sourceState: row.state,
            sourceCategory: config.sourceCategory,
          }),
          JSON.stringify({
            city: row.city,
            state: row.state,
            historicalContext: row.historicalContext,
            topicIds: row.topicIds ?? config.defaultTopicIds,
            eraBuckets: [row.era],
            confidence: config.confidence,
            geocode: { precision: 'city' },
            evidenceCitations: row.evidence,
            ...(row.namedOn !== undefined ? { namedOn: row.namedOn } : {}),
            ...(row.keywords !== undefined ? { keywords: row.keywords } : {}),
            ...(row.mentionedEntityIds !== undefined
              ? { mentionedEntityIds: row.mentionedEntityIds }
              : {}),
            personReview: {
              approved: true,
              approvedBy,
              approvedAt: new Date().toISOString(),
              basis: row.reviewBasis,
              livingStatus: row.livingStatus ?? 'deceased',
            },
          }),
        ],
      );
    }

    console.log(cohort.map((row) => row.id).join(','));
  } finally {
    await client.end();
  }
}
