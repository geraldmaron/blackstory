/**
 * Theme browse sections for the public /themes index. v6 edition Surface panels for
 * method notice and researched P0 and P1 catalog rows.
 */

import React from 'react';
import Link from 'next/link';
import {
  listP0Themes,
  listP1Themes,
  type ThemeImpactCatalogEntry,
} from '../../components/theme-impact/fixtures';
import { themesEditionPanelClassName } from './themes-panel-chrome';

function ThemeCatalogRow({
  entry,
  index,
}: {
  readonly entry: ThemeImpactCatalogEntry;
  readonly index: number;
}) {
  const priorityLabel = entry.priority === 'P0' ? 'Priority P0' : 'Priority P1';
  const statusLabel = entry.available ? 'Available now' : 'Coming soon';
  const indexLabel = String(index + 1).padStart(2, '0');

  return (
    <li className="ds-theme-impact__catalog-item">
      <span className="ds-theme-impact__catalog-index" aria-hidden="true">
        {indexLabel}
      </span>
      <div className="ds-theme-impact__catalog-body">
        <div className="ds-theme-impact__catalog-head">
          <h3 className="ds-theme-impact__catalog-title">
            {entry.available ? (
              <Link href={`/themes/${entry.id}`}>{entry.title}</Link>
            ) : (
              entry.title
            )}
          </h3>
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
            <Link className="ds-cta-link" href={`/themes/${entry.id}`}>
              Open theme
            </Link>
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function ThemeBrowseSections() {
  const p0 = listP0Themes();
  const p1 = listP1Themes();

  return (
    <>
      <article
        className={themesEditionPanelClassName('method')}
        aria-labelledby="theme-method-heading"
      >
        <p className="ds-themes-edition__panel-title">Method</p>
        <h2 className="ds-themes-edition__method-title" id="theme-method-heading">
          Juxtaposition, not causation
        </h2>
        <p className="ds-themes-edition__method-body">
          Theme packets place policy eras beside observations and artifacts. Co-movement is not
          treated as proof of cause. Read the{' '}
          <Link href="/methodology">methodology</Link> for confidence grades, gap labels, and when
          impact language is allowed.
        </p>
      </article>

      <article
        className={themesEditionPanelClassName('catalog')}
        aria-labelledby="themes-p0-heading"
        id="p0-themes"
      >
        <header className="ds-themes-edition__header">
          <span className="ds-themes-edition__index" aria-hidden="true">
            01
          </span>
          <div>
            <p className="ds-themes-edition__kicker">Priority P0</p>
            <h2 className="ds-themes-edition__title" id="themes-p0-heading">
              Themes with live packets
            </h2>
            <p className="ds-themes-edition__lede">
              Redlining and drug policy packets connect primary records to measured outcomes while
              keeping geography, time, and evidentiary limits visible.
            </p>
          </div>
        </header>
        <ul className="ds-theme-impact__catalog" aria-label="Priority P0 themes">
          {p0.map((entry, index) => (
            <ThemeCatalogRow key={entry.id} entry={entry} index={index} />
          ))}
        </ul>
      </article>

      <article
        className={themesEditionPanelClassName('catalog')}
        aria-labelledby="themes-p1-heading"
        id="p1-themes"
      >
        <header className="ds-themes-edition__header">
          <span className="ds-themes-edition__index" aria-hidden="true">
            02
          </span>
          <div>
            <p className="ds-themes-edition__kicker">Priority P1</p>
            <h2 className="ds-themes-edition__title" id="themes-p1-heading">
              Extended evidence themes
            </h2>
            <p className="ds-themes-edition__lede">
              Urban renewal, mass incarceration, environmental burden, school opportunity, and
              voting rights use the same cited packet structure. Mixed results and unavailable
              fields stay explicit. Chicago readings are examples of national patterns.
            </p>
          </div>
        </header>
        <ul className="ds-theme-impact__catalog" aria-label="Priority P1 themes">
          {p1.map((entry, index) => (
            <ThemeCatalogRow key={entry.id} entry={entry} index={index} />
          ))}
        </ul>
      </article>
    </>
  );
}
