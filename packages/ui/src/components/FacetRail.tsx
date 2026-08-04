/**
 * Faceted filter rail with live counts.
 *
 * Every facet value is a link, so the rail works before hydration and each filtered view has its
 * own URL. Counts come from the server computed under the other active filters, which is what
 * makes them trustworthy: a count of 0 means switching to that value really would empty the
 * table, so dead ends are visible before they are clicked.
 */

import React, { type ReactNode } from 'react';
import { cx } from '../utils/cx.js';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;

export type FacetOption = {
  readonly value: string;
  readonly label: string;
  readonly count: number;
  readonly href: string;
  readonly active: boolean;
};

export type FacetGroup = {
  readonly id: string;
  readonly label: string;
  readonly options: readonly FacetOption[];
  /** Groups past this many options collapse behind a native disclosure. */
  readonly collapseAfter?: number;
};

export type FacetRailProps = {
  readonly groups: readonly FacetGroup[];
  readonly clearHref?: string;
  readonly hasActiveFilters?: boolean;
  readonly footer?: ReactNode;
  readonly className?: string;
};

function FacetOptionRow({ option }: { readonly option: FacetOption }) {
  return (
    <li>
      <a
        className={cx('ds-facet__option', option.active && 'ds-facet__option--active')}
        href={option.href}
        aria-pressed={option.active}
      >
        <span className="ds-facet__option-label">{option.label}</span>
        <span className="ds-facet__option-count ds-mono">{option.count.toLocaleString()}</span>
      </a>
    </li>
  );
}

export function FacetRail({
  groups,
  clearHref,
  hasActiveFilters = false,
  footer,
  className,
}: FacetRailProps) {
  return (
    <aside className={cx('ds-facet-rail', className)} aria-label="Filters">
      <div className="ds-facet-rail__header">
        <h2 className="ds-facet-rail__title">Filters</h2>
        {hasActiveFilters && clearHref ? (
          <a className="ds-facet-rail__clear" href={clearHref}>
            Clear all
          </a>
        ) : null}
      </div>

      {groups.map((group) => {
        const limit = group.collapseAfter ?? 8;
        const visible = group.options.slice(0, limit);
        const overflow = group.options.slice(limit);
        return (
          <section className="ds-facet" key={group.id} aria-labelledby={`facet-${group.id}`}>
            <h3 className="ds-facet__title" id={`facet-${group.id}`}>
              {group.label}
            </h3>
            {group.options.length === 0 ? (
              <p className="ds-facet__empty">No values in this result set.</p>
            ) : (
              <>
                <ul className="ds-facet__options">
                  {visible.map((option) => (
                    <FacetOptionRow key={option.value} option={option} />
                  ))}
                </ul>
                {overflow.length > 0 ? (
                  <details className="ds-facet__more">
                    <summary>{overflow.length} more</summary>
                    <ul className="ds-facet__options">
                      {overflow.map((option) => (
                        <FacetOptionRow key={option.value} option={option} />
                      ))}
                    </ul>
                  </details>
                ) : null}
              </>
            )}
          </section>
        );
      })}

      {footer ? <div className="ds-facet-rail__footer">{footer}</div> : null}
    </aside>
  );
}
