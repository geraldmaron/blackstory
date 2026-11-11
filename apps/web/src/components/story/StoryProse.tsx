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

export function StoryCitationMarks({ numbers }: { readonly numbers: readonly number[] }) {
  if (numbers.length === 0) return null;
  return (
    <sup className="ds-reading-cite">
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

function renderNodes(
  nodes: readonly StoryInlineNode[],
  refNumberById: ReadonlyMap<string, number>,
): React.ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.type) {
      case 'text':
        return <React.Fragment key={index}>{node.text}</React.Fragment>;
      case 'break':
        return <React.Fragment key={index}>{'\n'}</React.Fragment>;
      case 'cite': {
        const number = refNumberById.get(node.refId);
        return number === undefined ? null : <StoryCitationMarks key={index} numbers={[number]} />;
      }
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
  });
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
