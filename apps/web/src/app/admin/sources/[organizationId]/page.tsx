/**
 * Source library detail — one publisher's profile, fitness by policy, and the entities that
 * cite it.
 *
 * Server-rendered, read-only: nothing here writes. `evidence.source_library` is a staff-only
 * view, so a miss on `organizationId` reads as `notFound()` rather than a degraded banner.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DetailField, DetailPanel, Pagination } from '@repo/ui';
import { readPostgresOrDegrade } from '../../../../admin/lib/canonical-postgres-client';
import { getSourceLibraryEntry, listSourceEntities } from '../../../../admin/sources/sources-store';
import { formatFitness, formatPublisherKind, formatTier } from '../source-library-labels';
import { SourceEntityTable } from './SourceEntityTable';

const PAGE_SIZE = 50;

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
}

export default async function SourceLibraryDetailPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly organizationId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId: rawOrganizationId } = await params;
  const organizationId = decodeURIComponent(rawOrganizationId);
  const query = await searchParams;
  const page = parsePage(query.page);
  const offset = (page - 1) * PAGE_SIZE;

  const detailOutcome = await readPostgresOrDegrade(
    () => getSourceLibraryEntry(organizationId),
    'source library entry',
  );

  if (detailOutcome.status === 'degraded') {
    return (
      <main className="story-review ds-container ds-page" id="main">
        <h1 className="ds-page__title">{organizationId}</h1>
        <p className="story-review__alert" role="alert">
          The source library database did not answer, so this publisher could not be loaded. Reload
          to retry. <span className="ds-mono">{detailOutcome.reason}</span>
        </p>
        <p className="story-review__notice">
          <Link href="/admin/sources">← Back to source library</Link>
        </p>
      </main>
    );
  }

  const detail = detailOutcome.value;
  if (!detail) notFound();

  const { entry, fitness } = detail;

  const entitiesOutcome = await readPostgresOrDegrade(
    () => listSourceEntities(organizationId, { limit: PAGE_SIZE, offset }),
    'source library entities',
  );
  const entities = entitiesOutcome.status === 'ok' ? entitiesOutcome.value : { rows: [], total: 0 };
  const entitiesDegradedReason =
    entitiesOutcome.status === 'degraded' ? entitiesOutcome.reason : undefined;
  const pageCount = Math.max(1, Math.ceil(entities.total / PAGE_SIZE));

  return (
    <main className="story-review ds-container ds-page" id="main">
      <header className="story-review__header">
        <div>
          <p className="ds-page__eyebrow">Source library</p>
          <h1 className="ds-page__title">{entry.name}</h1>
          <p className="ds-page__lede">
            {formatPublisherKind(entry.publisherKind)} · {formatTier(entry.tier)}
          </p>
          <p className="story-review__notice">
            <Link href="/admin/sources">← Back to source library</Link>
          </p>
        </div>
      </header>

      <DetailPanel title="Profile" meta={<span className="ds-mono">{entry.organizationId}</span>}>
        <DetailField label="Homepage">
          {entry.homepage ? (
            <a href={entry.homepage} rel="noopener noreferrer" target="_blank" className="ds-mono">
              {entry.homepage}
            </a>
          ) : undefined}
        </DetailField>
        <DetailField label="Parent organization">
          {entry.parentOrganizationId ? (
            <Link href={`/admin/sources/${encodeURIComponent(entry.parentOrganizationId)}`}>
              {entry.parentOrganizationId}
            </Link>
          ) : undefined}
        </DetailField>
        <DetailField label="Hosts" emptyLabel="No hosts recorded">
          {entry.hosts.length === 0 ? null : (
            <ul className="story-review__anchors">
              {entry.hosts.map((host) => (
                <li key={host} className="ds-mono">
                  {host}
                </li>
              ))}
            </ul>
          )}
        </DetailField>
        <DetailField label="Summary" emptyLabel="No summary yet.">
          {entry.summary}
        </DetailField>
        <DetailField label="Relevance" emptyLabel="No relevance note yet.">
          {entry.relevance}
        </DetailField>
        <DetailField label="Limitations" emptyLabel="No limitations recorded">
          {entry.limitations.length === 0 ? null : (
            <ul className="story-review__anchors">
              {entry.limitations.map((limitation, index) => (
                <li key={`${index}-${limitation}`}>{limitation}</li>
              ))}
            </ul>
          )}
        </DetailField>
        <DetailField label="Profile sources" emptyLabel="No profile sources recorded">
          {entry.profileSources.length === 0 ? null : (
            <ul className="story-review__anchors">
              {entry.profileSources.map((source) => (
                <li key={source}>
                  <a href={source} rel="noopener noreferrer" target="_blank" className="ds-mono">
                    {source}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </DetailField>
        <DetailField label="Profile reviewed" emptyLabel="No profile yet.">
          {entry.profileReviewedAt
            ? `${formatWhen(entry.profileReviewedAt)}${
                entry.profileReviewedBy ? ` by ${entry.profileReviewedBy}` : ''
              }`
            : undefined}
        </DetailField>
        <DetailField label="Published entities" mono>
          {entry.publishedEntities.toLocaleString()}
        </DetailField>
        <DetailField label="Published claims" mono>
          {entry.publishedClaims.toLocaleString()}
        </DetailField>
        <DetailField label="Canonical entities" mono>
          {entry.canonicalEntities.toLocaleString()}
        </DetailField>
        <DetailField label="Evidence sources" mono>
          {entry.evidenceSources.toLocaleString()}
        </DetailField>
        <DetailField label="Source items" mono>
          {entry.sourceItems.toLocaleString()}
        </DetailField>
        <DetailField label="Merged organization ids" emptyLabel="No merged organizations">
          {entry.mergedOrganizationIds.length === 0 ? null : (
            <ul className="story-review__anchors">
              {entry.mergedOrganizationIds.map((id) => (
                <li key={id} className="ds-mono">
                  {id}
                </li>
              ))}
            </ul>
          )}
        </DetailField>
      </DetailPanel>

      <h2 className="ds-section__title">Fitness by policy</h2>
      {fitness.length === 0 ? (
        <p className="ds-sans">No fitness policies recorded for this publisher.</p>
      ) : (
        <div className="story-review__table-wrap">
          <table className="story-review__table">
            <caption className="ds-visually-hidden">
              Evidence-use fitness recorded for this publisher, by policy
            </caption>
            <thead>
              <tr>
                <th scope="col">Policy</th>
                <th scope="col">Evidence use</th>
                <th scope="col">Fitness</th>
                <th scope="col">Limitations</th>
              </tr>
            </thead>
            <tbody>
              {fitness.map((row) => (
                <tr key={row.policyId}>
                  <td className="ds-mono">{row.policyId}</td>
                  <td>{row.evidenceUse ?? '—'}</td>
                  <td>{formatFitness(row.fitness)}</td>
                  <td>
                    {row.limitations.length === 0 ? (
                      '—'
                    ) : (
                      <ul className="story-review__anchors">
                        {row.limitations.map((limitation, index) => (
                          <li key={`${index}-${limitation}`}>{limitation}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="ds-section__title">Published entities</h2>
      {entitiesDegradedReason ? (
        <p className="story-review__alert" role="alert">
          The entity list is unavailable — the operational database did not answer.{' '}
          <span className="ds-mono">{entitiesDegradedReason}</span>
        </p>
      ) : (
        <>
          <SourceEntityTable rows={entities.rows} />
          <Pagination
            page={page}
            pageCount={pageCount}
            pageSize={PAGE_SIZE}
            total={entities.total}
            itemLabel="entities"
            hrefForPage={(target: number) =>
              `/admin/sources/${encodeURIComponent(organizationId)}${
                target > 1 ? `?page=${target}` : ''
              }`
            }
          />
        </>
      )}
    </main>
  );
}
