/**
 * Deterministic added, changed, removed, and unchanged claim diff for release previews.
 */
export type PreviewClaim = {
  readonly claimId: string;
  readonly claimVersionId: string;
  readonly entityId: string;
  readonly predicate: string;
  readonly object: string;
  readonly proceduralStatus: string;
};

export type ChangedPreviewClaim = {
  readonly claimId: string;
  readonly before: PreviewClaim;
  readonly after: PreviewClaim;
};

export type ReleaseClaimPreview = {
  readonly added: readonly PreviewClaim[];
  readonly changed: readonly ChangedPreviewClaim[];
  readonly removed: readonly PreviewClaim[];
  readonly unchanged: readonly PreviewClaim[];
  readonly counts: {
    readonly added: number;
    readonly changed: number;
    readonly removed: number;
    readonly unchanged: number;
  };
};

function claimContent(claim: PreviewClaim): string {
  return JSON.stringify([
    claim.claimVersionId,
    claim.entityId,
    claim.predicate,
    claim.object,
    claim.proceduralStatus,
  ]);
}

function byClaimId(left: PreviewClaim, right: PreviewClaim): number {
  return left.claimId.localeCompare(right.claimId);
}

function uniqueClaims(claims: readonly PreviewClaim[], label: string): Map<string, PreviewClaim> {
  const byId = new Map<string, PreviewClaim>();
  for (const claim of claims) {
    if (!claim.claimId.trim()) throw new Error(`${label} claimId is required`);
    if (byId.has(claim.claimId)) throw new Error(`${label} contains duplicate claim ${claim.claimId}`);
    byId.set(claim.claimId, claim);
  }
  return byId;
}

export function buildReleaseClaimPreview(
  currentClaims: readonly PreviewClaim[],
  candidateClaims: readonly PreviewClaim[],
): ReleaseClaimPreview {
  const current = uniqueClaims(currentClaims, 'current release');
  const candidate = uniqueClaims(candidateClaims, 'candidate release');
  const added: PreviewClaim[] = [];
  const changed: ChangedPreviewClaim[] = [];
  const removed: PreviewClaim[] = [];
  const unchanged: PreviewClaim[] = [];

  for (const [claimId, after] of candidate) {
    const before = current.get(claimId);
    if (!before) {
      added.push(after);
    } else if (claimContent(before) !== claimContent(after)) {
      changed.push({ claimId, before, after });
    } else {
      unchanged.push(after);
    }
  }
  for (const [claimId, before] of current) {
    if (!candidate.has(claimId)) removed.push(before);
  }

  added.sort(byClaimId);
  changed.sort((left, right) => left.claimId.localeCompare(right.claimId));
  removed.sort(byClaimId);
  unchanged.sort(byClaimId);
  return Object.freeze({
    added: Object.freeze(added),
    changed: Object.freeze(changed),
    removed: Object.freeze(removed),
    unchanged: Object.freeze(unchanged),
    counts: Object.freeze({
      added: added.length,
      changed: changed.length,
      removed: removed.length,
      unchanged: unchanged.length,
    }),
  });
}
