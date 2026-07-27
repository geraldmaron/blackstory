/**
 * Renders article prose, replacing inline `[ref:<id>]` citation markers with
 * superscript reference numbers that link down to the references section.
 * Unknown markers (no resolved number) are dropped from the output.
 */
import React from 'react';

void React;

export type ArticleProseProps = {
  readonly text: string;
  readonly refNumberById: ReadonlyMap<string, number>;
  readonly className?: string;
};

const MARKER = /\[ref:([a-z0-9]+(?:-[a-z0-9]+)*)\]/g;

type Segment =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'cite'; readonly number: number };

function segmentize(text: string, refNumberById: ReadonlyMap<string, number>): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(MARKER)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ kind: 'text', value: text.slice(lastIndex, start) });
    }
    const number = refNumberById.get(match[1]!);
    if (number !== undefined) segments.push({ kind: 'cite', number });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ kind: 'text', value: text.slice(lastIndex) });
  }
  return segments;
}

export function ArticleCitationMarks({
  numbers,
}: {
  readonly numbers: readonly number[];
}) {
  if (numbers.length === 0) return null;
  return (
    <sup className="ds-article-cite">
      {numbers.map((number, index) => (
        <React.Fragment key={number}>
          {index > 0 ? <span aria-hidden="true">,</span> : null}
          <a href={`#ref-${number}`} aria-label={`Reference ${number}`}>
            {number}
          </a>
        </React.Fragment>
      ))}
    </sup>
  );
}

export function ArticleProse({ text, refNumberById, className }: ArticleProseProps) {
  const segments = segmentize(text, refNumberById);
  return (
    <p className={className}>
      {segments.map((segment, index) =>
        segment.kind === 'text' ? (
          <React.Fragment key={index}>{segment.value}</React.Fragment>
        ) : (
          <ArticleCitationMarks key={index} numbers={[segment.number]} />
        ),
      )}
    </p>
  );
}
