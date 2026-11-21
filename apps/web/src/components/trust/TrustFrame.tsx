/**
 * The frame every trust, utility and data page shares. These pages are Parked
 * (design-direction-v11.md §4.1): no map, the night ground the world surfaces share in either
 * theme, the display title and one display numeral over the world's lit edge, and one reading
 * sheet that slides up over it with the page's sections on it.
 *
 * Render `TrustMast` as the room's `masthead` and wrap the body in `TrustSheet`; give the room
 * `className="ds-trust-room"` so the sheet overlaps the block. Styles: `./trust.css`.
 */
import React, { type ReactNode } from 'react';
import { Block, DisplayNumeral, Sheet, cx, type BlockTone } from '@repo/ui';
import { BandArt, type BandArtMotif } from '../atmosphere/BandArt';
import './trust.css';

void React;

export type TrustMastNumeral = {
  /** The figure as printed: "4,387", "0", "16". */
  readonly value: string;
  /** What it counts, set small under it. */
  readonly label: string;
  /** True when the dek or title already states the value, so it is not read twice. */
  readonly decorative?: boolean;
};

export type TrustMastProps = {
  /** The page's `PageHeader display`. */
  readonly children: ReactNode;
  readonly numeral?: TrustMastNumeral | undefined;
  /** Controls that belong to the whole page (a question picker), under the header. */
  readonly tools?: ReactNode;
  readonly className?: string;
  /** Decorative band art behind the mast, chosen to suit the page. */
  readonly art?: readonly BandArtMotif[];
};

export function TrustMast({ children, numeral, tools, className, art }: TrustMastProps) {
  return (
    <Block tone="ink" as="div" data-ground-fixed="" className={cx('ds-trust-mast', className)}>
      {art ? <BandArt motifs={art} /> : null}
      <div className="ds-wrap ds-trust-mast__inner">
        <div className="ds-trust-mast__head">{children}</div>
        {numeral === undefined ? null : (
          <p className="ds-trust-mast__figure">
            <DisplayNumeral
              as="span"
              // A long figure ("41.3M") steps down to the title size so the title keeps its width.
              size={numeral.value.length > 3 ? 'title' : 'numeral'}
              className="ds-trust-mast__numeral"
              decorative={numeral.decorative ?? false}
            >
              {numeral.value}
            </DisplayNumeral>
            <span className="ds-trust-mast__label">{numeral.label}</span>
          </p>
        )}
        {tools === undefined ? null : <div className="ds-trust-mast__tools">{tools}</div>}
      </div>
    </Block>
  );
}

export function TrustSheet({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  // The folio keeps the sheet one level below the room column, out of reach of the room kit's
  // contents-list grid, which would otherwise dissolve the sheet with `display: contents`.
  return (
    <div className="ds-trust-folio">
      <Sheet as="div" bands="none" className={cx('ds-trust-sheet', className)}>
        {children}
      </Sheet>
    </div>
  );
}

/**
 * A full-bleed ground between two sheets: the page changes plane instead of running one sheet for
 * screen after screen (patterns-living-archive, Depth planes). Its sections keep the sheet's
 * running numerals. `fixed` keeps an ink band ink in the light theme too.
 */
export function TrustBand({
  tone,
  fixed = false,
  children,
}: {
  readonly tone: BlockTone;
  readonly fixed?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <Block
      tone={tone}
      as="div"
      className="ds-trust-band"
      {...(fixed ? { 'data-ground-fixed': '' } : {})}
    >
      <div className="ds-trust-band__inner">{children}</div>
    </Block>
  );
}
