/**
 * Adapts `@black-book/domain`'s existing `US_STATES` table (51 states + D.C., BB-070) into
 * `jurisdictions` collection docs. BB-091 acceptance criterion 1 requires state docs to be
 * "sourced from the existing us-geography module (single source of truth, no duplicate
 * table)" — this file is the ONLY place state jurisdiction data is derived, and it derives
 * every field from `US_STATES` rather than re-encoding a second state table.
 */
import { US_STATES, type UsStateInfo } from '@black-book/domain';
import { countryJurisdictionId, stateJurisdictionId, type JurisdictionDoc } from './schema.js';

export const US_STATES_SOURCE_DATASET = 'us-geography-module' as const;

export type BuildStateJurisdictionDocsOptions = {
  readonly now?: () => string;
  readonly sourceVersion?: string;
};

/** The single country-level row every state doc's `parentId` points at. */
export function buildCountryJurisdictionDoc(options: BuildStateJurisdictionDocsOptions = {}): JurisdictionDoc {
  const now = (options.now ?? (() => new Date().toISOString()))();
  return {
    id: countryJurisdictionId(),
    kind: 'country',
    name: 'United States',
    sourceDataset: US_STATES_SOURCE_DATASET,
    ...(options.sourceVersion ? { sourceVersion: options.sourceVersion } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

function toStateJurisdictionDoc(
  state: UsStateInfo,
  countryId: string,
  now: string,
  sourceVersion?: string,
): JurisdictionDoc {
  return {
    id: stateJurisdictionId(state.fips),
    kind: 'state',
    name: state.name,
    parentId: countryId,
    fipsCode: state.fips,
    postalCode: state.postalCode,
    bbox: [state.bbox[0], state.bbox[1], state.bbox[2], state.bbox[3]],
    bboxSource: 'us-geography-module',
    sourceDataset: US_STATES_SOURCE_DATASET,
    ...(sourceVersion ? { sourceVersion } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Builds all 51 state jurisdiction docs (50 states + D.C.) plus the single country row, every
 * field traced back to `US_STATES` — never re-deriving state bbox/FIPS/name/postal from any
 * other source. Deterministic ids make repeated calls (and repeated Firestore writes) a no-op
 * write of the same content, satisfying the "idempotent" requirement at the state layer.
 */
export function buildStateJurisdictionDocs(
  options: BuildStateJurisdictionDocsOptions = {},
): readonly JurisdictionDoc[] {
  const now = (options.now ?? (() => new Date().toISOString()))();
  const country = buildCountryJurisdictionDoc({ ...options, now: () => now });
  const states = US_STATES.map((state) =>
    toStateJurisdictionDoc(state, country.id, now, options.sourceVersion),
  );
  return [country, ...states];
}

/** Lookup helper: state FIPS -> the `UsStateInfo` row, for callers building county docs. */
export function stateInfoByFips(fips: string): UsStateInfo | undefined {
  return US_STATES.find((state) => state.fips === fips);
}
