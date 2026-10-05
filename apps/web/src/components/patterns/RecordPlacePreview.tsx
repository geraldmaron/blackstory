/**
 * A record's place block: the place on a map, and the place in words.
 *
 * Two forms. Where the block sits in a page (the place hero, the record page's Visit block) it is
 * a live map (`EmbeddedMap`): its own small MapLibre instance in the document flow, so it scrolls
 * with the page natively — none of the lag, flicker or chrome collisions that ruled out borrowing
 * the shared fixed plate (see `RecordLocator`) — and it grows to full screen in place. Where the
 * block floats over the live map already (Explore's record sheet, the narrative card), a second
 * map would be a map on a map, so it stays the static locator.
 *
 * The precision caveat is printed by `RecordAnatomyPanel` / the record page; the map opens at city
 * scale, matching what the archive holds.
 */
import React from 'react';
import { EmbeddedMap } from '../map-embed/EmbeddedMap';
import { RecordLocator } from './RecordLocator';
import './record-locator.css';

void React;

/*
 * `precision` and `caption` are deliberately gone from this contract.
 *
 * `precision` only ever chose a MapLibre zoom level, and there is no camera left to aim. `caption`
 * carried the precision caveat, which `RecordAnatomyPanel` ALREADY prints for itself as
 * `.ds-record-anatomy__precision` and the record page prints through `<Precision>` — so passing it
 * here rendered the same sentence twice in the same block. The caveat belongs to the panel; the
 * place label belongs to the locator.
 */
export type RecordPlacePreviewProps = {
  readonly lat: number;
  readonly lng: number;
  readonly label: string;
  readonly accessibleName?: string;
  /** A live map that grows to full screen in place (`EmbeddedMap`). Off where the block floats
   * over the live map already (Explore's record sheet), which keeps the static locator. */
  readonly interactive?: boolean;
  /** Open at city scale (place hero) rather than regional. */
  readonly neighborhood?: boolean;
};

export function RecordPlacePreview({
  lat,
  lng,
  label,
  accessibleName,
  interactive = false,
  neighborhood = false,
}: RecordPlacePreviewProps) {
  const sharedProps = {
    lat,
    lng,
    label,
    ...(accessibleName !== undefined ? { accessibleName } : {}),
  } as const;

  return (
    <figure className="ds-record-anatomy__place">
      {interactive ? (
        <EmbeddedMap {...sharedProps} zoom={neighborhood ? 11 : 9} />
      ) : (
        <RecordLocator {...sharedProps} />
      )}
      {/* The words are the content and the locator is the illustration — the same contract
          `MapMoment` held, and the reason it required its caption. A record whose coordinates fall
          outside the projection renders no locator at all, and this line is then the whole block,
          which is why it does not depend on the graphic being there. */}
      <figcaption className="ds-record-anatomy__place-caption">{label}</figcaption>
    </figure>
  );
}
