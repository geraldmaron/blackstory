/** The editor document is a view of story blocks; persistence keeps the story contract. */
import type { JSONContent } from '@tiptap/core';
import type { StoryBodyBlockDoc } from '@repo/schemas';
/**
 * The entity-link half of the pattern, character for character the domain's
 * `ENTITY_PROSE_LINK_RE` (the one the public renderer uses). It is restated here because that
 * module also imports `node:crypto`, which a client bundle cannot take; `document-adapter.test.ts`
 * fails if the two ever drift apart. The bracket exclusions are what keep it linear-time.
 */
export const ENTITY_LINK_SOURCE = String.raw`\[\[([^|\][]+)(?:\|([^\][]+))?\]\]`;
/**
 * Inline markup the story contract stores inside plain text: `[ref:id]` citations, entity links
 * (`[[entityId]]` / `[[entityId|Label]]`) and newlines. Capture groups: 1 citation id, 2 entity
 * id, 3 entity label.
 */
const citation = new RegExp(
  String.raw`\[ref:([a-z0-9]+(?:-[a-z0-9]+)*)\]|${ENTITY_LINK_SOURCE}|\n`,
  'g',
);
function inline(text: string): JSONContent[] {
  const content: JSONContent[] = [];
  let start = 0;
  for (const match of text.matchAll(citation)) {
    if (match.index! > start) content.push({ type: 'text', text: text.slice(start, match.index) });
    if (match[1]) content.push({ type: 'citation', attrs: { refId: match[1] } });
    else if (match[2])
      content.push({
        type: 'entityLink',
        attrs: { entityId: match[2].trim(), label: match[3]?.trim() ?? '' },
      });
    else content.push({ type: 'hardBreak' });
    start = match.index! + match[0].length;
  }
  if (start < text.length) content.push({ type: 'text', text: text.slice(start) });
  return content;
}
function text(node: JSONContent): string {
  if (node.type === 'text') {
    if (node.marks?.length)
      throw new Error('This formatting is not supported by the story contract.');
    return node.text ?? '';
  }
  if (node.type === 'citation') return `[ref:${node.attrs?.refId}]`;
  if (node.type === 'entityLink')
    return node.attrs?.label
      ? `[[${node.attrs.entityId}|${node.attrs.label}]]`
      : `[[${node.attrs?.entityId}]]`;
  if (node.type === 'hardBreak') return '\n';
  return (node.content ?? []).map(text).join('');
}
export function storyToDocument(body: readonly StoryBodyBlockDoc[]): JSONContent {
  return {
    type: 'doc',
    content: body.length
      ? body.map((block) => {
          const attrs = { storyBlock: block };
          switch (block.type) {
            case 'paragraph':
              return { type: 'paragraph', attrs, content: inline(block.text) };
            case 'heading':
              return {
                type: 'heading',
                attrs: { ...attrs, level: block.level },
                content: inline(block.text),
              };
            case 'list':
              return {
                type: block.style === 'number' ? 'orderedList' : 'bulletList',
                attrs,
                content: block.items.map((item) => ({
                  type: 'listItem',
                  content: [{ type: 'paragraph', content: inline(item) }],
                })),
              };
            case 'pullquote':
              return {
                type: 'blockquote',
                attrs,
                content: [{ type: 'paragraph', content: inline(block.text) }],
              };
            default:
              return { type: 'editorialBlock', attrs: { storyBlock: block } };
          }
        })
      : [{ type: 'paragraph', content: [] }],
  };
}
export function documentToStory(doc: JSONContent): StoryBodyBlockDoc[] {
  return (doc.content ?? []).flatMap((node, index): StoryBodyBlockDoc[] => {
    const original = node.attrs?.storyBlock as StoryBodyBlockDoc | undefined;
    const prior = (type: StoryBodyBlockDoc['type']) => (original?.type === type ? original : {});
    switch (node.type) {
      case 'paragraph':
        if (!original && !text(node) && index === (doc.content?.length ?? 0) - 1) return [];
        return [{ ...prior('paragraph'), type: 'paragraph', text: text(node) }];
      case 'heading':
        if (![2, 3].includes(node.attrs?.level))
          throw new Error('Story headings use section or subsection levels.');
        return [
          { ...prior('heading'), type: 'heading', level: node.attrs!.level, text: text(node) },
        ];
      case 'blockquote':
        return [
          {
            ...prior('pullquote'),
            type: 'pullquote',
            text: (node.content ?? []).map(text).join('\n'),
          },
        ];
      case 'bulletList':
      case 'orderedList': {
        if (node.type === 'orderedList' && node.attrs?.start && node.attrs.start !== 1)
          throw new Error('Numbered lists start at one.');
        const items = (node.content ?? []).map((item) => {
          if (
            item.type !== 'listItem' ||
            item.content?.length !== 1 ||
            item.content[0]?.type !== 'paragraph'
          )
            throw new Error(
              'Keep each list item as one paragraph. Nested lists require a separate list block.',
            );
          return text(item);
        });
        return [
          {
            ...prior('list'),
            type: 'list',
            style: node.type === 'orderedList' ? 'number' : 'bullet',
            items,
          },
        ];
      }
      case 'editorialBlock':
        if (!original) throw new Error('The evidence block could not be recovered.');
        return [original];
      default:
        throw new Error(`Unsupported story block: ${node.type ?? 'unknown'}.`);
    }
  });
}
