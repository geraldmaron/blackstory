/**
 * Breadcrumb — <parent chain> / here, every step above the last a real link.
 *
 * The Atlas root is resolved but not rendered; see `resolveTrail`.
 *
 * The chain is resolved from `room-trail.ts`, not passed in per page. A room supplies only
 * the label of the step it is, because a record's title is data.
 */

import React from 'react';
import Link from 'next/link';
import { cx } from '@repo/ui';
import { resolveTrail, type RoomCrumb } from './room-trail';

void React;

export type BreadcrumbProps = {
  /** The route this room is at. Resolves the whole chain above it. */
  readonly pathname: string;
  /** Label for the final step. Defaults to the registry label for `pathname`. */
  readonly hereLabel?: string | undefined;
  readonly className?: string | undefined;
};

export function Breadcrumb({ pathname, hereLabel, className }: BreadcrumbProps) {
  const trail: readonly RoomCrumb[] = resolveTrail(pathname, hereLabel);

  /*
   * A chain of one is not a chain. On a top-level room the only crumb is the room itself, so the
   * nav printed the title twice — once in mono caps directly above the display title it repeats.
   * A breadcrumb earns its line by saying where you came from; with nothing above it, it says
   * nothing the <h1> two lines down does not.
   */
  if (trail.length < 2) {
    return null;
  }

  return (
    <nav className={cx('ds-room-crumb', className)} aria-label="Breadcrumb">
      {trail.map((crumb, index) => (
        <span key={`${crumb.href ?? 'here'}-${crumb.label}`} style={{ display: 'contents' }}>
          {index > 0 ? (
            <span className="ds-room-crumb__sep" aria-hidden="true">
              /
            </span>
          ) : null}
          {crumb.href ? (
            <Link className="ds-room-crumb__link" href={crumb.href}>
              {crumb.label}
            </Link>
          ) : (
            <span className="ds-room-crumb__here" aria-current="page">
              {crumb.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
