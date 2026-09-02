/**
 * Present-day place advisories for visit standing copy on public record surfaces.
 */
import { buildAdvisoryStatement, type PlaceAdvisoryRecord } from '@repo/domain/advisory';
import type { PublicClaimView } from '../../data/public-seed';
import { visitStandingLabel } from './visit-handoff';

function citationLabelForClaim(
  claimId: string,
  claims: readonly Pick<PublicClaimView, 'id' | 'citationLabel'>[],
): string | undefined {
  const claim = claims.find((entry) => entry.id === claimId);
  const label = claim?.citationLabel.trim();
  return label && label.length > 0 ? label : undefined;
}

/** Build the procedural visit-standing sentence from the first sourced advisory on a place. */
export function resolveVisitAdvisoryStanding(
  advisories: readonly PlaceAdvisoryRecord[],
  claims: readonly Pick<PublicClaimView, 'id' | 'citationLabel'>[],
): string | undefined {
  const advisory = advisories[0];
  if (!advisory) {
    return undefined;
  }
  const sourceClaimId = advisory.sourcedClaimIds[0];
  if (!sourceClaimId) {
    return undefined;
  }
  const sourceLabel = citationLabelForClaim(sourceClaimId, claims);
  if (!sourceLabel) {
    return undefined;
  }
  return buildAdvisoryStatement(advisory, sourceLabel);
}

/** Advisory standing wins over generic lifecycle status when both are present. */
export function resolveVisitStandingCopy(input: {
  readonly kind: string;
  readonly status?: string;
  readonly advisories?: readonly PlaceAdvisoryRecord[];
  readonly claims?: readonly Pick<PublicClaimView, 'id' | 'citationLabel'>[];
}): string | undefined {
  if (input.advisories && input.advisories.length > 0 && input.claims) {
    const advisoryStanding = resolveVisitAdvisoryStanding(input.advisories, input.claims);
    if (advisoryStanding) {
      return advisoryStanding;
    }
  }
  return visitStandingLabel(input.kind, input.status);
}
