/**
 * A record's place block: a locator inset, the place in words, and the way out to a real map.
 *
 * WHY A LOCATOR AND NOT A MAP. The block needs a locator, not a map. The caveat printed directly
 * beneath it holds the record to city precision and refuses exact addresses; an interactive street
 * camera contradicts that in the act of rendering. A static locator costs no GL context, no tiles,
 * no fixed positioning and no plate arbitration. `MapMoment` keeps its job on the reading
 * surfaces, where a moment is full-column, scroll-triggered, and genuinely about a camera
 * arriving — which is what it was designed for. See `RecordLocator` for why a borrowed plate
 * cannot serve a rail-width slot.
 *
 * THE SHARED-SURFACE CASE. `RecordAnatomyPanel` renders on the record page AND inside Explore's
 * record sheet, which floats over the live plate. A sheet cannot borrow the plate it is floating
 * over. A locator has nothing to borrow, so both surfaces render the same thing and neither needs
 * a line explaining that a map is not coming.
 *
 * NO MAPS LINK OF ITS OWN. `RecordAnatomyPanel` wraps its own WHERE fact value in a
 * `MapsExternalLink`, and the record page prints an `Open in maps` CTA directly beneath this
 * block. A third link to the same coordinates here would repeat what both of those already say.
 * Street detail stays one tap away on both surfaces; it is just not offered twice.
 */
import React from 'react';
import { InteractiveRecordLocator } from './InteractiveRecordLocator';
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
  /** Place-page stand: pan/zoom the national locator. Rail and sheet slots stay static. */
  readonly interactive?: boolean;
  /** Live Explore handoff when the locator is interactive. */
  readonly atlasHref?: string;
};

export function RecordPlacePreview({
  lat,
  lng,
  label,
  accessibleName,
  interactive = false,
  atlasHref,
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
        <InteractiveRecordLocator
          {...sharedProps}
          {...(atlasHref !== undefined ? { atlasHref } : {})}
        />
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
