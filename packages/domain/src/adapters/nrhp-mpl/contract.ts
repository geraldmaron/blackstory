/**
 * NRHP Multiple Property Listing (MPL) adapter contract defaults aligned with
 * `SourceAdapterContract`. Starts disabled by default — same isolation as every other adapter —
 * and `assertAdapterMayRun` (`../gates.ts`) will not let it run without an approved policy.
 *
 * Distinct from the existing NRHP *listing* corpus (`launch-corpora.ts` corpus `nrhp`) and the
 * fixture-only federal NPS adapter (`../federal/nps/definition.ts`, adapterId
 * `nps-national-register-v1`): MPL surveys are thematic Multiple Property Documentation Forms
 * that group related historic resources under one peer-reviewed federal survey.
 */
import { ADAPTER_CANDIDATE_SCHEMA_VERSION } from '../candidates.js';
import type { SourceAdapterContract } from '../types.js';
import {
  NRHP_MPL_ADAPTER_ID,
  NRHP_MPL_DEFAULT_CLASSIFICATION,
  NRHP_MPL_PARSER_VERSION,
  NRHP_MPL_RIGHTS,
  NRHP_MPL_STABLE_ID_SCHEME,
} from './definition.js';

export const NRHP_MPL_ATTRIBUTION_NOTICE =
  'National Register Multiple Property Documentation Forms are U.S. Government Works (17 ' +
  'U.S.C. § 105). BlackStory stores MPL metadata and evidence pointers only — never bulk OCR ' +
  'text from MPL PDFs. Attribute the National Park Service / National Register of Historic ' +
  'Places as custodian.';

export function createNrhpMplAdapterContract(
  overrides: Partial<SourceAdapterContract> = {},
): SourceAdapterContract {
  return {
    adapterId: NRHP_MPL_ADAPTER_ID,
    parserVersion: NRHP_MPL_PARSER_VERSION,
    displayName: 'NRHP Multiple Property Listings (African American curated-net)',
    classification: NRHP_MPL_DEFAULT_CLASSIFICATION,
    stableIdScheme: NRHP_MPL_STABLE_ID_SCHEME,
    policy: {
      snapshotMode: 'selective',
      rights: NRHP_MPL_RIGHTS,
      permittedClaimClasses: ['geographic_fact', 'institutional_fact', 'biographical_fact'],
      refreshSchedule: '0 6 1 * *',
      notes:
        'Curated African American heritage MPL inventory only; fixtures-first until policy ' +
        'approval. Metadata and canonical URLs — no bulk OCR of MPL PDFs.',
    },
    rights: NRHP_MPL_RIGHTS,
    permittedClaimClasses: ['geographic_fact', 'institutional_fact', 'biographical_fact'],
    refreshSchedule: '0 6 1 * *',
    rateLimits: { requestsPerMinute: 10, burst: 2 },
    volume: { expectedRecordsPerRun: 25, countToleranceFraction: 0.35 },
    geographicCoverage: {
      countries: ['US'],
      notes: 'U.S. NRHP Multiple Property Documentation Forms filtered to African American heritage themes',
    },
    expectedSchemaVersion: ADAPTER_CANDIDATE_SCHEMA_VERSION,
    canarySampleFraction: 0.1,
    ...overrides,
  };
}
