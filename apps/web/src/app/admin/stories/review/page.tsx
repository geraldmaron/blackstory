/**
 * Story packet review queue — the route.
 *
 * The packet list is read in the server request and handed to {@link StoryReviewDesk} as
 * `initialRows` so the first response contains the review queue.
 *
 * The desk stays a client component, and should: filtering, sorting, selection and the single and
 * bulk decision POSTs are real interaction against mutation APIs.
 */
import type { Metadata } from 'next';
import { listStoryPackets } from '../../../../admin/stories/story-packet-store';
import { readPostgresOrDegrade } from '../../../../admin/lib/canonical-postgres-client';
import { StoryReviewDesk, type PacketRow } from './StoryReviewDesk';

export const metadata: Metadata = {
  title: 'Story review — BlackStory Admin',
  description: 'Review story packets before anything publishes.',
};

/** A review queue served from a cache is a queue another reviewer may already have worked. */
export const dynamic = 'force-dynamic';

export default async function StoryReviewPage() {
  const outcome = await readPostgresOrDegrade(() => listStoryPackets(200), 'story packets');
  const rows = (outcome.status === 'ok' ? outcome.value : []) as readonly PacketRow[];

  return (
    <>
      {outcome.status === 'degraded' ? (
        <p className="story-review__alert" role="alert">
          The review queue is unavailable — the operational database did not answer. Nothing is
          listed rather than a partial queue, because a half-loaded review desk looks like a worked
          one. Reload to retry. <span className="ds-mono">{outcome.reason}</span>
        </p>
      ) : null}
      <StoryReviewDesk initialRows={rows} />
    </>
  );
}
