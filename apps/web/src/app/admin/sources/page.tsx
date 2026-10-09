import { querySourceLibrary } from '@repo/ops-data/source-library';
import { getPostgresPool } from '../../../admin/lib/canonical-postgres-client';
import { CollectionGuidance } from './collection-guidance';
/**
 * Staff source library with URL-driven search and sort resolved in SQL before rendering. Reads
 * evidence.source_library; publication belongs to the release workflow.
 */
import type { Metadata } from 'next';
import { readPostgresOrDegrade } from '../../../admin/lib/canonical-postgres-client';
import {
  getSourceLibraryTotals,
  listSourceLibrary,
  listUnmappedHosts,
} from '../../../admin/sources/sources-store';
import { SourceLibraryTable } from './SourceLibraryTable';
import { UnmappedHostsSection } from './UnmappedHostsSection';

export const metadata: Metadata = {
  title: 'Source library',
  description: "Publishers behind the archive's evidence sources, with reach and profile status.",
};

/** Operational state is read at request time, never served from a cache. */
export const dynamic = 'force-dynamic';

const BASE_PATH = '/admin/sources';

function sortHref(sort: 'entities' | 'name', q: string | undefined): string {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (sort !== 'entities') params.set('sort', sort);
  const qs = params.toString();
  return qs ? `${BASE_PATH}?${qs}` : BASE_PATH;
}

export default async function SourcesPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawQ = params.q;
  const q = (Array.isArray(rawQ) ? rawQ[0] : rawQ)?.trim() || undefined;
  const rawSort = params.sort;
  const sortParam = Array.isArray(rawSort) ? rawSort[0] : rawSort;
  const sort: 'entities' | 'name' = sortParam === 'name' ? 'name' : 'entities';

  const collectionQuery: Record<string, unknown> = {};
  for (const key of [
    'question',
    'assertionClass',
    'subject',
    'geography',
    'period',
    'reviewStatus',
    'offset',
  ]) {
    const raw = params[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value?.trim()) collectionQuery[key] = key === 'offset' ? Number(value) : value.trim();
  }
  collectionQuery.limit = 20;
  const collections = await readPostgresOrDegrade(
    () => querySourceLibrary(getPostgresPool(), collectionQuery),
    'collection guidance',
  );
  const [libraryOutcome, totalsOutcome, unmappedOutcome] = await Promise.all([
    readPostgresOrDegrade(
      () => listSourceLibrary({ sort, limit: 200, ...(q ? { q } : {}) }),
      'source library',
    ),
    readPostgresOrDegrade(() => getSourceLibraryTotals(), 'source library totals'),
    readPostgresOrDegrade(() => listUnmappedHosts(50), 'unmapped citation hosts'),
  ]);

  const rows = libraryOutcome.status === 'ok' ? libraryOutcome.value : [];
  const totals =
    totalsOutcome.status === 'ok'
      ? totalsOutcome.value
      : { publisherCount: 0, publishedClaimsMapped: 0, unmappedHostCount: 0 };
  const unmappedHosts = unmappedOutcome.status === 'ok' ? unmappedOutcome.value : [];

  const degradedReason =
    libraryOutcome.status === 'degraded'
      ? libraryOutcome.reason
      : totalsOutcome.status === 'degraded'
        ? totalsOutcome.reason
        : unmappedOutcome.status === 'degraded'
          ? unmappedOutcome.reason
          : undefined;

  return (
    <main className="story-review ds-container ds-page" id="main">
      <header className="story-review__header">
        <div>
          <p className="ds-page__eyebrow">Evidence registry</p>
          <h1 className="ds-page__title">Source library</h1>
          <p className="ds-page__lede">
            Find collections suited to your research question, inspect their limits, and trace the
            publishers behind existing citations.
          </p>
        </div>
      </header>

      <p className="story-review__notice" role="status">
        {totals.publisherCount.toLocaleString()} publishers ·{' '}
        {totals.publishedClaimsMapped.toLocaleString()} published claims mapped ·{' '}
        {totals.unmappedHostCount.toLocaleString()} unmapped hosts
      </p>

      {degradedReason ? (
        <p className="story-review__alert" role="alert">
          The source library is unavailable because the operational database did not answer, so this
          page shows nothing rather than a partial list. Reload to retry.{' '}
          <span className="ds-mono">{degradedReason}</span>
        </p>
      ) : null}

      {collections.status === 'ok' ? (
        <CollectionGuidance result={collections.value} />
      ) : (
        <p role="alert">Collection guidance is unavailable. Reload to retry.</p>
      )}
      <h2>Publishers and citation usage</h2>
      <p>
        These counts describe catalog use. They do not measure evidentiary fitness. Legacy tiers are
        discovery hints.
      </p>
      <form className="ds-toolbar" action={BASE_PATH} method="get" role="search">
        {sort !== 'entities' ? <input type="hidden" name="sort" value={sort} /> : null}
        <label className="ds-toolbar__field">
          <span className="ds-toolbar__field-label">Search</span>
          <input type="search" name="q" defaultValue={q ?? ''} placeholder="Publisher name…" />
        </label>
        <div className="ds-toolbar__actions">
          <button type="submit" className="ds-button ds-button--secondary">
            Search
          </button>
          {q ? (
            <a className="ds-button ds-button--secondary" href={sortHref(sort, undefined)}>
              Clear
            </a>
          ) : null}
        </div>
      </form>

      <section className="story-review__queue" aria-label="Source library publishers">
        <SourceLibraryTable
          rows={rows}
          sort={sort}
          sortHrefs={{ entities: sortHref('entities', q), name: sortHref('name', q) }}
        />
      </section>

      <UnmappedHostsSection rows={unmappedHosts} />
    </main>
  );
}
