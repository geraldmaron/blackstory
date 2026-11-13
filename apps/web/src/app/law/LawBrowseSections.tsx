/**
 * The `/law` index body: the register's toolbar, the active narrowing as removable chips, the
 * time axis drawn large on a sand band, then the chronology: each era a full-bleed color block
 * with its span as a display numeral beside a paper sheet of rows (the year, the law's name,
 * one line on what it did, its jurisdiction as a word).
 *
 * Server-rendered and JavaScript-free: menus are the register's native popovers of GET links,
 * and rows are anchors.
 */
import React from 'react';
import Link from 'next/link';
import { Block, Chip, DisplayNumeral, Sheet, buttonClassName } from '@repo/ui';
import { US_STATES } from '@repo/domain';
import {
  humanizeLegalKind,
  humanizeLegalTopic,
  isLawStatus,
  legalStatusDisplay,
} from '../../components/legal/format';
import { RecordsToolbar, type ToolbarMenu } from '../records/RecordsToolbar';
import { Outcome } from '../records/RecordsIndex';
import type { LegalSnapshotDocument } from '../../lib/legal/public-source';
import {
  LAW_UNDATED,
  lawBrowseHref,
  type LawBrowseViewModel,
  type LawEra,
  type LawFacetOption,
  type LegalBrowseItem,
  type RawLawBrowseParams,
} from './law-view-model';

void React;

