/**
 * The record room's relationship map: three hops of typed archive edges, drawn against time.
 *
 * This replaces `RelationshipConstellation`, which had two problems the reader could see. It drew
 * every edge twice — once as an `aria-hidden` diagram of dead text, then again as a link list
 * directly underneath — and the page then printed a *third* near-identical list below it for the
 * second hop ("Worth investigating next"). Three renderings of overlapping records read as filler,
 * and none of them said how any two records were connected to each other.
 *
 * What is here instead is one rendering. Every node is a real anchor in one ordered list; the
 * curves behind them are decoration (`aria-hidden`) and carry nothing a reader would lose. Hop and
 * date travel in each link's accessible name, so assistive tech gets the same three facts the
 * picture gives a sighted reader: what it is, how far from this record it sits, and when.
 *
 * The two things that make it a map rather than a longer list:
 *
 * - **Paths.** Each node knows the node it was reached through, so pointing at a third-hop record
 *   lights the whole chain back to the center. That is the answer to "what is this doing here",
 *   which the old flat list could not give at all.
 * - **Cross-links.** When two records on the map are also connected to each other, that edge is
 *   drawn. A tree would have to print the shared record once per branch; the loop is the story.
 *
 * Density is handled by depth, not by truncation: a reader can pull the map in to one hop or push
 * it out to three, and a crowded record opens at two so the first thing it shows is legible.
 */
'use client';

import React from 'react';
import { cx } from '@repo/ui';
import type { RelationshipGraph } from '../../data/public-seed';
import { humanizeToken } from '../entity/format';
import { neighborHref } from '../../lib/place/public-place-path';
import {
  NODE_HEIGHT,
  layOutRelationshipMap,
  type RelationshipMapPlacedNode,
} from './relationship-map-layout';
import './relationship-map.css';

/** Above this many nodes the map opens at two hops, so it never opens as a hairball. */
const DENSE_NODE_COUNT = 18;

export type RelationshipMapProps = {
  readonly centerLabel: string;
  readonly graph: RelationshipGraph;
  /**
   * Relation wording per node id, replacing this component's own phrasing wholesale. The door and
   * place surfaces speak in human place lines ("a school in Washington") rather than catalog
   * tokens, and they suppress a relation outright when the stored token would not survive being
   * read aloud, so a node missing from this map shows its name with no phrase under it.
   *
   * A plain object rather than a callback: this is a client component, and a server surface cannot
   * hand it a function.
   */
  readonly labels?: Readonly<Record<string, string>>;
  readonly className?: string;
};

/**
 * Where a node on the map points.
 *
 * `neighborHref` collapses every `person` to `/memorial` and every `law`/`case` to `/law`, which
 * is right for a prose link and wrong here: it turns eight distinct people into eight links to the
 * same index page, which is the redundancy this component exists to remove (and, keyed on href, it
 * is what produced duplicate React keys). On the map a node addresses its own record. The rest of
 * the app's routing is untouched.
 */
function mapNodeHref(node: {
  readonly id: string;
  readonly kind: string;
  readonly displayName: string;
}): string {
  if (node.kind === 'person' || node.kind === 'law' || node.kind === 'case') {
    return `/entity/${node.id}`;
  }
  return neighborHref({ id: node.id, kind: node.kind, displayName: node.displayName });
}

/**
 * The edge in words, in the direction it was stored. "Successor to" and "preceded by" are the same
 * edge read from two ends, so the direction has to survive into the label or the map lies.
 */
function relationPhrase(node: RelationshipMapPlacedNode): string {
  if (node.viaEventName !== undefined) return `both appear in ${node.viaEventName}`;
  const relation = humanizeToken(node.relationType).toLowerCase();
  if (relation.length === 0) return 'connected';
  return node.direction === 'incoming' ? `${relation}, from their record` : relation;
}

function hopPhrase(hop: number): string {
  if (hop === 0) return 'this record';
  return hop === 1 ? 'one step away' : `${hop} steps away`;
}

