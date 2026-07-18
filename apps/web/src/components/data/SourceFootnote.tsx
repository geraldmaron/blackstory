/**
 * Shared source/citation display for data surfaces. Pattern (owner 2026-07-18):
 *  - When every figure in a group shares the same source(s), render one group footer.
 *  - When a figure carries a unique extra source, render a compact inline citation
 *    under that figure only — never repeat a full SOURCE box for the same link.
 * Dedupes by URL (falling back to label). Pluralizes "Source" / "Sources".
 */
import React from 'react';
import { cx } from '@blap/ui';

void React;

export type DataSourceRef = {
  readonly label: string;
  readonly url: string;
};

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

export function SourceFootnote({
  sources,
  density = 'group',
  className,
}: SourceFootnoteProps) {
  const unique = dedupeSources(sources);
  if (unique.length === 0) return null;

  const label = unique.length === 1 ? 'Source' : 'Sources';
  return (
    <aside
      className={cx(
        'bp-citation',
        density === 'compact' ? 'bp-citation--compact' : 'bp-citation--group',
        className,
      )}
      aria-label={label}
    >
      <span className="bp-citation__label">{label}</span>
      {unique.length === 1 ? (
        <a href={unique[0]!.url} target="_blank" rel="noreferrer noopener">
          {unique[0]!.label}
        </a>
      ) : (
        <ul className="bp-citation__list">
          {unique.map((source) => (
            <li key={sourceKey(source)}>
              <a href={source.url} target="_blank" rel="noreferrer noopener">
                {source.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
