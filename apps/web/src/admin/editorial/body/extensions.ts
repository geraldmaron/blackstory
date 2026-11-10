/** Schema pieces for the manuscript editor beyond StarterKit: atoms, tables, cards and keys. */
import { Node, Extension, mergeAttributes } from '@tiptap/core';
import { NodeSelection, Plugin, Selection } from '@tiptap/pm/state';
import { ReactNodeViewRenderer } from '@tiptap/react';
import Heading from '@tiptap/extension-heading';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { moveTopLevelBlock } from '../editor-blocks';
import { TABLE_ROWS_MAX } from '../editor-lint';
import { CitationView, EvidenceCard, StoryVideoView } from './views';

const storyBlock = { storyBlock: { default: null, renderHTML: () => ({}) } };

/** `[ref:id]` in the stored text; drawn as a numbered superscript by `CitationView`. */
export const Citation = Node.create({
  name: 'citation',
  inline: true,
  group: 'inline',
  atom: true,
  addAttributes: () => ({ refId: { default: '' } }),
  parseHTML: () => [{ tag: 'span[data-story-citation]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'span',
    mergeAttributes(HTMLAttributes, {
      'data-story-citation': node.attrs.refId,
      class: 'rd-cite',
    }),
    `[${node.attrs.refId}]`,
  ],
  addNodeView: () => ReactNodeViewRenderer(CitationView, { as: 'span' }),
});

/** `[[entityId|Label]]` in the stored text; an atom so a link is edited as one unit. */
export const EntityLink = Node.create({
  name: 'entityLink',
  inline: true,
  group: 'inline',
  atom: true,
  addAttributes: () => ({
    // Carried by data-entity-link and the visible text; never as bare HTML attributes.
    entityId: {
      default: '',
      parseHTML: (element) => element.getAttribute('data-entity-link') ?? '',
      renderHTML: () => ({}),
    },
    label: {
      default: '',
      parseHTML: (element) => element.textContent ?? '',
      renderHTML: () => ({}),
    },
  }),
  parseHTML: () => [{ tag: 'span[data-entity-link]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'span',
    mergeAttributes(HTMLAttributes, {
      'data-entity-link': node.attrs.entityId,
      class: 'rd-entity',
      title: `Record ${node.attrs.entityId}`,
    }),
    node.attrs.label || node.attrs.entityId,
  ],
});

/** Keeps the stored block (pullquote attribution, anchors, ids) on the node that came from it. */
export const PreserveBlock = Extension.create({
  name: 'preserveStoryBlock',
  addGlobalAttributes: () => [
    {
      types: ['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'horizontalRule'],
      // Not kept on split: pressing Enter must not copy one block's stored fields onto the next.
      attributes: { storyBlock: { default: null, keepOnSplit: false, renderHTML: () => ({}) } },
    },
  ],
});

/** Headings are printed as written on the public page, so no emphasis or link can live in one. */
export const PlainHeading = Heading.configure({ levels: [2, 3] }).extend({ marks: '' });

/** Typing `**x**` in a heading must stay as typed, so markdown shortcuts are skipped there. */
export const PlainHeadingInput = Extension.create({
  name: 'plainHeadingInput',
  priority: 1000,
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleTextInput: (view, from, to, text) => {
            if (view.state.doc.resolve(from).parent.type.name !== 'heading') return false;
            view.dispatch(view.state.tr.insertText(text, from, to));
            return true;
          },
        },
      }),
    ];
  },
});

/** Alt+Up / Alt+Down move the current top-level block, the way outliners and Notion do. */
export const BlockMove = Extension.create({
  name: 'editorialBlockMove',
  addKeyboardShortcuts() {
    const move = (delta: -1 | 1) => () => {
      const index = this.editor.state.selection.$from.index(0);
      return moveTopLevelBlock(this.editor, index, delta);
    };
    return { 'Alt-ArrowUp': move(-1), 'Alt-ArrowDown': move(1) };
  },
});

/** Link, record and citation shortcuts; the panels they open belong to the React shell. */
export const StoryShortcuts = Extension.create<{ onLink: () => void; onCite: () => void }>({
  name: 'storyShortcuts',
  addOptions: () => ({ onLink: () => {}, onCite: () => {} }),
  addKeyboardShortcuts() {
    return {
      'Mod-k': () => {
        this.options.onLink();
        return true;
      },
      'Mod-Shift-k': () => {
        this.options.onCite();
        return true;
      },
      // Keyboard route to a record link's label field: select the link beside the caret.
      'Mod-Alt-k': () => {
        const { state, view } = this.editor;
        const { $from } = state.selection;
        const link = (node: typeof $from.nodeAfter) => node?.type.name === 'entityLink';
        const at = link($from.nodeAfter)
          ? $from.pos
          : link($from.nodeBefore)
            ? $from.pos - $from.nodeBefore!.nodeSize
            : -1;
        if (at < 0) return false;
        view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, at)));
        return true;
      },
    };
  },
});

