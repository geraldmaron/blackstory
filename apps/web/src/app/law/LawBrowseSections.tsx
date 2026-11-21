/**
 * The `/law` index, Parked (design-direction-v11.md §4.1): no map, a document on the night
 * ground. The time axis is a rail pinned at the left edge, the way the home globe carries its
 * time rail; beside it the page's head, the register's toolbar and the active narrowing, then
 * one reading sheet holding the chronology, an era at a time (the year, the law's name, one
 * line on what it did, its jurisdiction as a word).
 *
 * Server-rendered and JavaScript-free: menus are the register's native popovers of GET links,
 * and rows are anchors.
 */
import React, { type CSSProperties } from 'react';
import Link from 'next/link';
import { Chip, buttonClassName } from '@repo/ui';
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
  /** The page's head (crumb, title, dek), set above the toolbar on the night ground. */
  readonly head?: React.ReactNode;
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

/** Scroll timeline name for an era's section; its bar on the rail reads the same name. */
const eraTimeline = (era: LawEra) => `--law-era-${era.id}`;

/** A stretch of the catalog this long with no entry is named on the rail. */
const RAIL_GAP_YEARS = 25;

/**
 * Stretches of at least {@link RAIL_GAP_YEARS} years in which the catalog holds no entry, as
 * inclusive year pairs. Exported for the test.
 */
export function catalogGaps(years: readonly number[]): readonly (readonly [number, number])[] {
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  return sorted.flatMap((year, index) => {
    const next = sorted[index + 1];
    return next !== undefined && next - year > RAIL_GAP_YEARS
      ? [[year + 1, next - 1] as const]
      : [];
  });
}

/**
 * The time rail: one mark per dated entry at its year, decade ticks on a hairline, a bar for
 * each era that holds entries, and the long stretches the catalog has nothing in yet, named. A
 * picture of where the laws cluster, hidden from assistive tech: the era headings and rows in the
 * sheet carry the same information and are the links. The span and the gaps are the whole
 * catalog's, so a law keeps its place and a filter never invents a silence.
 *
 * Each mark carries its position as `--at`; law.css runs the rail down the page from 64rem and
 * across it below.
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
  const pct = (span: number) => `${((span / (to - from)) * 100).toFixed(3)}%`;
  const at = (year: number) => pct(year - from);
  const ticks: number[] = [];
  for (let year = Math.ceil(from / 20) * 20; year <= to; year += 20) ticks.push(year);
  const stack = new Map<number, number>();
  const eras = view.groups.flatMap(({ era, items }) => {
    if (era.id === LAW_UNDATED.id) return [];
    // An open-ended era's bar stops at its last entry, not at the edge of the axis.
    const last = Math.max(...items.map((item) => item.effectiveYear ?? from));
    const start = Math.max(era.from ?? from, from);
    const end = Math.min((era.to ?? last) + 1, to);
    return [{ era, start, end, count: items.length }];
  });
  const place = (year: number, span?: number) =>
    ({ '--at': at(year), ...(span === undefined ? {} : { '--span': pct(span) }) }) as CSSProperties;

  return (
    <div className="ds-law-axis" aria-hidden="true">
      <div className="ds-law-axis__track">
        {eras.map(({ era, start, end }) => (
          <span
            key={era.id}
            className="ds-law-axis__band"
            style={{ ...place(start, end - start), animationTimeline: eraTimeline(era) }}
          />
        ))}
        {eras.map(({ era, start, count }) => (
          <span key={era.id} className="ds-law-axis__era" style={place(start)}>
            {era.name}
            <span className="ds-law-axis__count">{count}</span>
          </span>
        ))}
        {catalogGaps(years).map(([first, last]) => (
          <span key={first} className="ds-law-axis__gap" style={place(first, last - first + 1)}>
            No entries yet, {first} to {last}
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
                  ...place(item.effectiveYear),
                  '--law-stack': level,
                  '--law-i': index,
                } as CSSProperties
              }
            />
          );
        })}
        {ticks.map((year) => (
          <span
            key={year}
            className={
              year % 40 === 0 ? 'ds-law-axis__tick' : 'ds-law-axis__tick ds-law-axis__tick--minor'
            }
            style={place(year)}
          >
            {year}
          </span>
        ))}
      </div>
      {/* Across the page the names cannot sit beside their bars; they read as a key instead. */}
      <ul className="ds-law-axis__legend">
        {eras.map(({ era }) => (
          <li key={era.id}>{era.name}</li>
        ))}
      </ul>
    </div>
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

