/** The editor document is a view of story blocks; persistence keeps the story contract. */
import type { JSONContent } from '@tiptap/core';
import type { StoryBodyBlockDoc } from '@repo/schemas';
// The subpath keeps the client bundle off the root index, which reads policy files with node:fs.
import {
  isSafeStoryLinkHref,
  parseStoryInline,
  serializeStoryInline,
  storyInlinePlainText,
  type StoryInlineNode,
} from '@repo/schemas/story-inline';

/** Warnings are non-fatal: the text is still saved, the named formatting is not. */
export type AdapterWarn = (message: string) => void;

type Marks = { readonly bold: boolean; readonly italic: boolean; readonly href: string | null };
const NO_MARKS: Marks = { bold: false, italic: false, href: null };

// ---------------------------------------------------------------------------------------------
// Story text -> Tiptap inline content
// ---------------------------------------------------------------------------------------------

function markList(marks: Marks, allowLink: boolean): JSONContent['marks'] {
  const out: NonNullable<JSONContent['marks']> = [];
  if (marks.bold) out.push({ type: 'bold' });
  if (marks.italic) out.push({ type: 'italic' });
  if (allowLink && marks.href) out.push({ type: 'link', attrs: { href: marks.href } });
  return out.length ? out : undefined;
}

function walk(nodes: readonly StoryInlineNode[], marks: Marks, out: JSONContent[]): void {
  for (const node of nodes) {
    switch (node.type) {
      case 'text': {
        if (node.text === '') break;
        const m = markList(marks, true);
        out.push(
          m ? { type: 'text', text: node.text, marks: m } : { type: 'text', text: node.text },
        );
        break;
      }
      case 'break': {
        const m = markList(marks, false);
        out.push(m ? { type: 'hardBreak', marks: m } : { type: 'hardBreak' });
        break;
      }
      case 'cite': {
        const m = markList(marks, false);
        out.push({ type: 'citation', attrs: { refId: node.refId }, ...(m ? { marks: m } : {}) });
        break;
      }
      case 'entity': {
        const m = markList(marks, false);
        out.push({
          type: 'entityLink',
          attrs: { entityId: node.entityId.trim(), label: node.label.trim() },
          ...(m ? { marks: m } : {}),
        });
        break;
      }
      case 'strong':
        walk(node.children, { ...marks, bold: true }, out);
        break;
      case 'em':
        walk(node.children, { ...marks, italic: true }, out);
        break;
      case 'link':
        walk(node.children, { ...marks, href: node.href }, out);
        break;
    }
  }
}

/** Story prose in the shared inline grammar -> editor inline nodes. */
export function inline(text: string): JSONContent[] {
  const out: JSONContent[] = [];
  walk(parseStoryInline(text), NO_MARKS, out);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Tiptap inline content -> story text
// ---------------------------------------------------------------------------------------------

type Run =
  | ({ kind: 'text'; text: string } & Marks)
  | ({ kind: 'break' } & Marks)
  | ({ kind: 'cite'; refId: string } & Marks)
  | ({ kind: 'entity'; entityId: string; label: string } & Marks);

function marksOf(node: JSONContent): Marks {
  let bold = false;
  let italic = false;
  let href: string | null = null;
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') bold = true;
    else if (mark.type === 'italic') italic = true;
    else if (mark.type === 'link') href = String(mark.attrs?.href ?? '');
    else throw new Error('This formatting is not supported by the story contract.');
  }
  return { bold, italic, href };
}

function collectRuns(content: readonly JSONContent[] | undefined, out: Run[]): void {
  for (const node of content ?? []) {
    switch (node.type) {
      case 'text':
        if (node.text) out.push({ kind: 'text', text: node.text, ...marksOf(node) });
        break;
      case 'hardBreak':
        out.push({ kind: 'break', ...marksOf(node), href: null });
        break;
      case 'citation':
        out.push({
          kind: 'cite',
          refId: String(node.attrs?.refId ?? ''),
          ...marksOf(node),
          href: null,
        });
        break;
      case 'entityLink':
        out.push({
          kind: 'entity',
          entityId: String(node.attrs?.entityId ?? ''),
          label: String(node.attrs?.label ?? ''),
          ...marksOf(node),
          href: null,
        });
        break;
      default:
        collectRuns(node.content, out);
    }
  }
}

