/**
 * Accepted-claims section. When many claims are present, shows a short preview and expands the
 * rest on demand so dense evidence lists do not dominate the scroll spine by default.
 */
import { View } from 'react-native';
import { EmptyState, LiftedSurface, space } from '@/ui';
import { RECORD_GAP_COPY, SECTION_HEADINGS } from '../copy';
import type { Claim } from '../types';
import { ClaimCard } from './ClaimCard';
import { ExpandableSection } from './ExpandableSection';
import { SectionHeading } from './SectionHeading';

/** Claims shown before the expand control; remainder stays collapsed until requested. */
export const CLAIMS_PREVIEW_COUNT = 2;

export type ClaimsSectionProps = {
  readonly claims: readonly Claim[];
  readonly isOnline: boolean;
};

export function ClaimsSection({ claims, isOnline }: ClaimsSectionProps) {
  const claimCards = claims.map((claim) => (
          <LiftedSurface key={claim.id} tone="surface" shadow="none" paddingKey="3">
      <ClaimCard claim={claim} isOnline={isOnline} />
    </LiftedSurface>
  ));

  return (
    <View style={{ gap: space['2'] }}>
      <SectionHeading level={2}>{SECTION_HEADINGS.claims}</SectionHeading>
      {claims.length === 0 ? (
        <EmptyState title={RECORD_GAP_COPY.claims.title} description={RECORD_GAP_COPY.claims.body} />
      ) : (
        <ExpandableSection
          previewCount={CLAIMS_PREVIEW_COUNT}
          items={claimCards}
          itemLabel="claims"
        />
      )}
    </View>
  );
}
