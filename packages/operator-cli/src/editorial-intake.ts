/**
 * Stages an editorial packet into quarantine as a contribution proposal.
 * Never opens promotion and never writes public projections.
 */
import type { EditorialPacket } from '@repo/domain';
import {
  prepareOperatorIntake,
  type OperatorIntakeContext,
  type OperatorIntakeOutcome,
} from './intake.js';

export function prepareEditorialPacketIntake(
  packet: EditorialPacket,
  context: OperatorIntakeContext,
): OperatorIntakeOutcome {
  const statement = [
    'Editorial packet (staged; not published).',
    `decision=${packet.decision}`,
    `confidence=${packet.confidence}`,
    `rationale=${packet.rationale}`,
    packet.drafts.publicSummary ? `publicSummary=${packet.drafts.publicSummary}` : undefined,
    packet.drafts.historicalContext
      ? `historicalContext=${packet.drafts.historicalContext}`
      : undefined,
    packet.drafts.relatedEntityIds?.length
      ? `relatedEntityIds=${packet.drafts.relatedEntityIds.join(',')}`
      : undefined,
    packet.validationIssues.length
      ? `validationIssues=${packet.validationIssues.join('; ')}`
      : undefined,
    `packetJson=${JSON.stringify(packet)}`,
  ]
    .filter((line): line is string => line !== undefined)
    .join('\n\n');

  return prepareOperatorIntake(
    'editorial_packet',
    {
      kind: 'contribution',
      title: `Editorial: ${packet.subjectTitle ?? packet.subjectId}`,
      statement,
      sourceUrls: ['https://blackstory.local/operator/editorial-packet'],
      targetRecordId: packet.subjectId,
    },
    context,
    { openDraftCase: packet.decision === 'keep' || packet.decision === 'needs_evidence' },
  );
}
