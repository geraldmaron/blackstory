/**
 * BB-037 source-registry contract for the U.S. Census Bureau TIGER/Gazetteer bulk reference
 * files that back the BB-091 `jurisdictions` collection (51 state docs + ~3,143 county docs).
 *
 * This is deliberately NOT built on `../federal/shared/contract-builder.ts`'s
 * `buildFederalAdapterDefinition`: that helper's `family` field is typed to a closed union
 * (`FederalAdapterFamily`) owned by BB-046, and extending it is outside BB-091's file
 * ownership. The two are structurally compatible (`SourceAdapterContract` is the same generic
 * type either way) but this module builds its contract directly rather than widening another
 * bead's closed enum.
 *
 * License verdict: U.S. Census Bureau TIGER/Line and Gazetteer Files are produced by a federal
 * agency and are U.S. Government Works — not subject to copyright protection in the United
 * States (17 U.S.C. § 105; see https://www.census.gov/about/policies/open-gov/open-data.html
 * and the Census Bureau's data usage terms, which impose no fee or license restriction).
 * `rights.defaultStatus` below is `public_domain` accordingly. No paid geocoding/boundary API
 * is used anywhere in this bead (BB-091 acceptance criterion 7).
 *
 * This is a bulk static reference-file source (annual-at-most refresh), not a live scraping
 * adapter — `rateLimits`/`volume` are populated because `SourceAdapterContract` requires them,
 * sized for "download the whole file, once, rarely" rather than a request-per-record API.
 */
import type { RightsPolicy } from '../../provenance/rights.js';
import type { EvidenceSource } from '../../provenance/source.js';
import { ADAPTER_CANDIDATE_SCHEMA_VERSION } from '../candidates.js';
import type { SourceAdapterContract } from '../types.js';

export const CENSUS_GEO_ADAPTER_ID = 'census-geo-tiger-gazetteer-v1' as const;
export const CENSUS_GEO_PARSER_VERSION = 'parser-1.0.0' as const;
export const CENSUS_GEO_SOURCE_ID = 'src_census_tiger_gazetteer' as const;
export const CENSUS_GEO_ORGANIZATION_ID = 'org_us_census_bureau' as const;

/** U.S. Government Work — public domain (17 U.S.C. § 105). No paid API involved. */
export const CENSUS_GEO_RIGHTS: RightsPolicy = {
  defaultStatus: 'public_domain',
  publicationPermissions: ['cite', 'short_excerpt', 'substantial_excerpt', 'redistribute'],
  prohibitedUses: [],
};

const CENSUS_GEO_PERMITTED_CLAIM_CLASSES = ['geographic_fact'] as const;

/**
 * `expectedRecordsPerRun` = 51 states/D.C. (from the existing `us-geography` module, not
 * re-fetched from Census) + ~3,143 counties/county-equivalents from the Gazetteer county
 * file. `countToleranceFraction` is generous (0.05) because county counts are stable
 * year-to-year (occasional consolidations, e.g. Connecticut's 2022 planning-region switch)
 * but should not silently drift by more than a handful of records.
 */
export function createCensusGeoAdapterContract(
  overrides: Partial<SourceAdapterContract> = {},
): SourceAdapterContract {
  return {
    adapterId: CENSUS_GEO_ADAPTER_ID,
    parserVersion: CENSUS_GEO_PARSER_VERSION,
    displayName: 'U.S. Census Bureau TIGER/Gazetteer (states + counties)',
    classification: 'government_record',
    stableIdScheme: 'census-fips',
    policy: {
      snapshotMode: 'selective',
      rights: CENSUS_GEO_RIGHTS,
      permittedClaimClasses: [...CENSUS_GEO_PERMITTED_CLAIM_CLASSES],
      refreshSchedule: '0 6 2 1 *', // annual, Jan 2 — matches the ADR's "at most annual" cadence.
      notes:
        'Bulk static reference file (Census Gazetteer county file + the existing US_STATES ' +
        'table), loaded by packages/firebase/src/jurisdictions/load-cli.ts. Not a live-scraping ' +
        'adapter; adapterEnabled/registryState still gate whether a run may write (BB-037).',
    },
    rights: CENSUS_GEO_RIGHTS,
    permittedClaimClasses: [...CENSUS_GEO_PERMITTED_CLAIM_CLASSES],
    refreshSchedule: '0 6 2 1 *',
    rateLimits: { requestsPerMinute: 6, burst: 1 },
    volume: { expectedRecordsPerRun: 3194, countToleranceFraction: 0.05 },
    geographicCoverage: { countries: ['US'] },
    expectedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
    ...overrides,
  };
}

export function createCensusGeoEvidenceSource(
  overrides: Partial<Omit<EvidenceSource, 'createdAt' | 'updatedAt'>> = {},
): Omit<EvidenceSource, 'createdAt' | 'updatedAt'> {
  const contract = createCensusGeoAdapterContract();
  return {
    id: CENSUS_GEO_SOURCE_ID,
    organizationId: CENSUS_GEO_ORGANIZATION_ID,
    displayName: contract.displayName,
    classification: contract.classification,
    adapterId: contract.adapterId,
    stableIdScheme: contract.stableIdScheme,
    policy: contract.policy,
    adapterEnabled: true,
    ...overrides,
  };
}
