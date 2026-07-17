/**
 * Present-day advisory record model for place-kind entities.
 *
 * An advisory answers "is this place currently visitable" a DIFFERENT question than the
 * entity's historic significance or its documented
 * historical condition (sundown-town redlining-grade layer records). Advisories are
 * CLAIMS: every record requires >=1 `sourcedClaimIds` entry, a dated `asOf`, and a `reviewCadence`
 * never an unsourced editorial label. See docs/security/entity-sensitivity-lanes.md for how
 * this lane relates to sensitivity and place-condition designations.
 *
 * PRESENTATION-ONLY BY CONSTRUCTION AND BY TEST. This module deliberately exposes no function
 * that feeds an `AdvisoryClass` or `PlaceAdvisoryRecord` field into any scoring/composite
 * pipeline there is no `advisoryToFeatureValue`-shaped export here, on purpose. `advisory.test.ts`
 * extends the standing "crime stats never enter the composite" discipline (the same discipline
 * modern-context layer will follow when it lands): it exercises the REAL relevance
 * (`packages/domain/src/relevance`) and confidence (`packages/domain/src/claims`) composite
 * outputs and proves, both by a compile-time key-overlap check and by a runtime structural scan
 * (`assertAdvisoryAbsentFromScoringInput`), that no advisory field ever appears in them.
 *
 * COPY DISCIPLINE (dignity rules): "dangerous today" must never appear as copy, a badge, or a
 * classification label. Advisory statements are dated, cited, procedural sentences only see
 * `buildAdvisoryStatement` and `assertProceduralAdvisoryLanguage`. No red/danger iconography is
 * defined or implied here; presentation components (apps/web/src/components/AdvisoryNotice.tsx)
 * render advisories through the same muted `Notice` treatment used for seed-data/offline notices
 * never a distinct "danger" tone.
 */
import type { DatePrecision } from './era.js';
import type { EntityId } from './ids.js';
import type { ConfidenceComponents } from './claims/index.js';
import type { RelevanceAssessment, RelevanceFeatureValue } from './relevance/index.js';

// ---------------------------------------------------------------------------
// Advisory class vocabulary
// ---------------------------------------------------------------------------

export const ADVISORY_CLASSES = [
  'private_property',
  'access_restricted',
  'site_lost',
  'verify_before_travel',
  'official_travel_advisory',
] as const;

export type AdvisoryClass = (typeof ADVISORY_CLASSES)[number];

export function isAdvisoryClass(value: string): value is AdvisoryClass {
  return (ADVISORY_CLASSES as readonly string[]).includes(value);
}

/**
 * Procedural, dated-statement-ready labels conduct/fact framing, never a danger label. Kept in
 * this module (not a UI package) so both apps/web and any future editorial tooling render
 * identical wording.
 */
export const ADVISORY_CLASS_LABELS: Readonly<Record<AdvisoryClass, string>> = {
  private_property: 'Private property',
  access_restricted: 'Access restricted',
  site_lost: 'Site no longer standing',
  verify_before_travel: 'Verify before traveling',
  official_travel_advisory: 'Official travel advisory on record',
};

// ---------------------------------------------------------------------------
// Advisory record a sourced, dated CLAIM on a place-kind entity
// ---------------------------------------------------------------------------

/**
 * Recommended (non-exhaustive) cadence vocabulary for `reviewCadence`. The field is a free-form
 * string, not an enum different sources warrant different cadences (an NAACP travel advisory
 * might review quarterly, a property-record lookup annually) these are documentation, not a
 * closed set.
 */
export const SUGGESTED_ADVISORY_REVIEW_CADENCES = [
  'quarterly',
  'annual',
  'on_source_update',
] as const;

export type PlaceAdvisoryRecord = {
  readonly id: string;
  /** The place-kind entity this advisory is attached to. Never merged into CanonicalEntity
   * fields owned by advisories are their own record type, referenced by id. */
  readonly placeEntityId: EntityId;
  readonly advisoryClass: AdvisoryClass;
  /** >=1 required advisories are sourced claims (property records, a dated NAACP-style travel
   * advisory, news of demolition), never unsourced editorial labels. */
  readonly sourcedClaimIds: readonly string[];
  /** The date the underlying claim(s) were true/observed as of required, never omitted. */
  readonly asOf: string;
  readonly datePrecision: DatePrecision;
  /** When this advisory is next due for review (free-form; see SUGGESTED_ADVISORY_REVIEW_CADENCES). */
  readonly reviewCadence: string;
  /** Optional short human context beyond the class label still procedural, never danger framing. */
  readonly note?: string;
};

export class AdvisoryValidationError extends Error {}

/**
 * Fails closed: every advisory must carry a recognized class, >=1 sourced claim, a non-blank
 * asOf date, and a non-blank reviewCadence. Citations required on every advisory.
 */
export function assertAdvisoryRecordValid(
  record: Pick<PlaceAdvisoryRecord, 'advisoryClass' | 'sourcedClaimIds' | 'asOf' | 'reviewCadence'>,
): void {
  if (!isAdvisoryClass(record.advisoryClass)) {
    throw new AdvisoryValidationError(`Unknown advisoryClass: ${String(record.advisoryClass)}`);
  }
  if (record.sourcedClaimIds.length < 1) {
    throw new AdvisoryValidationError(
      'Advisory records require at least one sourcedClaimId — advisories are sourced claims, ' +
        'never unsourced editorial labels.',
    );
  }
  if (!record.asOf.trim()) {
    throw new AdvisoryValidationError('Advisory records require a non-blank asOf date.');
  }
  if (!record.reviewCadence.trim()) {
    throw new AdvisoryValidationError('Advisory records require a non-blank reviewCadence.');
  }
}

