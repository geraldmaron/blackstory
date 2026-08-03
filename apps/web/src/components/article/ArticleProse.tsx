/**
 * Renders article prose, replacing inline `[ref:<id>]` citation markers with
 * superscript reference numbers that link down to the references section, and
 * `[[entityId|Label]]` markup with links to the entity record (the same
 * convention `LinkedProse` renders on entity and theme surfaces).
 * Unknown citation markers (no resolved number) are dropped from the output.
 */
import React from 'react';
import { ENTITY_PROSE_LINK_RE } from '@repo/domain/editorial';
import { EntityLink, humanizeEntityId } from '../entity/EntityLink';

void React;

export type ArticleProseProps = {
  readonly text: string;
  readonly refNumberById: ReadonlyMap<string, number>;
  readonly className?: string;
};

const CITE_MARKER_SOURCE = String.raw`\[ref:([a-z0-9]+(?:-[a-z0-9]+)*)\]`;

/**
 * One pass over both markup forms, so a paragraph carrying a citation and an
 * entity link resolves each in document order. The entity half is composed from
 * `@repo/domain`'s shared pattern rather than restated here: capture groups are
 * 1 = citation id, 2 = entity id, 3 = optional entity label.
 */
const MARKER = new RegExp(`${CITE_MARKER_SOURCE}|${ENTITY_PROSE_LINK_RE.source}`, 'g');

type Segment =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'cite'; readonly number: number }
  | { readonly kind: 'entity'; readonly entityId: string; readonly label: string };

function segmentize(text: string, refNumberById: ReadonlyMap<string, number>): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(MARKER)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ kind: 'text', value: text.slice(lastIndex, start) });
    }
    const citeId = match[1];
    if (citeId !== undefined) {
      const number = refNumberById.get(citeId);
      if (number !== undefined) segments.push({ kind: 'cite', number });
    } else {
      const entityId = match[2]?.trim() ?? '';
      if (entityId) {
        const label = match[3]?.trim() || humanizeEntityId(entityId);
        segments.push({ kind: 'entity', entityId, label });
      }
    }
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ kind: 'text', value: text.slice(lastIndex) });
  }
  return segments;
}

export function ArticleCitationMarks({ numbers }: { readonly numbers: readonly number[] }) {
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
      {segments.map((segment, index) => {
        if (segment.kind === 'text') {
          return <React.Fragment key={index}>{segment.value}</React.Fragment>;
        }
        if (segment.kind === 'entity') {
          return (
            <EntityLink key={index} entityId={segment.entityId}>
              {segment.label}
            </EntityLink>
          );
        }
        return <ArticleCitationMarks key={index} numbers={[segment.number]} />;
      })}
    </p>
  );
}