const isSpaceRun = (run: Run) =>
  run.kind === 'break' || (run.kind === 'text' && /^\s*$/.test(run.text));

/**
 * `**` and `_` need a non-space next to the inside edge, so whitespace at the edge of a marked
 * stretch moves outside it: selecting a word together with its trailing space still saves as
 * emphasis on the word.
 */
function hoistEdges(runs: readonly Run[], key: 'bold' | 'italic'): Run[] {
  const out: Run[] = [];
  let i = 0;
  while (i < runs.length) {
    if (!runs[i]![key]) {
      out.push(runs[i++]!);
      continue;
    }
    let j = i;
    while (j < runs.length && runs[j]![key]) j += 1;
    const group = runs.slice(i, j).map((run) => ({ ...run }));
    const lead: Run[] = [];
    const trail: Run[] = [];
    while (group.length && isSpaceRun(group[0]!)) lead.push({ ...group.shift()!, [key]: false });
    while (group.length && isSpaceRun(group[group.length - 1]!))
      trail.unshift({ ...group.pop()!, [key]: false });
    const first = group[0];
    if (first?.kind === 'text') {
      const space = /^\s+/.exec(first.text)?.[0] ?? '';
      if (space) {
        lead.push({ ...first, text: space, [key]: false });
        group[0] = { ...first, text: first.text.slice(space.length) };
      }
    }
    const last = group[group.length - 1];
    if (last?.kind === 'text') {
      const space = /\s+$/.exec(last.text)?.[0] ?? '';
      if (space) {
        trail.unshift({ ...last, text: space, [key]: false });
        group[group.length - 1] = { ...last, text: last.text.slice(0, -space.length) };
      }
    }
    out.push(...lead, ...group, ...trail);
    i = j;
  }
  return out;
}

function leaf(run: Run): StoryInlineNode {
  switch (run.kind) {
    case 'text':
      return { type: 'text', text: run.text };
    case 'break':
      return { type: 'break' };
    case 'cite':
      return { type: 'cite', refId: run.refId };
    case 'entity':
      return { type: 'entity', entityId: run.entityId, label: run.label };
  }
}

/** Nesting order is strong > em > link, so every run set has exactly one tree. */
function build(runs: readonly Run[]): StoryInlineNode[] {
  const groups = <T>(
    items: readonly T[],
    same: (a: T, b: T) => boolean,
    pick: (item: T) => boolean,
  ): (T[] & { marked?: boolean })[] => {
    const out: (T[] & { marked?: boolean })[] = [];
    for (const item of items) {
      const last = out[out.length - 1];
      const marked = pick(item);
      if (last && last.marked === marked && same(last[0]!, item)) last.push(item);
      else {
        const group = [item] as T[] & { marked?: boolean };
        group.marked = marked;
        out.push(group);
      }
    }
    return out;
  };
  const byLink = (items: readonly Run[]): StoryInlineNode[] =>
    groups(
      items,
      (a, b) => a.href === b.href,
      (r) => r.href !== null,
    ).flatMap((group) =>
      group.marked
        ? [{ type: 'link' as const, href: group[0]!.href!, children: group.map(leaf) }]
        : group.map(leaf),
    );
  const byEm = (items: readonly Run[]): StoryInlineNode[] =>
    groups(
      items,
      () => true,
      (r) => r.italic,
    ).flatMap((group) =>
      group.marked ? [{ type: 'em' as const, children: byLink(group) }] : byLink(group),
    );
  return groups(
    runs,
    () => true,
    (r) => r.bold,
  ).flatMap((group) =>
    group.marked ? [{ type: 'strong' as const, children: byEm(group) }] : byEm(group),
  );
}

const runPlain = (runs: readonly Run[]) =>
  runs
    .map((run) =>
      run.kind === 'text'
        ? run.text
        : run.kind === 'break'
          ? '\n'
          : run.kind === 'cite'
            ? ' '
            : run.label.trim() || run.entityId.trim(),
    )
    .join('');

/**
 * Editor inline content -> story text. Never drops words: a link that is not https loses the
 * link, and emphasis the grammar cannot express (for example italics inside a word) loses the
 * emphasis, each with a warning. Nothing is thrown for formatting the grammar can degrade.
 */
