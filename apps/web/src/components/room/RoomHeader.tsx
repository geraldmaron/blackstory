/**
 * RoomHeader — the one header every room in every surface class renders, and the only one.
 *
 * Breadcrumb chain, mono kicker, display title, serif lede, meta row of mono facts. Twelve
 * `*-panel-chrome.ts` modules existed because each route drew this itself; the parity gate
 * (repo-92n2.31) asserts no room renders a second header.
 */

import React from 'react';
import type { ReactNode } from 'react';
import { cx } from '@repo/ui';
import { Breadcrumb } from './Breadcrumb';

void React;

export type RoomHeaderProps = {
  /** Route of this room; drives the breadcrumb chain and the mono path fact. */
  readonly pathname: string;
  /** Final breadcrumb step. Defaults to the registry label for `pathname`. */
  readonly crumbLabel?: string;
  /** Mono caps register above the title — the room's kind, not a restatement of the title. */
  readonly kicker?: string;
  /** The display title. `<em>` inside renders in the editorial italic accent. */
  readonly title: ReactNode;
  /** One serif sentence saying what this room is for. */
  readonly lede?: ReactNode;
  /** Mono facts: counts, dates, coverage. Rendered dot-separated. */
  readonly meta?: readonly string[];
  /** Show the route itself as the last mono fact. On by default: readers cite URLs. */
  readonly showPath?: boolean;
  readonly className?: string;
};

export function RoomHeader({
  pathname,
  crumbLabel,
  kicker,
  title,
  lede,
  meta,
  showPath = true,
  className,
}: RoomHeaderProps) {
  const facts = meta ?? [];
  const hasMeta = facts.length > 0 || showPath;

  return (
    <header className={cx('ds-room-header', className)}>
      <Breadcrumb pathname={pathname} hereLabel={crumbLabel} />
      {kicker ? <span className="ds-room-header__kicker">{kicker}</span> : null}
      <h1 className="ds-room-header__title">{title}</h1>
      {lede ? <p className="ds-room-header__lede">{lede}</p> : null}
      {hasMeta ? (
        <div className="ds-room-header__meta">
          {facts.map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
          {showPath ? <span className="ds-room-header__path">{pathname}</span> : null}
        </div>
      ) : null}
    </header>
  );
}
