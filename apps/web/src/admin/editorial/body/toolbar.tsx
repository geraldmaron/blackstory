'use client';
/** The one quiet formatting row, the table strip under it, and the selection bubble. */
import type { Ref } from 'react';
import type { Editor } from '@tiptap/core';
import { NodeSelection, type EditorState } from '@tiptap/pm/state';
import { BubbleMenu } from '@tiptap/react/menus';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faAt,
  faBold,
  faItalic,
  faLink,
  faPlus,
  faQuoteLeft,
  faRotateLeft,
  faRotateRight,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { TABLE_COLUMNS_MAX, TABLE_ROWS_MAX, type EditorLintIssue } from '../editor-lint';
import { tableSize } from './extensions';
import { readIssues } from './lint-plugin';
import type { EntityTarget } from './popovers';

export type ToolbarState = {
  readonly style: 'paragraph' | 'heading-2' | 'heading-3';
  readonly bold: boolean;
  readonly italic: boolean;
  readonly link: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly words: number;
  readonly issues: readonly EditorLintIssue[];
  readonly inHeading: boolean;
  readonly table: {
    readonly rows: number;
    readonly columns: number;
    readonly header: boolean;
  } | null;
  readonly entity: EntityTarget | null;
};

const EMPTY: ToolbarState = {
  style: 'paragraph',
  bold: false,
  italic: false,
  link: false,
  canUndo: false,
  canRedo: false,
  words: 0,
  issues: [],
  inHeading: false,
  table: null,
  entity: null,
};

const wordCounts = new WeakMap<object, number>();
function wordsIn(state: EditorState): number {
  const cached = wordCounts.get(state.doc);
  if (cached !== undefined) return cached;
  const text = state.doc.textBetween(0, state.doc.content.size, ' ', ' ').trim();
  const words = text ? text.split(/\s+/).length : 0;
  wordCounts.set(state.doc, words);
  return words;
}

export function readToolbarState(editor: Editor | null): ToolbarState {
  if (!editor) return EMPTY;
  const { state } = editor;
  const { selection } = state;
  const size = tableSize(selection);
  let header = false;
  if (size) {
    for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
      const node = selection.$from.node(depth);
      if (node.type.name === 'table') {
        header = node.firstChild?.firstChild?.type.name === 'tableHeader';
        break;
      }
    }
  }
  const selected = selection instanceof NodeSelection ? selection.node : null;
  return {
    style: editor.isActive('heading', { level: 2 })
      ? 'heading-2'
      : editor.isActive('heading', { level: 3 })
        ? 'heading-3'
        : 'paragraph',
    bold: editor.isActive('bold'),
    italic: editor.isActive('italic'),
    link: editor.isActive('link'),
    canUndo: editor.can().undo(),
    canRedo: editor.can().redo(),
    words: wordsIn(state),
    issues: readIssues(state),
    inHeading: editor.isActive('heading'),
    table: size ? { ...size, header } : null,
    entity:
      selected?.type.name === 'entityLink'
        ? {
            pos: selection.from,
            entityId: String(selected.attrs.entityId),
            label: String(selected.attrs.label ?? ''),
          }
        : null,
  };
}

const MOD = 'Ctrl/⌘';

export function ToolButton({
  label,
  shortcut,
  icon,
  text,
  pressed,
  disabled,
  expanded,
  onClick,
  innerRef,
}: {
  label: string;
  shortcut?: string;
  icon?: IconDefinition;
  /** Visible words beside the icon, for controls that need naming (Record, Cite, Insert). */
  text?: string;
  pressed?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  onClick: () => void;
  innerRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={innerRef}
      type="button"
      className={`rd-btn${text ? ' rd-btn--text' : ' rd-btn--icon'}`}
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      {...(pressed !== undefined ? { 'aria-pressed': pressed } : {})}
      {...(expanded !== undefined
        ? { 'aria-expanded': expanded, 'aria-haspopup': 'dialog' as const }
        : {})}
      disabled={disabled}
      // The editor keeps its selection while the pointer presses a toolbar control.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {icon ? <FontAwesomeIcon icon={icon} aria-hidden="true" /> : null}
      {text ? <span>{text}</span> : null}
    </button>
  );
}

export type ToolbarActions = {
  onLink: () => void;
  onRecord: () => void;
  onCite: () => void;
  onInsert: () => void;
  onShowIssues?: (() => void) | undefined;
};

