/**
 * The exhibit frame and its receipt (docs/ui/DESIGN.md section 7.3). Every photograph, document,
 * map frame, chart and name the site shows is one of these: the object inside crop marks, a label
 * that says what it is and what its year means, and a receipt that says where it came from.
 *
 * `id` is the exhibit's address and must be persistent (built from the record and the claim,
 * image or figure id). `number` is only a reading aid for the page and is never the address.
 *
 * The memorial wall is not an exhibit and does not use this.
 */

import React, { type ReactNode } from 'react';
import { cx } from '../utils/cx.js';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;

export type ExhibitKind = 'photograph' | 'document' | 'map' | 'figure' | 'name';

/**
 * `full` has the label and crop marks. `compact` is for rows and thumbnails: marks only.
 * `quiet` is for harm-adjacent material: no marks, no enlargement, nothing that moves.
 */
export type ExhibitVariant = 'full' | 'compact' | 'quiet';

const KIND_LABEL: Record<ExhibitKind, string> = {
  photograph: 'Photograph',
  document: 'Document',
  map: 'Map',
  figure: 'Figure',
  name: 'Name',
};

export type ExhibitFrameProps = {
  /** Persistent address, linkable as `#id`. */
  readonly id: string;
  readonly kind: ExhibitKind;
  /** Reading aid on the page, e.g. "03" or "D-02". Not the address. */
  readonly number?: string;
  /**
   * What the year means, in words: "1904, first documented", "date not on record", "ratified
   * 1868". Never implies a photograph is from the period when its date is unknown.
   */
  readonly basis?: string;
  readonly variant?: ExhibitVariant;
  /** A map exhibit sits on ink in both themes. */
  readonly ground?: 'ink';
  /** Usually a {@link Receipt}. Always visible; never hidden behind a control. */
  readonly receipt?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
};

export function ExhibitFrame({
  id,
  kind,
  number,
  basis,
  variant = 'full',
  ground,
  receipt,
  children,
  className,
}: ExhibitFrameProps) {
  const labelId = `${id}-label`;
  const showLabel = variant !== 'compact';
  return (
    <figure
      id={id}
      className={cx('ds-exhibit', `ds-exhibit--${variant}`, className)}
      data-kind={kind}
      aria-labelledby={showLabel ? labelId : undefined}
    >
      {showLabel ? (
        <p id={labelId} className="ds-exhibit__label">
          {number ? <span>Fig. {number}</span> : null}
          <span>{KIND_LABEL[kind]}</span>
          {basis ? <span>{basis}</span> : null}
        </p>
      ) : null}
      <div
        className="ds-exhibit__object"
        data-ground={ground}
        // Fixed: tokens.css turns an unfixed ink ground to paper in the light theme.
        data-ground-fixed={ground ? '' : undefined}
      >
        {children}
      </div>
      {receipt ? <figcaption className="ds-exhibit__receipt">{receipt}</figcaption> : null}
    </figure>
  );
}

export type ReceiptProps = {
  /** The source's name, or an image's credit. */
  readonly source: string;
  readonly href?: string;
  /** License, host or page reference, in mono. */
  readonly detail?: string;
  /** The evidence grade in words with its glyph. Never a letter. */
  readonly grade?: ReactNode;
  /** Usually `<Cite />`. */
  readonly action?: ReactNode;
  readonly className?: string;
};

/** One claim's or one image's source line. A receipt belongs to exactly one thing. */
export function Receipt({ source, href, detail, grade, action, className }: ReceiptProps) {
  return (
    <div className={cx('ds-receipt', className)}>
      <span className="ds-receipt__source">
        {href ? (
          <a href={href} rel="noopener noreferrer">
            {source}
          </a>
        ) : (
          source
        )}
      </span>
      {detail ? <span className="ds-receipt__detail">{detail}</span> : null}
      {grade ? <span className="ds-receipt__grade">{grade}</span> : null}
      {action ? <span className="ds-receipt__action">{action}</span> : null}
    </div>
  );
}
