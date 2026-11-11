/**
 * Today: pick up the writing in progress, then see what is waiting on a decision.
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DeskTitleBar, Panel } from '../../admin/design-system/ui';
import { readVerifiedAdminIdentity } from '../../admin/auth/supabase-server';
import { listStories } from '../../admin/editorial/store';
import { readPostgresOrDegrade } from '../../admin/lib/canonical-postgres-client';
import { formatAgo } from '../../admin/lib/format-when';
import { formatWaitingDays } from '../../admin/queue/queue-format';
import {
  QUEUE_TYPE_LABELS,
  parseQueueQuery,
  toggleQueueFacetHref,
} from '../../admin/queue/queue-query';
import { queryQueueFacets, queryQueuePage } from '../../admin/queue/queue-store';
import './today.css';

export const dynamic = 'force-dynamic';

const STORY_STATUS: Readonly<Record<string, string>> = {
  draft: 'Draft',
  review: 'In review',
  published: 'Published',
};

/** Queue type labels are regular nouns ("lead", "story packet", "research case"). */
const plural = (label: string, count: number) => (count === 1 ? label : `${label}s`);

export default async function AdminHomePage() {
  // Gate before the reads: this route sits outside every route-group layout, so it has no
  // RequireAdminAuth wrapper of its own.
  const identity = await readVerifiedAdminIdentity();
  if (!identity) redirect('/admin/login');

  const query = parseQueueQuery({ size: '8' });
  const [storiesOutcome, pageOutcome, facetsOutcome] = await Promise.all([
    readPostgresOrDegrade(() => listStories(), 'recent stories'),
    readPostgresOrDegrade(() => queryQueuePage(query, identity.uid), 'queue items'),
    readPostgresOrDegrade(() => queryQueueFacets(query, identity.uid), 'queue facets'),
  ]);
  const stories =
    storiesOutcome.status === 'ok'
      ? storiesOutcome.value.filter((story) => story.status !== 'archived').slice(0, 4)
      : [];
  const rows = pageOutcome.status === 'ok' ? pageOutcome.value.rows : [];
  const total = pageOutcome.status === 'ok' ? pageOutcome.value.total : 0;
  const typeCounts = (facetsOutcome.status === 'ok' ? facetsOutcome.value.type : []).filter(
    (bucket) => bucket.count > 0,
  );
  const degraded = [storiesOutcome, pageOutcome, facetsOutcome].find(
    (outcome) => outcome.status === 'degraded',
  );
  const now = new Date();

  return (
    <main className="ds-container ds-page" id="main">
      <DeskTitleBar title="Today" />

      {degraded && degraded.status === 'degraded' ? (
        <p className="story-review__alert" role="alert">
          The operational database did not answer, so part of this page is empty. Reload to retry.{' '}
          <span className="ds-mono">{degraded.reason}</span>
        </p>
      ) : null}

      <div className="today">
        <Panel
          title="Pick up where I left off"
          actions={
            <Link className="ds-cta ds-cta--solid ds-cta--sm" href="/admin/stories/new">
              New story
            </Link>
          }
        >
          {stories.length === 0 ? (
            <p className="today__empty">
              No stories yet. <Link href="/admin/stories/new">Start one</Link> and it will wait here
              for you.
            </p>
          ) : (
            <ul className="today__list">
              {stories.map((story) => (
                <li className="today__row" key={story.id}>
                  <Link className="today__link" href={`/admin/stories/${story.slug}`}>
                    {story.title || 'Untitled story'}
                  </Link>
                  <p className="today__meta">
                    {STORY_STATUS[story.status] ?? story.status.replaceAll('_', ' ')}
                    {' · edited '}
                    {formatAgo(story.row_updated_at, now)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Waiting on a decision">
          {rows.length === 0 ? (
            <p className="today__empty">
              Nothing is waiting. New submissions and research cases land here oldest first.
            </p>
          ) : (
            <ul className="today__list">
              {rows.map((row) => (
                <li className="today__row" key={`${row.type}:${row.id}`}>
                  <Link className="today__link" href={row.href}>
                    {row.title}
                  </Link>
                  <p className="today__meta">{formatWaitingDays(row.waitingSince, now)}</p>
                  <p className="today__sub">{QUEUE_TYPE_LABELS[row.type]}</p>
                </li>
              ))}
            </ul>
          )}
          {typeCounts.length > 0 ? (
            <p className="today__foot">
              {typeCounts.map((bucket) => (
                <Link
                  key={bucket.value}
                  href={toggleQueueFacetHref('/admin/queue', {}, 'types', bucket.value as never)}
                >
                  {bucket.count.toLocaleString()}{' '}
                  {plural(
                    QUEUE_TYPE_LABELS[
                      bucket.value as keyof typeof QUEUE_TYPE_LABELS
                    ]?.toLowerCase() ?? bucket.value,
                    bucket.count,
                  )}
                </Link>
              ))}
              <Link className="today__foot-open" href="/admin/queue">
                Open the full queue{total > rows.length ? ` (${total.toLocaleString()})` : ''}
              </Link>
            </p>
          ) : null}
        </Panel>
      </div>
    </main>
  );
}
