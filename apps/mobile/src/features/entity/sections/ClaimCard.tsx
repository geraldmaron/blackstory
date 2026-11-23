/**
 * One claim: predicate as a field label, the value in the editorial face, ONE evidence line, a
 * citation (or a "no source" fallback for the adversarial "claim with no citation" case), a
 * preserved-contradiction
 * notice whose alternates are ALWAYS rendered alongside the primary value (never silently
 * resolved: the whole point of `dispute` being part of the public contract), revision history,
 * and a retraction notice. Mirrors web's `EvidenceCard.tsx` section-for-section.
 *
 * Evidence uses the stored qualitative label; legacy numeric scores are not displayed.
 */
import { StyleSheet, View } from 'react-native';
import { EvidenceGrade, Notice, Receipt, Text, space } from '@/ui';
import { CitationLink } from '../CitationLink';
import { formatIsoDate, humanizeToken } from '../format';
import type { Claim } from '../types';
import { SectionHeading } from './SectionHeading';

export type ClaimCardProps = {
  readonly claim: Claim;
  readonly isOnline: boolean;
  /** The claim's place in the list, from 1. A reading aid, never its address. */
  readonly number: number;
};

/**
 * One claim as a numbered statement with its own receipt: the source, and the grade in words
 * with its glyph (docs/ui/DESIGN.md sections 7.3 and 9.1). A receipt belongs to one claim.
 */
export function ClaimCard({ claim, isOnline, number }: ClaimCardProps) {
  const lineage =
    claim.independentLineageCount !== undefined
      ? `Source lineage: ${claim.independentLineageCount} independent ${
          claim.independentLineageCount === 1 ? 'source' : 'sources'
        }.`
      : undefined;

  return (
    <View style={styles.claim} accessible={false} testID={`entity-claim-${number}`}>
      <Text
        variant="meta"
        colorRole="inkMuted"
        accessibilityLabel={`Claim ${number}`}
        style={styles.number}
      >
        {String(number).padStart(2, '0')}
      </Text>
      <View style={styles.statement}>
        <SectionHeading level={3} fieldLabel>
          {humanizeToken(claim.predicate)}
        </SectionHeading>
        <Text variant="editorial" colorRole="ink">
          {claim.object}
        </Text>

        <Receipt
          testID="entity-claim-receipt"
          {...(claim.citation
            ? { link: <CitationLink citation={claim.citation} isOnline={isOnline} /> }
            : { source: 'No source citation is available for this claim.' })}
          {...(lineage ? { detail: lineage } : {})}
          grade={<EvidenceGrade tier={claim.confidenceLevel} />}
        />

        {claim.dispute?.hasDispute ? (
          <Notice tone="dispute" title="Preserved contradiction" description={claim.dispute.note} />
        ) : null}
        {claim.dispute?.hasDispute && claim.dispute.alternates.length > 0 ? (
          <View style={{ gap: space['1'] }}>
            {claim.dispute.alternates.map((alt, index) => (
              <Text key={`${claim.id}_alt_${index}`} variant="bodySmall" colorRole="inkMuted">
                {alt.value}: {humanizeToken(alt.kind)}
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
                {humanizeToken(entry.changeKind)}: {entry.summary} ({formatIsoDate(entry.changedAt)}
                )
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
    </View>
  );
}

const styles = StyleSheet.create({
  claim: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space['3'],
  },
  number: {
    paddingTop: space['1'],
  },
  statement: {
    flex: 1,
    gap: space['2'],
  },
});
