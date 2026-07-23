/**
 * Theme-impact map context strip — horizontal packet consumer for map panels.
 * Shares the Chicago redlining pilot fixture (Q3) with ThemeImpactStoryEmbed.
 */

import Link from 'next/link';
import React from 'react';
import type { ThemeImpactPacketView } from '@repo/domain';
import { collectPacketProvenance } from './ThemeImpactProvenanceList';
import { REDLINING_PILOT_PACKET } from './ThemeImpactStoryEmbed';
import { ThemeImpactEmptyNotice } from './ThemeImpactEmptyNotice';
import { THEME_IMPACT_METHOD_STANCE_LABEL } from './theme-impact-copy';

const METHOD_STANCE_LABEL = THEME_IMPACT_METHOD_STANCE_LABEL;
const INDICATOR_LIMIT = 3;

export type ThemeImpactMapStripProps = {
  readonly packet?: ThemeImpactPacketView;
  readonly labelId?: string;
};

export function ThemeImpactMapStrip({
  packet = REDLINING_PILOT_PACKET,
  labelId = 'theme-impact-map-strip',
}: ThemeImpactMapStripProps) {
  const indicators = packet.observations.slice(0, INDICATOR_LIMIT);
  const citations = collectPacketProvenance(packet);
  const methodNoteId = `${labelId}-method-note`;
  const indicatorsHeadingId = `${labelId}-indicators`;
  const citationsHeadingId = `${labelId}-citations`;

  return (
    <aside
      className="ds-theme-impact__strip"
      aria-labelledby={labelId}
      aria-describedby={methodNoteId}
    >
      <div className="ds-theme-impact__strip-row">
        <div className="ds-theme-impact__strip-intro">
          <p className="ds-mono ds-theme-impact__question-id" id={labelId}>
            Question {packet.questionId}
          </p>
          <p className="ds-theme-impact__strip-method">
            <span className="ds-theme-impact__chip" aria-hidden="true">
              Method
            </span>
            <span>{METHOD_STANCE_LABEL}</span>
          </p>
        </div>

        {indicators.length > 0 ? (
          <section
            className="ds-theme-impact__strip-indicators"
            aria-labelledby={indicatorsHeadingId}
          >
            <h3 className="ds-theme-impact__strip-indicators-heading" id={indicatorsHeadingId}>
              Indicators
            </h3>
            <dl className="ds-theme-impact__strip-metrics">
              {indicators.map((obs) => (
                <div key={obs.id}>
                  <dt>{obs.label}</dt>
                  <dd>
                    <span className="ds-mono ds-theme-impact__metric-value">{obs.value}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ) : (
          <ThemeImpactEmptyNotice kind="indicators" />
        )}

        <p className="ds-theme-impact__strip-theme-link">
          <Link href="/themes/redlining">Theme packets</Link>
        </p>
      </div>

      <p className="ds-theme-impact__strip-method-note" id={methodNoteId}>
        {packet.methodNote}
      </p>

      {citations.length > 0 ? (
        <section className="ds-theme-impact__strip-citations" aria-labelledby={citationsHeadingId}>
          <h3 className="ds-theme-impact__strip-citations-heading" id={citationsHeadingId}>
            Sources
          </h3>
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
      ) : (
        <ThemeImpactEmptyNotice kind="provenance" />
      )}
    </aside>
  );
}
