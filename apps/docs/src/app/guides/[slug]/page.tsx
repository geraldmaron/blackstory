/**
 * Catch-all docs pages rendered from curated markdown under content/.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadAllDocs, loadDoc } from '@/lib/content';
import { renderMarkdown } from '@/lib/markdown';
import { PRODUCT_NAME, REPO_URL } from '@/lib/site';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return loadAllDocs().map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = loadDoc(slug);
  if (!doc) {
    return { title: 'Not found' };
  }
  return {
    title: doc.title,
    description: doc.description || undefined,
  };
}

export default async function DocPage({ params }: PageProps) {
  const { slug } = await params;
  const doc = loadDoc(slug);
  if (!doc) {
    notFound();
  }
  const html = await renderMarkdown(doc.body);

  return (
    <article className="prose">
      <p className="hero-eyebrow">
        <span className="pin" aria-hidden />
        <span>{doc.nav}</span>
      </p>
      {doc.description ? <p className="doc-lede">{doc.description}</p> : null}
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <footer className="site-footer">
        <p>
          Edit this page in the repo under <code>apps/docs/content/{slug}.md</code>.{' '}
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            {PRODUCT_NAME} on GitHub
          </a>
        </p>
      </footer>
    </article>
  );
}
