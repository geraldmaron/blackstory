/**
 * The frame every method, utility and data page shares: one document on the page's own ground
 * (docs/ui/DESIGN.md section 9.6). A title, its line, and the sections under a 2px rule. No night
 * mast, no horizon, no display numeral and no color bands: a count is said in a sentence.
 *
 * Render `TrustMast` as the room's `masthead` and wrap the body in `TrustSheet`; give the room
 * `className="ds-trust-room"`. Styles: `./trust.css`.
 */
import React, { type ReactNode } from 'react';
import { cx } from '@repo/ui';
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
};

export function TrustMast({ children, numeral, tools, className }: TrustMastProps) {
  return (
    <div className={cx('ds-trust-mast', className)}>
      <div className="ds-wrap ds-trust-mast__inner">
        <div className="ds-trust-mast__head">{children}</div>
        {numeral === undefined ? null : (
          // A count is a fact in a sentence, never the page's display type (DESIGN.md rule 4).
          <p className="ds-trust-mast__figure" aria-hidden={numeral.decorative || undefined}>
            <strong>{numeral.value}</strong> {numeral.label}
          </p>
        )}
        {tools === undefined ? null : <div className="ds-trust-mast__tools">{tools}</div>}
      </div>
    </div>
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
      <div className={cx('ds-trust-sheet', className)}>{children}</div>
    </div>
  );
}

/**
 * A group of sections. It used to be a full-bleed color band; a field of color now has to state
 * a ground (DESIGN.md rule 5), so this only groups. `tone` and `fixed` are accepted and ignored
 * until the callers are rebuilt.
 */
export function TrustBand({
  children,
}: {
  readonly tone?: string;
  readonly fixed?: boolean;
  readonly children: ReactNode;
}) {
  return <div className="ds-trust-band">{children}</div>;
}
