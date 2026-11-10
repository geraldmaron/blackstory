import { randomUUID } from 'node:crypto';
import { notFound, redirect } from 'next/navigation';
import { readStory, listContributors, listStories } from '@/admin/editorial/store';
import { readVerifiedAdminIdentity } from '@/admin/auth/supabase-server';
import { queryPostgres } from '@/admin/lib/canonical-postgres-client';
import { StoryEditor } from '@/admin/editorial/story-editor';
import type { EditorialStory } from '@repo/schemas';
import '../stories.css';
import '../studio.css';
export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const identity = await readVerifiedAdminIdentity();
  if (!identity) redirect('/admin/login');
  const { slug } = await params;
  // These do not depend on the story, so they load alongside it.
  const contributors = listContributors(identity.uid);
  const stories = listStories();
  const tagsInUse = queryPostgres<{ tag: string }>(
    'SELECT DISTINCT unnest(tags) AS tag FROM reference.stories ORDER BY 1',
  );
  // New stories start with Neo as author; the writer adds themselves from the byline.
  const neo = (await contributors).find((c) => c.id === 'neo');
  const story: EditorialStory | null =
    slug === 'new'
      ? {
          draft: {
            id: randomUUID(),
            slug: `draft-${randomUUID().slice(0, 8)}`,
            title: '',
            summary: '',
            format: 'entry',
            publishedAt: new Date().toISOString().slice(0, 10),
            eraLabel: '',
            placeLabel: '',
            body: [],
            references: [],
            relatedEntityIds: [],
            tags: [],
            contributors: neo
              ? [{ id: neo.id, name: neo.name, kind: neo.kind, roles: ['author'] }]
              : [],
          },
          revision: 0,
          status: 'draft',
          review: null,
          history: [],
        }
      : await readStory(slug);
  if (!story) notFound();
  const [profiles, relatedRecords, allStories, tags] = await Promise.all([
    contributors,
    queryPostgres<{ id: string; display_name: string }>(
      'SELECT id,display_name FROM canonical.entities WHERE id=ANY($1::text[])',
      [story.draft.relatedEntityIds],
    ),
    stories,
    tagsInUse,
  ]);
  return (
    <main className="ds-container" id="main">
      <StoryEditor
        initial={story}
        profiles={profiles}
        relatedRecords={relatedRecords}
        otherStories={allStories.filter((s) => s.id !== story.draft.id).map((s) => s.slug)}
        tagsInUse={tags.map((t) => t.tag)}
      />
    </main>
  );
}
