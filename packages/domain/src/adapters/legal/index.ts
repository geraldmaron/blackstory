/**
 * Legal source adapters public surface. Fixture-only clients — no live network in tests.
 * Not yet re-exported from `packages/domain/src/adapters/index.ts`.
 */
export {
  CONGRESS_GOV_ADAPTER_ID,
  CONGRESS_GOV_PARSER_VERSION,
  createCongressGovAdapterContract,
} from './congress-gov/definition.js';
export { parseCongressGovFixtures, createCongressGovFixtureClient } from './congress-gov/client.js';

export {
  ECFR_ADAPTER_ID,
  ECFR_PARSER_VERSION,
  createEcfrAdapterContract,
} from './ecfr/definition.js';
export { parseEcfrFixtures, createEcfrFixtureClient } from './ecfr/client.js';

export {
  COURTLISTENER_ADAPTER_ID,
  COURTLISTENER_PARSER_VERSION,
  createCourtListenerAdapterContract,
} from './courtlistener/definition.js';
export {
  parseCourtListenerFixtures,
  createCourtListenerFixtureClient,
  validateCaseCitationInFixtures,
} from './courtlistener/client.js';

export {
  LEGISCAN_ADAPTER_ID,
  LEGISCAN_PARSER_VERSION,
  createLegiScanAdapterContract,
} from './legiscan/definition.js';
export {
  parseLegiScanFixtures,
  createLegiScanFixtureClient,
  diffLegiScanChangeHashes,
} from './legiscan/client.js';

export type { LegalAdapterParseResult, LegalFixtureClient } from './types.js';
import type { LegalAdapterParseResult } from './types.js';

export const LEGAL_FIXTURE_CLIENTS = [
  'congress-gov-v3',
  'ecfr-versioner',
  'courtlistener-bulk',
  'legiscan-free',
] as const;

import { createCongressGovFixtureClient } from './congress-gov/client.js';
import { createEcfrFixtureClient } from './ecfr/client.js';
import { createCourtListenerFixtureClient } from './courtlistener/client.js';
import { createLegiScanFixtureClient } from './legiscan/client.js';

export function parseAllLegalFixtures(): readonly LegalAdapterParseResult[] {
  return [
    createCongressGovFixtureClient().parseFixtures(),
    createEcfrFixtureClient().parseFixtures(),
    createCourtListenerFixtureClient().parseFixtures(),
    createLegiScanFixtureClient().parseFixtures(),
  ];
}
