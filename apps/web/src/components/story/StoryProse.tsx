/**
 * Renders story prose through the shared inline grammar (`@repo/schemas` story-inline):
 * `[ref:<id>]` citations become superscript reference numbers that link down to the references
 * section, `[[entityId|Label]]` becomes a link to the entity record (the same convention
 * `LinkedProse` renders on entity and theme surfaces), `**strong**` / `_em_` become marks and
 * `[label](https://url)` becomes an external link.
 * Unknown citation markers (no resolved number) are dropped from the output.
 */
import React from 'react';
import { parseStoryInline, type StoryInlineNode } from '@repo/schemas';
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { EntityLink, humanizeEntityId } from '../entity/EntityLink';

void React;

export type StoryProseProps = {
  readonly text: string;
  readonly refNumberById: ReadonlyMap<string, number>;
  readonly className?: string;
  /**
   * Element to render into. Defaults to `p`; call-out list items pass `span` so the
   * prose sits inside its own `<li>` rather than nesting a paragraph in a list item.
   */
  readonly as?: 'p' | 'span';
};

/** One superscript per citation run: each reference once, in ascending order. */
export function StoryCitationMarks({ numbers }: { readonly numbers: readonly number[] }) {
  const unique = [...new Set(numbers)].sort((a, b) => a - b);
  if (unique.length === 0) return null;
  return (
    <sup className="ds-reading-cite">
      {unique.map((number, index) => (
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

/**
 * Adjacent citations ("[ref:a] [ref:b]", or two ids that resolve to one source) are one run: they
 * render as one superscript, so a source never prints twice in a row.
 */
function citeRunEnd(nodes: readonly StoryInlineNode[], start: number): number {
  let end = start;
  for (let i = start + 1; i < nodes.length; i += 1) {
    const node = nodes[i]!;
    if (node.type === 'cite') end = i;
    else if (!(node.type === 'text' && node.text.trim() === '')) break;
  }
  return end;
}

function renderNodes(
  nodes: readonly StoryInlineNode[],
  refNumberById: ReadonlyMap<string, number>,
): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]!;
    if (node.type === 'cite') {
      const end = citeRunEnd(nodes, index);
      const numbers = nodes
        .slice(index, end + 1)
        .flatMap((n) => (n.type === 'cite' ? [refNumberById.get(n.refId)] : []))
        .filter((n): n is number => n !== undefined);
      out.push(<StoryCitationMarks key={index} numbers={numbers} />);
      index = end;
      continue;
    }
    out.push(renderNode(node, index, refNumberById));
  }
  return out;
}

function renderNode(
  node: Exclude<StoryInlineNode, { readonly type: 'cite' }>,
  index: number,
  refNumberById: ReadonlyMap<string, number>,
): React.ReactNode {
  switch (node.type) {
    case 'text':
      return <React.Fragment key={index}>{node.text}</React.Fragment>;
    case 'break':
      return <React.Fragment key={index}>{'\n'}</React.Fragment>;
    case 'entity': {
      const entityId = node.entityId.trim();
      if (!entityId) return null;
      return (
        <EntityLink key={index} entityId={entityId}>
          {node.label.trim() || humanizeEntityId(entityId)}
        </EntityLink>
      );
    }
    case 'strong':
      return <strong key={index}>{renderNodes(node.children, refNumberById)}</strong>;
    case 'em':
      return <em key={index}>{renderNodes(node.children, refNumberById)}</em>;
    case 'link':
      return (
        <a
          key={index}
          className="ds-reading__extlink"
          href={node.href}
          rel="noopener noreferrer external"
          target="_blank"
        >
          {renderNodes(node.children, refNumberById)}
          <span className="ds-visually-hidden"> (opens in a new tab)</span>
          <FontAwesomeIcon
            icon={faArrowUpRightFromSquare}
            className="ds-reading__extlink-icon"
            aria-hidden="true"
          />
        </a>
      );
  }
}

/** The same rendering with no wrapping element, for callers that already own the tag. */
export function StoryInline({
  text,
  refNumberById,
}: Pick<StoryProseProps, 'text' | 'refNumberById'>) {
  return <>{renderNodes(parseStoryInline(text), refNumberById)}</>;
}

export function StoryProse({ text, refNumberById, className, as }: StoryProseProps) {
  const Tag = as ?? 'p';
  return <Tag className={className}>{renderNodes(parseStoryInline(text), refNumberById)}</Tag>;
}
