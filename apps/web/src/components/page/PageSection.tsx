/**
 * A page's sections: a plain h2 (the shared SectionHeading) and its content. No icon plate, no
 * kicker, no alternating bands; the heading carries the section.
 */
import React, { type ReactNode } from 'react';
import Link from 'next/link';
import type { DestinationIconId } from '@repo/public-contracts/destinations';
import { cx, SectionHeading } from '@repo/ui';
import { DestinationIcon } from '../patterns/DestinationIcon';

void React;

export type PageSectionProps = {
  readonly id: string;
  readonly title: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
};

export function PageSection({ id, title, children, className }: PageSectionProps) {
  const headingId = `${id}-heading`;
  return (
    <section id={id} className={cx('ds-doc-section', className)} aria-labelledby={headingId}>
      <SectionHeading id={headingId}>{title}</SectionHeading>
      {children}
    </section>
  );
}

export type PageFact = {
  readonly title: string;
  readonly body: ReactNode;
};

/** Ruled rows of a short title and its sentence. */
export function FactList({
  items,
  className,
}: {
  readonly items: readonly PageFact[];
  readonly className?: string;
}) {
  return (
    <ul className={cx('ds-doc-facts', className)}>
      {items.map((item) => (
        <li key={item.title} className="ds-doc-fact">
          <h3 className="ds-doc-fact__title">{item.title}</h3>
          <div className="ds-doc-fact__body">{item.body}</div>
        </li>
      ))}
    </ul>
  );
}

export type RelatedLinkProps = {
  readonly href: string;
  readonly icon: DestinationIconId;
  readonly title: string;
  readonly line: string;
};

/** A related page, drawn as a ruled link row so it cannot hide inside a paragraph. */
export function RelatedLink({ href, icon, title, line }: RelatedLinkProps) {
  return (
    <Link className="ds-doc-handoff" href={href}>
      <span className="ds-doc-handoff__plate" aria-hidden="true">
        <DestinationIcon id={icon} size="lg" />
      </span>
      <span className="ds-doc-handoff__copy">
        <strong>{title}</strong>
        <small>{line}</small>
      </span>
    </Link>
  );
}
