/**
 * Theme browse sections for the public /themes index — P0 live themes and P1 coming soon.
 */

import React from 'react';
import Link from 'next/link';
import {
  listP0Themes,
  listP1Themes,
  type ThemeImpactCatalogEntry,
} from '../../components/theme-impact/fixtures';

function ThemeCatalogRow({ entry }: { readonly entry: ThemeImpactCatalogEntry }) {
  const priorityLabel = entry.priority === 'P0' ? 'Priority P0' : 'Priority P1';
  const statusLabel = entry.available ? 'Available now' : 'Coming soon';

  return (
    <li className="ds-theme-impact__catalog-item">
      <div className="ds-theme-impact__catalog-head">
        <h2 className="ds-theme-impact__catalog-title">
          {entry.available ? (
            <Link href={`/themes/${entry.id}`}>{entry.title}</Link>
          ) : (
            entry.title
          )}
        </h2>
        <span
          className={`ds-theme-impact__chip ${entry.available ? 'ds-theme-impact__chip--live' : 'ds-theme-impact__chip--soon'}`}
          aria-label={`${priorityLabel}; ${statusLabel}`}
        >
          {entry.priority}
          {!entry.available ? ' · coming soon' : ''}
        </span>
      </div>
      <p className="ds-theme-impact__catalog-lede">{entry.lede}</p>
      {entry.available ? (
        <p className="ds-theme-impact__catalog-meta">
          <Link className="ds-cta ds-cta--quiet" href={`/themes/${entry.id}`}>
            Open theme
          </Link>
        </p>
      ) : null}
    </li>
  );
}

export function ThemeBrowseSections() {
  const p0 = listP0Themes();
  const p1 = listP1Themes();

  return (
    <div className="ds-theme-impact">
      <aside className="ds-theme-impact__notice" aria-labelledby="theme-method-heading">
        <h2 className="ds-theme-impact__notice-title" id="theme-method-heading">
          Juxtaposition, not causation
        </h2>
        <p className="ds-theme-impact__notice-body">
          Theme packets place policy eras beside observations and artifacts. Co-movement is not
          treated as proof of cause. Read the{' '}
          <Link href="/methodology">methodology</Link> for confidence grades, gap labels, and when
          impact language is allowed.
        </p>
      </aside>

      <section
        className="ds-section ds-record-section ds-section--flush"
        aria-labelledby="themes-p0-heading"
        id="p0-themes"
      >
        <p className="ds-section__kicker">
          <span className="ds-kicker-index" aria-hidden="true" />
          Priority P0
        </p>
        <h2 className="ds-section__title" id="themes-p0-heading">
          Themes with fixture packets
        </h2>
        <p className="ds-section__lede">
          Redlining and drug policy &amp; the state ship first — each with canonical questions,
          cited fixtures, and explicit gap labels while live data wiring continues.
        </p>
        <ul className="ds-theme-impact__catalog" aria-label="Priority P0 themes">
          {p0.map((entry) => (
            <ThemeCatalogRow key={entry.id} entry={entry} />
          ))}
        </ul>
      </section>

      <section
        className="ds-section ds-record-section"
        aria-labelledby="themes-p1-heading"
        id="p1-themes"
      >
        <p className="ds-section__kicker">
          <span className="ds-kicker-index" aria-hidden="true" />
          Priority P1
        </p>
        <h2 className="ds-section__title" id="themes-p1-heading">
          Coming soon
        </h2>
        <p className="ds-section__lede">
          These themes use the same packet shape. They stay labeled coming soon until ingestion and
          editorial review catch up — not hidden, not overstated.
        </p>
        <ul className="ds-theme-impact__catalog" aria-label="Priority P1 themes coming soon">
          {p1.map((entry) => (
            <ThemeCatalogRow key={entry.id} entry={entry} />
          ))}
        </ul>
      </section>
    </div>
  );
}
