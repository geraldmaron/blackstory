/** The editor document is a view of article blocks; persistence keeps the article contract. */
import type { JSONContent } from '@tiptap/core';
import type { ArticleBodyBlockDoc } from '@repo/schemas';
const citation = /\[ref:([a-z0-9]+(?:-[a-z0-9]+)*)\]|\n/g;
function inline(text: string): JSONContent[] {
  const content: JSONContent[] = [];
  let start = 0;
  for (const match of text.matchAll(citation)) {
    if (match.index! > start) content.push({ type: 'text', text: text.slice(start, match.index) });
    content.push(
      match[1] ? { type: 'citation', attrs: { refId: match[1] } } : { type: 'hardBreak' },
    );
    start = match.index! + match[0].length;
  }
  if (start < text.length) content.push({ type: 'text', text: text.slice(start) });
  return content;
}
function text(node: JSONContent): string {
  if (node.type === 'text') {
    if (node.marks?.length)
      throw new Error('This formatting is not supported by the article contract.');
    return node.text ?? '';
  }
  if (node.type === 'citation') return `[ref:${node.attrs?.refId}]`;
  if (node.type === 'hardBreak') return '\n';
  return (node.content ?? []).map(text).join('');
}
export function articleToDocument(body: readonly ArticleBodyBlockDoc[]): JSONContent {
  return {
    type: 'doc',
    content: body.length
      ? body.map((block) => {
          const attrs = { articleBlock: block };
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
              return { type: 'editorialBlock', attrs: { articleBlock: block } };
          }
        })
      : [{ type: 'paragraph', content: [] }],
  };
}
export function documentToArticle(doc: JSONContent): ArticleBodyBlockDoc[] {
  return (doc.content ?? []).flatMap((node, index): ArticleBodyBlockDoc[] => {
    const original = node.attrs?.articleBlock as ArticleBodyBlockDoc | undefined;
    const prior = (type: ArticleBodyBlockDoc['type']) => (original?.type === type ? original : {});
    switch (node.type) {
      case 'paragraph':
        if (!original && !text(node) && index === (doc.content?.length ?? 0) - 1) return [];
        return [{ ...prior('paragraph'), type: 'paragraph', text: text(node) }];
      case 'heading':
        if (![2, 3].includes(node.attrs?.level))
          throw new Error('Article headings use section or subsection levels.');
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
        throw new Error(`Unsupported article block: ${node.type ?? 'unknown'}.`);
    }
  });
}