// ---------------------------------------------------------------------------
// Procedural copy dated, cited, no danger framing
// ---------------------------------------------------------------------------

/**
 * Phrases that would turn an advisory into unsourceable "dangerous today" editorializing. Banned
 * from every advisory statement this module builds, and asserted against in tests covering the
 * presentation components that consume this module.
 */
export const PROHIBITED_ADVISORY_LANGUAGE = [
  'dangerous',
  'danger',
  'unsafe',
  'not safe',
  'hazardous',
  'risky',
  'do not visit',
  'avoid this area',
] as const;

export function assertProceduralAdvisoryLanguage(text: string): void {
  const normalized = text.toLowerCase();
  for (const phrase of PROHIBITED_ADVISORY_LANGUAGE) {
    if (normalized.includes(phrase)) {
      throw new AdvisoryValidationError(
        `Advisory copy must never use "${phrase}" — advisories are dated, cited, procedural ` +
          'statements ("Private property as of [date], per [source]"), never danger framing.',
      );
    }
  }
}

/**
 * Builds the single dated, cited, procedural sentence every advisory renders as the only
 * approved shape for advisory copy ("Private property as of 2024-03-01, per County Assessor's
 * Office parcel record."). `sourceLabel` is a short human-readable citation label resolved
 * upstream from the advisory's `sourcedClaimIds` (citation formatting itself belongs to the
 * claims/citations system, not duplicated here).
 */
export function buildAdvisoryStatement(
  record: Pick<PlaceAdvisoryRecord, 'advisoryClass' | 'asOf'>,
  sourceLabel: string,
): string {
  if (!sourceLabel.trim()) {
    throw new AdvisoryValidationError('buildAdvisoryStatement requires a non-blank sourceLabel.');
  }
  const statement = `${ADVISORY_CLASS_LABELS[record.advisoryClass]} as of ${record.asOf}, per ${sourceLabel}.`;
  assertProceduralAdvisoryLanguage(statement);
  return statement;
}

// ---------------------------------------------------------------------------
// Scoring-exclusion guard the crime-stats discipline, extended to advisories
// ---------------------------------------------------------------------------

/**
 * Field/key names unique to advisory records. Deliberately conservative (a superset, not a
 * minimal set) — this guard is meant to fail CLOSED: a false-positive match is safe (it just
 * means a legitimate-but-confusingly-named field needs renaming), a false negative is not.
 */
export const ADVISORY_SCORING_BANNED_KEYS = [
  'advisoryClass',
  'sourcedClaimIds',
  'reviewCadence',
  'advisoryRecord',
  'advisoryRecords',
  'placeAdvisories',
  'advisoryStatement',
  'asOf',
] as const;

/**
 * Recursively scans an arbitrary scoring/composite value (a RelevanceAssessment, a
 * ConfidenceEngineResult, or any structurally similar object) and throws if any advisory-record
 * field name appears anywhere in it. Used both as a regression guard in tests exercising the
 * REAL relevance/confidence engines, and as a reusable assertion any future scoring/composite
 * builder can call defensively.
 */
export function assertAdvisoryAbsentFromScoringInput(value: unknown, path = '$'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertAdvisoryAbsentFromScoringInput(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if ((ADVISORY_SCORING_BANNED_KEYS as readonly string[]).includes(key)) {
        throw new AdvisoryValidationError(
          `Advisory field "${key}" found in scoring/composite input at ${path}.${key} — advisory ` +
            'data must never enter any scoring input or composite (BB-095 AC1, extending the ' +
            'BB-082 crime-stats discipline).',
        );
      }
      assertAdvisoryAbsentFromScoringInput(entry, `${path}.${key}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Compile-time proof enforced by `pnpm --filter @black-book/domain typecheck`, not only by the
// runtime scan above. If a future edit to relevance/types.ts or claims/confidence.ts ever
// introduces a field name colliding with PlaceAdvisoryRecord's own field names, the object literal
// below stops satisfying its type and `tsc --noEmit` fails the build the "never enters scoring"
// guarantee holds by construction, not only by whichever runtime tests happen to be run.
// ---------------------------------------------------------------------------
type NoKeyOverlap<A, B> = Extract<keyof A, keyof B> extends never ? true : false;

export const ADVISORY_SCORING_TYPE_INVARIANTS: {
  readonly noOverlapWithRelevanceFeatureValue: NoKeyOverlap<PlaceAdvisoryRecord, RelevanceFeatureValue>;
  readonly noOverlapWithRelevanceAssessment: NoKeyOverlap<PlaceAdvisoryRecord, RelevanceAssessment>;
  readonly noOverlapWithConfidenceComponents: NoKeyOverlap<PlaceAdvisoryRecord, ConfidenceComponents>;
} = {
  noOverlapWithRelevanceFeatureValue: true,
  noOverlapWithRelevanceAssessment: true,
  noOverlapWithConfidenceComponents: true,
};
