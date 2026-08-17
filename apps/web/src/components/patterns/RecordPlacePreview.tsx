/**
 * A record's place block: a locator inset, the place in words, and the way out to a real map.
 *
 * WHAT CHANGED AND WHY. This block has now been through three implementations, and the third one
 * is the first that answers the question the block is actually asking.
 *
 *   1. `EntityLocationMap` — a second MapLibre instance, so a record page held two GL contexts.
 *   2. A `MapMoment` borrowing the site's one persistent plate. That removed the second context
 *      but put a `position: fixed` element in a 240px rail slot, where it tore against the scroll,
 *      flickered in and out as the slot crossed the visibility floor, and wore chrome sized for a
 *      figure three times the width. See `RecordLocator` for the full account.
 *   3. A static locator. No GL, no tiles, no fixed positioning, no arbitration.
 *
 * The through-line is that the block was being given a map when what it needed was a locator. The
 * caveat printed directly beneath it holds the record to city precision and refuses exact
 * addresses; an interactive street camera contradicts that in the act of rendering. `MapMoment`
 * keeps its job on the reading surfaces, where a moment is full-column, scroll-triggered, and
 * genuinely about a camera arriving — which is what it was designed for.
 *
 * THE SHARED-SURFACE CASE, which used to need special handling and no longer does.
 * `RecordAnatomyPanel` renders on the record page AND inside the Atlas's record sheet, which floats
 * over the live plate. A sheet cannot borrow the plate it is floating over, so the old version had
 * to pass an idle line explaining that the map was never coming. A locator has nothing to borrow,
 * so both surfaces now render the same thing and the explanation is gone rather than reworded.
 *
 * NO MAPS LINK OF ITS OWN. This block used to carry one, and on both surfaces it was the second
 * link to the same coordinates. `RecordAnatomyPanel` already wraps its own WHERE fact value in a
 * `MapsExternalLink`, and the record page already prints an `Open in maps` CTA directly beneath
 * this block — so the preview's copy sat between them saying the same thing a third time. Street
 * detail is still one tap away on both surfaces; it is just not offered twice.
 */
import React from 'react';
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
};

export function RecordPlacePreview({ lat, lng, label }: RecordPlacePreviewProps) {
  return (
    <figure className="ds-record-anatomy__place">
      <RecordLocator lat={lat} lng={lng} label={label} />
      {/* The words are the content and the locator is the illustration — the same contract
          `MapMoment` held, and the reason it required its caption. A record whose coordinates fall
          outside the projection renders no locator at all, and this line is then the whole block,
          which is why it does not depend on the graphic being there. */}
      <figcaption className="ds-record-anatomy__place-caption">{label}</figcaption>
    </figure>
  );
}
