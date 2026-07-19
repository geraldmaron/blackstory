/**
 * Plain-language copy for the story packet review desk — intent lede, steps, and action help.
 */

export const STORY_REVIEW_INTENT_COPY =
  'Review staged story packets from research runs. Record approve, reject, or needs evidence — nothing here publishes to the public site.';

/** Numbered operator steps for the story review queue. */
export const STORY_REVIEW_STEPS = [
  'Open a story packet (or select rows for bulk).',
  'Add a decision note if helpful — optional, but stored with your review.',
  'Choose approve, needs evidence, or reject. Approval prepares a seed handoff; shipping happens separately.',
] as const;

export type StoryReviewAction = 'approved' | 'rejected' | 'needs_evidence';

/** Plain-language explanation of what each review decision does. */
export function storyReviewActionHelp(action: StoryReviewAction): string {
  switch (action) {
    case 'approved':
      return 'Record that this packet is ready for seed handoff. Paste the handoff JSON into stories-seed.ts later — it does not publish automatically.';
    case 'needs_evidence':
      return 'Send the packet back for stronger sources. Attach evidence on the evidence desk, then re-run story research when ready.';
    case 'rejected':
      return 'Close the packet without seeding. Use when the draft is off-scope or not worth advancing.';
  }
}

export function storyReviewActionLabel(action: StoryReviewAction): string {
  switch (action) {
    case 'approved':
      return 'Approve';
    case 'needs_evidence':
      return 'Needs evidence';
    case 'rejected':
      return 'Reject';
  }
}

export const STORY_REVIEW_EMPTY_COPY = {
  noPackets: 'No story packets are waiting for review.',
  noMatch: 'No packets match the current filters.',
  cliHint: 'To stage packets, run story-research-run --commit from operator-cli.',
} as const;
