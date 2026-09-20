/**
 * The one find bar for every filtering room: a search field where Enter submits, primary facets
 * as chip rows that scroll sideways on a phone, the active constraints with one Clear all, and a
 * count line that carries the sort.
 *
 * On 2026-09-14 five filtering routes ran five control systems: a 40px pill field with a Go button
 * on /law and /records, a labeled 8px box with an Apply button on /stories, a typeahead beside two
 * selects on /books. This composes the four class families those routes had already half-agreed on
 * (`ds-records-find`, `ds-room-chip`, `ds-records-active`, `ds-pill-select`) so a route hands over
 * its state and gets the same bar back.
 *
 * Everything here is a link or a GET form, so it works with JavaScript off. There is no Apply
 * button: a chip is a link, a select submits itself (`AutoSubmitSelect`), and the search field
 * submits on Enter. The submit button stays in the markup, out of sight and out of the tab order,
 * because a form with more than one field does not submit on Enter without one.
 */
import React, { type ReactNode } from 'react';
import Link from 'next/link';
import { cx } from '@repo/ui';

void React;

export type FindBarChip = {
  readonly label: string;
  readonly href: string;
  readonly active: boolean;
  readonly count?: number | undefined;
  /** A short glyph after the label, such as the sort direction arrow. */
  readonly mark?: string | undefined;
};

export type FindBarChipRow = {
  /** Names the group for assistive tech: "Filter by kind". */
  readonly label: string;
  readonly chips: readonly FindBarChip[];
};

export type FindBarConstraint = {
  readonly key: string;
  readonly label: string;
  /** The same view with this one constraint removed. */
  readonly href: string;
};

export type FindBarProps = {
  /** Prefix for the ids this bar mints; `${id}-results-heading` labels the list under it. */
  readonly id: string;
  readonly action: string;
  readonly queryLabel: string;
  readonly placeholder: string;
  readonly query: string;
  /** Narrowing already in the URL, so a search refines the view instead of resetting it. */
  readonly preserved?: Readonly<Record<string, string | undefined>>;
  /** Replaces the plain field, for a route with a typeahead. It must submit `q`. */
  readonly searchSlot?: ReactNode;
  /** Fields that have to live inside the search form, such as self-submitting selects. */
  readonly formFields?: ReactNode;
  readonly rows?: readonly FindBarChipRow[];
  /** Route facet controls that are not a plain chip row, such as the /records facet menus. */
  readonly children?: ReactNode;
  readonly active?: readonly FindBarConstraint[];
  readonly clearHref: string;
  readonly sort?: readonly FindBarChip[];
  /** Omit when the list under the bar prints its own count, as `HairlineIndex` does. */
  readonly summary?: string | undefined;
  readonly className?: string;
};

const count = (value: number) => value.toLocaleString('en-US');

export function FindBar({
  id,
  action,
  queryLabel,
  placeholder,
  query,
  preserved,
  searchSlot,
  formFields,
  rows = [],
  children,
  active = [],
  clearHref,
  sort,
  summary,
  className,
}: FindBarProps) {
  const fieldId = `${id}-q`;
  return (
    <div className={cx('ds-find', className)}>
      <form
        className="ds-records-find ds-find__form"
        method="get"
        action={action}
        role="search"
        aria-label={queryLabel}
      >
        <div className="ds-records-find__row ds-find__fields">
          {searchSlot ?? (
            <>
              <label className="ds-visually-hidden" htmlFor={fieldId}>
                {queryLabel}
              </label>
              <input
                className="ds-records-find__input"
                id={fieldId}
                name="q"
                type="search"
                defaultValue={query}
                placeholder={placeholder}
                autoComplete="off"
                enterKeyHint="search"
              />
            </>
          )}
          {formFields}
          <button className="ds-visually-hidden" type="submit" tabIndex={-1} aria-hidden="true">
            Search
          </button>
        </div>
        {Object.entries(preserved ?? {}).map(([name, value]) =>
          value === undefined || value.length === 0 ? null : (
            <input key={name} type="hidden" name={name} value={value} />
          ),
        )}
      </form>

      {active.length > 0 ? (
        <div className="ds-records-active" role="group" aria-label="Active filters">
          {active.map((constraint) => (
            <Link className="ds-records-active__chip" href={constraint.href} key={constraint.key}>
              {constraint.label}
              <span className="ds-records-active__x" aria-hidden="true">
                ✕
              </span>
              <span className="ds-visually-hidden">, remove this filter</span>
            </Link>
          ))}
          <Link className="ds-records-active__clear" href={clearHref}>
            Clear all
          </Link>
        </div>
      ) : null}

      {rows.map((row) => (
        <div className="ds-find__chips" role="group" aria-label={row.label} key={row.label}>
          {row.chips.map((chip) => (
            <Link
              key={chip.href + chip.label}
              className="ds-room-chip"
              href={chip.href}
              aria-current={chip.active ? true : undefined}
            >
              {chip.label}
              {chip.count === undefined ? null : (
                <>
                  {' '}
                  <span className="ds-room-num">{count(chip.count)}</span>
                </>
              )}
            </Link>
          ))}
        </div>
      ))}

      {children}

      {summary === undefined ? null : (
        <div className="ds-find__count">
          <p className="ds-room-idx__count" id={`${id}-results-heading`} role="status">
            {summary}
          </p>
          {sort === undefined || sort.length === 0 ? null : (
            <nav className="ds-find__sort" aria-label="Sort order">
              <span className="ds-find__sort-label" aria-hidden="true">
                Sort
              </span>
              {sort.map((option) => (
                <Link
                  key={option.href + option.label}
                  className="ds-find__sort-link"
                  href={option.href}
                  aria-current={option.active ? true : undefined}
                >
                  {option.label}
                  {option.mark === undefined ? null : (
                    <span aria-hidden="true"> {option.mark}</span>
                  )}
                </Link>
              ))}
            </nav>
          )}
        </div>
      )}
    </div>
  );
}
