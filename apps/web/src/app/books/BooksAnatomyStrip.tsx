/**
 * Compact challenged-title fact strip for the detail header. Built on the shared room
 * kit's `Anatomy` block, the same one `/law` uses, rather than a route-owned panel.
 * EditionFactIcon labels pair with visible text so icons are never the only signal
 * (WCAG 1.4.1).
 */
import React from 'react';
import Link from 'next/link';
import { EditionFactIcon } from '../../components/patterns/EditionFactIcon';
import { Anatomy } from '../../components/room';
import '../../components/patterns/edition-fact-icon.css';

void React;

export type BooksAnatomyStripProps = {
  readonly authorLine: string;
  readonly publishedDate: string;
  readonly citationCount: number;
  readonly challengeCount: number;
  readonly stateCount: number;
  readonly isbn?: string;
};

export function BooksAnatomyStrip({
  authorLine,
  publishedDate,
  citationCount,
  challengeCount,
  stateCount,
  isbn,
}: BooksAnatomyStripProps) {
  return (
    <Anatomy
      label="Title at a glance"
      cells={[
        {
          label: 'Author',
          icon: <EditionFactIcon variant="entry" step="source" />,
          value: authorLine,
        },
        {
          label: 'Published',
          icon: <EditionFactIcon variant="record-era" />,
          value: publishedDate,
        },
        {
          label: 'Citations',
          icon: <EditionFactIcon variant="record-evidence" tier="high" />,
          value: (
            <Link href="#citations">
              {citationCount} source{citationCount === 1 ? '' : 's'}
            </Link>
          ),
        },
        {
          label: 'Challenges',
          icon: <EditionFactIcon variant="record-where" />,
          value: (
            <Link href="#challenges">
              {challengeCount} report{challengeCount === 1 ? '' : 's'}
              {stateCount > 0 ? ` · ${stateCount} state${stateCount === 1 ? '' : 's'}` : ''}
            </Link>
          ),
        },
        ...(isbn
          ? [{ label: 'ISBN', icon: <EditionFactIcon variant="entry" step="source" />, value: <span className="ds-mono">{isbn}</span> }]
          : []),
      ]}
    />
  );
}
