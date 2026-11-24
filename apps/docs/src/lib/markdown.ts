/**
 * Markdown → safe HTML for curated docs pages.
 * GFM tables/lists; heading slugs for in-page anchors.
 */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeStringify from 'rehype-stringify';

type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

/** Makes horizontally scrolling blocks reachable by keyboard. */
function rehypeScrollableBlocks() {
  const walk = (node: HastNode) => {
    if (!node.children) {
      return;
    }
    node.children = node.children.map((child) => {
      if (child.tagName === 'pre') {
        child.properties = { ...child.properties, tabIndex: 0 };
        return child;
      }
      if (child.tagName === 'table') {
        return {
          type: 'element',
          tagName: 'div',
          properties: {
            className: ['table-scroll'],
            tabIndex: 0,
            role: 'region',
            ariaLabel: 'Table',
          },
          children: [child],
        };
      }
      walk(child);
      return child;
    });
  };
  return walk;
}

export async function renderMarkdown(source: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, {
      behavior: 'wrap',
      properties: { className: ['heading-anchor'] },
    })
    .use(rehypeScrollableBlocks)
    .use(rehypeStringify)
    .process(source);
  return String(file);
}
