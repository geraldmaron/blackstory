/**
 * The record room's connection tree.
 *
 * Every record the archive links to this one, then what those records link to, drawn as one
 * branching web. Geometry comes from the browser, not from `relationship-tree.ts`: the module
 * decides the *shape* (what hangs under what, which loops become words), and this renders it as
 * nested lists whose lines are drawn in a gutter no text ever enters. That is the whole answer to
 * the picture this replaced, which overlapped its own labels and left most of a fixed canvas
 * empty whenever two records shared a year.
 *
 * Three rules it keeps:
 *
 * - **No graph vocabulary.** A reader is never shown "hops". Distance is the indent and the line.
 * - **Nothing clips.** Cards are sized by their contents; a long name or a two-line relation
 *   phrase grows the card instead of being cut off.
 * - **No client JavaScript.** Branch expansion is `<details>`, path lighting is `:has()`. This
 *   server-renders whole, so the first paint is the finished picture.
 */
import React from 'react';
import { cx } from '@repo/ui';
import type { RelationshipGraph } from '../../data/public-seed';
import { humanizeToken } from '../entity/format';
import { neighborHref } from '../../lib/place/public-place-path';
import { buildRelationshipTree, type RelationshipTreeNode } from './relationship-tree';
import './relationship-tree.css';

/**
 * Above this many records the deeper branches open closed, so a dense record shows a legible
 * first level instead of two hundred cards. Below it every branch is already open and no
 * disclosure row is drawn at all — a control that only ever expands three cards is clutter, and a
 * branch holding a single record is never folded for the same reason.
 */
const DENSE_RECORD_COUNT = 12;

export type RelationshipTreeProps = {
  readonly centerLabel: string;
  readonly graph: RelationshipGraph;
  /**
   * Relation wording per record id, replacing this component's own phrasing wholesale. The door
   * and place surfaces speak in human place lines ("a school in Washington") rather than catalog
   * tokens, and they suppress a relation outright when the stored token would not survive being
   * read aloud, so a record missing from this map shows its name with no phrase above it.
   *
   * A plain object rather than a callback: a server surface can hand this across, a function
   * could not survive being passed to a client component if this ever becomes one again.
   */
  readonly labels?: Readonly<Record<string, string>>;
  readonly className?: string;
};

/**
 * Where a record on the tree points.
 *
 * `neighborHref` collapses every `person` to `/memorial` and every `law`/`case` to `/law`, which
 * is right for a prose link and wrong here: it turns eight distinct people into eight links to
 * the same index page, which is the redundancy this component exists to remove. On the tree a
 * record addresses its own page. The rest of the app's routing is untouched.
 */
function nodeHref(node: {
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
 * The edge in words, in the direction it was stored. "Successor to" and "preceded by" are the
 * same edge read from two ends, so the direction has to survive into the label or the tree lies.
 */
function relationPhrase(node: RelationshipTreeNode): string {
  if (node.viaEventName !== undefined) return `both appear in ${node.viaEventName}`;
  const relation = humanizeToken(node.relationType).toLowerCase();
  if (relation.length === 0) return 'connected';
  return node.direction === 'incoming' ? `${relation}, from their record` : relation;
}

/** What a screen reader hears in place of the indent: the chain, spelled out. */
function accessibleName(node: RelationshipTreeNode, relation: string): string {
  const parts = [node.displayName];
  if (relation.length > 0) parts.push(relation);
  if (node.viaName !== undefined) parts.push(`through ${node.viaName}`);
  parts.push(node.year !== undefined ? `${node.year}` : 'undated');
  return parts.join(', ');
}

function Branch({
  node,
  labels,
  collapsible,
}: {
  readonly node: RelationshipTreeNode;
  readonly labels: Readonly<Record<string, string>> | undefined;
  readonly collapsible: boolean;
}) {
  const relation = labels ? (labels[node.id] ?? '') : relationPhrase(node);
  const kind = humanizeToken(node.kind).toLowerCase();
  const children =
    node.children.length > 0 ? (
      <ul className="ds-reltree__children">
        {node.children.map((child) => (
          <Branch key={child.id} node={child} labels={labels} collapsible={collapsible} />
        ))}
      </ul>
    ) : null;

  return (
    <li className={cx('ds-reltree__branch', `ds-reltree__branch--d${Math.min(node.depth, 3)}`)}>
      <a
        className="ds-reltree__card"
        href={nodeHref(node)}
        aria-label={accessibleName(node, relation)}
      >
        {relation.length > 0 ? <span className="ds-reltree__relation">{relation}</span> : null}
        <span className="ds-reltree__name">{node.displayName}</span>
        <span className="ds-reltree__meta">
          {kind.length > 0 ? <span className="ds-reltree__kind">{kind}</span> : null}
          {node.year !== undefined ? <span className="ds-reltree__year">{node.year}</span> : null}
        </span>
        {node.alsoConnects.length > 0 ? (
          <span className="ds-reltree__loop">also connects to {node.alsoConnects.join(', ')}</span>
        ) : null}
      </a>

      {children === null ? null : collapsible && node.descendantCount > 1 ? (
        <details className="ds-reltree__more">
          <summary
            className="ds-reltree__more-toggle"
            aria-label={`Show the ${node.descendantCount} records connected to ${node.displayName}`}
          >
            <span className="ds-reltree__more-open">{`${node.descendantCount} more from here`}</span>
            <span className="ds-reltree__more-close">hide</span>
          </summary>
          {children}
        </details>
      ) : (
        children
      )}
    </li>
  );
}

export function RelationshipTree({ centerLabel, graph, labels, className }: RelationshipTreeProps) {
  if (graph.nodes.length === 0) return null;

  const tree = buildRelationshipTree(graph, centerLabel);
  const collapsible = tree.total > DENSE_RECORD_COUNT;

  return (
    <figure className={cx('ds-reltree', className)}>
      <figcaption className="ds-reltree__lede">
        Every record the archive links to this one, and what those records link to in turn. Each
        line is a stored connection, read in the direction it was filed.
      </figcaption>

      <div className="ds-reltree__root">
        <p className="ds-reltree__center">
          <span className="ds-reltree__center-name">{tree.centerLabel}</span>
          {tree.centerYear !== undefined ? (
            <span className="ds-reltree__year">{tree.centerYear}</span>
          ) : null}
        </p>

        <ul
          className="ds-reltree__children ds-reltree__children--top"
          aria-label={`Records connected to ${centerLabel}`}
        >
          {tree.branches.map((branch) => (
            <Branch key={branch.id} node={branch} labels={labels} collapsible={collapsible} />
          ))}
        </ul>
      </div>
    </figure>
  );
}
