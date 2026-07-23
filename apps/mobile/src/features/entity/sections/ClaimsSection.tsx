/**
 * Beat 06: accepted claims with expandable preview when dense.
 */
import { LiftedSurface } from '@/ui';
import { EntityEditionPanel } from '../EntityEditionPanel';
import { RecordGapNotice } from '../RecordGapNotice';
import { SECTION_HEADINGS } from '../copy';
import type { Claim } from '../types';
import { ClaimCard } from './ClaimCard';
import { ExpandableSection } from './ExpandableSection';

/** Claims shown before the expand control; remainder stays collapsed until requested. */
export const CLAIMS_PREVIEW_COUNT = 2;

export type ClaimsSectionProps = {
  readonly claims: readonly Claim[];
  readonly isOnline: boolean;
  readonly index: string;
};

export function ClaimsSection({ claims, isOnline, index }: ClaimsSectionProps) {
  const claimCards = claims.map((claim) => (
    <LiftedSurface key={claim.id} tone="surfaceRaised" shadow="none" paddingKey="3">
      <ClaimCard claim={claim} isOnline={isOnline} />
    </LiftedSurface>
  ));

  return (
    <EntityEditionPanel
      index={index}
      kicker="Claims"
      title={SECTION_HEADINGS.claims}
      testID="entity-claims-section"
    >
      {claims.length === 0 ? (
        <RecordGapNotice kind="claims" />
      ) : (
        <ExpandableSection
          previewCount={CLAIMS_PREVIEW_COUNT}
          items={claimCards}
          itemLabel="claims"
        />
      )}
    </EntityEditionPanel>
  );
}
