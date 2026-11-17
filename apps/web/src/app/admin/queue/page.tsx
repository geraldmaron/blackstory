/**
 * Queue — every open item that needs a person, across research cases, leads, story packets and
 * the viewer's own requests, oldest first.
 *
 * Server component. Type, stage, age, assignee, search and page are URL params resolved in SQL,
 * the same shape as the audit and catalog desks. The Queue lists and routes; each row opens the
 * page where that type is decided, so nothing here changes state. The desks it links to stay.
 *
 * Request rows are the viewer's own, keyed on the verified Supabase user id. The owner never
 * comes from the URL.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { FacetRail, Pagination, type FacetGroup } from '@repo/ui';
import { readVerifiedAdminIdentity } from '../../../admin/auth/supabase-server';
import { DeskToolbar } from '../../../admin/design-system/DeskToolbar';
import {
  ActiveFilters,
  DeskTitleBar,
  Panel,
  type ActiveFilter,
} from '../../../admin/design-system/ui';
import { readPostgresOrDegrade } from '../../../admin/lib/canonical-postgres-client';
import { formatWhen } from '../../../admin/lib/format-when';
import { formatWaitingDays, waitingLabel } from '../../../admin/queue/queue-format';
import {
  QUEUE_AGE_BAND_LABELS,
  QUEUE_AGE_BANDS,
  QUEUE_STAGE_LABELS,
  QUEUE_STAGES,
  QUEUE_TYPE_LABELS,
  QUEUE_TYPES,
  hasActiveQueueFilters,
  parseQueueQuery,
  queueQueryHref,
  serializeQueueQuery,
  toggleQueueFacetHref,
  type QueueAssigneeFilter,
  type QueueQuery,
} from '../../../admin/queue/queue-query';
import { queryQueueFacets, queryQueuePage } from '../../../admin/queue/queue-store';
import { QueueKeyboard } from './QueueKeyboard';
import './queue.css';

export const metadata: Metadata = {
  title: 'Queue',
  description: 'Every open item that needs a person, oldest first.',
};

/** A work list read from a cache is a different question than the one the operator asked. */
export const dynamic = 'force-dynamic';

const BASE_PATH = '/admin/queue';

const ASSIGNEE_OPTIONS: readonly {
  readonly value: QueueAssigneeFilter | undefined;
  readonly label: string;
}[] = [
  { value: undefined, label: 'Any' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'unassigned', label: 'Unassigned' },
];

/** Every vocabulary value is a facet option, so an empty stage shows as 0 rather than vanishing. */
function facetGroup<T extends string>(
  id: string,
  label: string,
  key: 'types' | 'stages' | 'ageBands',
  vocabulary: readonly T[],
  labels: Readonly<Record<T, string>>,
  buckets: readonly { readonly value: string; readonly count: number }[],
  query: QueueQuery,
): FacetGroup {
  const active: readonly string[] = query[key] ?? [];
  const counts = new Map(buckets.map((bucket) => [bucket.value, bucket.count]));
  return {
    id,
    label,
    options: vocabulary.map((value) => ({
      value,
      label: labels[value],
      count: counts.get(value) ?? 0,
      href: toggleQueueFacetHref(BASE_PATH, query, key, value),
      active: active.includes(value),
    })),
  };
}

