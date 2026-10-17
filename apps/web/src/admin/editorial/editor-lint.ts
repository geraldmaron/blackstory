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

export type LintNode = {
  readonly type: { readonly name: string };
  readonly attrs: Readonly<Record<string, unknown>>;
  readonly text?: string | null | undefined;
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
    | 'missing-citation';
  readonly message: string;
};

/** Length of the string the contract stores for this node. */
export function storedLength(node: LintNode): number {
  switch (node.type.name) {
    case 'text':
      return node.text?.length ?? 0;
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

export function lintStoryDocument(
  doc: LintNode,
  referenceIds: ReadonlySet<string>,
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
    node.descendants((child) => {
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
