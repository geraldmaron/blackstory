/**
 * Citation health. No link check has ever been recorded for a published citation: the
 * `citation-link-health-sweep` job (packages/config/src/scheduled-jobs/jobs/) is defined but has
 * no runner and no store. This desk says so with live counts instead of showing sample rot rates
 * as if they were measured. The reader-facing treatment below is a labeled sample.
 */
import Link from 'next/link';
import { buildTrySearchingForSuggestion } from '@repo/domain';
import { Citation } from '@repo/ui';
import { DeskTitleBar } from '../../../admin/design-system/ui';
import { readPostgresOrDegrade } from '../../../admin/lib/canonical-postgres-client';
import { getPublishedCitationTotalsPostgres } from '../../../admin/lib/postgres-sources';
import { CITATION_HEALTH_FIXTURES } from './fixtures';
import './citation-health.css';

export const metadata = {
  title: 'Citation health',
  description: 'Whether published citation links have been checked, and how a dead link reads.',
};

export const dynamic = 'force-dynamic';

export default async function CitationHealthPage() {
  const totals = await readPostgresOrDegrade(
    () => getPublishedCitationTotalsPostgres(),
    'published citation totals',
  );
  const deadCitation = CITATION_HEALTH_FIXTURES.find((citation) => citation.linkStatus === 'dead');
  const driftedCitation = CITATION_HEALTH_FIXTURES.find(
    (citation) => citation.linkStatus === 'drifted',
  );

  return (
    <main className="ds-container ds-prose ds-page citation-health-page" id="main">
      <DeskTitleBar
        eyebrow="Evidence quality"
        title="Citation health"
        description="Whether the links behind published citations still work."
      />

      <section aria-labelledby="link-checks-heading">
        <h2 id="link-checks-heading">Link checks</h2>
        {totals.status === 'ok' ? (
          <p role="status">
            {totals.value.citationCount.toLocaleString()} published citations point at{' '}
            {totals.value.hostCount.toLocaleString()} hosts. None has been checked yet.
          </p>
        ) : (
          <p role="alert">
            Citation counts are unavailable because the database did not answer. Reload to retry.
          </p>
        )}
        <p>
          The weekly link check is written but nothing runs it, and there is no table for its
          results. Until it runs, this desk has no rot rate to show. The job is{' '}
          <span className="ds-mono">citation-link-health-sweep</span>; when it runs, the only change
          it may make on its own is pointing a dead link at an archived copy.
        </p>
      </section>

      <section aria-labelledby="degraded-citation-heading">
        <h2 id="degraded-citation-heading">How a dead link reads (sample)</h2>
        <p>
          When a link dies, the reader sees the date it was found dead, an archived copy when one
          exists, and a search suggestion built from the citation&apos;s own details. These two
          examples are samples, not live citations.
        </p>
        {deadCitation ? (
          <Citation
            source={deadCitation.sourceName}
            {...(deadCitation.originallyPublishedAtUrl
              ? { href: deadCitation.originallyPublishedAtUrl }
              : {})}
            linkStatus="dead"
            {...(deadCitation.linkStatusAsOf
              ? { deadAsOfDate: deadCitation.linkStatusAsOf.slice(0, 10) }
              : {})}
            {...(deadCitation.capture.waybackCaptureUrl
              ? { archivedHref: deadCitation.capture.waybackCaptureUrl }
              : {})}
            trySearchingFor={buildTrySearchingForSuggestion(deadCitation)}
          />
        ) : null}
        {driftedCitation ? (
          <Citation source={driftedCitation.sourceName} linkStatus="drifted" />
        ) : null}
      </section>

      <p className="citation-health-footer">
        <Link href="/admin/sources">Source library</Link>
      </p>
    </main>
  );
}
