import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { storyDraftSchema, publicStoryProjectionSchema } from '@repo/schemas';
import { readVerifiedAdminIdentity } from '@/admin/auth/supabase-server';
import { readStory, storyBlockers } from '@/admin/editorial/store';
import { queryPostgres } from '@/admin/lib/canonical-postgres-client';
import {
  rowToProjectionAuthoring,
  type StoryRow,
} from '../../../../../../../../packages/ops-data/scripts/lib/story-lifecycle';
import { StoryHeroPhoto } from '@/components/story/StoryHeroPhoto';
import { StoryBody } from '@/components/story/StoryBody';
import { StoryReferences } from '@/components/story/StoryReferences';
import { hydrateStory, storyPacketIds, storyMapEntityIds } from '@/lib/stories/hydrate';
import { loadPacketViews, loadEntities } from '@/lib/stories/source';
import '@/components/story/story.css';
export const dynamic = 'force-dynamic';
export default async function Preview({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ revision?: string }>;
}) {
  if (!(await readVerifiedAdminIdentity())) redirect('/admin/login');
  const { slug } = await params,
    current = await readStory(slug);
  if (!current) notFound();
  const revision = Number((await searchParams).revision ?? current.revision);
  const rows = await queryPostgres<{ snapshot: StoryRow }>(
    'SELECT snapshot FROM reference.story_revisions WHERE story_id=$1 AND revision=$2',
    [current.draft.id, revision],
  );
  if (!rows[0]) notFound();
  const raw = rowToProjectionAuthoring(rows[0].snapshot),
    parsed = publicStoryProjectionSchema.safeParse({ ...raw, releaseId: 'preview' });
  // Blockers, packet views and entities are independent of each other once the snapshot parses.
  const [blockers, packetViews, entities] = await Promise.all([
    storyBlockers(storyDraftSchema.parse(raw)),
    parsed.success ? loadPacketViews(storyPacketIds(parsed.data)) : null,
    parsed.success ? loadEntities(storyMapEntityIds(parsed.data)) : null,
  ]);
  const story =
    parsed.success && packetViews && entities
      ? hydrateStory(parsed.data, packetViews, entities)
      : null;
  return (
    <main className="ds-container ds-page" id="main">
      <p>Private preview · revision {revision} · publication requires approval</p>
      <Link href={`/admin/stories/${slug}`}>Return to editor</Link>
      {parsed.success && parsed.data.heroImage && (
        <figure>
          <StoryHeroPhoto url={parsed.data.heroImage.url} alt={parsed.data.heroImage.alt} />
          <figcaption>{parsed.data.heroImage.credit}</figcaption>
        </figure>
      )}
      <h1>{raw.title}</h1>
      <p>{raw.summary}</p>
      <p>
        {storyDraftSchema
          .parse(raw)
          .contributors.map(
            (c) =>
              `${c.name} (${c.roles.join(', ')}${c.kind === 'editorial' ? ', house editorial identity' : ''})`,
          )
          .join('; ')}
      </p>
      {blockers.length > 0 && (
        <section>
          <h2>Current draft needs attention</h2>
          <ul>
            {blockers.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </section>
      )}
      {story ? (
        <>
          <StoryBody story={story} />
          <StoryReferences references={story.references} headingId="preview-references" />
        </>
      ) : (
        <p>Complete the body fields to render this saved revision.</p>
      )}
    </main>
  );
}
