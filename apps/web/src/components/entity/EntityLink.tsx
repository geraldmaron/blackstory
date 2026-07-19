/**
 * Quiet inline link to a canonical entity record page. Inherits surrounding text color;
 * underline appears on hover and focus-visible so link affordance is not color-only.
 */

import React from 'react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { humanizeToken } from './format';

void React;

/** Fallback label when a neighbor stub or label map lacks a display name. */
export function humanizeEntityId(id: string): string {
  const stripped = id.replace(/^ent_/, '').replace(/_\d+$/, '');
  return humanizeToken(stripped);
}

export type EntityLinkProps = {
  readonly entityId: string;
  readonly children: ReactNode;
  readonly className?: string;
};

export function EntityLink({ entityId, children, className }: EntityLinkProps) {
  return (
    <Link
      href={`/entity/${entityId}`}
      className={className ? `ds-entity-link ${className}` : 'ds-entity-link'}
    >
      {children}
    </Link>
  );
}

export function EntityLinkDiscoveryHint() {
  return <p className="ds-entity-link-hint">Record names link onward — click to keep learning.</p>;
}

export function resolveEntityLabel(
  entityId: string,
  labelsByEntityId?: ReadonlyMap<string, string> | Record<string, string>,
): string {
  if (labelsByEntityId !== undefined) {
    const label = lookupEntityLabel(entityId, labelsByEntityId);
    if (label !== undefined && label.trim().length > 0) {
      return label;
    }
  }
  return humanizeEntityId(entityId);
}

function lookupEntityLabel(
  entityId: string,
  labelsByEntityId: ReadonlyMap<string, string> | Record<string, string>,
): string | undefined {
  if (labelsByEntityId instanceof Map) {
    return labelsByEntityId.get(entityId);
  }
  return (labelsByEntityId as Record<string, string>)[entityId];
}
