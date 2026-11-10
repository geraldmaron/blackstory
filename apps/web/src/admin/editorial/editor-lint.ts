import { isSafeStoryLinkHref } from '@repo/schemas/story-inline';

/**
 * Live checks of the story editor's document against the limits the story contract enforces
 * at publication (`public-stories.ts`): heading 240, pullquote 600, list item 600, list 24 items,
 * no empty text blocks, and every `[ref:id]` pointing at an attached source.
 *
 * Lengths are measured on the stored string, not the rendered text: a citation costs
 * `[ref:id]` characters and an entity link costs `[[id|Label]]`, because that is what the schema
 * counts. Structural typing keeps this testable without a ProseMirror schema in the browser.
 */

export const HEADING_MAX = 240;
export const PULLQUOTE_MAX = 600;
export const LIST_ITEM_MAX = 600;
export const LIST_ITEMS_MAX = 24;
export const TABLE_COLUMNS_MAX = 12;
export const TABLE_ROWS_MAX = 60;

export type LintNode = {
  readonly type: { readonly name: string };
  readonly attrs: Readonly<Record<string, unknown>>;
  readonly text?: string | null | undefined;
  readonly marks?: readonly {
    readonly type: { readonly name: string };
    readonly attrs: Readonly<Record<string, unknown>>;
  }[];
  readonly childCount: number;
  forEach(callback: (node: LintNode, offset: number, index: number) => void): void;
  descendants(callback: (node: LintNode, pos: number) => boolean | void): void;
};

export type EditorLintIssue = {
  /** Top-level block the issue belongs to. */
  readonly index: number;
  readonly kind:
    | 'heading-length'
    | 'empty-block'
    | 'pullquote-length'
    | 'list-size'
    | 'list-item-length'
    | 'missing-citation'
    | 'table-caption'
    | 'table-width'
    | 'table-size'
    | 'video-incomplete'
    | 'link-not-https'
    | 'entity-unpublished';
  readonly message: string;
};

/** Length of the string the contract stores for this node. */
export function storedLength(node: LintNode): number {
  switch (node.type.name) {
    case 'text': {
      // Emphasis and links cost their markers in the stored string.
      let marked = 0;
      for (const mark of node.marks ?? []) {
        if (mark.type.name === 'bold') marked += 4;
        else if (mark.type.name === 'italic') marked += 2;
        else if (mark.type.name === 'link') marked += 4 + String(mark.attrs.href ?? '').length;
      }
      return (node.text?.length ?? 0) + marked;
    }
    case 'citation':
      return `[ref:${String(node.attrs.refId)}]`.length;
    case 'entityLink':
      return node.attrs.label
        ? `[[${String(node.attrs.entityId)}|${String(node.attrs.label)}]]`.length
        : `[[${String(node.attrs.entityId)}]]`.length;
    case 'hardBreak':
      return 1;
    default: {
      let total = 0;
      node.forEach((child, _offset, index) => {
        // Paragraphs inside a quote are joined by one newline in storage.
        if (node.type.name === 'blockquote' && index > 0) total += 1;
        total += storedLength(child);
      });
      return total;
    }
  }
}

export type LintContext = {
  /** Records known (from this session's searches) not to be public yet. Unknown ids are skipped. */
  readonly unpublishedEntityIds?: ReadonlySet<string>;
};

