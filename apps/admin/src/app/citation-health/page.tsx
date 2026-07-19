/**
 * Citation health: operator dashboard tile showing rot rate by source class, plus a
 * preview of the reader-facing degraded-citation treatment. Fixture data only, matching the
 * `/console` shell's and `/quick-add`'s conventions for this new, sibling route no live
 * service connection, no mutation handlers.
 */
import Link from 'next/link';
import { computeRotRateBySourceClass, buildTrySearchingForSuggestion } from '@repo/domain';
import { Citation } from '@repo/ui';
import { CITATION_HEALTH_FIXTURES } from './fixtures';
import './citation-health.css';

export const metadata = {
  title: 'Citation health — BlackStory Admin',
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
    <main className="ds-container ds-prose ds-page citation-health-page" id="main">
      <p className="ds-page__eyebrow">Evidence quality</p>
      <h1 className="ds-page__title">Citation health</h1>
      <p className="ds-page__lede">
        Rot rate by source class from the scheduled citation link-health sweep, plus a preview of
        the reader-facing degraded-citation treatment. This desk reads fixture telemetry only — it
        does not repair links, mutate citations, or publish catalog changes.
      </p>

      <section aria-labelledby="rot-rate-heading">
        <div className="citation-health-section-heading">
          <h2 id="rot-rate-heading">Rot rate by source class</h2>
          <span>{rotRates.length} source classes</span>
        </div>
        <div className="citation-health-table-wrap">
          <table>
            <caption className="ds-visually-hidden">Citation rot rate by source classification</caption>
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
          packages/domain/src/confidence-engine/engine.ts — as a durability signal for confidence durability,
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
        <Link href="/">Back to operations</Link>
      </p>
    </main>
  );
}
