/**
 * Renders prose with inline entity links. Supports explicit `[[entityId|Label]]` /
 * `[[entityId]]` markup and optional catalog-driven linkify for plain summaries via
 * `@repo/domain`'s `linkifyProseAgainstCatalog`.
 */

import React from 'react';
import type { ReactNode } from 'react';
import {
  linkifyProseAgainstCatalog,
  parseProseEntityLinks,
  type CatalogLinkTarget,
} from '@repo/domain/editorial';
import { EntityLink, humanizeEntityId } from './EntityLink';

void React;

export type EntityLinkCatalogEntry = CatalogLinkTarget;

export type LinkedProseProps = {
  readonly text: string;
  readonly className?: string;
  readonly skipEntityIds?: readonly string[];
  readonly catalog?: readonly EntityLinkCatalogEntry[];
  readonly as?: 'p' | 'span' | 'div';
};

type ProseSegment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'link'; readonly entityId: string; readonly label: string };

function hasEntityMarkup(text: string): boolean {
  return text.includes('[[');
}

function segmentsFromMarkup(
  text: string,
  skipEntityIds: readonly string[] | undefined,
): ProseSegment[] {
  const skip = new Set(skipEntityIds ?? []);
  const segments: ProseSegment[] = [];
  const pattern = /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      segments.push({ kind: 'text', text: text.slice(cursor, index) });
    }
    const entityId = match[1]?.trim() ?? '';
    if (entityId) {
      const label = match[2]?.trim() || humanizeEntityId(entityId);
      if (skip.has(entityId)) {
        segments.push({ kind: 'text', text: label });
      } else {
        segments.push({ kind: 'link', entityId, label });
      }
    }
    cursor = index + match[0].length;
  }
  if (cursor < text.length) {
    segments.push({ kind: 'text', text: text.slice(cursor) });
  }
  void parseProseEntityLinks(text);
  return segments.length > 0 ? segments : [{ kind: 'text', text }];
}

function segmentsFromCatalog(
  text: string,
  catalog: readonly EntityLinkCatalogEntry[],
  skipEntityIds: readonly string[] | undefined,
): ProseSegment[] {
  const linked = linkifyProseAgainstCatalog(text, catalog, {
    ...(skipEntityIds !== undefined ? { skipEntityIds } : {}),
  });
  if (linked.links.length === 0) {
    return [{ kind: 'text', text }];
  }
  return segmentsFromMarkup(linked.text);
}

function toSegments(
  text: string,
  catalog: readonly EntityLinkCatalogEntry[] | undefined,
  skipEntityIds: readonly string[] | undefined,
): ProseSegment[] {
  if (hasEntityMarkup(text)) {
    return segmentsFromMarkup(text, skipEntityIds);
  }
  if (catalog && catalog.length > 0) {
    return segmentsFromCatalog(text, catalog, skipEntityIds);
  }
  return [{ kind: 'text', text }];
}

export function LinkedProse({
  text,
  className,
  skipEntityIds,
  catalog,
  as: Tag = 'p',
}: LinkedProseProps) {
  const segments = toSegments(text, catalog, skipEntityIds);
  const children: ReactNode[] = segments.map((segment, index) => {
    if (segment.kind === 'text') {
      return <React.Fragment key={`t-${index}`}>{segment.text}</React.Fragment>;
    }
    return (
      <EntityLink key={`l-${index}-${segment.entityId}`} entityId={segment.entityId}>
        {segment.label}
      </EntityLink>
    );
  });

  return (
    <Tag className={className} data-linked-prose="">
      {children}
    </Tag>
  );
}
