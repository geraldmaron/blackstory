/**
 * Collection period controls: a native GET form that bounds a collection by stored decade.
 *
 * The bounds are archive decade buckets (`1880s`), not event dates, and the copy says so. The
 * options are the decades the collection actually documents, so a sparse collection shows a
 * sparse list rather than an invented continuous span. A bound already in the address that the
 * collection has no records for stays selectable so it can be read and changed.
 *
 * It renders its own `<form>` and must sit beside, not inside, another form. Every other public
 * param rides along as a hidden field (`preserved`), so applying a range never overwrites the
 * search, facets, sort, collection or layout. Full navigation is the intended behavior: it works
 * without JavaScript and from both Records and the map.
 */
import React from 'react';
import { cx } from '@repo/ui';
import { decadeLabel } from '../../lib/discovery/collection-period';
import './collection-period-controls.css';

void React;

export type CollectionPeriodControlsProps = {
  /** `/records` or `/explore`. */
  readonly action: string;
  /** Every other param to keep, already normalized by the caller. */
  readonly preserved: Readonly<Record<string, string>>;
  readonly decades: readonly { readonly decade: number; readonly count: number }[];
  /** Current bounds: `''`, a decade start, or `invalid`. */
  readonly start: string;
  readonly end: string;
  readonly includeUndated: boolean;
  readonly clearHref: string;
  /** Records without a documented decade that the active range leaves out. */
  readonly undatedExcluded?: number;
  readonly className?: string;
};

type Option = { readonly value: string; readonly label: string };

function optionsFor(
  decades: CollectionPeriodControlsProps['decades'],
  selected: string,
): readonly Option[] {
  const known = decades.map(({ decade, count }) => ({
    value: String(decade),
    label: `${decadeLabel(decade)} (${count.toLocaleString('en-US')})`,
  }));
  const selectedNumber = Number(selected);
  const listed = known.some((option) => option.value === selected);
  const extra =
    selected !== '' && selected !== 'invalid' && !listed && Number.isFinite(selectedNumber)
      ? [{ value: selected, label: `${decadeLabel(selectedNumber)} (none documented)` }]
      : [];
  return [...extra, ...known].sort((a, b) => Number(a.value) - Number(b.value));
}

export function CollectionPeriodControls({
  action,
  preserved,
  decades,
  start,
  end,
  includeUndated,
  clearHref,
  undatedExcluded = 0,
  className,
}: CollectionPeriodControlsProps) {
  const active = start !== '' || end !== '';
  const invalid = start === 'invalid' || end === 'invalid';
  const startOptions = optionsFor(decades, start);
  const endOptions = optionsFor(decades, end);

  return (
    <form
      className={cx('ds-period', className)}
      action={action}
      method="get"
      aria-label="Limit by documented decade"
    >
      {Object.entries(preserved).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <p className="ds-period__title">Documented decade</p>
      <div className="ds-period__fields">
        <label className="ds-period__field">
          <span className="ds-period__label">From</span>
          <select
            className="ds-period__select"
            name="periodStart"
            defaultValue={start === 'invalid' ? '' : start}
          >
            <option value="">Earliest</option>
            {startOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="ds-period__field">
          <span className="ds-period__label">Through</span>
          <select
            className="ds-period__select"
            name="periodEnd"
            defaultValue={end === 'invalid' ? '' : end}
          >
            <option value="">Latest</option>
            {endOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="ds-period__check">
          <input
            type="checkbox"
            name="includeUndated"
            value="1"
            defaultChecked={!active || includeUndated}
          />
          <span>Include records with no documented decade</span>
        </label>
        <div className="ds-period__actions">
          <button className="ds-cta ds-cta--quiet ds-cta--sm ds-period__apply" type="submit">
            Apply
          </button>
          {active ? (
            <a className="ds-period__clear" href={clearHref}>
              Clear range
            </a>
          ) : null}
        </div>
      </div>
      <p className="ds-period__note">
        Decades are the archive&apos;s documented buckets, not exact event dates. Bounds are
        inclusive. Without bounds, undated records stay included. Options count the collection
        before other filters; a record can occur in several decades.
      </p>
      {invalid ? (
        <p className="ds-period__note ds-period__note--error" role="status">
          The range in the address was not a decade the archive uses, so no records are shown.
          Choose a decade or clear the range.
        </p>
      ) : null}
      {active && !invalid && !includeUndated && undatedExcluded > 0 ? (
        <p className="ds-period__note" role="status">
          {undatedExcluded.toLocaleString('en-US')}{' '}
          {undatedExcluded === 1 ? 'record has' : 'records have'} no documented decade and{' '}
          {undatedExcluded === 1 ? 'is' : 'are'} left out of this range.
        </p>
      ) : null}
    </form>
  );
}
