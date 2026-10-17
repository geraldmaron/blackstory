import { randomUUID } from 'node:crypto';
import { notFound, redirect } from 'next/navigation';
import { readStory, listContributors } from '@/admin/editorial/store';
import { readVerifiedAdminIdentity } from '@/admin/auth/supabase-server';
import { queryPostgres } from '@/admin/lib/canonical-postgres-client';
import { StoryEditor } from '@/admin/editorial/story-editor';
import type { EditorialStory } from '@repo/schemas';
import '../stories.css';
export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!(await readVerifiedAdminIdentity())) redirect('/admin/login');
  const { slug } = await params;
  // The contributor list does not depend on the story, so it loads alongside it.
  const contributors = listContributors();
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
            contributors: [],
          },
          revision: 0,
          status: 'draft',
          review: null,
          history: [],
        }
      : await readStory(slug);
  if (!story) notFound();
  const [profiles, relatedRecords] = await Promise.all([
    contributors,
    queryPostgres<{ id: string; display_name: string }>(
      'SELECT id,display_name FROM canonical.entities WHERE id=ANY($1::text[])',
      [story.draft.relatedEntityIds],
    ),
  ]);
  return (
    <main className="ds-container" id="main">
      <StoryEditor initial={story} profiles={profiles} relatedRecords={relatedRecords} />
    </main>
  );
}
