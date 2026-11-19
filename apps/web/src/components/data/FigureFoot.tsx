'use client';

/**
 * A figure's one footer row: the source on the left, Limits and Numbers on the right. Each opens a
 * panel under the row; one is open at a time. The panels are in the server HTML (hidden), so the
 * limits text and the full table are in the page source for search and for a reader who uses find.
 */
import React, { useId, useState, type ReactNode } from 'react';
import { dedupeSources, humanSourceLabel, sourceKey, type DataSourceRef } from './SourceFootnote';

void React;

type Panel = 'sources' | 'limits' | 'numbers';

/** Past this many sources the row names the first and opens the full list under it. */
const SOURCES_INLINE = 3;

export function FigureFoot({
  title,
  sources,
  limits,
  numbers,
  chapterHref,
}: {
  readonly title: string;
  readonly sources: readonly DataSourceRef[];
  readonly limits: ReactNode;
  readonly numbers: ReactNode;
  /** The chapter that tells the story behind the number, when one is published. */
  readonly chapterHref?: string;
}) {
  const [open, setOpen] = useState<Panel | null>(null);
  const id = useId();
  const unique = dedupeSources(sources);
  const long = unique.length > SOURCES_INLINE;
  const toggle = (panel: Panel) => setOpen((current) => (current === panel ? null : panel));

  return (
    <div className="ds-datafig__foot">
      <div className="ds-datafig__foot-row">
        <p className="ds-datafig__source">
          <span className="ds-datafig__source-label">
            {unique.length === 1 ? 'Source' : 'Sources'}
          </span>{' '}
          {(long ? unique.slice(0, 1) : unique).map((source, index) => (
            <React.Fragment key={sourceKey(source)}>
              {index > 0 ? <span aria-hidden="true">; </span> : null}
              <a href={source.url} target="_blank" rel="noreferrer noopener">
                {humanSourceLabel(source.label)}
              </a>
            </React.Fragment>
          ))}
          {long ? (
            <>
              {' '}
              <button
                type="button"
                className="ds-datafig__more"
                aria-expanded={open === 'sources'}
                aria-controls={`${id}-sources`}
                onClick={() => toggle('sources')}
              >
                and {unique.length - 1} more
              </button>
            </>
          ) : null}
          {chapterHref ? (
            <>
              <span aria-hidden="true"> · </span>
              <a href={chapterHref}>Read the chapter</a>
            </>
          ) : null}
        </p>
        <div className="ds-datafig__toggles">
          {(['limits', 'numbers'] as const).map((panel) => (
            <button
              key={panel}
              type="button"
              className="ds-datafig__toggle"
              aria-expanded={open === panel}
              aria-controls={`${id}-${panel}`}
              onClick={() => toggle(panel)}
            >
              {panel === 'limits' ? 'Limits' : 'Numbers'}
              <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path
                  d="M2.5 4.5 6 8l3.5-3.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ))}
        </div>
      </div>
      {long ? (
        <div id={`${id}-sources`} className="ds-datafig__panel" hidden={open !== 'sources'}>
          <ul className="ds-datafig__source-list">
            {unique.map((source) => (
              <li key={sourceKey(source)}>
                <a href={source.url} target="_blank" rel="noreferrer noopener">
                  {humanSourceLabel(source.label)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div id={`${id}-limits`} className="ds-datafig__panel" hidden={open !== 'limits'}>
        <p className="ds-datafig__limits">{limits}</p>
      </div>
      <div
        id={`${id}-numbers`}
        className="ds-datafig__panel ds-datafig__numbers"
        hidden={open !== 'numbers'}
        role="region"
        aria-label={`Numbers for ${title}`}
        tabIndex={0}
      >
        {numbers}
      </div>
    </div>
  );
}
