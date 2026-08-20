/**
 * RailGroup — a grouping block in a Reading room's right rail.
 *
 * The rail's job is always the same across the class: take the set the room is already showing
 * and offer it back grouped a second way, as links that stay inside the room. `/records` groups
 * by era and by state; `/stories` by era and place; `/books` and `/law` by jurisdiction.
 *
 * Entries are anchors with a mono count, never buttons: a rail that needs JavaScript to regroup
 * is a rail a crawler cannot follow, and these links are a large part of how the index is
 * discovered at all.
 */

import React from 'react';
import { cx } from '@repo/ui';

void React;

export type RailEntry = {
  readonly label: string;
  readonly href: string;
  readonly count?: number;
  /** Leading decorative mark — a kind glyph on a "records cited" style rail. */
  readonly glyph?: React.ReactNode;
};

export type RailGroupProps = {
  readonly title: string;
  readonly entries: readonly RailEntry[];
  /** Caps the list and states the cap in words rather than truncating in silence. */
  readonly limit?: number;
  readonly moreHref?: string;
  readonly className?: string;
};

export function RailGroup({ title, entries, limit, moreHref, className }: RailGroupProps) {
  if (entries.length === 0) return null;
  const shown = limit === undefined ? entries : entries.slice(0, limit);
  const hidden = entries.length - shown.length;

  return (
    <section className={cx('ds-room-rail-group', className)}>
      <h2 className="ds-room-rail-group__title">{title}</h2>
      <ul className="ds-room-rail-group__list">
        {shown.map((entry) => (
          <li key={entry.href}>
            <a className="ds-room-rail-group__link" href={entry.href}>
              <span className="ds-room-rail-group__label">
                {entry.glyph === undefined ? null : (
                  <span className="ds-room-rail-group__glyph" aria-hidden="true">
                    {entry.glyph}
                  </span>
                )}
                {entry.label}
              </span>
              {entry.count === undefined ? null : (
                <span className="ds-room-num">{entry.count.toLocaleString('en-US')}</span>
              )}
            </a>
          </li>
        ))}
      </ul>
      {hidden > 0 ? (
        <p className="ds-room-rail-group__more">
          {moreHref === undefined ? (
            `${hidden.toLocaleString('en-US')} more not shown here.`
          ) : (
            <a href={moreHref}>{`See all ${entries.length.toLocaleString('en-US')}`}</a>
          )}
        </p>
      ) : null}
    </section>
  );
}
