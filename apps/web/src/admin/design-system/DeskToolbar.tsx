'use client';
/**
 * The one search, filter and sort control every desk shares.
 *
 * A plain GET form, so a view is a URL: bookmarkable, shareable, back-button safe, and working
 * before hydration. Selects submit on change; Enter submits the search. Filter and sort options
 * are native `<select>`s: lighter than a Base Web Select, keyboard and screen-reader complete, and
 * they post their own value, so no hidden-input bridge is needed.
 *
 * `preserved` carries every param the controls do not own (facets, page size) so using one control
 * never silently drops another. Page is deliberately not carried: any change returns to page 1.
 */
import { useRef, type ReactNode } from 'react';

export type SelectOption = { readonly value: string; readonly label: string };

export type ToolbarFilter = {
  readonly name: string;
  readonly label: string;
  readonly value: string;
  readonly options: readonly SelectOption[];
};

export function DeskToolbar({
  label,
  action,
  search,
  filters = [],
  sort,
  preserved = {},
  extra,
  summary,
}: {
  readonly label: string;
  readonly action: string;
  readonly search?: {
    readonly name?: string;
    readonly value: string;
    readonly placeholder: string;
  };
  readonly filters?: readonly ToolbarFilter[];
  readonly sort?: {
    readonly name?: string;
    readonly directionName?: string;
    readonly value: string;
    readonly direction: 'asc' | 'desc';
    readonly options: readonly SelectOption[];
  };
  readonly preserved?: Readonly<Record<string, string>>;
  /** Extra fields a desk owns, such as a date range. They submit with the form. */
  readonly extra?: ReactNode;
  /** "475 cases", shown at the right edge so the count is always where the eye lands. */
  readonly summary?: ReactNode;
}) {
  const form = useRef<HTMLFormElement>(null);
  const direction = useRef<HTMLInputElement>(null);
  const submit = () => form.current?.requestSubmit();
  const sortName = sort?.name ?? 'sort';
  const directionName = sort?.directionName ?? 'dir';
  const flipped = sort?.direction === 'asc' ? 'desc' : 'asc';
  // The direction rides in one hidden field, so Enter in the search box, Apply and a select change
  // all keep it; the arrow button rewrites it and submits.
  return (
    <form
      ref={form}
      className="admin-base-controls"
      method="get"
      action={action}
      role="search"
      aria-label={label}
    >
      {Object.entries(preserved).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {search ? (
        <label className="admin-base-controls__search">
          <span className="ds-visually-hidden">Search</span>
          <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14">
            <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="m10.5 10.5 3 3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="search"
            name={search.name ?? 'q'}
            defaultValue={search.value}
            placeholder={search.placeholder}
          />
        </label>
      ) : null}
      {filters.map((filter) => (
        <label key={filter.name} className="admin-base-controls__field">
          <span>{filter.label}</span>
          <select name={filter.name} defaultValue={filter.value} onChange={submit}>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      {extra}
      {sort ? (
        <div className="admin-base-controls__sort">
          {sort.options.length > 1 ? (
            <label className="admin-base-controls__field">
              <span>Sort</span>
              <select name={sortName} defaultValue={sort.value} onChange={submit}>
                {sort.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="admin-base-controls__field">
              <span>Sort</span>
              <span className="admin-base-controls__fixed">{sort.options[0]?.label}</span>
            </span>
          )}
          <input ref={direction} type="hidden" name={directionName} defaultValue={sort.direction} />
          <button
            type="button"
            className="admin-base-controls__dir"
            aria-label={`Sorted ${sort.direction === 'asc' ? 'ascending' : 'descending'}. Switch to ${
              flipped === 'asc' ? 'ascending' : 'descending'
            }`}
            title={sort.direction === 'asc' ? 'Ascending' : 'Descending'}
            onClick={() => {
              if (direction.current) direction.current.value = flipped;
              submit();
            }}
          >
            <span aria-hidden="true">{sort.direction === 'asc' ? '↑' : '↓'}</span>
          </button>
        </div>
      ) : null}
      <button type="submit" className="admin-base-controls__apply">
        Apply
      </button>
      {summary ? <p className="admin-base-controls__summary">{summary}</p> : null}
    </form>
  );
}
