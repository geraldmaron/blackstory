'use client';
import { useEffect, useRef, useState } from 'react';
import {
  EditorContent,
  useEditor,
  useEditorState,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type Editor,
  type NodeViewProps,
} from '@tiptap/react';
import { Node, Extension, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';
import ListItem from '@tiptap/extension-list-item';
import { Button } from 'baseui/button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faListUl,
  faListOl,
  faQuoteRight,
  faSliders,
  faRotateLeft,
  faRotateRight,
  faUserTag,
  faArrowUp,
  faArrowDown,
  faTrashCan,
} from '@fortawesome/free-solid-svg-icons';
import { Select } from 'baseui/select';
import type { ArticleBodyBlockDoc, ArticleReferenceDoc } from '@repo/schemas';
import { AdminRecordPicker } from '@/components/patterns/admin-record-picker';
import { articleToDocument, documentToArticle } from './document-adapter';
import { lintArticleDocument, type EditorLintIssue } from './editor-lint';
import { moveTopLevelBlock, removeTopLevelBlock } from './editor-blocks';

/** Evidence blocks a writer can place; the label is what the toolbar shows. */
export const INSERTABLE_BLOCKS: readonly {
  readonly id: ArticleBodyBlockDoc['type'];
  readonly label: string;
}[] = [
  { id: 'image', label: 'Image' },
  { id: 'mapInset', label: 'Record map' },
  { id: 'figure', label: 'Figure' },
  { id: 'stat', label: 'Statistic' },
  { id: 'primaryDocument', label: 'Primary document' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'dispute', label: 'Disputed account' },
];

const lintKey = new PluginKey('editorialLint');

const Citation = Node.create({
  name: 'citation',
  inline: true,
  group: 'inline',
  atom: true,
  addAttributes: () => ({ refId: { default: '' } }),
  parseHTML: () => [{ tag: 'span[data-article-citation]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'span',
    mergeAttributes(HTMLAttributes, {
      'data-article-citation': node.attrs.refId,
      class: 'editorial-citation-token',
    }),
    `[${node.attrs.refId}]`,
  ],
});

/** `[[entityId|Label]]` in the stored text; an atom here so a link is edited as one unit. */
const EntityLink = Node.create({
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
      class: 'editorial-entity-token',
      title: `Record ${node.attrs.entityId}`,
    }),
    node.attrs.label || node.attrs.entityId,
  ],
});

const PreserveBlock = Extension.create({
  name: 'preserveArticleBlock',
  addGlobalAttributes: () => [
    {
      types: ['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList'],
      attributes: { articleBlock: { default: null, renderHTML: () => ({}) } },
    },
  ],
});

/**
 * Live checks against the article contract's limits, drawn on the blocks that break them. The
 * same rules gate publication, so a writer sees the problem where it is instead of in a blocker
 * list after saving.
 */
