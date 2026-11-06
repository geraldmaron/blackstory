/**
 * Chronology: the same collection as the Records index, regrouped by documented decade.
 *
 * Each record is placed ONCE, under the earliest decade the archive documents it in WITHIN the
 * active period (the earliest known bucket when there is no range). Records with no known decade
 * sit in an explicit undated section after every dated one. A decade is an archive bucket, not an
 * event year, and the copy says so.
 *
 * Coverage is reported as the decades that actually hold records (`1880s and 2000s`), never as a
 * continuous `1880 to 2000` span: sparse buckets stay sparse and nothing is invented between them.
 *
 * Order is dated decades ascending, then undated; inside a group the collection's own sort
 * applies, with the record id as the last tie-break so the order is stable. Previous/next on a
 * record page follows this displayed order (`chronologyOrder`), and paging slices it as the index
 * slices its rows.
 */
import { comparatorFor, type CollectionFacts } from '../records/records-matching';
import type { RecordsQuery } from '../records/records-query';
import { decadeLabel, decadesWithinPeriod } from './collection-period';

export type ChronologyEntry<T extends CollectionFacts> = {
  readonly facts: T;
  /** Earliest documented decade within the active period, or `null` when none is known. */
  readonly decade: number | null;
};

export function chronologyOrder<T extends CollectionFacts>(
  matched: readonly T[],
  query: RecordsQuery,
): readonly ChronologyEntry<T>[] {
  const period = {
    start: query.periodStart,
    end: query.periodEnd,
    includeUndated: query.includeUndated,
  };
  const compare = comparatorFor(query.sort);
  return matched
    .map((facts): ChronologyEntry<T> => ({
      facts,
      decade: decadesWithinPeriod(facts.eraBuckets, period)[0] ?? null,
    }))
    .sort((a, b) => {
      if (a.decade !== b.decade) {
        if (a.decade === null) return 1;
        if (b.decade === null) return -1;
        return a.decade - b.decade;
      }
      return compare(a.facts, b.facts) || a.facts.row.id.localeCompare(b.facts.row.id);
    });
}

export type ChronologySection<R> = {
  readonly decade: number | null;
  readonly label: string;
  /** Records in this group across every page. */
  readonly total: number;
  /** Records of this group on the current page. */
  readonly shown: number;
  /** The page opens partway through this group (it began on an earlier page). */
  readonly continued: boolean;
  readonly rows: readonly R[];
};

export type ChronologyPage<R> = {
  readonly sections: readonly ChronologySection<R>[];
  /** Decades that hold records, with the 1-based page each one starts on. */
  readonly coverage: readonly {
    readonly decade: number;
    readonly count: number;
    readonly page: number;
  }[];
  readonly undatedCount: number;
  /** The page the undated section starts on; `null` when every record has a decade. */
  readonly undatedPage: number | null;
  readonly coverageLabel: string;
};

function joinDecades(labels: readonly string[]): string {
  if (labels.length <= 2) return labels.join(' and ');
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

/**
 * Groups one page of an already ordered chronology. `ordered` is the whole collection (for the
 * totals and coverage); `start`/`end` slice the page; `toRow` builds the display row.
 */
export function buildChronologyPage<T extends CollectionFacts, R>(
  ordered: readonly ChronologyEntry<T>[],
  start: number,
  end: number,
  toRow: (facts: T) => R,
): ChronologyPage<R> {
  const totals = new Map<number | null, number>();
  const firstIndex = new Map<number | null, number>();
  ordered.forEach((entry, index) => {
    totals.set(entry.decade, (totals.get(entry.decade) ?? 0) + 1);
    if (!firstIndex.has(entry.decade)) firstIndex.set(entry.decade, index);
  });
  const pageSize = Math.max(1, end - start);
  const pageOf = (decade: number | null) =>
    Math.floor((firstIndex.get(decade) ?? 0) / pageSize) + 1;

  const sections: {
    decade: number | null;
    shown: number;
    continued: boolean;
    rows: R[];
  }[] = [];
  ordered.slice(start, end).forEach((entry, offset) => {
    const last = sections[sections.length - 1];
    if (last && last.decade === entry.decade) {
      last.rows.push(toRow(entry.facts));
      last.shown += 1;
      return;
    }
    const before = ordered[start + offset - 1];
    sections.push({
      decade: entry.decade,
      shown: 1,
      continued: offset === 0 && before !== undefined && before.decade === entry.decade,
      rows: [toRow(entry.facts)],
    });
  });

  const coverage = [...totals.entries()]
    .flatMap(([decade, count]) =>
      decade === null ? [] : [{ decade, count, page: pageOf(decade) }],
    )
    .sort((a, b) => a.decade - b.decade);
  const undatedCount = totals.get(null) ?? 0;

  return {
    sections: sections.map((section) => ({
      decade: section.decade,
      label:
        section.decade === null
          ? 'No documented decade'
          : `Documented in the ${decadeLabel(section.decade)}`,
      total: totals.get(section.decade) ?? section.shown,
      shown: section.shown,
      continued: section.continued,
      rows: section.rows,
    })),
    coverage,
    undatedCount,
    undatedPage: undatedCount > 0 ? pageOf(null) : null,
    coverageLabel:
      coverage.length === 0
        ? 'No record in this collection has a documented decade.'
        : `Groups by earliest documented decade: ${joinDecades(coverage.map((item) => decadeLabel(item.decade)))}.`,
  };
}