export default async function QueuePage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseQueueQuery(await searchParams);
  const identity = await readVerifiedAdminIdentity();
  if (!identity) {
    return (
      <main className="ds-container ds-page" id="main">
        <DeskTitleBar eyebrow="Work" title="Queue" />
        <p className="story-review__notice" role="status">
          Sign in to see the queue.
        </p>
      </main>
    );
  }
  const ownerId = identity.uid;

  const [pageOutcome, facetsOutcome] = await Promise.all([
    readPostgresOrDegrade(() => queryQueuePage(query, ownerId), 'queue items'),
    readPostgresOrDegrade(() => queryQueueFacets(query, ownerId), 'queue facets'),
  ]);
  const degradedReason =
    pageOutcome.status === 'degraded'
      ? pageOutcome.reason
      : facetsOutcome.status === 'degraded'
        ? facetsOutcome.reason
        : undefined;
  const page =
    pageOutcome.status === 'ok'
      ? pageOutcome.value
      : { rows: [], total: 0, page: 1, pageSize: query.pageSize ?? 50, pageCount: 1 };
  const facets =
    facetsOutcome.status === 'ok' ? facetsOutcome.value : { type: [], stage: [], ageBand: [] };

  const filtersActive = hasActiveQueueFilters(query);
  const facetGroups: readonly FacetGroup[] = [
    facetGroup('type', 'Type', 'types', QUEUE_TYPES, QUEUE_TYPE_LABELS, facets.type, query),
    facetGroup('stage', 'Stage', 'stages', QUEUE_STAGES, QUEUE_STAGE_LABELS, facets.stage, query),
    facetGroup(
      'age',
      'Age',
      'ageBands',
      QUEUE_AGE_BANDS,
      QUEUE_AGE_BAND_LABELS,
      facets.ageBand,
      query,
    ),
  ];
  // Everything except the field this form owns rides along as hidden inputs, so searching never
  // silently drops the facets, assignee or page size the operator already chose.
  const { search: _s, ...rest } = query;
  const preserved = Object.fromEntries(
    new URLSearchParams(serializeQueueQuery({ ...rest, page: 1 })),
  );
  const active: ActiveFilter[] = [
    ...(query.search
      ? [
          {
            label: `“${query.search}”`,
            removeHref: queueQueryHref(BASE_PATH, query, { search: '' }),
          },
        ]
      : []),
    ...(query.types ?? []).map((value) => ({
      label: `Type: ${QUEUE_TYPE_LABELS[value]}`,
      removeHref: toggleQueueFacetHref(BASE_PATH, query, 'types', value),
    })),
    ...(query.stages ?? []).map((value) => ({
      label: `Stage: ${QUEUE_STAGE_LABELS[value]}`,
      removeHref: toggleQueueFacetHref(BASE_PATH, query, 'stages', value),
    })),
    ...(query.ageBands ?? []).map((value) => ({
      label: `Age: ${QUEUE_AGE_BAND_LABELS[value]}`,
      removeHref: toggleQueueFacetHref(BASE_PATH, query, 'ageBands', value),
    })),
    ...(query.assignee
      ? [
          {
            label: `Assignee: ${query.assignee === 'assigned' ? 'Assigned' : 'Unassigned'}`,
            removeHref: queueQueryHref(BASE_PATH, query, { assignee: undefined }),
          },
        ]
      : []),
  ];
  const now = new Date();

  return (
    <main className="ds-container ds-page" id="main">
      <DeskTitleBar
        eyebrow="Work"
        title="Queue"
        meta={<span>{page.total.toLocaleString()} open items</span>}
        description="Every open item that needs a person, oldest first. Open an item to decide it on its own page."
      />

      {degradedReason ? (
        <p className="story-review__alert" role="alert">
          The queue is unavailable — the operational database did not answer, so this page shows
          nothing rather than a partial list. Reload to retry.{' '}
          <span className="ds-mono">{degradedReason}</span>
        </p>
      ) : null}

      <div className="ds-workbench">
        <div className="ds-workbench__rail">
          <FacetRail groups={facetGroups} clearHref={BASE_PATH} hasActiveFilters={filtersActive} />
        </div>
        <div className="ds-workbench__main">
          <DeskToolbar
            label="Search the queue"
            action={BASE_PATH}
            preserved={preserved}
            search={{
              value: query.search ?? '',
              placeholder: 'Title, id, candidate, reviewer or source URL…',
            }}
            extra={
              <div className="queue__assignee" role="group" aria-label="Assignee">
                <span className="queue__assignee-label">Assignee</span>
                {ASSIGNEE_OPTIONS.map((option) => {
                  const current = option.value === query.assignee;
                  return (
                    <Link
                      key={option.label}
                      className="queue__assignee-option"
                      href={queueQueryHref(BASE_PATH, query, { assignee: option.value })}
                      aria-current={current ? 'true' : undefined}
                    >
                      {option.label}
                    </Link>
                  );
                })}
                <span className="queue__assignee-hint">Cases only</span>
              </div>
            }
            summary={`${page.total.toLocaleString()} open items`}
          />
          <ActiveFilters filters={active} clearHref={BASE_PATH} />

          <Panel flush label="Open items">
            {page.rows.length === 0 && !degradedReason ? (
              <p className="queue__empty">
                {filtersActive ? (
                  <>
                    No open items match these filters. <Link href={BASE_PATH}>Clear filters</Link>.
                  </>
                ) : (
                  'Nothing is waiting.'
                )}
              </p>
            ) : (
              <div className="queue__scroll">
                <QueueKeyboard>
                  <table className="queue__table">
                    <caption className="ds-visually-hidden">
                      Open items with type, stage, waiting time and assignee, oldest first
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Item</th>
                        <th scope="col">Type</th>
                        <th scope="col">Stage</th>
                        <th scope="col">Waiting</th>
                        <th scope="col">Assignee</th>
                      </tr>
                    </thead>
                    <tbody>
                      {page.rows.map((row) => (
                        <tr key={`${row.type}:${row.id}`} data-queue-row={row.href}>
                          <td className="queue__item">
                            <Link className="story-review__row-title" href={row.href}>
                              {row.title}
                            </Link>
                            <p className="story-review__row-meta ds-mono" title={row.nativeId}>
                              {row.nativeId}
                            </p>
                            {row.openCaseCount > 1 ? (
                              <span className="queue__badge">{row.openCaseCount} open cases</span>
                            ) : null}
                          </td>
                          <td>{QUEUE_TYPE_LABELS[row.type]}</td>
                          <td>
                            {QUEUE_STAGE_LABELS[row.stage]}
                            <p className="story-review__row-meta ds-mono" title="Native state">
                              {row.nativeState.replaceAll('_', ' ')}
                            </p>
                          </td>
                          <td>
                            {formatWaitingDays(row.waitingSince, now)}
                            <p className="story-review__row-meta">
                              {row.type === 'request' ? `${waitingLabel(row.type)} ` : ''}
                              {formatWhen(row.waitingSince)}
                            </p>
                          </td>
                          <td>
                            {row.type === 'case' ? (
                              row.assigneeId ? (
                                <span className="ds-mono">{row.assigneeId}</span>
                              ) : (
                                'Unassigned'
                              )
                            ) : (
                              <span className="queue__muted">Not assignable</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </QueueKeyboard>
              </div>
            )}
          </Panel>
          {page.rows.length > 0 ? (
            <p className="queue__hint">j / k to move, Enter to open</p>
          ) : null}

          <Pagination
            page={page.page}
            pageCount={page.pageCount}
            pageSize={page.pageSize}
            total={page.total}
            itemLabel="items"
            hrefForPage={(target: number) => queueQueryHref(BASE_PATH, query, { page: target })}
          />
        </div>
      </div>
    </main>
  );
}
