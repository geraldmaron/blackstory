/**
 * Evidence lineage and syndication relationships.
 * Syndicated copies share a lineage root so can count them once.
 */
export const LINEAGE_KINDS = [
  'syndication',
  'republication',
  'derivative',
  'same_capture',
  'translation',
] as const;

export type LineageKind = (typeof LINEAGE_KINDS)[number];

export type EvidenceLineage = {
  readonly id: string;
  readonly kind: LineageKind;
  readonly fromEvidenceId: string;
  readonly toEvidenceId: string;
  /** Shared root for counting syndicated reporting as one lineage. */
  readonly lineageRootId: string;
  readonly notes?: string;
  readonly createdAt: string;
};

export function assertLineageEndpointsDistinct(
  lineage: Pick<EvidenceLineage, 'fromEvidenceId' | 'toEvidenceId'>,
): void {
  if (lineage.fromEvidenceId === lineage.toEvidenceId) {
    throw new Error('Lineage endpoints must be distinct evidence ids');
  }
}

export function resolveLineageRoot(
  evidence: {
    readonly id: string;
    readonly lineageRootId?: string;
    readonly syndicatedFromEvidenceId?: string;
  },
  parent?: { readonly id: string; readonly lineageRootId?: string } | null,
): string {
  if (evidence.lineageRootId?.trim()) {
    return evidence.lineageRootId;
  }
  if (parent?.lineageRootId?.trim()) {
    return parent.lineageRootId;
  }
  if (parent?.id) {
    return parent.id;
  }
  if (evidence.syndicatedFromEvidenceId?.trim()) {
    return evidence.syndicatedFromEvidenceId;
  }
  return evidence.id;
}