/** A link wraps text only. A record or citation atom keeps its own link, so none is added to it. */
export const NoAtomLinks = Extension.create({
  name: 'noAtomLinks',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (transactions, _old, state) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const link = state.schema.marks.link;
          if (!link) return null;
          let fix: ReturnType<typeof state.tr.removeMark> | null = null;
          state.doc.descendants((node, pos) => {
            if (
              (node.type.name === 'citation' || node.type.name === 'entityLink') &&
              link.isInSet(node.marks)
            ) {
              fix = (fix ?? state.tr).removeMark(pos, pos + node.nodeSize, link);
            }
          });
          return fix;
        },
      }),
    ];
  },
});

/** Evidence blocks the frame edits in its own inspector. */
export const EvidenceBlock = Node.create({
  name: 'editorialBlock',
  group: 'block',
  atom: true,
  draggable: true,
  addOptions: () => ({ onEdit: (_index: number) => {} }),
  addAttributes: () => storyBlock,
  parseHTML: () => [],
  renderHTML: () => ['div', { 'data-editorial-block': '' }],
  addNodeView: () => ReactNodeViewRenderer(EvidenceCard),
});

/** A video by provider and id. An atom: its fields live in the card, never in the text flow. */
export const StoryVideo = Node.create({
  name: 'storyVideo',
  group: 'block',
  atom: true,
  addAttributes: () => storyBlock,
  parseHTML: () => [],
  renderHTML: () => ['div', { 'data-story-video': '' }],
  addNodeView: () => ReactNodeViewRenderer(StoryVideoView),
});

// ----- tables ---------------------------------------------------------------------------------

/** Rows and columns of the table around the selection, or null outside one. */
export function tableSize(
  selection: Selection,
): { readonly rows: number; readonly columns: number } | null {
  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name !== 'table') continue;
    let columns = 0;
    node.firstChild?.forEach((cell) => {
      columns += Math.max(1, Number(cell.attrs.colspan ?? 1));
    });
    return { rows: node.childCount, columns };
  }
  return null;
}

/** A table is only placed inside `storyTable`, so a pasted table never lands loose in the text. */
export const StoryTableNode = Table.extend({
  group: 'tableContent',
  addKeyboardShortcuts() {
    return {
      // Tab walks the cells and adds a row at the end, up to the contract's row limit.
      Tab: () => {
        if (this.editor.commands.goToNextCell()) return true;
        const size = tableSize(this.editor.state.selection);
        if (!size || size.rows >= TABLE_ROWS_MAX) return false;
        return this.editor.chain().addRowAfter().goToNextCell().run();
      },
      'Shift-Tab': () => this.editor.commands.goToPreviousCell(),
    };
  },
}).configure({ resizable: false });

export const StoryTableRow = TableRow;
export const StoryTableCell = TableCell.extend({ content: 'paragraph' });
export const StoryTableHeader = TableHeader.extend({ content: 'paragraph' });

export const StoryTable = Node.create({
  name: 'storyTable',
  group: 'block',
  content: 'table storyTableCaption',
  isolating: true,
  addAttributes: () => storyBlock,
  parseHTML: () => [{ tag: 'figure[data-story-table]' }],
  renderHTML: () => ['figure', { class: 'rd-table', 'data-story-table': '' }, 0],
});

export const StoryTableCaption = Node.create({
  name: 'storyTableCaption',
  content: 'inline*',
  isolating: true,
  parseHTML: () => [{ tag: 'figcaption' }],
  renderHTML: () => ['figcaption', { class: 'rd-table__caption' }, 0],
  addKeyboardShortcuts() {
    return {
      // Enter in the caption leaves the table, creating a paragraph after it when it ends the story.
      Enter: () => {
        const { $from } = this.editor.state.selection;
        if ($from.parent.type.name !== 'storyTableCaption') return false;
        const after = $from.after($from.depth - 1);
        return this.editor
          .chain()
          .command(({ tr, state }) => {
            if (!state.doc.nodeAt(after)) tr.insert(after, state.schema.nodes.paragraph!.create());
            tr.setSelection(Selection.near(tr.doc.resolve(after), 1));
            return true;
          })
          .focus()
          .run();
      },
    };
  },
});
