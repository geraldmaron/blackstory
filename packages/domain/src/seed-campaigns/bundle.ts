/**
 * Assembles the BB-058 national seed campaign bundle from curated campaign metadata and records.
 */
import { SEED_CAMPAIGN_METADATA } from './campaigns.js';
import { ALL_SEED_RECORDS } from './records.js';
import {
  SEED_CAMPAIGN_SCHEMA_VERSION,
  type SeedCampaignBundle,
  type SeedCampaignId,
  type SeedRecord,
} from './types.js';

export const NATIONAL_SEED_CAMPAIGN_VERSION = '1.0.0' as const;

/** Hard ceiling proving this module is not a bulk U.S. school import (BB-058 AC4). */
export const NATIONAL_SEED_MAX_RECORDS = 50 as const;

export function buildNationalSeedCampaignBundle(input: {
  readonly curatedBy: string;
  readonly curatedAt: string;
}): SeedCampaignBundle {
  return Object.freeze({
    schemaVersion: SEED_CAMPAIGN_SCHEMA_VERSION,
    campaignVersion: NATIONAL_SEED_CAMPAIGN_VERSION,
    curatedAt: input.curatedAt,
    curatedBy: input.curatedBy,
    campaigns: Object.freeze([...SEED_CAMPAIGN_METADATA]),
    records: Object.freeze([...ALL_SEED_RECORDS]),
  });
}

export const NATIONAL_SEED_CAMPAIGN_BUNDLE: SeedCampaignBundle = buildNationalSeedCampaignBundle({
  curatedBy: 'operator-gerald',
  curatedAt: '2026-07-17T00:00:00.000Z',
});

export function recordsByCampaign(
  records: readonly SeedRecord[],
): Readonly<Record<SeedCampaignId, readonly SeedRecord[]>> {
  const grouped = Object.fromEntries(
    SEED_CAMPAIGN_METADATA.map((campaign) => [campaign.id, [] as SeedRecord[]]),
  ) as Record<SeedCampaignId, SeedRecord[]>;

  for (const record of records) {
    grouped[record.campaignId].push(record);
  }

  return Object.freeze(
    Object.fromEntries(
      Object.entries(grouped).map(([id, list]) => [id, Object.freeze([...list])]),
    ) as Record<SeedCampaignId, readonly SeedRecord[]>,
  );
}

export function countRecordsByCampaign(
  records: readonly SeedRecord[],
): Readonly<Record<SeedCampaignId, number>> {
  const grouped = recordsByCampaign(records);
  return Object.freeze(
    Object.fromEntries(
      Object.entries(grouped).map(([id, list]) => [id, list.length]),
    ) as Record<SeedCampaignId, number>,
  );
}
