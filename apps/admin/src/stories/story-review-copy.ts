/**
 * Plain-language copy for the story packet review desk: intent lede, steps, and action help.
 */

export const STORY_REVIEW_INTENT_COPY =
  'Review staged story packets from research runs. Record approve, reject, or needs evidence. Nothing here publishes to the public site. Open the article cover form to attach a brief, recipe, and plate before publication.';

/** Numbered operator steps for the story review queue. */
export const STORY_REVIEW_STEPS = [
  'Open a story packet (or select rows for bulk).',
  'Check naming, agency framing, and (for sensitive subject matter) community-review status against docs/methodology/scholarship-principles.md before deciding.',
  'Add a decision note if helpful (optional, but stored with your review).',
  'Choose approve, needs evidence, or reject. Approval prepares a seed handoff; shipping happens separately.',
] as const;

/**
 * v1 advisory community-review note (docs/methodology/scholarship-principles.md, §5, modeled
 * on the SNCC Digital Gateway editorial-partnership pattern). Not a formal board gate — records
 * who was asked and what they said, or that community input has not yet been sought, so the
 * absence of that input is visible rather than silent for packets on sensitive subject matter
 * (redlining, racial violence, forced displacement, family separation).
 */
export const STORY_REVIEW_COMMUNITY_NOTE_PROMPT =
  'Community review (sensitive subject matter): who was asked, what they said — or "not yet sought".';

export type StoryReviewAction = 'approved' | 'rejected' | 'needs_evidence';

/** Plain-language explanation of what each review decision does. */
export function storyReviewActionHelp(action: StoryReviewAction): string {
  switch (action) {
    case 'approved':
      return 'Record that this packet is ready for release assembly. Approval remains a private artifact and does not publish automatically.';
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
