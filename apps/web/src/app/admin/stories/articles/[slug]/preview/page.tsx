import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { articleDraftSchema, publicArticleProjectionSchema } from '@repo/schemas';
import { readVerifiedAdminIdentity } from '@/admin/auth/supabase-server';
import { readArticle, articleBlockers } from '@/admin/editorial/store';
import { queryPostgres } from '@/admin/lib/canonical-postgres-client';
import {
  rowToProjectionAuthoring,
  type ArticleRow,
} from '../../../../../../../../../packages/ops-data/scripts/lib/article-lifecycle';
import { ArticleHeroPhoto } from '@/components/article/ArticleHeroPhoto';
import { ArticleBody } from '@/components/article/ArticleBody';
import { ArticleReferences } from '@/components/article/ArticleReferences';
import { hydrateArticle, articlePacketIds, articleMapEntityIds } from '@/lib/articles/hydrate';
import { loadPacketViews, loadEntities } from '@/lib/articles/source';
import '@/components/article/article.css';
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
    current = await readArticle(slug);
  if (!current) notFound();
  const revision = Number((await searchParams).revision ?? current.revision);
  const rows = await queryPostgres<{ snapshot: ArticleRow }>(
    'SELECT snapshot FROM reference.article_revisions WHERE article_id=$1 AND revision=$2',
    [current.draft.id, revision],
  );
  if (!rows[0]) notFound();
  const raw = rowToProjectionAuthoring(rows[0].snapshot),
    parsed = publicArticleProjectionSchema.safeParse({ ...raw, releaseId: 'preview' });
  // Blockers, packet views and entities are independent of each other once the snapshot parses.
  const [blockers, packetViews, entities] = await Promise.all([
    articleBlockers(articleDraftSchema.parse(raw)),
    parsed.success ? loadPacketViews(articlePacketIds(parsed.data)) : null,
    parsed.success ? loadEntities(articleMapEntityIds(parsed.data)) : null,
  ]);
  const article =
    parsed.success && packetViews && entities
      ? hydrateArticle(parsed.data, packetViews, entities)
      : null;
  return (
    <main className="ds-container ds-page" id="main">
      <p>Private preview · revision {revision} · publication requires approval</p>
      <Link href={`/admin/stories/articles/${slug}`}>Return to editor</Link>
      {parsed.success && parsed.data.heroImage && (
        <figure>
          <ArticleHeroPhoto url={parsed.data.heroImage.url} alt={parsed.data.heroImage.alt} />
          <figcaption>{parsed.data.heroImage.credit}</figcaption>
        </figure>
      )}
      <h1>{raw.title}</h1>
      <p>{raw.summary}</p>
      <p>
        {articleDraftSchema
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
      {article ? (
        <>
          <ArticleBody article={article} />
          <ArticleReferences references={article.references} headingId="preview-references" />
        </>
      ) : (
        <p>Complete the body fields to render this saved revision.</p>
      )}
    </main>
  );
}
