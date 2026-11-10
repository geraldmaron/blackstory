/**
 * One pass over the document per change: contract issues drawn on the blocks that break them,
 * citation numbers, and the empty-document and empty-caption placeholders. The result lives in
 * plugin state, so typing costs one walk and the toolbar reads the same issues.
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import {
  citationNumbers,
  lintStoryDocument,
  type EditorLintIssue,
  type LintContext,
  type LintNode,
  type ReferenceInfo,
} from '../editor-lint';

export type CitationInfo = {
  readonly number: number;
  readonly label: string;
  readonly missing: boolean;
};

export const PLACEHOLDER = 'Start writing. Type @ to link a record, / to add a block.';
export const CAPTION_PLACEHOLDER = 'Caption, required';

type LintState = {
  readonly issues: readonly EditorLintIssue[];
  readonly decorations: DecorationSet;
};
export const lintKey = new PluginKey<LintState>('editorialLint');

type Options = {
  getReferences: () => ReadonlyMap<string, ReferenceInfo>;
  getContext: () => LintContext;
};

function compute(doc: PMNode, { getReferences, getContext }: Options): LintState {
  const references = getReferences();
  const issues = lintStoryDocument(
    doc as unknown as LintNode,
    new Set(references.keys()),
    getContext(),
  );
  const decorations: Decoration[] = [];
  const flagged = new Map<number, string[]>();
  for (const issue of issues) {
    // A missing citation is drawn on the citation itself, below.
    if (issue.kind === 'missing-citation') continue;
    flagged.set(issue.index, [...(flagged.get(issue.index) ?? []), issue.message]);
  }
  doc.forEach((node, offset, index) => {
    const messages = flagged.get(index);
    if (messages) {
      decorations.push(
        Decoration.node(offset, offset + node.nodeSize, {
          class: 'rd-lint',
          title: messages.join(' '),
        }),
      );
    }
  });
  const numbers = citationNumbers(doc as unknown as LintNode, references);
  doc.descendants((node, pos) => {
    if (node.type.name === 'citation') {
      const id = String(node.attrs.refId);
      const number = numbers.get(id);
      const info: CitationInfo =
        number === undefined
          ? { number: 0, label: id, missing: true }
          : { number, label: references.get(id)?.label || id, missing: false };
      decorations.push(Decoration.node(pos, pos + node.nodeSize, {}, { citation: info }));
    } else if (node.type.name === 'storyTableCaption' && node.content.size === 0) {
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          class: 'is-empty',
          'data-placeholder': CAPTION_PLACEHOLDER,
        }),
      );
    }
  });
  const first = doc.firstChild;
  if (doc.childCount === 1 && first?.type.name === 'paragraph' && first.content.size === 0) {
    decorations.push(
      Decoration.node(0, first.nodeSize, { class: 'is-empty', 'data-placeholder': PLACEHOLDER }),
    );
  }
  return { issues, decorations: DecorationSet.create(doc, decorations) };
}

export const readIssues = (state: EditorState): readonly EditorLintIssue[] =>
  lintKey.getState(state)?.issues ?? [];

export const EditorialLint = Extension.create<Options>({
  name: 'editorialLint',
  addOptions: () => ({
    getReferences: () => new Map<string, ReferenceInfo>(),
    getContext: () => ({}),
  }),
  addProseMirrorPlugins() {
    const options = this.options;
    return [
      new Plugin<LintState>({
        key: lintKey,
        state: {
          init: (_config, state) => compute(state.doc, options),
          apply: (tr, previous, _old, state) =>
            tr.docChanged || tr.getMeta(lintKey) ? compute(state.doc, options) : previous,
        },
        props: { decorations: (state) => lintKey.getState(state)?.decorations ?? null },
      }),
    ];
  },
});
