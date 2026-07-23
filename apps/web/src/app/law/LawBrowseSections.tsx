/**
 * Law browse page sections: disclaimer, auto-apply facets, hairline ledger, and
 * about panel inside the v6 edition Surface stack.
 */
import React from 'react';
import Link from 'next/link';
import { EmptyState } from '@repo/ui';
import {
  LegalBrowseList,
  LegalDisclaimer,
} from '../../components/legal';
import { AutoSubmitSelect } from '../../components/forms/AutoSubmitSelect';
import type { LawBrowseViewModel } from './law-view-model';
import { lawEditionPanelClassName } from './law-panel-chrome';

export type LawBrowseSectionsProps = {
  readonly view: LawBrowseViewModel;
};

export function LawBrowseSections({ view }: LawBrowseSectionsProps) {
  const countLabel =
    view.totalMatched === 1 ? '1 law entry' : `${view.totalMatched} law entries`;

  return (
    <>
      <article className={lawEditionPanelClassName('disclaimer')}>
        <LegalDisclaimer />
      </article>

      <article
        className={lawEditionPanelClassName('browse')}
        aria-labelledby="law-browse-heading"
        id="browse"
      >
        <p className="ds-law-edition__panel-title">Catalog</p>
        <h2 className="ds-law-edition__panel-heading" id="law-browse-heading">
          Browse landmark statutes and decisions
        </h2>
        <p className="ds-law-edition__lede">
          Filter by kind or topic, or search by title and citation. Each entry links to a
          plain-language explainer with official sources when editorial review is complete.
        </p>

        <form
          className="ds-search-mast ds-law-edition__refine"
          method="get"
          action="/law"
          role="search"
        >
          <div className="ds-search-mast__field">
            <input
              className="ds-search-mast__input"
              type="search"
              id="q"
              name="q"
              placeholder="Title, citation, topic…"
              defaultValue={view.q}
              aria-label="Search law entries"
            />
            <button className="ds-cta ds-cta--ink" type="submit">
              Search
            </button>
          </div>
          <div className="ds-search-mast__refine">
            <AutoSubmitSelect
              id="kind"
              name="kind"
              label="Kind"
              defaultValue={view.kind}
              options={view.kindOptions}
            />
            <AutoSubmitSelect
              id="topic"
              name="topic"
              label="Topic"
              defaultValue={view.topic}
              options={view.topicOptions}
            />
            <Link className="ds-cta-link" href="/law">
              Clear
            </Link>
          </div>
        </form>

        <p className="ds-law-edition__count" id="law-results-heading">
          {countLabel}
        </p>

        {view.items.length === 0 ? (
          <EmptyState
            title="No law entries matched"
            action={
              <a className="ds-cta ds-cta--ink" href="/law">
                Clear filters
              </a>
            }
          >
            Try a broader keyword or reset the kind and topic filters.
          </EmptyState>
        ) : (
          <LegalBrowseList items={view.items} labelledBy="law-results-heading" />
        )}
      </article>

      <article
        className={lawEditionPanelClassName('about')}
        aria-labelledby="about-law-heading"
        id="about-law"
      >
        <p className="ds-law-edition__panel-title">About</p>
        <h2 className="ds-law-edition__panel-heading" id="about-law-heading">
          About this page
        </h2>
        <p className="ds-law-edition__lede">
          BlackStory explains public laws and court decisions in plain language, not legal advice.
          For guidance about your specific situation, consult a licensed attorney or qualified legal
          aid organization.
        </p>
        <p className="ds-law-edition__footer-links">
          <Link className="ds-cta-link" href="/methodology">
            Methodology
          </Link>
          {' · '}
          <Link className="ds-cta-link" href="/about">
            About BlackStory
          </Link>
          {' · '}
          <Link className="ds-cta-link" href="/history">
            Search the archive
          </Link>
        </p>
      </article>
    </>
  );
}