export function serializeInlineContent(
  content: readonly JSONContent[] | undefined,
  warn?: AdapterWarn,
): string {
  let runs: Run[] = [];
  collectRuns(content, runs);
  runs = runs.map((run) => {
    if (run.href && !isSafeStoryLinkHref(run.href)) {
      warn?.(
        `The link to “${run.href.slice(0, 60)}” was not saved. Story links must start with https://.`,
      );
      return { ...run, href: null };
    }
    return run;
  });
  const render = (list: readonly Run[]) =>
    serializeStoryInline(build(hoistEdges(hoistEdges(list, 'bold'), 'italic')));
  const expected = runPlain(runs);
  const attempts: Run[][] = [
    runs,
    runs.map((run) => ({ ...run, italic: false })),
    runs.map((run) => ({ ...run, italic: false, bold: false })),
  ];
  for (const [index, attempt] of attempts.entries()) {
    const text = render(attempt);
    if (storyInlinePlainText(text) === expected) {
      if (index > 0)
        warn?.(
          'Some emphasis could not be saved. Bold and italics must wrap whole words, with no space inside the edges.',
        );
      return text;
    }
  }
  return render(attempts[2]!);
}

/** Order- and attribute-insensitive view of inline content, to detect an untouched block. */
function canon(content: readonly JSONContent[] | undefined): unknown[] {
  return (content ?? []).map((node) => ({
    t: node.type,
    s: node.text,
    a:
      node.type === 'citation'
        ? node.attrs?.refId
        : node.type === 'entityLink'
          ? [node.attrs?.entityId, node.attrs?.label]
          : undefined,
    m: (node.marks ?? [])
      .map((mark) => (mark.type === 'link' ? `link:${mark.attrs?.href}` : mark.type))
      .sort(),
  }));
}

/**
 * Prose for one text-bearing node. A block the writer has not touched keeps its stored string
 * byte for byte, so opening a story never rewrites emphasis the grammar writes two ways.
 */
function prose(
  content: readonly JSONContent[] | undefined,
  original: string | undefined,
  warn?: AdapterWarn,
): string {
  if (
    original !== undefined &&
    JSON.stringify(canon(content)) === JSON.stringify(canon(inline(original)))
  )
    return original;
  return serializeInlineContent(content, warn);
}

// ---------------------------------------------------------------------------------------------
// Story blocks <-> document
// ---------------------------------------------------------------------------------------------

/**
 * Headings are plain text: the public page prints them as written, so `**` and `[[...]]` in a
 * heading are literal characters here too, and nothing in one is parsed or marked.
 */
function plainInline(text: string): JSONContent[] {
  return text
    .split('\n')
    .flatMap((line, i): JSONContent[] => [
      ...(i > 0 ? [{ type: 'hardBreak' }] : []),
      ...(line ? [{ type: 'text', text: line }] : []),
    ]);
}

function plainOf(content: readonly JSONContent[] | undefined): string {
  const runs: Run[] = [];
  collectRuns(content, runs);
  return runs
    .map((run) =>
      run.kind === 'text'
        ? run.text
        : run.kind === 'break'
          ? '\n'
          : run.kind === 'cite'
            ? `[ref:${run.refId}]`
            : run.label
              ? `[[${run.entityId}|${run.label}]]`
              : `[[${run.entityId}]]`,
    )
    .join('');
}

const cellParagraph = (text: string): JSONContent => ({ type: 'paragraph', content: inline(text) });

