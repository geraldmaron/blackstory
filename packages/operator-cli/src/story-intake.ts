/**
 * Stages a story research packet into quarantine as a contribution proposal.
 * Never opens promotion and never writes public projections or seed stories.
 *
 * Full packet is stored on `payload.storyPacket` (statement stays under size limits).
 */
import type { StoryResearchPacket } from '@repo/domain';
import {
  prepareOperatorIntake,
  type OperatorIntakeContext,
  type OperatorIntakeOutcome,
} from './intake.js';

export function prepareStoryPacketIntake(
  packet: StoryResearchPacket,
  context: OperatorIntakeContext,
): OperatorIntakeOutcome {
  const statement = [
    'Story research packet (staged; not published).',
    `decision=${packet.decision}`,
    `confidence=${packet.confidence}`,
    `rationale=${packet.rationale.slice(0, 500)}`,
    `title=${packet.draft.title}`,
    `dek=${packet.draft.dek.slice(0, 400)}`,
    `era=${packet.draft.eraLabel}`,
    `place=${packet.draft.placeLabel}`,
    packet.relatedEntityIds.length
      ? `relatedEntityIds=${packet.relatedEntityIds.join(',')}`
      : undefined,
    packet.relatedFactIds.length
      ? `relatedFactIds=${packet.relatedFactIds.join(',')}`
      : undefined,
    packet.validationIssues.length
      ? `validationIssues=${packet.validationIssues.slice(0, 8).join('; ')}`
      : undefined,
    'Full packet is on payload.storyPacket.',
  ]
    .filter((line): line is string => line !== undefined)
    .join('\n\n');

  const outcome = prepareOperatorIntake(
    'story_packet',
    {
      kind: 'contribution',
      title: `Story: ${packet.topicTitle ?? packet.draft.title}`,
      statement,
      sourceUrls: ['https://blackstory.local/operator/story-research-packet'],
      targetRecordId: packet.topicId,
    },
    context,
    {
      openDraftCase:
        packet.decision === 'recommend' || packet.decision === 'needs_evidence',
    },
  );

  if (!outcome.accepted) return outcome;

  const mutations = outcome.mutations.map((mutation) => {
    if (mutation.operation !== 'create' || !mutation.path.includes('submissionInbox')) {
      return mutation;
    }
    const data = mutation.data as {
      readonly payload?: Readonly<Record<string, unknown>>;
      readonly [key: string]: unknown;
    };
    const payload = {
      ...(data.payload ?? {}),
      storyPacket: packet,
      proposalKind: 'story_packet',
    };
    return {
      ...mutation,
      data: {
        ...data,
        payload,
      },
    };
  });

  return {
    ...outcome,
    mutations,
  };
}
