/**
 * The story packet review decisions. The one definition: the Postgres reader, the store and the
 * client review panel all import it from here, because this module imports nothing and is safe in
 * a client bundle.
 */
export type StoryPacketReviewDecision = 'approved' | 'rejected' | 'needs_evidence';
