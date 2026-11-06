/**
 * One story packet, addressable by submission id, with the same review decision as the desk.
 *
 * The packet is read in the server request. The layout above (`stories/layout.tsx`) gates
 * sign-in; the review POST re-verifies the ID token and permission.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { readPostgresOrDegrade } from '../../../../../admin/lib/canonical-postgres-client';
import { DeskTitleBar } from '../../../../../admin/design-system/ui';
import { getStoryPacket } from '../../../../../admin/stories/story-packet-store';
import { StoryPacketReview } from '../../../../../admin/stories/StoryPacketReview';
import type { PacketRow } from '../../../../../admin/stories/StoryPacketDetail';

export const metadata: Metadata = {
  title: 'Story review',
  description: 'Review one story packet before anything publishes.',
};

/** A packet another reviewer may already have decided must never be served from a cache. */
export const dynamic = 'force-dynamic';

export default async function StoryPacketPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;
  const outcome = await readPostgresOrDegrade(() => getStoryPacket(submissionId), 'story packet');

  if (outcome.status === 'degraded') {
    return (
      <main className="story-review ds-container ds-page" id="main">
        <DeskTitleBar
          eyebrow="Story review"
          title="Story packet"
          actions={<Link href="/admin/stories/review">Back to story review</Link>}
        />
        <p className="story-review__alert" role="alert">
          This packet is unavailable — the operational database did not answer. Reload to retry.{' '}
          <span className="ds-mono">{outcome.reason}</span>
        </p>
      </main>
    );
  }

  const item = outcome.value;
  if (!item) notFound();

  const row: PacketRow = { ...item, review: item.review ?? null };

  return (
    <main className="story-review ds-container ds-page" id="main">
      <DeskTitleBar
        eyebrow="Story review"
        title={row.title}
        actions={<Link href="/admin/stories/review">Back to story review</Link>}
      />
      <StoryPacketReview row={row} />
    </main>
  );
}
