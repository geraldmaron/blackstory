/**
 * Provenance list for theme-impact packets — human citations with source URLs
 * and the full provenance quartet in monospace detail.
 */

import React from 'react';
import type { ThemeImpactProvenance } from './fixtures/types';

export type ThemeImpactProvenanceListProps = {
  readonly items: readonly ThemeImpactProvenance[];
  readonly heading?: string;
};

export function ThemeImpactProvenanceList({
  items,
  heading = 'Sources & provenance',
}: ThemeImpactProvenanceListProps) {
  if (items.length === 0) return null;

  return (
    <section className="ds-theme-impact__provenance" aria-labelledby="theme-impact-provenance-heading">
      <h4 className="ds-theme-impact__provenance-heading" id="theme-impact-provenance-heading">
        {heading}
      </h4>
      <ol className="ds-theme-impact__provenance-list">
        {items.map((item) => (
          <li key={`${item.source}:${item.content_hash}`} className="ds-theme-impact__provenance-item">
            <p className="ds-theme-impact__provenance-citation">{item.humanCitation}</p>
            <p className="ds-theme-impact__provenance-link">
              <a href={item.source_url} target="_blank" rel="noreferrer noopener">
                Open source
              </a>
            </p>
            <dl className="ds-theme-impact__provenance-quartet ds-mono">
              <div>
                <dt>Source id</dt>
                <dd>{item.source}</dd>
              </div>
              <div>
                <dt>Retrieved</dt>
                <dd>
                  <time dateTime={item.retrieved_at}>{item.retrieved_at.slice(0, 10)}</time>
                </dd>
              </div>
              <div>
                <dt>Content hash</dt>
                <dd>{item.content_hash}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Collect unique provenance rows from observations, derived metrics, and artifacts. */
export function collectPacketProvenance(input: {
  readonly observations: readonly { readonly provenance: ThemeImpactProvenance }[];
  readonly derived: readonly { readonly provenance: ThemeImpactProvenance }[];
  readonly artifacts: readonly { readonly provenance?: ThemeImpactProvenance }[];
}): readonly ThemeImpactProvenance[] {
  const seen = new Set<string>();
  const out: ThemeImpactProvenance[] = [];

  const push = (provenance: ThemeImpactProvenance) => {
    const key = provenance.content_hash;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(provenance);
  };

  for (const row of input.observations) push(row.provenance);
  for (const row of input.derived) push(row.provenance);
  for (const artifact of input.artifacts) {
    if (artifact.provenance) push(artifact.provenance);
  }

  return out;
}
