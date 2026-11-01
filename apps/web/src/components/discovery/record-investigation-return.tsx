/**
 * The way back into the investigation that sent a reader to a record: the map and the list, with
 * the narrowing they carried. One server-rendered bar for every public record family (place,
 * person, invention) so the return is the same control wherever the record lives.
 *
 * Presentation only. Hrefs, the position label and any narrowing wording come from
 * `placeDiscoveryReturn`; this component reads nothing and invents no URL.
 */
import React from 'react';
import Link from 'next/link';
import type { PlaceDiscoveryReturn } from '../../lib/discovery/discovery-state';
import './record-investigation-return.css';

void React;

export type RecordInvestigationReturnProps = {
  readonly returns: PlaceDiscoveryReturn;
  /**
   * `place` keeps the builder's place wording. `record` is for people, inventions and other
   * records that are not standable places, where "this place" would misdescribe the subject.
   */
  readonly family?: 'place' | 'record';
  /** True when the arrival carried narrowing; the builder's narrowing labels then apply as is. */
  readonly narrowed?: boolean;
  /** True when the record has a public map location. Unpinned records never promise a pin. */
  readonly pinned?: boolean;
};

export function investigationReturnLabels({
  returns,
  family = 'place',
  narrowed = false,
  pinned = true,
}: RecordInvestigationReturnProps): { readonly mapLabel: string; readonly listLabel: string } {
  if (family === 'place' || narrowed) {
    return { mapLabel: returns.mapLabel, listLabel: returns.listLabel };
  }
  return {
    mapLabel: pinned ? 'See this record on the map' : 'Browse the map',
    listLabel: returns.listLabel,
  };
}

export function RecordInvestigationReturn(props: RecordInvestigationReturnProps) {
  const { returns } = props;
  const labels = investigationReturnLabels(props);
  return (
    <nav className="ds-record-return" aria-label="Return to your investigation">
      <span className="ds-record-return__label">Your investigation</span>
      <Link className="ds-record-return__link" href={returns.mapHref} scroll={false}>
        {labels.mapLabel}
      </Link>
      <Link className="ds-record-return__link" href={returns.listHref}>
        {labels.listLabel}
      </Link>
      {returns.positionLabel ? (
        <span className="ds-record-return__position">{returns.positionLabel}</span>
      ) : null}
    </nav>
  );
}