export function RelationshipMap({ centerLabel, graph, labels, className }: RelationshipMapProps) {
  const deepest = graph.nodes.reduce((max, node) => Math.max(max, node.hop), 0);
  const [depth, setDepth] = React.useState(() =>
    graph.nodes.length > DENSE_NODE_COUNT ? Math.min(2, deepest) : deepest,
  );
  const [active, setActive] = React.useState<string | undefined>(undefined);

  const layout = React.useMemo(
    () => layOutRelationshipMap(graph, centerLabel, { maxHop: depth }),
    [graph, centerLabel, depth],
  );

  // Everything on the lit path back to the record, plus the record itself.
  const lit = React.useMemo(() => {
    if (active === undefined) return undefined;
    const node = layout.nodes.find((candidate) => candidate.id === active);
    return new Set<string>([active, ...(node?.pathToCenter ?? [])]);
  }, [active, layout]);

  if (graph.nodes.length === 0) return null;

  const depthOptions = Array.from({ length: deepest }, (_, index) => index + 1);
  const shown = layout.nodes.length - 1;

  return (
    <figure className={cx('ds-relmap', className)}>
      <figcaption className="ds-relmap__caption">
        <p className="ds-relmap__lede">
          {layout.timeAxis
            ? 'Typed connections from the archive, laid out left to right by when they happened and top to bottom by how far they sit from this record.'
            : 'Typed connections from the archive, laid out top to bottom by how far they sit from this record. Too few of them carry a date to draw a time axis.'}{' '}
          Point at any record to light its path back here. Nearby on the map is not the same as
          related.
        </p>
        {deepest > 1 ? (
          <div className="ds-relmap__depth" role="group" aria-label="How far to follow connections">
            {depthOptions.map((option) => (
              <button
                key={option}
                type="button"
                className="ds-relmap__depth-btn"
                aria-pressed={depth === option}
                onClick={() => {
                  setDepth(option);
                  setActive(undefined);
                }}
              >
                {option === 1 ? '1 hop' : `${option} hops`}
              </button>
            ))}
          </div>
        ) : null}
      </figcaption>

      <div className="ds-relmap__frame">
        <ul className="ds-relmap__lanes" aria-hidden="true">
          {layout.lanes.map((lane) => (
            <li
              key={lane.key}
              className={cx(
                'ds-relmap__lane-label',
                lane.undated && 'ds-relmap__lane-label--undated',
              )}
              style={{ top: `${lane.y}px`, height: `${NODE_HEIGHT}px` }}
            >
              {lane.label}
            </li>
          ))}
        </ul>

        <div className="ds-relmap__scroll" tabIndex={0} role="group" aria-label="Relationship map">
          <div
            className={cx('ds-relmap__canvas', lit !== undefined && 'ds-relmap__canvas--focused')}
            style={{ width: `${layout.width}px`, height: `${layout.height}px` }}
          >
            <svg
              className="ds-relmap__wires"
              width={layout.width}
              height={layout.height}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              aria-hidden="true"
              focusable="false"
            >
              {layout.lanes.map((lane) => (
                <line
                  key={`rule-${lane.key}`}
                  className="ds-relmap__lane-rule"
                  x1={0}
                  x2={layout.width}
                  y1={lane.y + NODE_HEIGHT / 2}
                  y2={lane.y + NODE_HEIGHT / 2}
                />
              ))}
              {layout.ticks.map((tick) => (
                <g key={`tick-${tick.year}`}>
                  <line
                    className="ds-relmap__tick-rule"
                    x1={tick.x}
                    x2={tick.x}
                    y1={22}
                    y2={layout.height - 8}
                  />
                  <text className="ds-relmap__tick-label" x={tick.x} y={14}>
                    {tick.label}
                  </text>
                </g>
              ))}
              {layout.links.map((link) => (
                <path
                  key={link.key}
                  className={cx(
                    'ds-relmap__wire',
                    link.spine ? 'ds-relmap__wire--spine' : 'ds-relmap__wire--cross',
                    lit !== undefined &&
                      lit.has(link.source) &&
                      lit.has(link.target) &&
                      'ds-relmap__wire--lit',
                  )}
                  d={link.d}
                />
              ))}
            </svg>

            <ul
              className="ds-relmap__nodes"
              aria-label={`Records connected to ${centerLabel}, nearest first`}
            >
              {layout.nodes.map((node) => {
                const style = {
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: `${node.width}px`,
                  height: `${NODE_HEIGHT}px`,
                } as const;

                if (node.center) {
                  return (
                    <li key={node.id} className="ds-relmap__node-slot" style={style}>
                      <span className="ds-relmap__node ds-relmap__node--center">
                        <span className="ds-relmap__node-name">{node.displayName}</span>
                        {node.year !== undefined ? (
                          <span className="ds-relmap__node-year">{node.year}</span>
                        ) : null}
                      </span>
                    </li>
                  );
                }

                const relation = labels ? labels[node.id] : relationPhrase(node);
                return (
                  <li key={node.id} className="ds-relmap__node-slot" style={style}>
                    <a
                      className={cx(
                        'ds-relmap__node',
                        `ds-relmap__node--hop${node.hop}`,
                        lit !== undefined && lit.has(node.id) && 'ds-relmap__node--lit',
                      )}
                      href={mapNodeHref(node)}
                      aria-label={`${node.displayName}${
                        relation !== undefined && relation.length > 0 ? `: ${relation}` : ''
                      }, ${hopPhrase(node.hop)}${
                        node.year !== undefined ? `, ${node.year}` : ', undated'
                      }`}
                      onMouseEnter={() => setActive(node.id)}
                      onMouseLeave={() => setActive(undefined)}
                      onFocus={() => setActive(node.id)}
                      onBlur={() => setActive(undefined)}
                    >
                      {relation !== undefined && relation.length > 0 ? (
                        <span className="ds-relmap__node-rel">{relation}</span>
                      ) : null}
                      <span className="ds-relmap__node-name">{node.displayName}</span>
                      {node.year !== undefined ? (
                        <span className="ds-relmap__node-year">{node.year}</span>
                      ) : null}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      <p className="ds-relmap__count">
        {shown === 1 ? '1 record' : `${shown} records`} within{' '}
        {depth === 1 ? 'one hop' : `${depth} hops`}
        {deepest > depth ? ', more further out' : ''}.
      </p>
    </figure>
  );
}
