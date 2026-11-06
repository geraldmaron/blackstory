/**
 * Browser-side call for recording one story packet review decision.
 * Shared by the review desk and the by-id packet page so both send the same body and headers to
 * `POST /admin/api/stories/packets/[submissionId]/review`.
 */
import type { StoryPacketReviewDecision } from './story-packet-review-decision';

export type SingleReviewResponse = {
  readonly error?: string;
  readonly storyDraft?: { readonly slug: string };
};

/** The JSON body: the note is sent only when it has content once trimmed. */
export function buildSingleReviewBody(
  decision: StoryPacketReviewDecision,
  note: string,
): { readonly decision: StoryPacketReviewDecision; readonly note?: string } {
  const trimmed = note.trim();
  return { decision, ...(trimmed ? { note: trimmed } : {}) };
}

/** Records one decision and returns the response body; throws with the server's message. */
export async function postStoryPacketReview(
  token: string,
  submissionId: string,
  decision: StoryPacketReviewDecision,
  note: string,
): Promise<SingleReviewResponse> {
  const response = await fetch(`/admin/api/stories/packets/${submissionId}/review`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildSingleReviewBody(decision, note)),
  });
  const body = (await response.json()) as SingleReviewResponse;
  if (!response.ok) {
    throw new Error(body.error ?? `Review failed (${response.status})`);
  }
  return body;
}
