import { FormInput, FormButton } from '../../../admin/design-system/fields';
import { DeskTitleBar } from '../../../admin/design-system/ui';
import { querySourceLibrary } from '@repo/ops-data/source-library';
import { getPostgresPool } from '../../../admin/lib/canonical-postgres-client';
import { CollectionGuidance } from './collection-guidance';
/**
 * Staff source library with URL-driven search and sort resolved in SQL before rendering. Reads
 * evidence.source_library; publication belongs to the release workflow.
 */
import type { Metadata } from 'next';
import { readPostgresOrDegrade } from '../../../admin/lib/canonical-postgres-client';
import { Pagination } from '@repo/ui';
import {
  countSourceLibrary,
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
const PAGE_SIZE = 50;
const COLLECTION_KEYS = [
  'question',
  'assertionClass',
  'subject',
  'geography',
  'period',
  'reviewStatus',
  'offset',
] as const;

/** The two searches share one URL; each link and form changes only its own keys. */
function hrefWith(
  current: Readonly<Record<string, string>>,
  changes: Readonly<Record<string, string | undefined>>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...changes })) {
    if (value) params.set(key, value);
  }
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
  const rawPage = Number(Array.isArray(params.page) ? params.page[0] : params.page);
  const requestedPage = Number.isInteger(rawPage) && rawPage > 1 ? rawPage : 1;

  const current: Record<string, string> = {};
  for (const [key, raw] of Object.entries(params)) {
    const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
    if (value) current[key] = value;
  }
  const collectionParams = Object.fromEntries(
    Object.entries(current).filter(([key]) => (COLLECTION_KEYS as readonly string[]).includes(key)),
  );
  const libraryParams = Object.fromEntries(
    Object.entries(current).filter(([key]) => ['q', 'sort', 'page'].includes(key)),
  );

  const collectionQuery: Record<string, unknown> = {};
  for (const key of COLLECTION_KEYS) {
    const raw = params[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value?.trim()) collectionQuery[key] = key === 'offset' ? Number(value) : value.trim();
  }
  collectionQuery.limit = 20;
  const collections = await readPostgresOrDegrade(
    () => querySourceLibrary(getPostgresPool(), collectionQuery),
    'collection guidance',
  );
  const [libraryOutcome, countOutcome, totalsOutcome, unmappedOutcome] = await Promise.all([
    readPostgresOrDegrade(
      () =>
        listSourceLibrary({
          sort,
          limit: PAGE_SIZE,
          offset: (requestedPage - 1) * PAGE_SIZE,
          ...(q ? { q } : {}),
        }),
      'source library',
    ),
    readPostgresOrDegrade(() => countSourceLibrary(q), 'source library count'),
    readPostgresOrDegrade(() => getSourceLibraryTotals(), 'source library totals'),
    readPostgresOrDegrade(() => listUnmappedHosts(50), 'unmapped citation hosts'),
  ]);

  const rows = libraryOutcome.status === 'ok' ? libraryOutcome.value : [];
  const matchCount = countOutcome.status === 'ok' ? countOutcome.value : rows.length;
  const pageCount = Math.max(1, Math.ceil(matchCount / PAGE_SIZE));
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
      <DeskTitleBar
        eyebrow="Evidence registry"
        title="Source library"
        description="Find collections suited to your research question, inspect their limits, and trace the publishers behind existing citations."
      />

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
        <CollectionGuidance result={collections.value} keep={libraryParams} />
      ) : (
        <p role="alert">Collection guidance is unavailable. Reload to retry.</p>
      )}
      <h2>Publishers and citation usage</h2>
      <p>
        These counts describe catalog use. They do not measure evidentiary fitness. Legacy tiers are
        discovery hints.
      </p>
      <form className="ds-toolbar" action={BASE_PATH} method="get" role="search">
        {Object.entries({ ...collectionParams, ...(sort !== 'entities' ? { sort } : {}) }).map(
          ([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ),
        )}
        <label className="ds-toolbar__field">
          <span className="ds-toolbar__field-label">Search</span>
          <FormInput type="search" name="q" defaultValue={q ?? ''} placeholder="Publisher name…" />
        </label>
        <div className="ds-toolbar__actions">
          <FormButton type="submit" className="ds-button ds-button--secondary">
            Search
          </FormButton>
          {q ? (
            <a
              className="ds-button ds-button--secondary"
              href={hrefWith(current, { q: undefined, page: undefined })}
            >
              Clear
            </a>
          ) : null}
        </div>
      </form>

      <section className="story-review__queue" aria-label="Source library publishers">
        <SourceLibraryTable
          rows={rows}
          sort={sort}
          sortHrefs={{
            entities: hrefWith(current, { sort: undefined, page: undefined }),
            name: hrefWith(current, { sort: 'name', page: undefined }),
          }}
        />
        {matchCount > 0 ? (
          <Pagination
            page={Math.min(requestedPage, pageCount)}
            pageCount={pageCount}
            pageSize={PAGE_SIZE}
            total={matchCount}
            itemLabel="publishers"
            hrefForPage={(page) => hrefWith(current, { page: page > 1 ? String(page) : undefined })}
          />
        ) : null}
      </section>

      <UnmappedHostsSection rows={unmappedHosts} />
    </main>
  );
}
