/**
 * NRHP Multiple Property Listing adapter identity, rights, and African American curated-net
 * filter constants. MPL surveys are federal thematic documentation forms — not individual NRHP
 * property listings — and this module defines which MPL themes qualify for the curated-net lane.
 */
import type { RightsPolicy } from '../../provenance/rights.js';
import type { EvidenceSource } from '../../provenance/source.js';
import { federalAdapterKillSwitchId } from '../federal/shared/kill-switch.js';

export const NRHP_MPL_ADAPTER_ID = 'nrhp-mpl-v1' as const;
export const NRHP_MPL_PARSER_VERSION = 'nrhp-mpl-parser-1.0.0' as const;
export const NRHP_MPL_STABLE_ID_SCHEME = 'nrhp-mpl-ref' as const;
export const NRHP_MPL_PAYLOAD_SCHEMA_VERSION = 'nrhp-mpl-payload.v1' as const;
export const NRHP_MPL_DEFAULT_CLASSIFICATION = 'government_record' as const;

export const NRHP_MPL_SOURCE_ID = 'src_nrhp_mpl' as const;
export const NRHP_MPL_ORGANIZATION_ID = 'org_nps' as const;
export const NRHP_MPL_REGISTRY_ENTRY_ID = 'reg_nrhp_mpl' as const;

/** U.S. Government Work public domain (17 U.S.C. § 105). */
export const NRHP_MPL_RIGHTS: RightsPolicy = {
  defaultStatus: 'public_domain',
  publicationPermissions: ['cite', 'short_excerpt', 'substantial_excerpt'],
  prohibitedUses: ['biometric_extraction', 'commercial_reuse', 'full_text_republication'],
};

/** Keys that must never persist from MPL exports (bulk OCR / PDF text is out of scope). */
export const NRHP_MPL_FORBIDDEN_PAYLOAD_KEYS = [
  'fullText',
  'ocrText',
  'pdfText',
  'pdfBytes',
  'binaryBlob',
  'attachments',
] as const;

/**
 * Curated-net theme allowlist for African American heritage MPL surveys. Records must declare
 * one of these themes and pass `aaHeritageRelevance` gating in the normalizer.
 */
export const NRHP_MPL_AA_CURATED_THEMES = [
  'african_american_schools',
  'civil_rights_movement',
  'segregation_and_desegregation',
  'african_american_churches',
  'african_american_cemeteries',
  'urban_african_american_communities',
  'reconstruction_era_african_american_resources',
  'rosenwald_schools',
  'african_american_fraternal_and_benevolent_societies',
] as const;

export type NrhpMplAaCuratedTheme = (typeof NRHP_MPL_AA_CURATED_THEMES)[number];

export const NRHP_MPL_AA_RELEVANCE_LEVELS = ['primary', 'significant'] as const;

export type NrhpMplAaHeritageRelevance = (typeof NRHP_MPL_AA_RELEVANCE_LEVELS)[number];

export function createNrhpMplEvidenceSource(
  overrides: Partial<Omit<EvidenceSource, 'createdAt' | 'updatedAt'>> = {},
): Omit<EvidenceSource, 'createdAt' | 'updatedAt'> {
  return {
    id: NRHP_MPL_SOURCE_ID,
    organizationId: NRHP_MPL_ORGANIZATION_ID,
    displayName: 'NRHP Multiple Property Listings (African American curated-net)',
    classification: NRHP_MPL_DEFAULT_CLASSIFICATION,
    adapterId: NRHP_MPL_ADAPTER_ID,
    stableIdScheme: NRHP_MPL_STABLE_ID_SCHEME,
    policy: {
      snapshotMode: 'selective',
      rights: NRHP_MPL_RIGHTS,
      permittedClaimClasses: ['geographic_fact', 'institutional_fact', 'biographical_fact'],
      refreshSchedule: '0 6 1 * *',
      notes:
        'Curated African American heritage MPL inventory; fixtures-first; no bulk OCR. ' +
        'Do not enable without explicit policy approval.',
    },
    adapterEnabled: true,
    killSwitchId: federalAdapterKillSwitchId(NRHP_MPL_ADAPTER_ID),
    ...overrides,
  };
}

export function isNrhpMplAaCuratedTheme(value: string): value is NrhpMplAaCuratedTheme {
  return (NRHP_MPL_AA_CURATED_THEMES as readonly string[]).includes(value);
}

export function qualifiesForAaCuratedNet(input: {
  readonly theme: string;
  readonly aaHeritageRelevance: string;
}): boolean {
  return (
    isNrhpMplAaCuratedTheme(input.theme) &&
    (NRHP_MPL_AA_RELEVANCE_LEVELS as readonly string[]).includes(input.aaHeritageRelevance)
  );
}