export function Toolbar({
  editor,
  ui,
  disabled,
  actions,
  openPanel,
  insertRef,
}: {
  editor: Editor | null;
  ui: ToolbarState;
  disabled: boolean;
  actions: ToolbarActions;
  openPanel: 'link' | 'record' | 'cite' | 'insert' | null;
  insertRef: Ref<HTMLButtonElement>;
}) {
  const problems = ui.issues.length;
  const run = (fn: (chain: ReturnType<Editor['chain']>) => void) => () => {
    if (editor) fn(editor.chain().focus());
  };
  return (
    <div className="rd-toolbar">
      <div className="rd-toolbar__row" role="toolbar" aria-label="Story formatting">
        <select
          className="rd-select"
          aria-label="Text style"
          disabled={disabled || ui.table !== null}
          value={ui.style}
          onChange={(event) => {
            const choice = event.target.value;
            if (!editor) return;
            if (choice === 'paragraph') editor.chain().focus().setParagraph().run();
            else
              editor
                .chain()
                .focus()
                .setHeading({ level: choice === 'heading-2' ? 2 : 3 })
                .run();
          }}
        >
          <option value="paragraph">Paragraph</option>
          <option value="heading-2">Heading</option>
          <option value="heading-3">Subheading</option>
        </select>
        <span className="rd-toolbar__rule" aria-hidden="true" />
        <ToolButton
          label="Bold"
          shortcut={`${MOD} B`}
          icon={faBold}
          pressed={ui.bold}
          disabled={disabled || ui.inHeading}
          onClick={run((c) => c.toggleBold().run())}
        />
        <ToolButton
          label="Italic"
          shortcut={`${MOD} I`}
          icon={faItalic}
          pressed={ui.italic}
          disabled={disabled || ui.inHeading}
          onClick={run((c) => c.toggleItalic().run())}
        />
        <ToolButton
          label="Link"
          shortcut={`${MOD} K`}
          icon={faLink}
          pressed={ui.link}
          expanded={openPanel === 'link'}
          disabled={disabled || ui.inHeading}
          onClick={actions.onLink}
        />
        <span className="rd-toolbar__rule" aria-hidden="true" />
        <ToolButton
          label="Link a record"
          shortcut="@; Ctrl/⌘ Alt K edits the record link beside the caret"
          icon={faAt}
          text="Record"
          expanded={openPanel === 'record'}
          disabled={disabled || ui.inHeading}
          onClick={actions.onRecord}
        />
        <ToolButton
          label="Cite a source"
          shortcut={`${MOD} Shift K`}
          icon={faQuoteLeft}
          text="Cite"
          expanded={openPanel === 'cite'}
          disabled={disabled || ui.inHeading}
          onClick={actions.onCite}
        />
        <span className="rd-toolbar__rule" aria-hidden="true" />
        <ToolButton
          innerRef={insertRef}
          label="Insert a block"
          shortcut="/"
          icon={faPlus}
          text="Insert"
          expanded={openPanel === 'insert'}
          disabled={disabled}
          onClick={actions.onInsert}
        />
        <span className="rd-toolbar__rule" aria-hidden="true" />
        <ToolButton
          label="Undo"
          shortcut={`${MOD} Z`}
          icon={faRotateLeft}
          disabled={disabled || !ui.canUndo}
          onClick={run((c) => c.undo().run())}
        />
        <ToolButton
          label="Redo"
          shortcut={`${MOD} Shift Z`}
          icon={faRotateRight}
          disabled={disabled || !ui.canRedo}
          onClick={run((c) => c.redo().run())}
        />
        <div className="rd-toolbar__meta">
          {problems && actions.onShowIssues ? (
            <button type="button" className="rd-toolbar__issues" onClick={actions.onShowIssues}>
              {problems} to fix
            </button>
          ) : problems ? (
            <span className="rd-toolbar__issues">{problems} to fix</span>
          ) : null}
        </div>
      </div>
      {ui.table ? (
        <div className="rd-toolbar__row rd-toolbar__row--table" role="toolbar" aria-label="Table">
          <ToolButton
            label="Add row below"
            text="Add row"
            disabled={disabled || ui.table.rows >= TABLE_ROWS_MAX}
            onClick={run((c) => c.addRowAfter().run())}
          />
          <ToolButton
            label="Add column right"
            text="Add column"
            disabled={disabled || ui.table.columns >= TABLE_COLUMNS_MAX}
            onClick={run((c) => c.addColumnAfter().run())}
          />
          <ToolButton
            label="Delete row"
            text="Delete row"
            disabled={disabled || ui.table.rows <= 1}
            onClick={run((c) => c.deleteRow().run())}
          />
          <ToolButton
            label="Delete column"
            text="Delete column"
            disabled={disabled || ui.table.columns <= 1}
            onClick={run((c) => c.deleteColumn().run())}
          />
          <ToolButton
            label="Header row"
            text="Header row"
            pressed={ui.table.header}
            disabled={disabled}
            onClick={run((c) => c.toggleHeaderRow().run())}
          />
          <ToolButton
            label="Delete table"
            text="Delete table"
            disabled={disabled}
            onClick={() => editor && deleteStoryTable(editor)}
          />
          <span className="rd-toolbar__meta">
            {ui.table.rows} of {TABLE_ROWS_MAX} rows, {ui.table.columns} of {TABLE_COLUMNS_MAX}{' '}
            columns
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** Remove the whole table block, caption included; undo restores it. */
function deleteStoryTable(editor: Editor): void {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'storyTable') {
      editor
        .chain()
        .focus()
        .deleteRange({ from: $from.before(depth), to: $from.after(depth) })
        .run();
      return;
    }
  }
}

/** B, I, Link, Record and Cite over a text selection. Never over a card or a heading. */
export function SelectionBubble({
  editor,
  ui,
  actions,
}: {
  editor: Editor;
  ui: ToolbarState;
  actions: ToolbarActions;
}) {
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="rdSelectionBubble"
      updateDelay={100}
      appendTo={() => document.body}
      options={{ strategy: 'fixed', placement: 'top', offset: 8 }}
      shouldShow={({ state, view }) =>
        view.hasFocus() &&
        !state.selection.empty &&
        !(state.selection instanceof NodeSelection) &&
        state.selection.$from.parent.type.name !== 'heading' &&
        view.editable
      }
      className="rd-bubble"
      role="toolbar"
      aria-label="Format selection"
    >
      <ToolButton
        label="Bold"
        shortcut={`${MOD} B`}
        icon={faBold}
        pressed={ui.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolButton
        label="Italic"
        shortcut={`${MOD} I`}
        icon={faItalic}
        pressed={ui.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolButton
        label="Link"
        shortcut={`${MOD} K`}
        icon={faLink}
        pressed={ui.link}
        onClick={actions.onLink}
      />
      <ToolButton label="Link a record" icon={faAt} onClick={actions.onRecord} />
      <ToolButton
        label="Cite a source"
        shortcut={`${MOD} Shift K`}
        icon={faQuoteLeft}
        onClick={actions.onCite}
      />
    </BubbleMenu>
  );
}
