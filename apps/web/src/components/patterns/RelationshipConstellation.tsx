/**
 * Typed relationship constellation for Place (v10).
 *
 * Sighted readers get a flat diagram of typed edges around the record. Assistive tech gets the
 * same edges as an explicit list. Proximity is never implied: only caller-supplied typed edges.
 */
'use client';

import React from 'react';
import { cx } from '@repo/ui';
import './relationship-constellation.css';

void React;

export type ConstellationEdge = {
  readonly name: string;
  readonly relation: string;
  readonly href: string;
};

export type RelationshipConstellationProps = {
  readonly centerLabel: string;
  readonly edges: readonly ConstellationEdge[];
  readonly className?: string;
};

const MAX_DIAGRAM = 8;

export function RelationshipConstellation({
  centerLabel,
  edges,
  className,
}: RelationshipConstellationProps) {
  if (edges.length === 0) return null;

  const diagramEdges = edges.slice(0, MAX_DIAGRAM);

  return (
    <div className={cx('ds-constellation', className)}>
      <div className="ds-constellation__diagram" aria-hidden="true">
        <span className="ds-constellation__center">{centerLabel}</span>
        <ul className="ds-constellation__orbit">
          {diagramEdges.map((edge) => (
            <li key={`${edge.href}-${edge.relation}`} className="ds-constellation__node">
              <span className="ds-constellation__rel">{edge.relation || 'connected'}</span>
              <span className="ds-constellation__name">{edge.name}</span>
            </li>
          ))}
        </ul>
      </div>

      <ul className="ds-constellation__list" aria-label={`Connections from ${centerLabel}`}>
        {edges.map((edge, index) => (
          <li key={`${index}-${edge.href}`}>
            <a className="ds-constellation__link" href={edge.href}>
              <span className="ds-constellation__link-name">{edge.name}</span>
              <span className="ds-constellation__link-rel">
                {edge.relation.length > 0 ? edge.relation : 'connected'}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
