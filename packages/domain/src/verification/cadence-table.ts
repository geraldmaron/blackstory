/**
 * Default verification cadences used to seed concrete policies. Each policy must additionally
 * specify its subject classes, predicates and applicable sources; these defaults do not install
 * schedules.
 */
import type { ReviewInterval, VolatilityClass } from './policy.js';

export const VERIFICATION_CADENCE_SCENARIOS = [
  'living_or_unknown_vital_status',
  'current_office_role_or_employment',
  'active_law_or_court_status',
  'demographic_estimate',
  'static_historical_claim',
  'citation_link_health',
] as const;

export type VerificationCadenceScenario = (typeof VERIFICATION_CADENCE_SCENARIOS)[number];

export type SeedCadenceEntry = {
  readonly volatilityClass: VolatilityClass;
  readonly defaultReviewInterval: ReviewInterval;
  readonly rationale: string;
};

/**
 * Bead spec cadences:
 *  - living/unknown vital status -> monthly (can flip at any time; false-negative "still alive"
 *    is the failure mode this guards against).
 *  - current office/role/employment -> "monthly-quarterly" in the bead; monthly is used as the
 *    single conservative default here (a policy seeded from this row can widen to quarterly by
 *    overriding `defaultReviewInterval`, this table is a floor, not every allowed value).
 *  - active laws/court status -> monthly fallback per the bead, pending any docket-specific
 *    cadence a future policy might set explicitly.
 *  - demographic estimates -> "source-cadence" per the bead, i.e. this should inherit whatever
 *    `SourceAdapterContract.refreshSchedule` (`../adapters/types.ts`) the authoritative source
 *    itself declares, not a fixed domain-level default. That wiring needs adapter registry
 *    metadata this module has no access to, so it is left as an explicit TODO and this row's
 *    interval is a placeholder floor (annual) only.
 *  - static historical claims -> annual.
 *  - citation/link-health -> "monthly-quarterly" in the bead; monthly chosen as the conservative
 *    default, consistent with the `current_office_role_or_employment` row above and with
 *    `../citations/link-health.ts`'s scheduled-sweep cadence family.
 */
export const DEFAULT_VERIFICATION_CADENCES: Readonly<
  Record<VerificationCadenceScenario, SeedCadenceEntry>
> = {
  living_or_unknown_vital_status: {
    volatilityClass: 'high',
    defaultReviewInterval: { unit: 'month', count: 1 },
    rationale: 'Living/unknown vital status can change at any time (death); monthly per bead spec.',
  },
  current_office_role_or_employment: {
    volatilityClass: 'high',
    defaultReviewInterval: { unit: 'month', count: 1 },
    rationale: 'Bead spec allows monthly-to-quarterly; monthly is the conservative seed default.',
  },
  active_law_or_court_status: {
    volatilityClass: 'medium',
    defaultReviewInterval: { unit: 'month', count: 1 },
    rationale: 'Bead spec: monthly fallback for active laws/court status.',
  },
  demographic_estimate: {
    volatilityClass: 'low',
    // This fixed floor does not inherit a source adapter's refresh schedule. Policy selection
    // must account for source-specific update behavior.
    defaultReviewInterval: { unit: 'year', count: 1 },
    rationale:
      'Placeholder floor only (bead spec: "source-cadence") pending adapter-refreshSchedule wiring; see TODO above this entry.',
  },
  static_historical_claim: {
    volatilityClass: 'static',
    defaultReviewInterval: { unit: 'year', count: 1 },
    rationale: 'Bead spec: static historical claims reviewed annually.',
  },
  citation_link_health: {
    volatilityClass: 'medium',
    defaultReviewInterval: { unit: 'month', count: 1 },
    rationale: 'Bead spec allows monthly-to-quarterly; monthly is the conservative seed default.',
  },
};
