/**
 * Citation block with source label and optional external link (non-color provenance cue).
 */

import type { ReactNode } from 'react';
import { cx } from '../utils/cx.js';

export type CitationProps = {
  readonly label?: string;
  readonly source: string;
  readonly href?: string;
  readonly children?: ReactNode;
  readonly className?: string;
};

export function Citation({ label = 'Source', source, href, children, className }: CitationProps) {
  return (
    <aside className={cx('bb-citation', className)} aria-label={label}>
      <span className="bb-citation__label">{label}</span>
      {href ? (
        <a href={href} rel="noopener noreferrer">
          {source}
        </a>
      ) : (
        <span>{source}</span>
      )}
      {children}
    </aside>
  );
}