const EditorialLint = Extension.create<{ getReferenceIds: () => ReadonlySet<string> }>({
  name: 'editorialLint',
  addOptions: () => ({ getReferenceIds: () => new Set<string>() }),
  addProseMirrorPlugins() {
    const getReferenceIds = this.options.getReferenceIds;
    return [
      new Plugin({
        key: lintKey,
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            const doc = state.doc;
            const issues = lintArticleDocument(doc, getReferenceIds());
            const flagged = new Map<number, string[]>();
            for (const issue of issues) {
              if (issue.kind === 'missing-citation') continue;
              flagged.set(issue.index, [...(flagged.get(issue.index) ?? []), issue.message]);
            }
            doc.forEach((node, offset, index) => {
              const messages = flagged.get(index);
              if (messages) {
                decorations.push(
                  Decoration.node(offset, offset + node.nodeSize, {
                    class: 'editorial-lint',
                    title: messages.join(' '),
                  }),
                );
              }
            });
            const references = getReferenceIds();
            doc.descendants((node, pos) => {
              if (node.type.name === 'citation' && !references.has(String(node.attrs.refId))) {
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    class: 'editorial-citation-token--missing',
                    title: `No source named “${node.attrs.refId}” is attached to this article.`,
                  }),
                );
              }
            });
            const first = doc.firstChild;
            if (
              doc.childCount === 1 &&
              first &&
              first.type.name === 'paragraph' &&
              !first.content.size
            ) {
              decorations.push(
                Decoration.node(0, first.nodeSize, {
                  class: 'is-empty',
                  'data-placeholder':
                    'Start writing, or insert a record link, citation or block from the toolbar…',
                }),
              );
            }
            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});

/** Alt+Up / Alt+Down move the current top-level block, the way outliners and Notion do. */
const BlockMove = Extension.create({
  name: 'editorialBlockMove',
  addKeyboardShortcuts() {
    const move = (delta: -1 | 1) => () => {
      const index = this.editor.state.selection.$from.index(0);
      return moveTopLevelBlock(this.editor, index, delta);
    };
    return { 'Alt-ArrowUp': move(-1), 'Alt-ArrowDown': move(1) };
  },
});

function EvidenceCard({ node, selected, extension, getPos, editor }: NodeViewProps) {
  const block = node.attrs.articleBlock as ArticleBodyBlockDoc;
  const label =
    block.type === 'image'
      ? block.image.alt || 'Image description needed'
      : 'caption' in block
        ? block.caption
        : 'label' in block
          ? block.label
          : 'packetId' in block
            ? block.packetId
            : '';
  const index = () => {
    const pos = getPos();
    return typeof pos === 'number' ? editor.state.doc.resolve(pos).index(0) : null;
  };
  const editable = editor.isEditable;
  return (
    <NodeViewWrapper
      className={`editorial-evidence-card${selected ? ' editorial-evidence-card--selected' : ''}`}
      contentEditable={false}
    >
      <div>
        <span className="editorial-evidence-card__type">{block.type}</span>
        <p>{label || 'Complete this evidence block'}</p>
      </div>
      <div className="editorial-evidence-card__actions">
        <Button
          kind="secondary"
          size="compact"
          onClick={() => {
            const pos = getPos();
            if (typeof pos === 'number') {
              editor.commands.setNodeSelection(pos);
              extension.options.onEdit(editor.state.doc.resolve(pos).index(0));
            }
          }}
        >
          Edit block
        </Button>
        <Button
          kind="tertiary"
          size="compact"
          aria-label="Move block up"
          title="Move up (Alt+↑)"
          disabled={!editable}
          onClick={() => {
            const at = index();
            if (at !== null) moveTopLevelBlock(editor, at, -1);
          }}
        >
          <FontAwesomeIcon icon={faArrowUp} aria-hidden="true" />
        </Button>
        <Button
          kind="tertiary"
          size="compact"
          aria-label="Move block down"
          title="Move down (Alt+↓)"
          disabled={!editable}
          onClick={() => {
            const at = index();
            if (at !== null) moveTopLevelBlock(editor, at, 1);
          }}
        >
          <FontAwesomeIcon icon={faArrowDown} aria-hidden="true" />
        </Button>
        <Button
          kind="tertiary"
          size="compact"
          aria-label="Remove block"
          title="Remove block (undo restores it)"
          disabled={!editable}
          onClick={() => {
            const at = index();
            if (at !== null) removeTopLevelBlock(editor, at);
          }}
        >
          <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
        </Button>
      </div>
    </NodeViewWrapper>
  );
}
const EvidenceBlock = Node.create({
  name: 'editorialBlock',
  group: 'block',
  atom: true,
  draggable: true,
  addOptions: () => ({ onEdit: (_index: number) => {} }),
  addAttributes: () => ({ articleBlock: { default: null, renderHTML: () => ({}) } }),
  parseHTML: () => [],
  renderHTML: () => ['div', { 'data-editorial-block': '' }],
  addNodeView: () => ReactNodeViewRenderer(EvidenceCard),
});
const FlatListItem = ListItem.extend({ content: 'paragraph' });

type ToolbarState = {
  readonly style: 'paragraph' | 'heading-2' | 'heading-3';
  readonly bullet: boolean;
  readonly ordered: boolean;
  readonly quote: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly words: number;
  readonly issues: readonly EditorLintIssue[];
};

function readToolbarState(editor: Editor | null, references: ReadonlySet<string>): ToolbarState {
  if (!editor) {
    return {
      style: 'paragraph',
      bullet: false,
      ordered: false,
      quote: false,
      canUndo: false,
      canRedo: false,
      words: 0,
      issues: [],
    };
  }
  const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, ' ', ' ').trim();
  return {
    style: editor.isActive('heading', { level: 2 })
      ? 'heading-2'
      : editor.isActive('heading', { level: 3 })
        ? 'heading-3'
        : 'paragraph',
    bullet: editor.isActive('bulletList'),
    ordered: editor.isActive('orderedList'),
    quote: editor.isActive('blockquote'),
    canUndo: editor.can().undo(),
    canRedo: editor.can().redo(),
    words: text ? text.split(/\s+/).length : 0,
    issues: lintArticleDocument(editor.state.doc as PMNode, references),
  };
}

