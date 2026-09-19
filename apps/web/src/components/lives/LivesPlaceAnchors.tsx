/**
 * Place anchors for a Lives area: catalog illustration chips, never city rates.
 */
import React from 'react';
import Link from 'next/link';
import {
  livesAreaBySlug,
  livesPlaceAnchorsForArea,
  type LivesPlaceAnchor,
} from '@repo/domain/statistics/lives';

void React;

export type LivesPlaceAnchorsProps = {
  readonly areaSlug: string;
};

function AnchorChip({ anchor }: { readonly anchor: LivesPlaceAnchor }) {
  const content = (
    <>
      <span className="lives-anchors__name">{anchor.name}</span>
      <span className="lives-anchors__role">{anchor.role}</span>
    </>
  );
  if (anchor.href) {
    return (
      <Link className="lives-anchors__chip" href={anchor.href}>
        {content}
      </Link>
    );
  }
  return <span className="lives-anchors__chip lives-anchors__chip--static">{content}</span>;
}

export function LivesPlaceAnchors({ areaSlug }: LivesPlaceAnchorsProps) {
  const area = livesAreaBySlug(areaSlug);
  if (!area || area.kind === 'nation') return null;
  const anchors = livesPlaceAnchorsForArea(area);
  if (anchors.length === 0) return null;

  return (
    <aside className="lives-anchors" aria-label="Places that illustrate this region">
      <p className="lives-anchors__kicker">Places that illustrate this region</p>
      <p className="lives-anchors__note">
        Figures stay regional. These places open stories and catalog records; they are not city
        rates on the street.
      </p>
      <ul className="lives-anchors__list">
        {anchors.map((anchor) => (
          <li key={anchor.name}>
            <AnchorChip anchor={anchor} />
          </li>
        ))}
      </ul>
    </aside>
  );
}
