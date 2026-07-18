/**
 * Citation health: operator dashboard tile showing rot rate by source class, plus a
 * preview of the reader-facing degraded-citation treatment. Fixture data only, matching the
 * `/console` shell's and `/quick-add`'s conventions for this new, sibling route no live
 * service connection, no mutation handlers.
 */
import Link from 'next/link';
import { computeRotRateBySourceClass, buildTrySearchingForSuggestion } from '@blap/domain';
import { Citation } from '@blap/ui';
import { CITATION_HEALTH_FIXTURES } from './fixtures';
import './citation-health.css';

export const metadata = {
  title: 'Citation health — Black Book Admin',
  description: 'Rot rate by source class and the reader-facing degraded-citation treatment.',
};

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default function CitationHealthPage() {
  const rotRates = computeRotRateBySourceClass(CITATION_HEALTH_FIXTURES);
  const deadCitation = CITATION_HEALTH_FIXTURES.find((citation) => citation.linkStatus === 'dead');
  const driftedCitation = CITATION_HEALTH_FIXTURES.find((citation) => citation.linkStatus === 'drifted');

  return (
    <main className="bb-container bb-prose citation-health-page">
      <p className="citation-health-kicker">Operator dashboard tile · BB-083</p>
      <h1>Citation health</h1>
      <p>
        Rot rate per source class, from the weekly <code>citation-link-health-sweep</code>{' '}
        scheduled job (packages/config/src/scheduled-jobs/jobs/citation-link-health-sweep.ts).
        This shell renders fixture data and exposes no live mutation handlers — the real sweep
        writes its findings to the citation store, which a future integration would read here.
      </p>

      <section aria-labelledby="rot-rate-heading">
        <div className="citation-health-section-heading">
          <h2 id="rot-rate-heading">Rot rate by source class</h2>
          <span>{rotRates.length} source classes</span>
        </div>
        <div className="citation-health-table-wrap">
          <table>
            <caption className="bb-visually-hidden">Citation rot rate by source classification</caption>
            <thead>
              <tr>
                <th scope="col">Source class</th>
                <th scope="col">Citations</th>
                <th scope="col">Dead</th>
                <th scope="col">Drifted</th>
                <th scope="col">Rot rate</th>
                <th scope="col">Attention rate</th>
              </tr>
            </thead>
            <tbody>
              {rotRates.map((row) => (
                <tr key={row.sourceClassification}>
                  <th scope="row">{row.sourceClassification}</th>
                  <td>{row.totalCitations}</td>
                  <td>{row.deadCount}</td>
                  <td>{row.driftedCount}</td>
                  <td>{formatPercent(row.rotRate)}</td>
                  <td>{formatPercent(row.attentionRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="citation-health-note">
          Rot rate also feeds an additive confidence-engine authority signal —{' '}
          <code>citationRotRateAuthoritySignal</code> in
          packages/domain/src/confidence-engine/engine.ts — as a durability signal for BB-043,
          without changing the existing weighted confidence computation.
        </p>
      </section>

      <section aria-labelledby="degraded-citation-heading">
        <div className="citation-health-section-heading">
          <h2 id="degraded-citation-heading">Reader-facing degraded citation preview</h2>
        </div>
        <p>
          When a citation&apos;s link dies, the reader sees a clearly marked notice with the date,
          an archived copy when one exists, and a deterministic &ldquo;Try searching for&rdquo;
          suggestion built from stored citation metadata — never an LLM call.
        </p>
        {deadCitation ? (
          <Citation
            source={deadCitation.sourceName}
            {...(deadCitation.originallyPublishedAtUrl ? { href: deadCitation.originallyPublishedAtUrl } : {})}
            linkStatus="dead"
            {...(deadCitation.linkStatusAsOf ? { deadAsOfDate: deadCitation.linkStatusAsOf.slice(0, 10) } : {})}
            {...(deadCitation.capture.waybackCaptureUrl ? { archivedHref: deadCitation.capture.waybackCaptureUrl } : {})}
            trySearchingFor={buildTrySearchingForSuggestion(deadCitation)}
          />
        ) : null}
        {driftedCitation ? (
          <Citation source={driftedCitation.sourceName} linkStatus="drifted" />
        ) : null}
      </section>

      <p className="citation-health-footer">
        <Link href="/console">Back to the administration console</Link>
      </p>
    </main>
  );
}
