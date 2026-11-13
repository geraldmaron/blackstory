/**
 * The register's one toolbar row: a FilterButton per facet, the Sort button and List | Timeline.
 *
 * No JavaScript. Every menu is a native `popover` opened by its button through `popovertarget`,
 * so it light-dismisses, closes on Escape and sits in the top layer by itself, and every value in
 * it is a GET link. On wide screens a menu drops from its button; below 64rem the six buttons and
 * Sort fold into one sticky Filters button whose bottom sheet lists them, and each menu opens as
 * its own sheet over it.
 */
import React from 'react';
import { FilterButton, Segmented, buttonClassName } from '@repo/ui';

void React;

export type ToolbarOption = {
  readonly id: string;
  readonly label: string;
  /** Absent for Sort, whose options are orders rather than subsets. */
  readonly count?: number;
  readonly href: string;
  readonly current: boolean;
  readonly nofollow?: boolean;
};

export type ToolbarMenu = {
  readonly key: string;
  readonly title: string;
  /** What the menu is set to, for the phone sheet row ("Any" when unset). */
  readonly value: string;
  /** Values set on this filter, for the button's badge. Sort has none. */
  readonly active: number;
  readonly options: readonly ToolbarOption[];
  /** Lifts this one filter; absent when it is not set. */
  readonly clearHref?: string;
};

export type RecordsToolbarProps = {
  readonly filters: readonly ToolbarMenu[];
  readonly sort: ToolbarMenu;
  readonly view: {
    readonly value: string;
    readonly listHref: string;
    readonly timelineHref: string;
  };
  readonly activeCount: number;
  readonly clearAllHref?: string;
  /** The sheet's one primary action, which closes it onto the list: "Show 21 records". */
  readonly showLabel: string;
};

const menuId = (key: string) => `records-menu-${key}`;
const SHEET_ID = 'records-filters';

function CheckGlyph() {
  return (
    <svg className="ds-records-menu__check" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="m3.5 8.5 3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SortGlyph() {
  return (
    <svg className="ds-records-toolbar__glyph" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M5 3v10m0 0-2.5-2.5M5 13l2.5-2.5M11 13V3m0 0L8.5 5.5M11 3l2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FiltersGlyph() {
  return (
    <svg className="ds-records-toolbar__glyph" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2.5 4.5h11M4.5 8h7M6.5 11.5h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronGlyph() {
  return (
    <svg className="ds-records-sheet__chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="m6 3.5 4.5 4.5L6 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Menu({ menu }: { readonly menu: ToolbarMenu }) {
  const id = menuId(menu.key);
  return (
    <div
      className="ds-records-menu"
      id={id}
      popover="auto"
      data-key={menu.key}
      role="dialog"
      aria-labelledby={`${id}-title`}
    >
      <div className="ds-records-menu__head">
        <h2 className="ds-records-menu__title" id={`${id}-title`}>
          {menu.title}
        </h2>
        {menu.clearHref === undefined ? null : (
          <a className="ds-records-menu__clear" href={menu.clearHref}>
            Clear
          </a>
        )}
        <button
          className="ds-records-menu__close"
          type="button"
          popoverTarget={id}
          popoverTargetAction="hide"
        >
          Close
        </button>
      </div>
      {menu.options.length === 0 ? (
        <p className="ds-records-menu__empty">No {menu.title.toLowerCase()} to narrow by here.</p>
      ) : null}
      <ul className="ds-records-menu__list">
        {menu.options.map((option) => (
          <li key={option.id}>
            <a
              className="ds-records-menu__option"
              href={option.href}
              rel={option.nofollow ? 'nofollow' : undefined}
              aria-current={option.current ? 'true' : undefined}
            >
              {option.current ? <CheckGlyph /> : <span className="ds-records-menu__check" />}
              <span className="ds-records-menu__label">{option.label}</span>
              {option.count === undefined ? null : (
                <span className="ds-records-menu__count">
                  {option.count.toLocaleString('en-US')}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RecordsToolbar({
  filters,
  sort,
  view,
  activeCount,
  clearAllHref,
  showLabel,
}: RecordsToolbarProps) {
  return (
    <div className="ds-records-toolbar">
      <div className="ds-records-toolbar__inner">
        <div className="ds-records-toolbar__facets" role="group" aria-label="Filter records">
          {filters.map((menu) => (
            <FilterButton
              key={menu.key}
              className="ds-records-toolbar__facet"
              data-key={menu.key}
              popoverTarget={menuId(menu.key)}
              count={menu.active}
            >
              {menu.title}
            </FilterButton>
          ))}
        </div>

        <FilterButton
          className="ds-records-toolbar__sheet-button"
          popoverTarget={SHEET_ID}
          count={activeCount}
        >
          <FiltersGlyph />
          Filters
        </FilterButton>

        <div className="ds-records-toolbar__end">
          <FilterButton
            className="ds-records-toolbar__facet ds-records-toolbar__sort"
            data-key={sort.key}
            popoverTarget={menuId(sort.key)}
            aria-label={`Sort: ${sort.value}`}
          >
            <SortGlyph />
            {sort.value}
          </FilterButton>
          <Segmented
            label="Show records as"
            value={view.value}
            options={[
              { value: 'list', label: 'List', href: view.listHref },
              { value: 'timeline', label: 'Timeline', href: view.timelineHref },
            ]}
          />
        </div>
      </div>

      {/* The phone and tablet sheet: one row per menu, each opening that menu over the sheet. */}
      <div
        className="ds-records-sheet"
        id={SHEET_ID}
        popover="auto"
        role="dialog"
        aria-labelledby={`${SHEET_ID}-title`}
      >
        <div className="ds-records-menu__head">
          <h2 className="ds-records-menu__title" id={`${SHEET_ID}-title`}>
            Filters
          </h2>
          {clearAllHref === undefined ? null : (
            <a className="ds-records-menu__clear" href={clearAllHref}>
              Clear all
            </a>
          )}
        </div>
        <ul className="ds-records-sheet__list">
          {[sort, ...filters].map((menu) => (
            <li key={menu.key}>
              <button
                className="ds-records-sheet__row"
                type="button"
                popoverTarget={menuId(menu.key)}
              >
                <span className="ds-records-sheet__name">{menu.title}</span>
                <span className="ds-records-sheet__value">{menu.value}</span>
                <ChevronGlyph />
              </button>
            </li>
          ))}
        </ul>
        {/* Within thumb reach: every choice above is already applied, so this only closes. */}
        <div className="ds-records-sheet__foot">
          <button
            className={buttonClassName('primary', 'ds-records-sheet__show')}
            type="button"
            popoverTarget={SHEET_ID}
            popoverTargetAction="hide"
          >
            {showLabel}
          </button>
        </div>
      </div>

      {[...filters, sort].map((menu) => (
        <Menu key={menu.key} menu={menu} />
      ))}
    </div>
  );
}
