/**
 * Law browse page sections: intro panel, disclaimer, kind/topic chips, search field, and
 * hairline result rows carrying citation, year, jurisdiction and a plain-language gloss.
 *
 * Room kit edition. Rows reuse `ds-room-idx-*` slots plus law-specific citation and gloss
 * fields styled in `reading-room.css` (`ds-law-idx`), with subgrid alignment like `/books`.
 */
import React from 'react';
import Link from 'next/link';
import { US_STATES } from '@repo/domain';
import {
  EmptyList,
  FindBar,
  FindBarChips,
  FindBarFilters,
  Prose,
  RoomFactList,
  RoomHandoff,
  RoomJump,
  RoomSection,
  roomSectionTone,
  type RoomFact,
} from '../../components/room';
import { LegalDisclaimer, humanizeLegalKind, humanizeLegalTopic } from '../../components/legal';
import type { LegalSnapshotDocument } from '../../lib/legal/public-source';
import { formatResultSummary } from '../../lib/discovery/result-summary';
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
  return query.length > 0 ? `/law?${query}#browse` : '/law#browse';
}

function countBy(values: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

const LAW_JUMP = [
  { id: 'how-to-read', label: 'How to read this', icon: 'methodology' as const },
  { id: 'catalog', label: 'The catalog', icon: 'law' as const },
  { id: 'keep-going', label: 'Keep going', icon: 'rooms' as const },
];

const LAW_READ_FACTS: readonly RoomFact[] = [
  {
    icon: 'questions',
    title: 'Plain language first',
    body: 'Each entry opens with what the law did, in a sentence you can repeat.',
  },
  {
    icon: 'evidence',
    title: 'The operative text, quoted',
    body: 'The words that carry the force are quoted exactly, inside quotation marks.',
  },
  {
    icon: 'source',
    title: 'Checked against the official source',
    body: 'Every entry links to the official text it was checked against.',
  },
];

export function LawBrowseSections({ view, catalog }: LawBrowseSectionsProps) {
  const countLabel = formatResultSummary({
    matched: view.totalMatched,
    total: view.isFiltered ? view.totalAvailable : view.totalMatched,
    singular: 'law entry',
    plural: 'law entries',
  });

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
      <RoomJump sections={LAW_JUMP} />

      <RoomSection
        id="how-to-read"
        icon="methodology"
        kicker="How to read"
        title="How to read this catalog"
        tone={roomSectionTone(0)}
      >
        <RoomFactList items={LAW_READ_FACTS} />
        <Prose>
          <p>
            This catalog loads from a separate legal reference, not from the entity records this
            archive pins to place. Where a law and a record share a jurisdiction and an era, that is
            a coincidence of scope, not a documented link: the relationship is jurisdictional, not
            evidentiary. A jurisdiction is not a location. It is the reach of the authority that
            passed a law, and it carries no address of its own.
          </p>
        </Prose>
        <LegalDisclaimer />
      </RoomSection>

      <RoomSection
        id="catalog"
        icon="law"
        kicker="Catalog"
        title="Browse statutes and decisions"
        tone={roomSectionTone(1)}
      >
        <div id="browse" className="ds-find-anchor">
          <FindBar
            id="law"
            action="/law#browse"
            queryLabel="Title, citation or topic"
            placeholder="Brown v. Board, voting, 42 U.S.C…"
            query={view.q}
            preserved={{
              kind: view.kind !== 'all' ? view.kind : undefined,
              topic: view.topic !== 'all' ? view.topic : undefined,
              sort: view.sort !== 'chronological' ? view.sort : undefined,
            }}
            active={activeChips}
            clearHref="/law"
            rows={[
              {
                label: 'Filter by kind',
                chips: [
                  {
                    label: 'All kinds',
                    href: buildLawHref({
                      q: view.q,
                      kind: 'all',
                      topic: view.topic,
                      sort: view.sort,
                    }),
                    active: view.kind === 'all',
                    count: catalog.length,
                  },
                  ...view.kindOptions
                    .filter((option) => option.value !== 'all')
                    .map((option) => ({
                      label: humanizeLegalKind(option.value),
                      href: buildLawHref({
                        q: view.q,
                        kind: option.value,
                        topic: view.topic,
                        sort: view.sort,
                      }),
                      active: view.kind === option.value,
                      count: kindCounts.get(option.value) ?? 0,
                    })),
                ],
              },
            ]}
            sort={view.sortOptions.map((option) => ({
              label: option.label,
              href: buildLawHref({
                q: view.q,
                kind: view.kind,
                topic: view.topic,
                sort: option.value,
              }),
              active: view.sort === option.value,
            }))}
            summary={countLabel}
          >
            <FindBarFilters label="Filter by topic" activeCount={view.topic === 'all' ? 0 : 1}>
              <FindBarChips
                row={{
                  label: 'Filter by topic',
                  chips: [
                    {
                      label: 'All topics',
                      href: buildLawHref({
                        q: view.q,
                        kind: view.kind,
                        topic: 'all',
                        sort: view.sort,
                      }),
                      active: view.topic === 'all',
                    },
                    ...view.topicOptions
                      .filter((option) => option.value !== 'all')
                      .map((option) => ({
                        label: humanizeLegalTopic(option.value),
                        href: buildLawHref({
                          q: view.q,
                          kind: view.kind,
                          topic: option.value,
                          sort: view.sort,
                        }),
                        active: view.topic === option.value,
                        count: topicCounts.get(option.value) ?? 0,
                      })),
                  ],
                }}
              />
            </FindBarFilters>
          </FindBar>

          {view.items.length === 0 ? (
            <EmptyList title="No law entries matched">
              {activeChips.length > 0 ? (
                <>
                  Nothing matches {activeChips.map((chip) => chip.label).join(', ')}.{' '}
                  <Link href="/law">Clear every filter</Link> to see all {view.totalAvailable} law
                  entries.
                </>
              ) : (
                <>The catalog is empty. This is a fault on our side, not an absence of law.</>
              )}
            </EmptyList>
          ) : (
            <div className="ds-law-idx ds-room-idx__list" aria-labelledby="law-results-heading">
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
                    <span className="ds-law-idx__kind">{humanizeLegalKind(item.kind)}</span>
                    <span className="ds-room-idx__place" title={jurisdiction}>
                      {jurisdiction}
                    </span>
                    <span className="ds-room-idx__era">{year}</span>
                    <span className="ds-law-idx__citation" title={item.citation}>
                      {item.citation}
                    </span>
                    <span className="ds-law-idx__gloss">{gloss}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </RoomSection>

      <RoomSection
        id="keep-going"
        icon="rooms"
        kicker="Next"
        title="Keep going"
        tone={roomSectionTone(2)}
      >
        <div className="ds-room-handoffs">
          <RoomHandoff
            href="/methodology"
            icon="methodology"
            title="Methodology"
            line="How a record gets in, and what the evidence grades mean."
          />
          <RoomHandoff
            href="/sources"
            icon="source"
            title="Source library"
            line="The publishers a public claim traces to."
          />
          <RoomHandoff
            href="/data"
            icon="data"
            title="Data"
            line="National series with their sources attached."
          />
        </div>
      </RoomSection>
    </>
  );
}