export function lintStoryDocument(
  doc: LintNode,
  referenceIds: ReadonlySet<string>,
  context: LintContext = {},
): readonly EditorLintIssue[] {
  const issues: EditorLintIssue[] = [];
  const last = doc.childCount - 1;
  doc.forEach((node, _offset, index) => {
    const name = node.type.name;
    const length = storedLength(node);
    if (name === 'heading') {
      if (length === 0) {
        issues.push({ index, kind: 'empty-block', message: 'This heading is empty.' });
      } else if (length > HEADING_MAX) {
        issues.push({
          index,
          kind: 'heading-length',
          message: `Headings are limited to ${HEADING_MAX} characters; this one has ${length}.`,
        });
      }
    } else if (name === 'paragraph') {
      // The trailing empty paragraph is the cursor's resting place and is never saved.
      if (length === 0 && index !== last) {
        issues.push({
          index,
          kind: 'empty-block',
          message: 'This paragraph is empty. Add text or remove it.',
        });
      }
    } else if (name === 'blockquote') {
      if (length === 0) {
        issues.push({ index, kind: 'empty-block', message: 'This quotation is empty.' });
      } else if (length > PULLQUOTE_MAX) {
        issues.push({
          index,
          kind: 'pullquote-length',
          message: `Quotations are limited to ${PULLQUOTE_MAX} characters; this one has ${length}.`,
        });
      }
    } else if (name === 'bulletList' || name === 'orderedList') {
      if (node.childCount > LIST_ITEMS_MAX) {
        issues.push({
          index,
          kind: 'list-size',
          message: `Lists are limited to ${LIST_ITEMS_MAX} items; this one has ${node.childCount}.`,
        });
      }
      node.forEach((item) => {
        const itemLength = storedLength(item);
        if (itemLength === 0) {
          issues.push({ index, kind: 'empty-block', message: 'A list item is empty.' });
        } else if (itemLength > LIST_ITEM_MAX) {
          issues.push({
            index,
            kind: 'list-item-length',
            message: `List items are limited to ${LIST_ITEM_MAX} characters; one has ${itemLength}.`,
          });
        }
      });
    }
    if (name === 'storyTable') {
      let caption = 0;
      let widest = 0;
      let rows = 0;
      const widths: number[] = [];
      node.forEach((part) => {
        if (part.type.name === 'storyTableCaption') caption = storedLength(part);
        if (part.type.name !== 'table') return;
        part.forEach((row) => {
          rows += 1;
          let width = 0;
          row.forEach((cell) => {
            width += Math.max(1, Number(cell.attrs.colspan ?? 1));
          });
          widths.push(width);
          widest = Math.max(widest, width);
        });
      });
      if (caption === 0) {
        issues.push({
          index,
          kind: 'table-caption',
          message: 'This table needs a caption that says what it shows.',
        });
      }
      if (widths.some((width) => width !== widths[0])) {
        issues.push({
          index,
          kind: 'table-width',
          message: 'Every row of this table needs the same number of cells.',
        });
      }
      if (widest > TABLE_COLUMNS_MAX || rows > TABLE_ROWS_MAX) {
        issues.push({
          index,
          kind: 'table-size',
          message: `Tables are limited to ${TABLE_COLUMNS_MAX} columns and ${TABLE_ROWS_MAX} rows.`,
        });
      }
    }
    if (name === 'storyVideo') {
      const block = (node.attrs.storyBlock ?? {}) as {
        videoId?: string;
        title?: string;
        credit?: string;
      };
      const missing = [
        !block.videoId && 'a link',
        !block.title?.trim() && 'a title',
        !block.credit?.trim() && 'a credit',
      ].filter(Boolean);
      if (missing.length) {
        issues.push({
          index,
          kind: 'video-incomplete',
          message: `This video needs ${missing.length > 1 ? `${missing.slice(0, -1).join(', ')} and ${missing.at(-1)}` : missing[0]}.`,
        });
      }
    }
    node.descendants((child) => {
      for (const mark of child.marks ?? []) {
        const href = String(mark.attrs.href ?? '');
        if (mark.type.name === 'link' && !isSafeStoryLinkHref(href)) {
          issues.push({
            index,
            kind: 'link-not-https',
            message: `The link to “${href.slice(0, 60)}” must start with https://.`,
          });
        }
      }
      if (
        child.type.name === 'entityLink' &&
        context.unpublishedEntityIds?.has(String(child.attrs.entityId))
      ) {
        issues.push({
          index,
          kind: 'entity-unpublished',
          message: `${String(child.attrs.label || child.attrs.entityId)} is not public yet, so readers will see a link to a missing page.`,
        });
      }
      if (child.type.name === 'citation' && !referenceIds.has(String(child.attrs.refId))) {
        issues.push({
          index,
          kind: 'missing-citation',
          message: `“${String(child.attrs.refId)}” is not attached to this story. Attach the source or remove the citation.`,
        });
      }
    });
  });
  return issues;
}

export type ReferenceInfo = { readonly label: string; readonly url: string };

/**
 * Citation numbers the way the public page assigns them: in reading order, one number per
 * distinct source (two reference ids with the same URL share a number). Unknown ids get none.
 * Evidence blocks that carry their own provenance also take numbers on the public page; the
 * editor cannot see those, so a story with a data block before its first citation can read
 * one or two lower here than it does when published.
 */
export function citationNumbers(
  doc: LintNode,
  references: ReadonlyMap<string, ReferenceInfo>,
): Map<string, number> {
  const numberByKey = new Map<string, number>();
  const numbers = new Map<string, number>();
  doc.descendants((node) => {
    if (node.type.name !== 'citation') return;
    const id = String(node.attrs.refId);
    const reference = references.get(id);
    if (!reference || numbers.has(id)) return;
    const key = reference.url || `id:${id}`;
    if (!numberByKey.has(key)) numberByKey.set(key, numberByKey.size + 1);
    numbers.set(id, numberByKey.get(key)!);
  });
  return numbers;
}
