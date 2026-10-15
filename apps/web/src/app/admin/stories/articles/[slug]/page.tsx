import { randomUUID } from 'node:crypto';
import { notFound, redirect } from 'next/navigation';
import { readArticle, listContributors } from '@/admin/editorial/store';
import { readVerifiedAdminIdentity } from '@/admin/auth/supabase-server';
import { queryPostgres } from '@/admin/lib/canonical-postgres-client';
import { ArticleEditor } from '@/admin/editorial/article-editor';
import type { EditorialArticle } from '@repo/schemas';
import '../articles.css';
export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  if (!(await readVerifiedAdminIdentity())) redirect('/admin/login');
  const { slug } = await params;
  const article: EditorialArticle | null =
    slug === 'new'
      ? {
          draft: {
            id: randomUUID(),
            slug: `draft-${randomUUID().slice(0, 8)}`,
            title: '',
            summary: '',
            kind: 'article',
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
      : await readArticle(slug);
  if (!article) notFound();
  return (
    <main className="ds-container" id="main">
      <ArticleEditor
        initial={article}
        profiles={await listContributors()}
        relatedRecords={await queryPostgres<{ id: string; display_name: string }>(
          'SELECT id,display_name FROM canonical.entities WHERE id=ANY($1::text[])',
          [article.draft.relatedEntityIds],
        )}
      />
    </main>
  );
}
