/**
 * One published statistic + its mandatory source citation (public-numeric-policy category 3:
 * a count without provenance is an assertion, not a statistic — every stat rendered from
 * `@blap/firebase`'s national-stats readers carries {source, sourceUrl} and must show both).
 * Reuses the existing `.bp-data-strip` value/label pair and `.bp-citation` styling rather
 * than inventing a third numeric-display pattern.
 */
import type { ReactNode } from 'react';

export type DataStatCitationProps = {
  readonly value: string;
  readonly label: string;
  readonly sourceLabel: string;
  readonly sourceUrl: string;
  readonly note?: ReactNode;
};

export function DataStatCitation({ value, label, sourceLabel, sourceUrl, note }: DataStatCitationProps) {
  return (
    <li className="bp-data-strip__item">
      <span className="bp-data-strip__value">{value}</span>
      <span className="bp-data-strip__label">{label}</span>
      {note ? (
        <p className="bp-sans" style={{ margin: 'var(--bp-space-2) 0 0 0', color: 'var(--bp-ink-muted)' }}>
          {note}
        </p>
      ) : null}
      <p className="bp-citation" style={{ marginTop: 'var(--bp-space-2)' }}>
        <span className="bp-citation__label">Source</span>
        <a href={sourceUrl} target="_blank" rel="noreferrer noopener">
          {sourceLabel}
        </a>
      </p>
    </li>
  );
}
