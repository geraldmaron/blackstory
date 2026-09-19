/**
 * Stage the two memorial-wall victims who had no record of their own.
 *
 * The machinery is shared with the inventor cohort — see `lib/stage-person-cohort.ts` for the
 * person-review gate, the owned-key merge and why `personReview` is exempt from it.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a && export DATABASE_SSL=1
 *   node --conditions development --import tsx packages/ops-data/scripts/stage-memorial-victim-cohort.ts
 *   DRY_RUN=0 APPLY=1 PERSON_REVIEW_APPROVED_BY="<who approved>" \
 *     node --conditions development --import tsx packages/ops-data/scripts/stage-memorial-victim-cohort.ts
 */
import { MEMORIAL_VICTIM_COHORT } from './data/memorial-victim-cohort.ts';
import { stagePersonCohort } from './lib/stage-person-cohort.ts';

await stagePersonCohort(MEMORIAL_VICTIM_COHORT, {
  runId: 'run_memorial_victim_cohort_2026_09',
  programId: 'memorial-victim-cohort',
  programName: 'Memorial victim cohort',
  lane: 'memorial-victim-cohort',
  // Every record in this cohort sets its own topicIds, so this is the floor rather than the
  // value. `jim-crow` is what the live lynching records carry; `racial-terror` is the LANE name
  // and is not a registry topic id, which the cohort-bounds check catches.
  defaultTopicIds: ['jim-crow'],
  confidence: 0.82,
  sourceCategory: 'People',
});
