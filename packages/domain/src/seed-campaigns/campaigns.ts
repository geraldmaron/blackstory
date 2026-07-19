/**
 * seed campaign metadata. Quality determines count soft targets are ceilings for
 * planning, not quotas to fill with weak records.
 */
import type { SeedCampaignMeta } from './types.js';

export const SEED_CAMPAIGN_METADATA: readonly SeedCampaignMeta[] = [
  {
    id: 'rosenwald-schools',
    displayName: 'Rosenwald schools',
    description:
      'NRHP- or NPS-documented Rosenwald Fund school buildings. Fisk Rosenwald database bulk ' +
      'import remains deferred (); only individually verified public listings ship here.',
    qualityTargetCount: 6,
    preferredNotabilityCriteria: ['landmark_or_national_register', 'only_or_oldest', 'documented_site'],
  },
  {
    id: 'freedmens-schools',
    displayName: "Freedmen's Bureau schools",
    description:
      "Institutions founded during or immediately after the Freedmen's Bureau era with federal or " +
      'NPS-documented founding evidence — not an exhaustive Bureau school inventory.',
    qualityTargetCount: 5,
    preferredNotabilityCriteria: ['community_anchor', 'documented_site', 'only_or_oldest'],
  },
  {
    id: 'hbcu-sample',
    displayName: 'Historically Black colleges and universities (sample)',
    description:
      'Geographically diverse HBCU sample from the NCES/ED public list — not the full ~100 ' +
      'institution inventory.',
    qualityTargetCount: 6,
    preferredNotabilityCriteria: ['community_anchor'],
  },
  {
    id: 'desegregation-litigation-schools',
    displayName: 'Desegregation litigation schools',
    description:
      'Schools named in or central to consequential desegregation litigation with court or NPS ' +
      'primary documentation.',
    qualityTargetCount: 5,
    preferredNotabilityCriteria: ['court_precedent', 'documented_site', 'landmark_or_national_register'],
  },
  {
    id: 'black-educational-movements',
    displayName: 'Black educational movement institutions',
    description:
      'Sites and institutions central to documented Black educational movements (Reconstruction ' +
      'literacy, citizenship schools, Freedom Schools, movement training centers).',
    qualityTargetCount: 5,
    preferredNotabilityCriteria: ['movement_significance', 'documented_site', 'community_anchor'],
  },
  {
    id: 'nationally-significant-institutions',
    displayName: 'Nationally or regionally significant Black institutions',
    description:
      'Selected institutions with documented national or regional significance in Black ' +
      'education — superlative or landmark evidence required.',
    qualityTargetCount: 5,
    preferredNotabilityCriteria: [
      'only_or_oldest',
      'community_anchor',
      'landmark_or_national_register',
      'first_to_do_x',
    ],
  },
];

export function seedCampaignMeta(id: SeedCampaignMeta['id']): SeedCampaignMeta {
  const meta = SEED_CAMPAIGN_METADATA.find((entry) => entry.id === id);
  if (!meta) {
    throw new Error(`Unknown seed campaign: ${id}`);
  }
  return meta;
}
