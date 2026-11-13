/**
 * The frame every trust, utility and data page shares on the archive table: a full-bleed color
 * block at the top carrying the display title and one display numeral, and a paper sheet that
 * slides up over the block's foot with the page's sections on it.
 *
 * Render `TrustMast` as the room's `masthead` and wrap the body in `TrustSheet`; give the room
 * `className="ds-trust-room"` so the sheet overlaps the block. Styles: `./trust.css`.
 */
import React, { type ReactNode } from 'react';
import { Block, DisplayNumeral, Sheet, cx, type BlockTone } from '@repo/ui';
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
  readonly tone: Extract<BlockTone, 'copper' | 'sand'>;
  /** The page's `PageHeader display`. */
  readonly children: ReactNode;
  readonly numeral?: TrustMastNumeral | undefined;
  /** Controls that belong to the whole page (a question picker), under the header. */
  readonly tools?: ReactNode;
  readonly className?: string;
};

export function TrustMast({ tone, children, numeral, tools, className }: TrustMastProps) {
  return (
    <Block tone={tone} as="div" className={cx('ds-trust-mast', className)}>
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
      <Sheet as="div" className={cx('ds-trust-sheet', className)}>
        {children}
      </Sheet>
    </div>
  );
}
