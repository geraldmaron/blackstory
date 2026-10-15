'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Button } from 'baseui/button';
import { TableBuilder, TableBuilderColumn } from 'baseui/table-semantic';
import { ChoiceField, TextField } from '../design-system/fields';
import type { listArticles } from './store';
type Article = Awaited<ReturnType<typeof listArticles>>[number];
export function ArticleList({ items }: { items: readonly Article[] }) {
  const [query, setQuery] = useState(''),
    [status, setStatus] = useState('all');
  const visible = useMemo(
    () =>
      items.filter(
        (item) =>
          (status === 'all' || item.status === status) &&
          `${item.title} ${item.slug}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [items, query, status],
  );
  return (
    <main id="main" className="ds-container">
      <header className="admin-base-page-header">
        <div>
          <h1>Articles</h1>
          <p>Write, review and manage articles in the archive.</p>
        </div>
        <div className="admin-base-actions">
          <Button href="/admin/stories/articles/new">New article</Button>
          <Button kind="secondary" href="/admin/stories/review">
            Research packets
          </Button>
          <Button kind="tertiary" href="/admin/stories/contributors">
            Contributors
          </Button>
        </div>
      </header>
      <div className="admin-base-toolbar">
        <div className="admin-base-search">
          <TextField label="Search articles" value={query} onChange={setQuery} />
        </div>
        <div className="admin-base-filter">
          <ChoiceField
            label="Publication state"
            value={status}
            onChange={setStatus}
            options={['all', ...new Set(items.map((item) => item.status))].map((id) => ({
              id,
              label: id === 'all' ? 'All states' : id.replaceAll('_', ' '),
            }))}
          />
        </div>
      </div>
      <p role="status">
        {visible.length} of {items.length} articles
      </p>
      <div className="admin-base-article-table">
        <TableBuilder
          data={visible}
          emptyMessage={
            items.length
              ? 'No articles match these filters.'
              : 'Create your first article to begin.'
          }
        >
          <TableBuilderColumn header="Article">
            {(item: Article) => (
              <Link href={`/admin/stories/articles/${item.slug}`}>
                {item.title || 'Untitled article'}
              </Link>
            )}
          </TableBuilderColumn>
          <TableBuilderColumn header="State">
            {(item: Article) => item.status.replaceAll('_', ' ')}
          </TableBuilderColumn>
          <TableBuilderColumn header="Revision">
            {(item: Article) => item.revision}
          </TableBuilderColumn>
          <TableBuilderColumn header="Actions">
            {(item: Article) => (
              <Link
                href={`/admin/stories/articles/${item.slug}/preview?revision=${item.revision}`}
                target="_blank"
                rel="noreferrer"
              >
                Preview revision {item.revision}
              </Link>
            )}
          </TableBuilderColumn>
        </TableBuilder>
      </div>
      <ul className="admin-base-article-cards" aria-label="Articles">
        {visible.map((item) => (
          <li key={item.id}>
            <div>
              <Link href={`/admin/stories/articles/${item.slug}`}>
                {item.title || 'Untitled article'}
              </Link>
              <p>
                {item.status.replaceAll('_', ' ')} · Revision {item.revision}
              </p>
            </div>
            <Button
              size="compact"
              kind="tertiary"
              href={`/admin/stories/articles/${item.slug}/preview?revision=${item.revision}`}
              aria-label={`Preview ${item.title || 'untitled article'}`}
            >
              Preview
            </Button>
          </li>
        ))}
        {!visible.length && <li>No articles match these filters.</li>}
      </ul>
    </main>
  );
}
