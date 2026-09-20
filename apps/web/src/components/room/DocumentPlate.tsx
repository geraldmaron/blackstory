/**
 * The document plate: a sheet set into a ledger room's masthead, carrying words the page already
 * quotes and cites.
 *
 * It is typeset, not photographic, and that is the rule rather than a stopgap.
 * `ArchiveFigure` keeps documentary images at full frame with their provenance and never crops
 * one for decoration, so a masthead that wants the texture of a document sets the document's
 * text and its citation instead (docs/ui/design-direction-v10-rooms.md, "The document plate").
 * A cleared scan, when there is one, goes through `ArchiveFigure`, not through this.
 *
 * No content, no plate: a caller with nothing to quote renders nothing. There is no placeholder.
 */
import React, { type ReactNode } from 'react';
import Link from 'next/link';
import { cx } from '@repo/ui';

void React;

export type DocumentPlateProps = {
  /** The quoted words, exactly as the record quotes them. No added emphasis (P-02). */
  readonly quote?: string | undefined;
  /**
   * Instead of a quotation: one of the page's own instruments, drawn with the production
   * component a reader meets on records (the evidence grade key, the citation chain). Never an
   * invented example.
   */
  readonly children?: ReactNode;
  /** The citation for the quoted words, or one line saying what the instrument is. */
  readonly citation: string;
  /** What the sheet is, in a few words: "Operative text". */
  readonly label: string;
  readonly href?: string | undefined;
  readonly hrefLabel?: string | undefined;
  readonly className?: string;
};

export function DocumentPlate({
  quote,
  children,
  citation,
  label,
  href,
  hrefLabel = 'Open the entry',
  className,
}: DocumentPlateProps) {
  const text = quote?.trim() ?? '';
  if (text.length === 0 && (children === undefined || children === null)) return null;
  return (
    <figure className={cx('ds-room-plate', className)}>
      <p className="ds-room-plate__label">{label}</p>
      {text.length > 0 ? <blockquote className="ds-room-plate__text">{text}</blockquote> : null}
      {children === undefined || children === null ? null : (
        <div className="ds-room-plate__body">{children}</div>
      )}
      <figcaption className="ds-room-plate__caption">
        <span>{citation}</span>
        {href === undefined ? null : (
          <Link className="ds-room-plate__link" href={href}>
            {hrefLabel}
          </Link>
        )}
      </figcaption>
    </figure>
  );
}
