/**
 * Reader-facing list of Internet Archive and Wayback sources already cited on a record.
 */
import React from 'react';
import type { InternetArchiveSource } from '../../lib/geography/internet-archive-sources';
import { RecordArchiveContribution } from './RecordArchiveContribution';
import './record-archive.css';

void React;

export type RecordArchiveSourcesProps = {
  readonly sources: readonly InternetArchiveSource[];
  readonly className?: string;
};

function sourceDetail(source: InternetArchiveSource): string | undefined {
  if (source.kind === 'details') {
    return 'Internet Archive item';
  }
  if (source.originalUrl) {
    return `Wayback capture of ${source.originalUrl}`;
  }
  return 'Wayback capture';
}

export function RecordArchiveSources({ sources, className }: RecordArchiveSourcesProps) {
  if (sources.length === 0) {
    return null;
  }

  const rootClass = className ? `ds-record-archive ${className}` : 'ds-record-archive';

  return (
    <section className={rootClass} aria-labelledby="record-archive-heading">
      <h2 className="ds-record-archive__heading" id="record-archive-heading">
        Archived copies
      </h2>
      <p className="ds-record-archive__lede">
        Sources already linked on this record that are preserved on the Internet Archive.
      </p>
      <ol className="ds-record-archive__list">
        {sources.map((source) => (
          <li key={source.id} className="ds-record-archive__item">
            <a className="ds-record-archive__link" href={source.href} rel="noreferrer">
              {source.title}
            </a>
            <span className="ds-record-archive__detail ds-mono">{sourceDetail(source)}</span>
          </li>
        ))}
      </ol>
      <RecordArchiveContribution compact />
    </section>
  );
}
