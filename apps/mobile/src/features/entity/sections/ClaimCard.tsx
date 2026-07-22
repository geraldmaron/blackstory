/**
 * One claim: predicate heading, object text, evidence-score badge + label, citation (or a "no
 * source" fallback for the adversarial "claim with no citation" case), a preserved-contradiction
 * notice whose alternates are ALWAYS rendered alongside the primary value (never silently
 * resolved — the whole point of `dispute` being part of the public contract), revision history,
 * and a retraction notice. Mirrors web's `EvidenceCard.tsx` section-for-section.
 */
import { View } from 'react-native';
import { Badge, Notice, Text, space } from '@/ui';
import { CitationLink } from '../CitationLink';
import { formatEvidenceScoreLabel, formatIsoDate, humanizeToken } from '../format';
import type { Claim } from '../types';
import { SectionHeading } from './SectionHeading';

export type ClaimCardProps = {
  readonly claim: Claim;
  readonly isOnline: boolean;
};

export function ClaimCard({ claim, isOnline }: ClaimCardProps) {
  return (
    <View style={{ gap: space['2'] }} accessible={false}>
      <SectionHeading level={3}>{humanizeToken(claim.predicate)}</SectionHeading>
      <Text variant="body">{claim.object}</Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space['2'], flexWrap: 'wrap' }}>
        <Badge kind="confidence" level={claim.confidenceLevel} />
        <Text variant="caption" colorRole="inkMuted">
          {formatEvidenceScoreLabel(claim.confidenceScore, claim.confidenceLevel)}
        </Text>
      </View>

      {claim.citation ? (
        <CitationLink citation={claim.citation} isOnline={isOnline} />
      ) : (
        <Text variant="caption" colorRole="inkMuted">
          No source citation is available for this claim.
        </Text>
      )}

      {claim.independentLineageCount !== undefined ? (
        <Text variant="caption" colorRole="inkMuted">
          Source lineage: {claim.independentLineageCount} independent{' '}
          {claim.independentLineageCount === 1 ? 'source' : 'sources'}.
        </Text>
      ) : null}

      {claim.dispute?.hasDispute ? (
        <Notice tone="dispute" title="Preserved contradiction" description={claim.dispute.note} />
      ) : null}
      {claim.dispute?.hasDispute && claim.dispute.alternates.length > 0 ? (
        <View style={{ gap: space['1'] }}>
          {claim.dispute.alternates.map((alt, index) => (
            <Text key={`${claim.id}_alt_${index}`} variant="bodySmall" colorRole="inkMuted">
              {alt.value} — {humanizeToken(alt.kind)}
              {alt.credible ? '' : ' (not independently credible)'}
            </Text>
          ))}
        </View>
      ) : null}

      {claim.revisionHistory && claim.revisionHistory.length > 0 ? (
        <View style={{ gap: space['1'] }}>
          <Text variant="caption" colorRole="inkMuted">
            Revision history ({claim.revisionHistory.length})
          </Text>
          {claim.revisionHistory.map((entry) => (
            <Text key={entry.id} variant="bodySmall" colorRole="inkMuted">
              {humanizeToken(entry.changeKind)} — {entry.summary} ({formatIsoDate(entry.changedAt)})
            </Text>
          ))}
        </View>
      ) : null}

      {claim.retraction ? (
        <Notice
          tone="error"
          title={`Retracted ${formatIsoDate(claim.retraction.retractedAt)}`}
          description={
            claim.retraction.supersededByClaimId
              ? `${claim.retraction.reason} Superseded by ${claim.retraction.supersededByClaimId}.`
              : claim.retraction.reason
          }
        />
      ) : null}
    </View>
  );
}
