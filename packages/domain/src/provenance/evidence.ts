/**
 * Evidence records with source-item resolution, locator, excerpts, and rights.
 * Every evidence record must resolve to a source item before use.
 */
import type { ExcerptKind, PublicationPermission, ProhibitedUse, RightsStatus } from './rights.js';
import { assertRightsStatusForPublication, type PublicationContentKind } from './rights.js';

export type EvidenceLocator = {
  readonly page?: string;
  readonly pages?: string;
  readonly paragraph?: string;
  readonly offsetStart?: number;
  readonly offsetEnd?: number;
  readonly label?: string;
  readonly uriFragment?: string;
};

export type EvidenceRecord = {
  readonly id: string;
  /** Required: every evidence record resolves to a source item. */
  readonly sourceItemId: string;
  readonly sourceId: string;
  readonly captureId?: string;
  /** GCS Storage object for media or full capture blob; never embed bytes. */
  readonly storageObject?: string;
  readonly locator?: EvidenceLocator;
  readonly excerpt?: string;
  readonly excerptKind: ExcerptKind;
  /** Timestamp observed in the source material (not capture time). */
  readonly observedAt?: string;
  readonly rightsStatus: RightsStatus;
  readonly publicationPermissions: readonly PublicationPermission[];
  readonly prohibitedUses: readonly ProhibitedUse[];
  /** Root evidence id for a syndication lineage. */
  readonly lineageRootId?: string;
  readonly syndicatedFromEvidenceId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export function assertEvidenceResolvesToSourceItem(
  evidence: Pick<EvidenceRecord, 'sourceItemId'>,
): void {
  if (!evidence.sourceItemId?.trim()) {
    throw new Error('Every evidence record must resolve to a source item');
  }
}

export function assertEvidenceRecordValid(
  evidence: Pick<
    EvidenceRecord,
    'sourceItemId' | 'excerpt' | 'excerptKind' | 'rightsStatus' | 'storageObject'
  >,
): void {
  assertEvidenceResolvesToSourceItem(evidence);
  if (evidence.excerptKind === 'none' && evidence.excerpt?.trim()) {
    throw new Error('excerptKind "none" cannot include an excerpt');
  }
  if (
    (evidence.excerptKind === 'short' || evidence.excerptKind === 'substantial') &&
    !evidence.excerpt?.trim()
  ) {
    throw new Error(`excerptKind "${evidence.excerptKind}" requires an excerpt`);
  }
}

/**
 * Gate publishing media or substantial excerpts on resolved rights status.
 */
export function assertEvidenceMayPublish(
  evidence: Pick<
    EvidenceRecord,
    'rightsStatus' | 'publicationPermissions' | 'prohibitedUses' | 'excerptKind' | 'storageObject'
  >,
  contentKind?: PublicationContentKind,
): void {
  const kind: PublicationContentKind =
    contentKind ??
    (evidence.storageObject && evidence.excerptKind !== 'substantial'
      ? 'media'
      : evidence.excerptKind === 'substantial'
        ? 'substantial_excerpt'
        : evidence.excerptKind === 'short'
          ? 'short_excerpt'
          : 'citation');

  assertRightsStatusForPublication({
    rightsStatus: evidence.rightsStatus,
    contentKind: kind,
    publicationPermissions: evidence.publicationPermissions,
    prohibitedUses: evidence.prohibitedUses,
  });
}