export function LawBrowseSections({ view, catalog, head }: LawBrowseSectionsProps) {
  const jurisdictionById = new Map(
    catalog.map((snapshot) => [snapshot.id, jurisdictionLabel(snapshot.jurisdictionId)] as const),
  );
  const jurisdictionOf = (item: LegalBrowseItem) =>
    jurisdictionById.get(item.id) ?? 'Unknown jurisdiction';
  const active = activeFilters(view);
  const facets = active.filter((filter) => filter.key !== 'q').length;

  let body: React.ReactNode;
  if (view.totalAvailable === 0) {
    body = (
      <Outcome
        ground="paper"
        title="The law catalog did not load"
        action={{ href: '/law', label: 'Try again' }}
      >
        The entries are kept, only this page failed to read them.
      </Outcome>
    );
  } else if (view.items.length === 0) {
    body = (
      <Outcome
        ground="paper"
        title="No laws match"
        action={{ href: '/law', label: 'Clear filters' }}
      >
        Nothing in the catalog matches {active.map((filter) => filter.label).join(', ')}.
      </Outcome>
    );
  } else if (view.groups.length === 0) {
    body = (
      <div className="ds-parked__sheet ds-law-sheet" data-ground="paper">
        <ol className="ds-law-list">
          {view.items.map((item) => (
            <LawRow key={item.id} item={item} jurisdiction={jurisdictionOf(item)} />
          ))}
        </ol>
      </div>
    );
  } else {
    body = (
      <div className="ds-parked__sheet ds-law-sheet" data-ground="paper">
        {view.groups.map((group) => {
          const span = eraSpan(group.era, group.items);
          return (
            <section
              key={group.era.id}
              className="ds-law-era"
              aria-labelledby={eraAnchor(group.era)}
              style={{ viewTimelineName: eraTimeline(group.era) }}
            >
              <header className="ds-law-era__mark">
                <h2 className="ds-law-era__title" id={eraAnchor(group.era)}>
                  {group.era.name}
                </h2>
                <p className="ds-law-era__count">
                  {span === null ? null : (
                    <span className="ds-law-era__span">
                      {span[0]} to {span[1]}
                    </span>
                  )}
                  <span>{lawsPhrase(group.items.length)}</span>
                </p>
              </header>
              <ol className="ds-law-list">
                {group.items.map((item) => (
                  <LawRow key={item.id} item={item} jurisdiction={jurisdictionOf(item)} />
                ))}
              </ol>
            </section>
          );
        })}
      </div>
    );
  }

  const railed =
    view.groups.length > 0 &&
    view.items.some((item) => item.effectiveYear !== undefined) &&
    catalog.some((snapshot) => snapshot.effectiveYear !== undefined);

  // The rail's bars light as their era's section crosses the window (law.css); the scope lets a
  // bar in one column read a timeline declared in the other.
  const timelines = view.groups.map((group) => eraTimeline(group.era)).join(', ');

  return (
    <div
      // Without a rail (nothing dated to place) the stage is one column.
      className={railed ? 'ds-parked ds-parked--railed ds-law-stage' : 'ds-parked ds-law-stage'}
      data-ground="ink"
      data-ground-fixed=""
      style={timelines ? ({ timelineScope: timelines } as CSSProperties) : undefined}
    >
      <div className="ds-parked__main">
        {head}
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

        {view.totalAvailable > 0 ? <LawNote className="ds-law-note" /> : null}
      </div>
    </div>
  );
}
