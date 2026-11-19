/**
 * Decorative art for color bands and section breaks. Pure ornament (aria-hidden, no text in the
 * art); the motifs are monochrome SVG masks painted with the ground's ink token, so they follow
 * whatever ground and theme they sit on.
 *
 * - `BandArt` fills its host (position: relative; isolation: isolate) behind the content.
 * - `BandRule` is an in-flow strip or vignette: a quilted rule, a halftone edge, a drawing.
 */
import React from 'react';
import { cx } from '@repo/ui';
import './band-art.css';

void React;

export const BAND_ART_MOTIFS = [
  'weave',
  'grain',
  'decades',
  'contours',
  'ledger',
  'architecture',
  'tools',
  'mapline',
] as const;
export type BandArtMotif = (typeof BAND_ART_MOTIFS)[number];

export function BandArt({ motifs }: { readonly motifs: readonly BandArtMotif[] }) {
  return (
    <div className="ds-band-art" aria-hidden="true">
      {motifs.map((motif) => (
        <span key={motif} className={`ds-band-art__layer ds-band-art__layer--${motif}`} />
      ))}
    </div>
  );
}

export function BandRule({
  motif,
  className,
}: {
  readonly motif: BandArtMotif;
  readonly className?: string;
}) {
  return (
    <span className={cx('ds-band-rule', `ds-band-rule--${motif}`, className)} aria-hidden="true" />
  );
}