export function storyToDocument(body: readonly StoryBodyBlockDoc[]): JSONContent {
  return {
    type: 'doc',
    content: body.length
      ? body.map((block): JSONContent => {
          const attrs = { storyBlock: block };
          switch (block.type) {
            case 'paragraph':
              return { type: 'paragraph', attrs, content: inline(block.text) };
            case 'heading':
              return {
                type: 'heading',
                attrs: { ...attrs, level: block.level },
                content: plainInline(block.text),
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
            case 'table':
              return {
                type: 'storyTable',
                attrs,
                content: [
                  {
                    type: 'table',
                    content: block.rows.map((row, r) => ({
                      type: 'tableRow',
                      content: row.map((cell) => ({
                        type: block.header && r === 0 ? 'tableHeader' : 'tableCell',
                        content: [cellParagraph(cell)],
                      })),
                    })),
                  },
                  { type: 'storyTableCaption', content: inline(block.caption) },
                ],
              };
            case 'video':
              return { type: 'storyVideo', attrs };
            case 'divider':
              return { type: 'horizontalRule', attrs };
            default:
              return { type: 'editorialBlock', attrs };
          }
        })
      : [{ type: 'paragraph', content: [] }],
  };
}

export function documentToStory(doc: JSONContent, warn?: AdapterWarn): StoryBodyBlockDoc[] {
  const nodes = doc.content ?? [];
  return nodes.flatMap((node, index): StoryBodyBlockDoc[] => {
    const original = node.attrs?.storyBlock as StoryBodyBlockDoc | undefined;
    const prior = <T extends StoryBodyBlockDoc['type']>(type: T) =>
      original?.type === type ? (original as Extract<StoryBodyBlockDoc, { type: T }>) : undefined;
    const oldText = (type: 'paragraph' | 'pullquote') => prior(type)?.text;
    switch (node.type) {
      case 'paragraph': {
        const text = prose(node.content, oldText('paragraph'), warn);
        if (!original && !text && index === nodes.length - 1) return [];
        return [{ ...prior('paragraph'), type: 'paragraph', text }];
      }
      case 'heading':
        if (![2, 3].includes(node.attrs?.level))
          throw new Error('Story headings use section or subsection levels.');
        return [
          {
            ...prior('heading'),
            type: 'heading',
            level: node.attrs!.level,
            text: plainOf(node.content),
          },
        ];
      case 'blockquote': {
        // Paragraphs inside a quote are stored joined by one newline, as a hard break is.
        const joined = (node.content ?? []).flatMap((p, i): JSONContent[] => [
          ...(i > 0 ? [{ type: 'hardBreak' }] : []),
          ...(p.content ?? []),
        ]);
        const text = prose(joined, oldText('pullquote'), warn);
        return [{ ...prior('pullquote'), type: 'pullquote', text }];
      }
      case 'bulletList':
      case 'orderedList': {
        if (node.type === 'orderedList' && node.attrs?.start && node.attrs.start !== 1)
          throw new Error('Numbered lists start at one.');
        const before = prior('list')?.items;
        const items = (node.content ?? []).map((item, i) => {
          if (
            item.type !== 'listItem' ||
            item.content?.length !== 1 ||
            item.content[0]?.type !== 'paragraph'
          )
            throw new Error(
              'Keep each list item as one paragraph. Nested lists require a separate list block.',
            );
          return prose(
            item.content[0].content,
            before?.length === node.content?.length ? before?.[i] : undefined,
            warn,
          );
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
      case 'storyTable': {
        const before = prior('table');
        const table = (node.content ?? []).find((child) => child.type === 'table');
        const caption = (node.content ?? []).find((child) => child.type === 'storyTableCaption');
        const rowNodes = table?.content ?? [];
        const rows = rowNodes.map((row, r) =>
          (row.content ?? []).flatMap((cell, c) => {
            const text = prose(
              cell.content?.[0]?.content,
              before?.rows[r]?.length === row.content?.length ? before?.rows[r]?.[c] : undefined,
              warn,
            );
            // A merged cell (pasted HTML) keeps its text and pads the columns it covered.
            const span = Math.max(1, Number(cell.attrs?.colspan ?? 1));
            return [text, ...Array.from({ length: span - 1 }, () => '')];
          }),
        );
        const header =
          rowNodes.length > 0 &&
          (rowNodes[0]!.content ?? []).length > 0 &&
          (rowNodes[0]!.content ?? []).every((cell) => cell.type === 'tableHeader');
        return [
          {
            ...before,
            type: 'table',
            caption: prose(caption?.content, before?.caption, warn),
            header,
            rows,
          },
        ];
      }
      case 'storyVideo': {
        if (!original || original.type !== 'video')
          throw new Error('The video block could not be recovered.');
        return [original];
      }
      case 'horizontalRule':
        return [{ type: 'divider' }];
      case 'editorialBlock':
        if (!original) throw new Error('The evidence block could not be recovered.');
        return [original];
      default:
        throw new Error(`Unsupported story block: ${node.type ?? 'unknown'}.`);
    }
  });
}
