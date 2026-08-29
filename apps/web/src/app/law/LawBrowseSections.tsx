/**
 * Law browse page sections: intro panel, disclaimer, kind/topic chips, search field, and
 * hairline result rows carrying citation, year, jurisdiction and a plain-language gloss.
 *
 * Room kit edition. The kit's `HairlineIndex` row shape (glyph/name/place/era/grade) has no
 * slot for a one-line gloss, so rows are hand-built here reusing the kit's `ds-room-idx-*`
 * classes rather than a fifth field bolted onto a shared component used by five other rooms.
 */
import React from 'react';
import Link from 'next/link';
import { US_STATES } from '@repo/domain';
import { EmptyList, Prose } from '../../components/room';
import { LegalDisclaimer, humanizeLegalKind, humanizeLegalTopic } from '../../components/legal';
import type { LegalSnapshotDocument } from '../../lib/legal/public-source';
import type { LawBrowseViewModel } from './law-view-model';

export type LawBrowseSectionsProps = {
  readonly view: LawBrowseViewModel;
  /** Full, unfiltered catalog: source of jurisdiction ids and chip counts across the whole set. */
  readonly catalog: readonly LegalSnapshotDocument[];
};

/**
 * `jurisdictionId` on the catalog is `'us'` for federal entries or `'us-<fips>'` for a state.
 * Neither form is a location: it is the reach of the authority that passed the law. An id this
 * cannot resolve renders an explicit unknown rather than being silently dropped from a row.
 */
export function jurisdictionLabel(jurisdictionId: string): string {
  if (jurisdictionId === 'us') return 'Federal';
  const match = /^us-(\d{1,2})$/.exec(jurisdictionId);
  const fips = match?.[1]?.padStart(2, '0');
  const state = fips ? US_STATES.find((entry) => entry.fips === fips) : undefined;
  return state?.name ?? 'Unknown jurisdiction';
}

export function statePostalForJurisdiction(jurisdictionId: string): string | undefined {
  const match = /^us-(\d{1,2})$/.exec(jurisdictionId);
  const fips = match?.[1]?.padStart(2, '0');
  return fips ? US_STATES.find((entry) => entry.fips === fips)?.postalCode : undefined;
}

function buildLawHref(params: {
  readonly q: string;
  readonly kind: string;
  readonly topic: string;
  readonly sort: string;
}): string {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.kind !== 'all') search.set('kind', params.kind);
  if (params.topic !== 'all') search.set('topic', params.topic);
  if (params.sort !== 'chronological') search.set('sort', params.sort);
  const query = search.toString();
  return query.length > 0 ? `/law?${query}` : '/law';
}

