/**
 * Law browse page sections: disclaimer, on-page nav, filters, and ledger results.
 */
import React from 'react';
import Link from 'next/link';
import { EmptyState, FilterBar } from '@repo/ui';
import {
  LegalBrowseList,
  LegalDisclaimer,
} from '../../components/legal';
import type { LawBrowseViewModel } from './law-view-model';
import './law.css';

const BROWSE_SECTIONS = [
  { id: 'browse', label: 'Browse' },
  { id: 'about-law', label: 'About this page' },
] as const;

export type LawBrowseSectionsProps = {
  readonly view: LawBrowseViewModel;
};

export function LawBrowseSections({ view }: LawBrowseSectionsProps) {
  return (
    <div className="ds-law">
      <LegalDisclaimer />

      <nav className="ds-law__nav" aria-labelledby="law-toc-title">
        <p className="ds-law__nav-title" id="law-toc-title">
          On this page
        </p>
        <ul className="ds-law__nav-list">
          {BROWSE_SECTIONS.map((section) => (
            <li key={section.id}>
              <a className="ds-law__nav-link" href={`#${section.id}`}>
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <section
        className="ds-section ds-record-section ds-section--flush ds-law__filter-band"
        aria-labelledby="law-browse-heading"
        id="browse"
      >
        <p className="ds-section__kicker">
          <span className="ds-kicker-index" aria-hidden="true" />
          Landmark statutes &amp; decisions
        </p>
        <h2 className="ds-section__title" id="law-browse-heading">
          Browse the catalog
        </h2>
        <p className="ds-section__lede">
          Filter by kind or topic, or search by title and citation. Each entry links to a
          plain-language explainer with official sources when editorial review is complete.
        </p>

        <FilterBar
          method="get"
          action="/law"
          legend="Filter law entries"
          fields={[
            {
              id: 'q',
              name: 'q',
              label: 'Search',
              type: 'search',
              placeholder: 'Title, citation, topic…',
              defaultValue: view.q,
            },
            {
              id: 'kind',
              name: 'kind',
              label: 'Kind',
              type: 'select',
              defaultValue: view.kind,
              options: view.kindOptions,
            },
            {
              id: 'topic',
              name: 'topic',
              label: 'Topic',
              type: 'select',
              defaultValue: view.topic,
              options: view.topicOptions,
            },
          ]}
        />

        <p className="ds-law__count" id="law-results-heading">
          {view.totalMatched} law entr{view.totalMatched === 1 ? 'y' : 'ies'}
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
      </section>

      <section
        className="ds-section ds-record-section ds-law__next"
        aria-labelledby="about-law-heading"
        id="about-law"
      >
        <h2 className="ds-section__title" id="about-law-heading">
          About this page
        </h2>
        <p className="ds-section__lede">
          BlackStory explains public laws and court decisions in plain language — not legal advice.
          For guidance about your specific situation, consult a licensed attorney or qualified legal
          aid organization.
        </p>
        <p className="ds-band__cta">
          <Link className="ds-cta-link" href="/methodology">
            Methodology
          </Link>
          {' · '}
          <Link className="ds-cta-link" href="/about">
            About BlackStory
          </Link>
          {' · '}
          <Link className="ds-cta-link" href="/search">
            Search the archive
          </Link>
        </p>
      </section>
    </div>
  );
}
