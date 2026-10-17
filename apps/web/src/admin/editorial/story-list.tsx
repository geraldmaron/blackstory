'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Button } from 'baseui/button';
import { TableBuilder, TableBuilderColumn } from 'baseui/table-semantic';
import { ChoiceField, TextField } from '../design-system/fields';
import type { listStories } from './store';
type Story = Awaited<ReturnType<typeof listStories>>[number];
export function StoryList({ items }: { items: readonly Story[] }) {
  const [query, setQuery] = useState(''),
    [status, setStatus] = useState('active');
  const visible = useMemo(
    () =>
      items.filter(
        (item) =>
          (status === 'all' ||
            (status === 'active' ? item.status !== 'archived' : item.status === status)) &&
          `${item.title} ${item.slug}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [items, query, status],
  );
  return (
    <main id="main" className="ds-container">
      <header className="admin-base-page-header">
        <div>
          <h1>Stories</h1>
          <p>Write, review and manage stories in the archive.</p>
        </div>
        <div className="admin-base-actions">
          <Button href="/admin/stories/new">New story</Button>
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
          <TextField label="Search stories" value={query} onChange={setQuery} />
        </div>
        <div className="admin-base-filter">
          <ChoiceField
            label="Publication state"
            value={status}
            onChange={setStatus}
            options={['active', 'all', ...new Set(items.map((item) => item.status))].map((id) => ({
              id,
              label:
                id === 'active'
                  ? 'Active stories'
                  : id === 'all'
                    ? 'All states'
                    : id.replaceAll('_', ' '),
            }))}
          />
        </div>
      </div>
      <p role="status">
        {visible.length} of {items.length} stories. Archived stories remain available in the state
        filter.
      </p>
      <div className="admin-base-story-table">
        <TableBuilder
          data={visible}
          emptyMessage={
            items.length ? 'No stories match these filters.' : 'Create your first story to begin.'
          }
        >
          <TableBuilderColumn header="Story">
            {(item: Story) => (
              <Link href={`/admin/stories/${item.slug}`}>{item.title || 'Untitled story'}</Link>
            )}
          </TableBuilderColumn>
          <TableBuilderColumn header="State">
            {(item: Story) => item.status.replaceAll('_', ' ')}
          </TableBuilderColumn>
          <TableBuilderColumn header="Revision">
            {(item: Story) => item.revision}
          </TableBuilderColumn>
          <TableBuilderColumn header="Actions">
            {(item: Story) => (
              <Link
                href={`/admin/stories/${item.slug}/preview?revision=${item.revision}`}
                target="_blank"
                rel="noreferrer"
              >
                Preview revision {item.revision}
              </Link>
            )}
          </TableBuilderColumn>
        </TableBuilder>
      </div>
      <ul className="admin-base-story-cards" aria-label="Stories">
        {visible.map((item) => (
          <li key={item.id}>
            <div>
              <Link href={`/admin/stories/${item.slug}`}>{item.title || 'Untitled story'}</Link>
              <p>
                {item.status.replaceAll('_', ' ')} · Revision {item.revision}
              </p>
            </div>
            <Button
              size="compact"
              kind="tertiary"
              href={`/admin/stories/${item.slug}/preview?revision=${item.revision}`}
              aria-label={`Preview ${item.title || 'untitled story'}`}
            >
              Preview
            </Button>
          </li>
        ))}
        {!visible.length && <li>No stories match these filters.</li>}
      </ul>
    </main>
  );
}
