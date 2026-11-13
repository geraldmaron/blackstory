/**
 * The top of a page: an optional crumb (a plain link), the h1, an optional one-line dek and
 * optional actions aligned right. No kicker, no rule under it, no stat tiles.
 *
 * SectionHeading is the h2 that follows it: Schibsted 24/28, 48px above and 16px below.
 */

import React, { type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../utils/cx.js';

void React;

export type PageHeaderProps = {
  readonly title: ReactNode;
  readonly dek?: ReactNode;
  /** Absent (or undefined) for a top-level page with nothing above it. */
  readonly crumb?: { readonly href: string; readonly label: string } | undefined;
  readonly actions?: ReactNode;
  /** Renders the crumb with a framework link (Next's `Link`). */
  readonly linkAs?: ElementType;
  /** Sets the title at display scale (the PageTitle step). */
  readonly display?: boolean;
  readonly className?: string;
};

export function PageHeader({
  title,
  dek,
  crumb,
  actions,
  linkAs: LinkAs = 'a',
  display = false,
  className,
}: PageHeaderProps) {
  return (
    <header className={cx('ds-page-header', display && 'ds-page-header--display', className)}>
      <div className="ds-page-header__text">
        {crumb ? (
          <LinkAs className="ds-page-header__crumb" href={crumb.href}>
            {crumb.label}
          </LinkAs>
        ) : null}
        <h1 className="ds-page-header__title">{title}</h1>
        {dek ? <p className="ds-page-header__dek">{dek}</p> : null}
      </div>
      {actions ? <div className="ds-page-header__actions">{actions}</div> : null}
    </header>
  );
}

export type SectionHeadingProps = HTMLAttributes<HTMLHeadingElement> & {
  readonly children: ReactNode;
};

export function SectionHeading({ className, children, ...rest }: SectionHeadingProps) {
  return (
    <h2 className={cx('ds-section-heading', className)} {...rest}>
      {children}
    </h2>
  );
}
