/**
 * One claim: predicate as a field label, the value in the editorial face, ONE evidence line, a
 * citation (or a "no source" fallback for the adversarial "claim with no citation" case), a
 * preserved-contradiction
 * notice whose alternates are ALWAYS rendered alongside the primary value (never silently
 * resolved — the whole point of `dispute` being part of the public contract), revision history,
 * and a retraction notice. Mirrors web's `EvidenceCard.tsx` section-for-section.
 *
 * The evidence line used to be a large confidence pill next to the sentence "Evidence score: high
 * (0.85 of 1.00)" — the word "high" printed twice, in two type sizes, for one fact. It is now the
 * shared meter with its grade letter, then the number, on one line. The full sentence still goes
 * to assistive tech, where bars say nothing.
 */
import { StyleSheet, View } from 'react-native';
import { evidenceLabel } from '@repo/public-contracts/evidence';
import { Notice, RecordMeter, Text, space } from '@/ui';
import { CitationLink } from '../CitationLink';
import {
  formatEvidenceScoreLabel,
  formatEvidenceScoreValue,
  formatIsoDate,
  humanizeToken,
} from '../format';
import type { Claim } from '../types';
import { SectionHeading } from './SectionHeading';

export type ClaimCardProps = {
  readonly claim: Claim;
  readonly isOnline: boolean;
};

export function ClaimCard({ claim, isOnline }: ClaimCardProps) {
  return (
    <View style={{ gap: space['2'] }} accessible={false}>
      <SectionHeading level={3} fieldLabel>
        {humanizeToken(claim.predicate)}
      </SectionHeading>
      <Text variant="editorial" colorRole="ink">
        {claim.object}
      </Text>

      <View
        style={styles.evidenceLine}
        accessible
        accessibilityLabel={formatEvidenceScoreLabel(claim.confidenceScore, claim.confidenceLevel)}
      >
        {/* The grade word is right there; a letter on the meter would print "A" twice. */}
        <RecordMeter tier={claim.confidenceLevel} showLetter={false} decorative />
        <Text variant="caption" colorRole="inkMuted">
          {evidenceLabel(claim.confidenceLevel)}
        </Text>
        <Text variant="code" colorRole="inkSubtle">
          {formatEvidenceScoreValue(claim.confidenceScore)}
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

const styles = StyleSheet.create({
  evidenceLine: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space['2'],
  },
});
