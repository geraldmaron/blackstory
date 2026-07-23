/**
 * Theme-impact story embed — compact packet consumer for narrative surfaces.
 * Resolves live Q3 packet when Postgres is configured; falls back to fixtures.
 */

import Link from 'next/link';
import React from 'react';
import type { ThemeImpactPacketView } from '@repo/domain';
import { REDLINING_PACKET_FIXTURES } from './fixtures/packets/redlining';
import { collectPacketProvenance } from './ThemeImpactProvenanceList';

/** Fixture fallback when live reads are unavailable at build time. */
export const REDLINING_PILOT_PACKET: ThemeImpactPacketView =
  REDLINING_PACKET_FIXTURES.find((packet) => packet.questionId === 'Q3')!;

const METHOD_STANCE_LABEL = 'Juxtaposition — not causation';
const INDICATOR_LIMIT = 3;

export type ThemeImpactStoryEmbedProps = {
  readonly packet?: ThemeImpactPacketView;
  readonly headingId?: string;
  readonly citationsHeading?: string;
};

export function ThemeImpactStoryEmbed({
  packet = REDLINING_PILOT_PACKET,
  headingId = 'theme-impact-story-embed',
  citationsHeading = 'Sources',
}: ThemeImpactStoryEmbedProps) {
  const indicators = packet.observations.slice(0, INDICATOR_LIMIT);
  const citations = collectPacketProvenance(packet);
  const citationsHeadingId = `${headingId}-citations`;

  return (
    <aside className="ds-theme-impact__embed" aria-labelledby={headingId}>
      <header className="ds-theme-impact__embed-header">
        <p className="ds-mono ds-theme-impact__question-id">Question {packet.questionId}</p>
        <h3 className="ds-theme-impact__embed-title" id={headingId}>
          {packet.question}
        </h3>
      </header>

      <div
        className="ds-theme-impact__method ds-theme-impact__method--compact"
        role="group"
        aria-label="Method stance"
      >
        <p className="ds-theme-impact__method-label">
          <span className="ds-theme-impact__chip" aria-hidden="true">
            Method
          </span>
          {METHOD_STANCE_LABEL}
        </p>
        <p className="ds-theme-impact__method-note">{packet.methodNote}</p>
      </div>

      {indicators.length > 0 ? (
        <section aria-labelledby={`${headingId}-indicators`}>
          <h4 className="ds-theme-impact__subheading" id={`${headingId}-indicators`}>
            Indicators
          </h4>
          <dl className="ds-theme-impact__embed-metrics">
            {indicators.map((obs) => (
              <div key={obs.id}>
                <dt>{obs.label}</dt>
                <dd>
                  <span className="ds-mono ds-theme-impact__metric-value">{obs.value}</span>
                  {obs.referencePeriod ? (
                    <span className="ds-mono ds-theme-impact__metric-period">
                      {' '}
                      · {obs.referencePeriod}
                    </span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {citations.length > 0 ? (
        <section className="ds-theme-impact__embed-citations" aria-labelledby={citationsHeadingId}>
          <h4 className="ds-theme-impact__subheading" id={citationsHeadingId}>
            {citationsHeading}
          </h4>
          <ul className="ds-theme-impact__citation-links">
            {citations.map((item) => (
              <li key={item.content_hash}>
                <a href={item.source_url} target="_blank" rel="noreferrer noopener">
                  {item.humanCitation}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="ds-theme-impact__embed-footer">
        <Link href="/themes/redlining">Open redlining theme packets</Link>
      </p>
    </aside>
  );
}
