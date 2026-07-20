/**
 * Shared source/citation display for data surfaces. Pattern (owner 2026-07-18):
 *  - When every figure in a group shares the same source(s), render one group footer.
 *  - When a figure carries a unique extra source, render a compact inline citation
 *    under that figure only — never repeat a full SOURCE box for the same link.
 * Dedupes by URL (falling back to label). Pluralizes "Source" / "Sources".
 * Machine source ids (kebab ingest keys) are shown as reader-facing publisher names.
 */
import React from 'react';
import { cx } from '@repo/ui';

void React;

export type DataSourceRef = {
  readonly label: string;
  readonly url: string;
};

/**
 * Map persisted ingest source ids to citation text humans can recognize.
 * Prose labels (anything with a space) pass through unchanged.
 */
export function humanSourceLabel(label: string): string {
  const id = label.trim();
  if (!id || /\s/.test(id)) return id;

  if (id.startsWith('us-census-acs') || id === 'acs') {
    return 'U.S. Census Bureau, American Community Survey';
  }
  if (
    id.startsWith('us-census-decennial') ||
    id.startsWith('us-census-historical') ||
    id === 'census'
  ) {
    return 'U.S. Census Bureau, Decennial Census';
  }
  if (id.includes('fbi-ucr') && id.includes('hate')) {
    return 'FBI Hate Crime Statistics';
  }
  if (id.includes('fbi-ucr')) {
    return 'FBI Uniform Crime Reporting';
  }
  if (id.includes('opportunity')) {
    return 'Opportunity Insights, Opportunity Atlas';
  }
  if (id.includes('twps') || id.includes('working-paper-56')) {
    return 'U.S. Census Bureau, Working Paper 56';
  }
  return id;
}

export function sourceKey(source: DataSourceRef): string {
  const url = source.url.trim().toLowerCase();
  if (url.length > 0) return `url:${url}`;
  return `label:${source.label.trim().toLowerCase()}`;
}

export function dedupeSources(sources: readonly DataSourceRef[]): readonly DataSourceRef[] {
  const seen = new Set<string>();
  const out: DataSourceRef[] = [];
  for (const source of sources) {
    const key = sourceKey(source);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(source);
  }
  return out;
}

/** True when two source lists cite the same set (order-independent). */
export function sourcesEqual(
  left: readonly DataSourceRef[],
  right: readonly DataSourceRef[],
): boolean {
  if (left.length !== right.length) return false;
  const rightKeys = new Set(right.map(sourceKey));
  return left.every((source) => rightKeys.has(sourceKey(source)));
}

/**
 * Partition strip sources: hoist shared sources to a group footer; keep only
 * unique extras under individual figures.
 */
export function partitionStripSources(input: {
  readonly groupSources?: readonly DataSourceRef[];
  readonly itemSources: readonly (readonly DataSourceRef[] | undefined)[];
}): {
  readonly groupSources: readonly DataSourceRef[];
  readonly itemExtras: readonly (readonly DataSourceRef[])[];
} {
  const explicitGroup = dedupeSources(input.groupSources ?? []);
  const normalizedItems = input.itemSources.map((sources) => dedupeSources(sources ?? []));

  if (explicitGroup.length > 0) {
    const groupKeys = new Set(explicitGroup.map(sourceKey));
    return {
      groupSources: explicitGroup,
      itemExtras: normalizedItems.map((sources) =>
        sources.filter((source) => !groupKeys.has(sourceKey(source))),
      ),
    };
  }

  const nonEmpty = normalizedItems.filter((sources) => sources.length > 0);
  if (nonEmpty.length > 0 && nonEmpty.length === normalizedItems.length) {
    const [first, ...rest] = nonEmpty;
    if (first && rest.every((sources) => sourcesEqual(first, sources))) {
      return {
        groupSources: first,
        itemExtras: normalizedItems.map(() => []),
      };
    }
  }

  return {
    groupSources: [],
    itemExtras: normalizedItems,
  };
}

export type SourceFootnoteProps = {
  readonly sources: readonly DataSourceRef[];
  /** `group` = strip/section footer; `compact` = under a single figure. */
  readonly density?: 'group' | 'compact';
  readonly className?: string;
};

export function SourceFootnote({ sources, density = 'group', className }: SourceFootnoteProps) {
  const unique = dedupeSources(sources);
  if (unique.length === 0) return null;

  const label = unique.length === 1 ? 'Source' : 'Sources';
  return (
    <aside
      className={cx(
        'ds-citation',
        density === 'compact' ? 'ds-citation--compact' : 'ds-citation--group',
        className,
      )}
      aria-label={label}
    >
      <span className="ds-citation__label">{label}</span>
      {unique.length === 1 ? (
        <a href={unique[0]!.url} target="_blank" rel="noreferrer noopener">
          {humanSourceLabel(unique[0]!.label)}
        </a>
      ) : (
        <ul className="ds-citation__list">
          {unique.map((source) => (
            <li key={sourceKey(source)}>
              <a href={source.url} target="_blank" rel="noreferrer noopener">
                {humanSourceLabel(source.label)}
              </a>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