const READING_WORDS_PER_MINUTE = 230;

export function RichDocument({
  body,
  onChange,
  editable,
  references,
  onEditBlock,
  onInsertBlock,
  onError,
}: {
  body: ArticleBodyBlockDoc[];
  onChange: (body: ArticleBodyBlockDoc[]) => void;
  editable: boolean;
  references: ArticleReferenceDoc[];
  onEditBlock: (index: number) => void;
  /** Insert a new evidence block at this body index, or at the end when null. */
  onInsertBlock: (type: ArticleBodyBlockDoc['type'], index: number | null) => void;
  onError: (message: string) => void;
}) {
  const callbacks = useRef({ onChange, onEditBlock, onError });
  callbacks.current = { onChange, onEditBlock, onError };
  const referenceIds = useRef<ReadonlySet<string>>(new Set());
  referenceIds.current = new Set(references.map((ref) => ref.id));
  // The body this editor last reported. When the parent hands the same array straight back there
  // is nothing to reconcile, so the per-keystroke full-document compare is skipped.
  const lastEmitted = useRef<ArticleBodyBlockDoc[] | null>(null);
  // Index of the block the writer last had the cursor in, for inserting "here" from the toolbar.
  const lastBlockIndex = useRef<number | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    // Toolbar state is read through useEditorState below; re-rendering this whole component (and
    // its Base Web controls) on every transaction made typing in a long article lag.
    shouldRerenderOnTransaction: false,
    editable,
    extensions: [
      StarterKit.configure({
        bold: false,
        italic: false,
        strike: false,
        underline: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        link: false,
        listItem: false,
        heading: { levels: [2, 3] },
      }),
      FlatListItem,
      Citation,
      EntityLink,
      PreserveBlock,
      BlockMove,
      EditorialLint.configure({ getReferenceIds: () => referenceIds.current }),
      EvidenceBlock.configure({ onEdit: (index: number) => callbacks.current.onEditBlock(index) }),
    ],
    content: articleToDocument(body),
    editorProps: {
      attributes: {
        class: 'editorial-document__prose',
        role: 'textbox',
        'aria-label': 'Article body',
        'aria-multiline': 'true',
      },
      // Formatting is outside the article contract, so pasted HTML is reduced to its text rather
      // than being rejected (or worse, silently dropped) block by block.
      transformPastedHTML: (html) =>
        html.replace(/<(\/?)(b|strong|i|em|u|s|strike|font|span)\b[^>]*>/gi, (tag) =>
          /data-(article-citation|entity-link)/.test(tag) ? tag : '',
        ),
    },
    onSelectionUpdate: ({ editor: current }) => {
      if (current.isFocused) lastBlockIndex.current = current.state.selection.$from.index(0);
    },
    onUpdate: ({ editor: current }) => {
      try {
        const next = documentToArticle(current.getJSON());
        lastEmitted.current = next;
        if (current.isFocused) lastBlockIndex.current = current.state.selection.$from.index(0);
        callbacks.current.onChange(next);
      } catch (error) {
        callbacks.current.onError(
          error instanceof Error ? error.message : 'The article could not be saved.',
        );
      }
    },
  });

  useEffect(() => {
    if (!editor || body === lastEmitted.current) return;
    try {
      if (JSON.stringify(documentToArticle(editor.getJSON())) !== JSON.stringify(body)) {
        const position = editor.state.selection.from;
        editor.commands.setContent(articleToDocument(body), { emitUpdate: false });
        editor.commands.setTextSelection(Math.min(position, editor.state.doc.content.size));
      }
    } catch (error) {
      callbacks.current.onError(
        error instanceof Error ? error.message : 'The article could not be restored.',
      );
    }
  }, [body, editor]);
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);
  // Source labels or ids changing must repaint the missing-citation marks without a keystroke.
  useEffect(() => {
    editor?.view.dispatch(editor.state.tr.setMeta(lintKey, 'refresh'));
  }, [editor, references]);

  const ui =
    useEditorState({
      editor,
      selector: ({ editor: current }) => readToolbarState(current, referenceIds.current),
    }) ?? readToolbarState(null, referenceIds.current);

  const disabled = !editable || !editor;
  const problems = ui.issues.length;
  const minutes = Math.max(1, Math.round(ui.words / READING_WORDS_PER_MINUTE));

  function insertRecord(record: { id: string; display_name: string }) {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    const selected = empty ? '' : editor.state.doc.textBetween(from, to, ' ').trim();
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'entityLink',
        attrs: { entityId: record.id, label: selected || record.display_name },
      })
      .run();
    setLinkOpen(false);
  }

  return (
    <div className="editorial-document">
      <div className="editorial-document__toolbar" role="toolbar" aria-label="Article formatting">
        <div className="editorial-document__format">
          <Select
            size="compact"
            aria-label="Text style"
            searchable={false}
            clearable={false}
            disabled={disabled}
            options={[
              { id: 'paragraph', label: 'Paragraph' },
              { id: 'heading-2', label: 'Section heading' },
              { id: 'heading-3', label: 'Subheading' },
            ]}
            value={[{ id: ui.style }]}
            onChange={({ value }) => {
              const choice = value[0]?.id;
              if (choice === 'paragraph') editor?.chain().focus().setParagraph().run();
              else
                editor
                  ?.chain()
                  .focus()
                  .toggleHeading({ level: choice === 'heading-2' ? 2 : 3 })
                  .run();
            }}
          />
        </div>
        <Button
          aria-label="Bullets"
          title="Bullets (Ctrl/⌘ Shift 8)"
          kind="tertiary"
          size="compact"
          disabled={disabled}
          isSelected={ui.bullet}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <FontAwesomeIcon icon={faListUl} aria-hidden="true" />
        </Button>
        <Button
          aria-label="Numbered list"
          title="Numbered list (Ctrl/⌘ Shift 7)"
          kind="tertiary"
          size="compact"
          disabled={disabled}
          isSelected={ui.ordered}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <FontAwesomeIcon icon={faListOl} aria-hidden="true" />
        </Button>
        <Button
          aria-label="Quote"
          title="Quote (Ctrl/⌘ Shift B)"
          kind="tertiary"
          size="compact"
          disabled={disabled}
          isSelected={ui.quote}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <FontAwesomeIcon icon={faQuoteRight} aria-hidden="true" />
        </Button>
        <span className="editorial-document__divider" aria-hidden="true" />
        <div className="editorial-document__citation">
          <Select
            size="compact"
            aria-label="Insert citation"
            placeholder="Insert citation"
            value={[]}
            clearable={false}
            disabled={disabled || !references.length}
            options={references.map((ref) => ({ id: ref.id, label: ref.label || ref.id }))}
            onChange={({ value }) => {
              const refId = value[0]?.id;
              if (refId)
                editor?.chain().focus().insertContent({ type: 'citation', attrs: { refId } }).run();
            }}
          />
        </div>
        <div className="editorial-document__link">
          <Button
            aria-label="Link a record"
            aria-expanded={linkOpen}
            title="Link a record (select text first to keep it as the label)"
            kind="tertiary"
            size="compact"
            disabled={disabled}
            isSelected={linkOpen}
            onClick={() => setLinkOpen((open) => !open)}
            startEnhancer={<FontAwesomeIcon icon={faUserTag} aria-hidden="true" />}
          >
            Link record
          </Button>
          {linkOpen ? (
            <div
              className="editorial-document__link-panel"
              role="dialog"
              aria-label="Link a record"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setLinkOpen(false);
                  editor?.commands.focus();
                }
              }}
            >
              <AdminRecordPicker label="Find a record" onSelect={insertRecord} />
            </div>
          ) : null}
        </div>
        <div className="editorial-document__insert">
          <Select
            size="compact"
            aria-label="Insert evidence block"
            placeholder="Insert block"
            value={[]}
            clearable={false}
            searchable={false}
            disabled={disabled}
            options={INSERTABLE_BLOCKS.map(({ id, label }) => ({ id, label }))}
            onChange={({ value }) => {
              const type = value[0]?.id as ArticleBodyBlockDoc['type'] | undefined;
              if (!type) return;
              const here = lastBlockIndex.current;
              onInsertBlock(type, here === null ? null : Math.min(here + 1, body.length));
            }}
          />
        </div>
        <span className="editorial-document__divider" aria-hidden="true" />
        <Button
          aria-label="Block details"
          title="Block details"
          kind="tertiary"
          size="compact"
          disabled={disabled}
          onClick={() => {
            if (!editor) return;
            const position = editor.state.selection.$from;
            onEditBlock(position.index(0));
          }}
        >
          <FontAwesomeIcon icon={faSliders} aria-hidden="true" />
        </Button>
        <Button
          aria-label="Undo"
          title="Undo (Ctrl/⌘ Z)"
          kind="tertiary"
          size="compact"
          disabled={!editable || !ui.canUndo}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <FontAwesomeIcon icon={faRotateLeft} aria-hidden="true" />
        </Button>
        <Button
          aria-label="Redo"
          title="Redo (Ctrl/⌘ Shift Z)"
          kind="tertiary"
          size="compact"
          disabled={!editable || !ui.canRedo}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <FontAwesomeIcon icon={faRotateRight} aria-hidden="true" />
        </Button>
      </div>
      {!editor && <p role="status">Loading article editor…</p>}
      <EditorContent editor={editor} />
      <div className="editorial-document__status">
        <p>
          {ui.words.toLocaleString()} {ui.words === 1 ? 'word' : 'words'} · about {minutes} min read
        </p>
        {problems ? (
          <details className="editorial-document__issues">
            <summary>
              {problems} {problems === 1 ? 'thing needs' : 'things need'} attention before
              publication
            </summary>
            <ul>
              {ui.issues.map((issue, position) => (
                <li key={`${issue.index}-${position}`}>
                  {issue.kind === 'missing-citation' ? 'A citation' : `Block ${issue.index + 1}`}:{' '}
                  {issue.message}
                </li>
              ))}
            </ul>
          </details>
        ) : (
          <p>No contract problems found in the text.</p>
        )}
        <p className="editorial-document__help">
          Headings Ctrl/⌘ Alt 2 or 3 · Lists Ctrl/⌘ Shift 7 or 8 · Quote Ctrl/⌘ Shift B · Move a
          block Alt ↑ or ↓. Formatting such as bold and italics is not part of the article contract,
          so pasted text arrives plain. Evidence blocks keep their reviewed bindings.
        </p>
      </div>
    </div>
  );
}
