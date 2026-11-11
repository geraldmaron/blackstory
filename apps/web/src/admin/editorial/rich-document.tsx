'use client';
/**
 * The manuscript editor: the story's body written as it will read, with record links, citations,
 * emphasis and links inline, and images, tables, video and evidence blocks placed in the text.
 * Persistence stays the story contract; `document-adapter.ts` is the only translation.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { getMarkRange, type Editor } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import { NodeSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import ListItem from '@tiptap/extension-list-item';
import type { StoryBodyBlockDoc, StoryReferenceDoc } from '@repo/schemas';
import { parseStoryVideoUrl } from '@repo/schemas/public-stories';
import { isSafeStoryLinkHref } from '@repo/schemas/story-inline';
import { storyToDocument, documentToStory } from './document-adapter';
import { type EditorLintIssue, type ReferenceInfo } from './editor-lint';
import {
  BlockMove,
  Citation,
  EntityLink,
  EvidenceBlock,
  PlainHeading,
  PlainHeadingInput,
  NoAtomLinks,
  PreserveBlock,
  StoryShortcuts,
  StoryTable,
  StoryTableCaption,
  StoryTableCell,
  StoryTableHeader,
  StoryTableNode,
  StoryTableRow,
  StoryVideo,
} from './body/extensions';
import { EditorialLint, lintKey } from './body/lint-plugin';
import { newVideoBlock, runInsert } from './body/insert';
import { PickerPopover, RecordPicker } from './body/menus';
import {
  CitationList,
  EntityPopover,
  LinkPopover,
  insertCitation,
  rangeRect,
  type LinkTarget,
} from './body/popovers';
import { unpublishedRecordIds, safeLabel } from './body/record-session';
import { InsertList, RecordMention, SlashInsert } from './body/suggestions';
import { SelectionBubble, Toolbar, readToolbarState, type ToolbarActions } from './body/toolbar';
import './rich-document.css';

/** Evidence blocks a writer can place; the label is what the insert menu shows. */
export const INSERTABLE_BLOCKS: readonly {
  readonly id: StoryBodyBlockDoc['type'];
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

const FlatListItem = ListItem.extend({ content: 'paragraph' });

type Panel =
  | { readonly kind: 'link'; readonly target: LinkTarget }
  | {
      readonly kind: 'record';
      readonly from: number;
      readonly to: number;
      readonly selected: string;
    }
  | { readonly kind: 'cite' }
  | { readonly kind: 'insert' };

/** The link around a position or selection: its extent and where it points ('' for none yet). */
function linkTargetAt(editor: Editor, from: number, to: number): LinkTarget {
  const type = editor.schema.marks.link!;
  const range = from === to ? getMarkRange(editor.state.doc.resolve(from), type) : null;
  const start = range?.from ?? from;
  const mark = editor.state.doc.nodeAt(start)?.marks.find((m) => m.type === type);
  return { from: start, to: range?.to ?? to, href: mark ? String(mark.attrs.href ?? '') : '' };
}

export function RichDocument({
  body,
  onChange,
  editable,
  references,
  onEditBlock,
  onInsertBlock,
  onError,
  onWarning,
  onAddReference,
  onImageFile,
  onIssues,
  onShowIssues,
}: {
  body: StoryBodyBlockDoc[];
  onChange: (body: StoryBodyBlockDoc[]) => void;
  editable: boolean;
  references: StoryReferenceDoc[];
  onEditBlock: (index: number) => void;
  /** Insert a new evidence block at this body index, or at the end when null. */
  onInsertBlock: (type: StoryBodyBlockDoc['type'], index: number | null) => void;
  onError: (message: string) => void;
  /** Non-fatal notices, such as formatting the contract cannot store. Never pauses saving. */
  onWarning?: (message: string) => void;
  /** The Cite menu's "Add a new source…": the frame opens its Sources section. */
  onAddReference?: () => void;
  /** An image file pasted or dropped into the text, with the body index to place it at. */
  onImageFile?: (file: File, index: number) => void;
  /** Contract problems in the text, for the frame's Readiness list. Called when they change. */
  onIssues?: (issues: readonly EditorLintIssue[]) => void;
  /** Shows the frame's issue list; when given, the toolbar's "to fix" count becomes a button. */
  onShowIssues?: () => void;
}) {
  const live = useRef({
    onChange,
    onEditBlock,
    onError,
    onWarning,
    onInsertBlock,
    onAddReference,
    onImageFile,
    body,
  });
  live.current = {
    onChange,
    onEditBlock,
    onError,
    onWarning,
    onInsertBlock,
    onAddReference,
    onImageFile,
    body,
  };
  const referenceInfo = useRef<ReadonlyMap<string, ReferenceInfo>>(new Map());
  referenceInfo.current = new Map(
    references.map((ref) => [ref.id, { label: ref.label, url: ref.url }]),
  );
  // The body this editor last reported. When the parent hands the same array straight back there
  // is nothing to reconcile, so the per-keystroke full-document compare is skipped.
  const lastEmitted = useRef<StoryBodyBlockDoc[] | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const actions = useRef<{
    openLink: (range?: { from: number; to: number }) => void;
    openCite: () => void;
  }>({
    openLink: () => {},
    openCite: () => {},
  });
  const insertButton = useRef<HTMLButtonElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    // Toolbar state is read through useEditorState below; re-rendering this whole component on
    // every transaction made typing in a long story lag.
    shouldRerenderOnTransaction: false,
    editable,
    extensions: [
      StarterKit.configure({
        strike: false,
        underline: false,
        code: false,
        codeBlock: false,
        listItem: false,
        heading: false,
        link: {
          openOnClick: false,
          autolink: false,
          linkOnPaste: true,
          defaultProtocol: 'https',
          // Pasted HTML keeps strong, em and https links; the schema drops everything else.
          isAllowedUri: (url) => isSafeStoryLinkHref(url),
          HTMLAttributes: { class: 'rd-link' },
        },
      }),
      FlatListItem,
      Citation,
      EntityLink,
      PreserveBlock,
      PlainHeading,
      PlainHeadingInput,
      NoAtomLinks,
      BlockMove,
      StoryShortcuts.configure({
        onLink: () => actions.current.openLink(),
        onCite: () => actions.current.openCite(),
      }),
      EditorialLint.configure({
        getReferences: () => referenceInfo.current,
        getContext: () => ({ unpublishedEntityIds: unpublishedRecordIds() }),
      }),
      EvidenceBlock.configure({ onEdit: (index: number) => live.current.onEditBlock(index) }),
      StoryVideo,
      StoryTable,
      StoryTableCaption,
      StoryTableNode,
      StoryTableRow,
      StoryTableHeader,
      StoryTableCell,
      RecordMention,
      SlashInsert.configure({
        getContext: () => ({
          onInsertBlock: (type, index) =>
            live.current.onInsertBlock(
              type,
              index === null ? null : Math.min(index, live.current.body.length),
            ),
        }),
      }),
    ],
    content: storyToDocument(body),
    editorProps: {
      attributes: {
        class: 'rd-prose',
        role: 'textbox',
        'aria-label': 'Story body',
        'aria-multiline': 'true',
      },
      handleKeyDown: (view, event) => {
        // Enter on a selected record link moves into its label field.
        const { selection } = view.state;
        if (
          event.key === 'Enter' &&
          selection instanceof NodeSelection &&
          selection.node.type.name === 'entityLink'
        ) {
          document.getElementById('rd-entity-label')?.focus();
          return true;
        }
        return false;
      },
      handleClick: (view, pos, event) => {
        const anchor = (event.target as HTMLElement | null)?.closest('a');
        if (!anchor || !view.dom.contains(anchor) || !view.editable) return false;
        const range = getMarkRange(view.state.doc.resolve(pos), view.state.schema.marks.link!);
        if (range) actions.current.openLink(range);
        return false;
      },
      handlePaste: (view, event) => {
        const files = [...(event.clipboardData?.files ?? [])].filter((f) =>
          f.type.startsWith('image/'),
        );
        const place = view.state.selection.$from.index(0) + 1;
        if (files.length && live.current.onImageFile) {
          files.forEach((file, i) =>
            live.current.onImageFile?.(file, Math.min(place + i, live.current.body.length)),
          );
          return true;
        }
        // A single supported video link pasted into an empty paragraph becomes a video block.
        // The URL is typed first and the block made in a separate history step, so one undo
        // returns the link as text.
        const text = event.clipboardData?.getData('text/plain').trim() ?? '';
        const video = text && !/\s/.test(text) ? parseStoryVideoUrl(text) : null;
        const { $from, empty } = view.state.selection;
        if (
          video &&
          empty &&
          $from.depth === 1 &&
          $from.parent.type.name === 'paragraph' &&
          $from.parent.content.size === 0
        ) {
          const start = $from.before(1);
          view.dispatch(view.state.tr.insertText(text));
          const { schema, doc } = view.state;
          const node = schema.nodes.storyVideo!.create({
            storyBlock: newVideoBlock(video),
          });
          view.dispatch(
            closeHistory(view.state.tr).replaceWith(
              start,
              start + doc.nodeAt(start)!.nodeSize,
              node,
            ),
          );
          return true;
        }
        return false;
      },
      handleDrop: (view, event, _slice, moved) => {
        const files = [...(event.dataTransfer?.files ?? [])].filter((f) =>
          f.type.startsWith('image/'),
        );
        if (moved || !files.length || !live.current.onImageFile) return false;
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
        const $pos = at ? view.state.doc.resolve(at.pos) : null;
        const place = $pos ? $pos.index(0) + ($pos.depth >= 1 ? 1 : 0) : live.current.body.length;
        files.forEach((file, i) =>
          live.current.onImageFile?.(file, Math.min(place + i, live.current.body.length)),
        );
        event.preventDefault();
        return true;
      },
    },
    onUpdate: ({ editor: current }) => {
      try {
        const next = documentToStory(current.getJSON(), (message) =>
          live.current.onWarning?.(message),
        );
        lastEmitted.current = next;
        live.current.onChange(next);
      } catch (error) {
        live.current.onError(
          error instanceof Error ? error.message : 'The story could not be saved.',
        );
      }
    },
  });

  useEffect(() => {
    if (!editor || body === lastEmitted.current) return;
    try {
      if (JSON.stringify(documentToStory(editor.getJSON())) !== JSON.stringify(body)) {
        const position = editor.state.selection.from;
        editor.commands.setContent(storyToDocument(body), { emitUpdate: false });
        editor.commands.setTextSelection(Math.min(position, editor.state.doc.content.size));
      }
    } catch (error) {
      live.current.onError(
        error instanceof Error ? error.message : 'The story could not be restored.',
      );
    }
  }, [body, editor]);
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);
  // Source labels or ids changing must repaint citation numbers without a keystroke.
  useEffect(() => {
    editor?.view.dispatch(editor.state.tr.setMeta(lintKey, 'refresh'));
  }, [editor, references]);

  const ui =
    useEditorState({ editor, selector: ({ editor: current }) => readToolbarState(current) }) ??
    readToolbarState(null);
  useEffect(() => {
    onIssues?.(ui.issues);
  }, [ui.issues, onIssues]);

  const closePanel = useCallback(() => {
    setPanel(null);
    editor?.commands.focus();
  }, [editor]);

  actions.current.openLink = (range) => {
    if (!editor || !editor.isEditable) return;
    const { from, to } = range ?? editor.state.selection;
    setPanel({ kind: 'link', target: linkTargetAt(editor, from, to) });
  };
  actions.current.openCite = () => {
    if (editor?.isEditable) setPanel({ kind: 'cite' });
  };
  const openRecord = () => {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    setPanel({
      kind: 'record',
      from,
      to,
      selected: empty ? '' : safeLabel(editor.state.doc.textBetween(from, to, ' ')),
    });
  };
  const toolbarActions: ToolbarActions = {
    onLink: () => actions.current.openLink(),
    onRecord: openRecord,
    onCite: () => actions.current.openCite(),
    onInsert: () => setPanel((open) => (open?.kind === 'insert' ? null : { kind: 'insert' })),
    onShowIssues,
  };

  const disabled = !editable || !editor;
  return (
    <div className="editorial-document rd-document">
      <Toolbar
        editor={editor}
        ui={ui}
        disabled={disabled}
        actions={toolbarActions}
        openPanel={panel?.kind ?? null}
        insertRef={insertButton}
      />
      {!editor && <p role="status">Loading story editor…</p>}
      <EditorContent editor={editor} />
      {editor && editable ? (
        <SelectionBubble editor={editor} ui={ui} actions={toolbarActions} />
      ) : null}

      {editor && panel?.kind === 'link' ? (
        <LinkPopover editor={editor} target={panel.target} onClose={closePanel} />
      ) : null}
      {editor && panel?.kind === 'record' ? (
        <PickerPopover
          label="Link a record"
          placeholder="Search records by name"
          getRect={() => rangeRect(editor, panel.from, panel.to)}
          onClose={closePanel}
        >
          {(query, list, setActive) => (
            <RecordPicker
              ref={list}
              query={query}
              onActiveId={setActive}
              onPick={(hit) => {
                editor
                  .chain()
                  .focus()
                  .insertContentAt(
                    { from: panel.from, to: panel.to },
                    {
                      type: 'entityLink',
                      attrs: {
                        entityId: hit.id,
                        label: panel.selected || safeLabel(hit.display_name),
                      },
                    },
                  )
                  .run();
                setPanel(null);
              }}
            />
          )}
        </PickerPopover>
      ) : null}
      {editor && panel?.kind === 'cite' ? (
        <PickerPopover
          label="Cite a source"
          placeholder="Filter sources"
          getRect={() => rangeRect(editor, editor.state.selection.from, editor.state.selection.to)}
          onClose={closePanel}
        >
          {(query, list, setActive) => (
            <CitationList
              query={query}
              references={references}
              listRef={list}
              onActiveId={setActive}
              onPick={(refId) => {
                setPanel(null);
                insertCitation(editor, refId);
              }}
              onAdd={
                onAddReference
                  ? () => {
                      setPanel(null);
                      onAddReference();
                    }
                  : undefined
              }
            />
          )}
        </PickerPopover>
      ) : null}
      {editor && panel?.kind === 'insert' ? (
        <PickerPopover
          label="Insert a block"
          placeholder="Filter blocks"
          getRect={() => insertButton.current?.getBoundingClientRect() ?? null}
          ignore={() => insertButton.current}
          onClose={closePanel}
        >
          {(query, list, setActive) => (
            <InsertList
              ref={list}
              query={query}
              onActiveId={setActive}
              onPick={(entry) => {
                setPanel(null);
                runInsert(editor, entry.id, {
                  onInsertBlock: (type, index) =>
                    onInsertBlock(
                      type,
                      index === null ? null : Math.min(index, live.current.body.length),
                    ),
                });
              }}
            />
          )}
        </PickerPopover>
      ) : null}
      {editor && editable && ui.entity ? (
        <EntityPopover
          editor={editor}
          target={ui.entity}
          onClose={() => {
            // Step past the atom so the popover closes and typing resumes after it.
            editor
              .chain()
              .focus()
              .setTextSelection(ui.entity!.pos + 1)
              .run();
          }}
        />
      ) : null}
    </div>
  );
}
