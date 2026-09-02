/**
 * Thin outbound handoff for Internet Archive contribution (operator-gated; no live upload UI).
 */
import React from 'react';
import Link from 'next/link';
import './record-archive.css';

void React;

export type RecordArchiveContributionProps = {
  readonly compact?: boolean;
  readonly className?: string;
};

export function RecordArchiveContribution({
  compact = false,
  className,
}: RecordArchiveContributionProps) {
  const rootClass = className
    ? `ds-record-archive-contrib ${className}`
    : 'ds-record-archive-contrib';

  if (compact) {
    return (
      <p className={`${rootClass} ds-record-archive-contrib--compact`}>
        <Link href="/methodology#internet-archive" prefetch={false}>
          Learn how BlackStory contributes to the Internet Archive
        </Link>
      </p>
    );
  }

  return (
    <section className={rootClass} aria-labelledby="record-archive-contrib-heading">
      <h3 className="ds-record-archive-contrib__heading" id="record-archive-contrib-heading">
        Contribute to the commons
      </h3>
      <p>
        BlackStory preserves cited pages through the Wayback Machine and stages curated research
        exports for operator review before any Internet Archive upload. Public readers can learn
        more about that workflow; operators run capture and export through the research CLI.
      </p>
      <p>
        <Link
          className="ds-cta ds-cta--quiet"
          href="/methodology#internet-archive"
          prefetch={false}
        >
          Read the Internet Archive handoff
        </Link>
      </p>
    </section>
  );
}