function countBy(values: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

export function LawBrowseSections({ view, catalog }: LawBrowseSectionsProps) {
  const noun = view.totalMatched === 1 ? 'law entry' : 'law entries';
  const countLabel = view.isFiltered
    ? `${view.totalMatched} of ${view.totalAvailable} ${noun}`
    : `${view.totalMatched} ${noun}`;

  const jurisdictionById = new Map(
    catalog.map((snapshot) => [snapshot.id, jurisdictionLabel(snapshot.jurisdictionId)] as const),
  );

  const kindCounts = countBy(catalog.map((snapshot) => snapshot.kind));
  const topicCounts = countBy(catalog.flatMap((snapshot) => snapshot.topics));

  const activeChips: { readonly key: string; readonly label: string; readonly href: string }[] = [];
  if (view.q.trim()) {
    activeChips.push({
      key: 'q',
      label: `Search: ${view.q.trim()}`,
      href: buildLawHref({ q: '', kind: view.kind, topic: view.topic, sort: view.sort }),
    });
  }
  if (view.kind !== 'all') {
    activeChips.push({
      key: 'kind',
      label: humanizeLegalKind(view.kind),
      href: buildLawHref({ q: view.q, kind: 'all', topic: view.topic, sort: view.sort }),
    });
  }
  if (view.topic !== 'all') {
    activeChips.push({
      key: 'topic',
      label: humanizeLegalTopic(view.topic),
      href: buildLawHref({ q: view.q, kind: view.kind, topic: 'all', sort: view.sort }),
    });
  }

  return (
    <>
      <Prose>
        <p>
          This catalogue loads from a separate legal reference, not from the entity records this
          archive pins to place. Where a law and a record share a jurisdiction and an era, that is
          a coincidence of scope, not a documented link: the relationship is jurisdictional, not
          evidentiary. A jurisdiction is not a location. It is the reach of the authority that
          passed a law, and it carries no address of its own.
        </p>
      </Prose>

      <LegalDisclaimer />

      <form
        className="ds-records-find"
        method="get"
        action="/law"
        role="search"
        aria-labelledby="law-browse-heading"
      >
        <h2 id="law-browse-heading" className="ds-room-grouphd">
          Browse landmark statutes and decisions
        </h2>
        {/* `ds-records-find__label` was never defined in any stylesheet, so this rendered as
            unstyled stray body text above the field. The identical control in `RecordsIndex`
            hides its label and lets the placeholder carry the visible prompt; matching it keeps
            the accessible name without the orphaned class or the duplicated visible text. */}
        <label className="ds-visually-hidden" htmlFor="law-q">
          Title, citation or topic
        </label>
        <div className="ds-records-find__row">
          <input
            className="ds-records-find__input"
            id="law-q"
            name="q"
            type="search"
            defaultValue={view.q}
            placeholder="Brown v. Board, voting, 42 U.S.C…"
            autoComplete="off"
          />
          <button className="ds-records-find__go" type="submit">
            Search
          </button>
        </div>
        {view.kind !== 'all' ? <input type="hidden" name="kind" value={view.kind} /> : null}
        {view.topic !== 'all' ? <input type="hidden" name="topic" value={view.topic} /> : null}
        {view.sort !== 'chronological' ? (
          <input type="hidden" name="sort" value={view.sort} />
        ) : null}
      </form>

      {activeChips.length > 0 ? (
        <div className="ds-records-active" role="group" aria-label="Active filters">
          {activeChips.map((chip) => (
            <Link className="ds-records-active__chip" href={chip.href} key={chip.key}>
              {chip.label}
              <span className="ds-records-active__x" aria-hidden="true">
                ✕
              </span>
              <span className="ds-visually-hidden"> — remove this filter</span>
            </Link>
          ))}
          <Link className="ds-records-active__clear" href="/law">
            Clear all
          </Link>
        </div>
      ) : null}

      <div className="ds-room-idx__bar" role="group" aria-label="Filter by kind">
        <Link
          className="ds-room-chip"
          href={buildLawHref({ q: view.q, kind: 'all', topic: view.topic, sort: view.sort })}
          aria-current={view.kind === 'all' ? true : undefined}
        >
          All kinds <span className="ds-room-num">{catalog.length}</span>
        </Link>
        {view.kindOptions
          .filter((option) => option.value !== 'all')
          .map((option) => (
            <Link
              key={option.value}
              className="ds-room-chip"
              href={buildLawHref({
                q: view.q,
                kind: option.value,
                topic: view.topic,
                sort: view.sort,
              })}
              aria-current={view.kind === option.value ? true : undefined}
            >
              {humanizeLegalKind(option.value)}{' '}
              <span className="ds-room-num">{kindCounts.get(option.value) ?? 0}</span>
            </Link>
          ))}
      </div>

      <div className="ds-room-idx__bar" role="group" aria-label="Filter by topic">
        <Link
          className="ds-room-chip"
          href={buildLawHref({ q: view.q, kind: view.kind, topic: 'all', sort: view.sort })}
          aria-current={view.topic === 'all' ? true : undefined}
        >
          All topics
        </Link>
        {view.topicOptions
          .filter((option) => option.value !== 'all')
          .map((option) => (
            <Link
              key={option.value}
              className="ds-room-chip"
              href={buildLawHref({
                q: view.q,
                kind: view.kind,
                topic: option.value,
                sort: view.sort,
              })}
              aria-current={view.topic === option.value ? true : undefined}
            >
              {humanizeLegalTopic(option.value)}{' '}
              <span className="ds-room-num">{topicCounts.get(option.value) ?? 0}</span>
            </Link>
          ))}
      </div>

      <p className="ds-room-idx__count" id="law-results-heading">
        {countLabel}
      </p>

      {view.items.length === 0 ? (
        <EmptyList title="No law entries matched">
          {activeChips.length > 0 ? (
            <>
              Nothing matches {activeChips.map((chip) => chip.label).join(', ')}.{' '}
              <Link href="/law">Clear every filter</Link> to see all {view.totalAvailable} law
              entries.
            </>
          ) : (
            <>The catalogue is empty. This is a fault on our side, not an absence of law.</>
          )}
        </EmptyList>
      ) : (
        <div className="ds-room-idx__list" aria-labelledby="law-results-heading">
          {view.items.map((item) => {
            const jurisdiction = jurisdictionById.get(item.id) ?? 'Unknown jurisdiction';
            const year = item.effectiveYear ? String(item.effectiveYear) : 'Year unknown';
            const gloss = item.summary ?? 'No plain-language summary yet.';
            return (
              <Link className="ds-room-idx__row" href={`/law/${item.slug}`} key={item.id}>
                <span className="ds-room-idx__glyph" aria-hidden="true">
                  §
                </span>
                <span className="ds-room-idx__name">{item.title}</span>
                <span className="ds-room-idx__place" title={jurisdiction}>
                  {jurisdiction}
                </span>
                <span className="ds-room-idx__era">{year}</span>
                <span className="ds-room-idx__grade">{item.citation}</span>
                <span style={{ gridColumn: '1 / -1' }}>{gloss}</span>
              </Link>
            );
          })}
        </div>
      )}

      <Prose>
        <p>
          BlackStory explains public laws and court decisions in plain language, not legal advice.
          For guidance about your specific situation, consult a licensed attorney or a qualified
          legal aid organization.
        </p>
        <p>
          <Link href="/methodology">Methodology</Link> · <Link href="/about">About</Link>
        </p>
      </Prose>
    </>
  );
}