export type LawBrowseSectionsProps = {
  readonly view: LawBrowseViewModel;
  /** Full, unfiltered catalog: the source of each row's jurisdiction. */
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

type FacetKey = 'kind' | 'topic' | 'status';

const FACETS: readonly {
  readonly key: FacetKey;
  readonly title: string;
  readonly label: (value: string) => string;
  readonly options: (view: LawBrowseViewModel) => readonly LawFacetOption[];
}[] = [
  { key: 'kind', title: 'Kind', label: humanizeLegalKind, options: (view) => view.kindOptions },
  { key: 'topic', title: 'Topic', label: humanizeLegalTopic, options: (view) => view.topicOptions },
  {
    key: 'status',
    title: 'Status',
    label: (value) => (isLawStatus(value) ? legalStatusDisplay(value) : value),
    options: (view) => view.statusOptions,
  },
];

function currentParams(view: LawBrowseViewModel): RawLawBrowseParams {
  return { q: view.q, kind: view.kind, topic: view.topic, status: view.status, sort: view.sort };
}

function facetMenus(view: LawBrowseViewModel): ToolbarMenu[] {
  const params = currentParams(view);
  return FACETS.map((facet) => {
    const current = view[facet.key];
    const set = current !== 'all';
    return {
      key: facet.key,
      title: facet.title,
      value: set ? facet.label(current) : 'Any',
      active: set ? 1 : 0,
      options: facet.options(view).map((option) => ({
        id: option.value,
        label: facet.label(option.value),
        count: option.count,
        href: lawBrowseHref({ ...params, [facet.key]: option.value }),
        current: option.value === current,
      })),
      ...(set ? { clearHref: lawBrowseHref({ ...params, [facet.key]: 'all' }) } : {}),
    };
  });
}

function sortMenu(view: LawBrowseViewModel): ToolbarMenu {
  const params = currentParams(view);
  return {
    key: 'sort',
    title: 'Sort',
    value: view.sortOptions.find((option) => option.value === view.sort)?.label ?? 'Oldest first',
    active: 0,
    options: view.sortOptions.map((option) => ({
      id: option.value,
      label: option.label,
      href: lawBrowseHref({ ...params, sort: option.value }),
      current: option.value === view.sort,
    })),
  };
}

type ActiveFilter = { readonly key: string; readonly label: string; readonly href: string };

function activeFilters(view: LawBrowseViewModel): ActiveFilter[] {
  const params = currentParams(view);
  const active: ActiveFilter[] = [];
  const q = view.q.trim();
  // The header search lands on /records; a `q` here comes from an older link, and still narrows.
  if (q) active.push({ key: 'q', label: `“${q}”`, href: lawBrowseHref({ ...params, q: '' }) });
  for (const facet of FACETS) {
    const value = view[facet.key];
    if (value !== 'all') {
      active.push({
        key: facet.key,
        label: facet.label(value),
        href: lawBrowseHref({ ...params, [facet.key]: 'all' }),
      });
    }
  }
  return active;
}

function lawsPhrase(count: number): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? 'law' : 'laws'}`;
}

const eraAnchor = (era: LawEra) => `era-${era.id}`;

/** The era's first and last year, or null when it has no closed span to print. */
function eraSpan(era: LawEra, items: readonly LegalBrowseItem[]): readonly [number, number] | null {
  if (era.id === LAW_UNDATED.id) return null;
  if (era.from !== undefined && era.to !== undefined) return [era.from, era.to];
  if (era.from === undefined) return null;
  const years = items.flatMap((item) => (item.effectiveYear ? [item.effectiveYear] : []));
  return [era.from, Math.max(...years)];
}

/**
 * Era blocks alternate ink and copper down the page, counted from the last, which is always ink:
 * the copper footer follows it, and two copper blocks in a row would read as one.
 */
const eraTone = (index: number, count: number) =>
  (count - 1 - index) % 2 === 0 ? 'ink' : 'copper';

/**
 * The time axis: one mark per dated entry at its year, decade ticks under a hairline, and a band
 * under each era that holds entries. A picture of where the laws cluster, hidden from assistive
 * tech: the era headings and rows below carry the same information and are the links. The span
 * is the whole catalog's, so a law keeps its place on the axis whatever the filters.
 */
function TimeAxis({
  view,
  catalog,
}: {
  readonly view: LawBrowseViewModel;
  readonly catalog: readonly LegalSnapshotDocument[];
}) {
  const dated = view.items.filter(
    (item): item is LegalBrowseItem & { effectiveYear: number } => item.effectiveYear !== undefined,
  );
  const years = catalog.flatMap((snapshot) =>
    snapshot.effectiveYear ? [snapshot.effectiveYear] : [],
  );
  if (dated.length === 0 || view.groups.length === 0 || years.length === 0) return null;
  const from = Math.floor((Math.min(...years) - 1) / 10) * 10;
  const to = Math.ceil((Math.max(...years) + 1) / 10) * 10;
  const at = (year: number) => `${(((year - from) / (to - from)) * 100).toFixed(3)}%`;
  const ticks: number[] = [];
  for (let year = Math.ceil(from / 20) * 20; year <= to; year += 20) ticks.push(year);
  const stack = new Map<number, number>();
  // Each era's bar takes the tone of its block below, with a 2px gap between neighbors.
  const eras = view.groups.flatMap(({ era, items }, index) => {
    if (era.id === LAW_UNDATED.id) return [];
    // An open-ended era's band stops at its last entry, not at the edge of the axis.
    const last = Math.max(...items.map((item) => item.effectiveYear ?? from));
    const start = Math.max(era.from ?? from, from);
    const end = Math.min((era.to ?? last) + 1, to);
    return [{ era, tone: eraTone(index, view.groups.length), start, end }];
  });

  return (
    <Block tone="sand" className="ds-law-axis-band">
      <div className="ds-wrap">
        <div className="ds-law-axis" aria-hidden="true">
          <div className="ds-law-axis__track">
            {eras.map(({ era, tone, start, end }) => (
              <span
                key={era.id}
                className="ds-law-axis__band"
                data-tone={tone}
                style={{ left: at(start), width: `calc(${at(from + end - start)} - 2px)` }}
              />
            ))}
            {eras.map(({ era, start }, index) => (
              <span
                key={era.id}
                className="ds-law-axis__era"
                // The name may wrap inside the room up to the next era, never over it.
                style={{
                  left: at(start),
                  maxWidth: at(from + (eras[index + 1]?.start ?? to) - start),
                }}
              >
                {era.name}
              </span>
            ))}
            {dated.map((item, index) => {
              const level = stack.get(item.effectiveYear) ?? 0;
              stack.set(item.effectiveYear, level + 1);
              return (
                <span
                  key={item.id}
                  className="ds-law-axis__mark"
                  style={
                    {
                      left: at(item.effectiveYear),
                      '--law-stack': level,
                      '--law-i': index,
                    } as React.CSSProperties
                  }
                />
              );
            })}
            {ticks.map((year) => (
              <span
                key={year}
                className={
                  year % 40 === 0
                    ? 'ds-law-axis__tick'
                    : 'ds-law-axis__tick ds-law-axis__tick--minor'
                }
                style={{ left: at(year) }}
              >
                {year}
              </span>
            ))}
          </div>
          {/* At phone width the names cannot sit under their bars; they read as a key instead. */}
          <ul className="ds-law-axis__legend">
            {eras.map(({ era, tone }) => (
              <li key={era.id} data-tone={tone}>
                {era.name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Block>
  );
}

function LawNote({ className }: { readonly className: string }) {
  return (
    <p className={className}>
      Plain-language summaries, not legal advice. A jurisdiction is the reach of the authority that
      passed a law, not a place on the map. <Link href="/methodology">How entries are checked</Link>
    </p>
  );
}

function LawRow({
  item,
  jurisdiction,
}: {
  readonly item: LegalBrowseItem;
  readonly jurisdiction: string;
}) {
  return (
    <li className="ds-law-row">
      <Link className="ds-law-row__link" href={`/law/${item.slug}`}>
        <span className="ds-law-row__year" data-unknown={item.effectiveYear ? undefined : 'true'}>
          {item.effectiveYear ? String(item.effectiveYear) : 'Year unknown'}
        </span>
        <span className="ds-law-row__name">{item.title}</span>
        <span className="ds-law-row__where">{jurisdiction}</span>
        <span className="ds-law-row__gloss">
          {item.summary ?? 'No plain-language summary yet.'}
        </span>
      </Link>
    </li>
  );
}

export function LawBrowseSections({ view, catalog }: LawBrowseSectionsProps) {
  const jurisdictionById = new Map(
    catalog.map((snapshot) => [snapshot.id, jurisdictionLabel(snapshot.jurisdictionId)] as const),
  );
  const jurisdictionOf = (item: LegalBrowseItem) =>
    jurisdictionById.get(item.id) ?? 'Unknown jurisdiction';
  const active = activeFilters(view);
  const facets = active.filter((filter) => filter.key !== 'q').length;

  const endsOnEra = view.items.length > 0 && view.groups.length > 0;
  let body: React.ReactNode;
  if (view.totalAvailable === 0) {
    body = (
      <Outcome title="The law catalog did not load" action={{ href: '/law', label: 'Try again' }}>
        The entries are kept, only this page failed to read them.
      </Outcome>
    );
  } else if (view.items.length === 0) {
    body = (
      <Outcome title="No laws match" action={{ href: '/law', label: 'Clear filters' }}>
        Nothing in the catalog matches {active.map((filter) => filter.label).join(', ')}.
      </Outcome>
    );
  } else if (view.groups.length === 0) {
    body = (
      <Sheet className="ds-law-sheet ds-law-sheet--flat">
        <ol className="ds-law-list">
          {view.items.map((item) => (
            <LawRow key={item.id} item={item} jurisdiction={jurisdictionOf(item)} />
          ))}
        </ol>
      </Sheet>
    );
  } else {
    body = view.groups.map((group, index) => {
      const span = eraSpan(group.era, group.items);
      const tone = eraTone(index, view.groups.length);
      const last = index === view.groups.length - 1;
      return (
        <Block
          key={group.era.id}
          tone={tone}
          className="ds-law-era"
          aria-labelledby={eraAnchor(group.era)}
        >
          <div className="ds-wrap ds-law-era__inner">
            <header className="ds-law-era__mark">
              <h2 className="ds-law-era__title" id={eraAnchor(group.era)}>
                {group.era.name}
              </h2>
              {span === null ? null : (
                <DisplayNumeral
                  as="p"
                  size="title"
                  tone={tone === 'ink' ? 'soft' : 'accent'}
                  className="ds-law-era__span"
                >
                  <span>{span[0]}</span>
                  <span className="ds-law-era__to"> to </span>
                  <span>{span[1]}</span>
                </DisplayNumeral>
              )}
              <p className="ds-law-era__count">{lawsPhrase(group.items.length)}</p>
            </header>
            <Sheet className="ds-law-sheet">
              <ol className="ds-law-list">
                {group.items.map((item) => (
                  <LawRow key={item.id} item={item} jurisdiction={jurisdictionOf(item)} />
                ))}
              </ol>
            </Sheet>
            {/* The closing note rides the last era, so the page meets the footer on a block. */}
            {last ? <LawNote className="ds-law-note ds-law-note--in-era" /> : null}
          </div>
        </Block>
      );
    });
  }

  return (
    <>
      <RecordsToolbar
        filters={facetMenus(view)}
        sort={sortMenu(view)}
        activeCount={facets}
        showLabel={`Show ${lawsPhrase(view.totalMatched)}`}
        {...(facets > 0 ? { clearAllHref: lawBrowseHref({ q: view.q, sort: view.sort }) } : {})}
      />

      {active.length > 0 ? (
        <div className="ds-records-active">
          <ul className="ds-records-active__chips" aria-label="Active filters">
            {active.map((filter) => (
              <li key={filter.key}>
                <Chip removable href={filter.href} label={filter.label}>
                  {filter.label}
                </Chip>
              </li>
            ))}
          </ul>
          {/* The empty state carries its own Clear filters; one control per job. */}
          {active.length > 1 && view.items.length > 0 ? (
            <a className={buttonClassName('quiet')} href="/law">
              Clear all
            </a>
          ) : null}
        </div>
      ) : null}

      <TimeAxis view={view} catalog={catalog} />

      {body}

      {view.totalAvailable > 0 && !endsOnEra ? <LawNote className="ds-law-note" /> : null}
    </>
  );
}
