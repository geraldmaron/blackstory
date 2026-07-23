import { View } from 'react-native';
import { EmptyState, LiftedSurface, space } from '@/ui';
import { RECORD_GAP_COPY, SECTION_HEADINGS } from '../copy';
import type { Claim } from '../types';
import { ClaimCard } from './ClaimCard';
import { SectionHeading } from './SectionHeading';

export type ClaimsSectionProps = {
  readonly claims: readonly Claim[];
  readonly isOnline: boolean;
};

export function ClaimsSection({ claims, isOnline }: ClaimsSectionProps) {
  return (
    <View style={{ gap: space['2'] }}>
      <SectionHeading level={2}>{SECTION_HEADINGS.claims}</SectionHeading>
      {claims.length === 0 ? (
        <EmptyState title={RECORD_GAP_COPY.claims.title} description={RECORD_GAP_COPY.claims.body} />
      ) : (
        claims.map((claim) => (
          <LiftedSurface key={claim.id} gradient="surfaceLift" shadow="sm" paddingKey="3">
            <ClaimCard claim={claim} isOnline={isOnline} />
          </LiftedSurface>
        ))
      )}
    </View>
  );
}
