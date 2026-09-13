/**
 * Stage the inventor cohort as landscape candidates so the incremental publisher can admit them.
 *
 * The machinery lives in `lib/stage-person-cohort.ts`, shared with the memorial-victim cohort —
 * see that file for the person-review gate, the owned-key merge, and why `personReview` is exempt
 * from refresh-on-conflict. This file is the cohort's identity and nothing else.
 *
 * Dry-run unless DRY_RUN=0 and APPLY=1.
 *
 *   set -a && source apps/web/.env.local && set +a && export DATABASE_SSL=1
 *   node --conditions development --import tsx packages/ops-data/scripts/stage-inventor-cohort.ts
 *   DRY_RUN=0 APPLY=1 PERSON_REVIEW_APPROVED_BY="<who approved>" \
 *     node --conditions development --import tsx packages/ops-data/scripts/stage-inventor-cohort.ts
 */
import { INVENTOR_COHORT } from './data/inventor-cohort.ts';
import { stagePersonCohort } from './lib/stage-person-cohort.ts';

await stagePersonCohort(INVENTOR_COHORT, {
  runId: 'run_inventor_cohort_2026_09',
  programId: 'inventor-cohort',
  programName: 'Inventor cohort',
  lane: 'inventor-cohort',
  defaultTopicIds: ['invention'],
  confidence: 0.82,
  sourceCategory: 'People',
});
