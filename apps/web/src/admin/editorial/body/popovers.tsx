'use client';
/** Small anchored editors: the link field, the record-label field, and the source picker. */
import { useState } from 'react';
import type { Editor } from '@tiptap/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUpRightFromSquare, faPlus } from '@fortawesome/free-solid-svg-icons';
import type { StoryReferenceDoc } from '@repo/schemas';
import { FloatingPanel, MenuList, type MenuListHandle, type Rect } from './menus';
import { normalizeLinkInput } from './link';
import { safeLabel } from './record-session';

/** The rectangle spanned by a document range, for anchoring a panel to it. */
export function rangeRect(editor: Editor, from: number, to: number): Rect | null {
  try {
    const start = editor.view.coordsAtPos(from);
    const end = editor.view.coordsAtPos(Math.max(from, to));
    return {
      left: Math.min(start.left, end.left),
      right: Math.max(start.right, end.right),
      top: Math.min(start.top, end.top),
      bottom: Math.max(start.bottom, end.bottom),
    };
  } catch {
    return null;
  }
}

export type LinkTarget = { readonly from: number; readonly to: number; readonly href: string };

/** The link field: paste an https address, apply it, remove it, or open it. */
export function LinkPopover({
  editor,
  target,
  onClose,
}: {
  editor: Editor;
  target: LinkTarget;
  onClose: () => void;
}) {
  const existing = target.href !== '';
  const [value, setValue] = useState(target.href);
  const [problem, setProblem] = useState('');
  const checked = normalizeLinkInput(value);
  const apply = () => {
    if ('problem' in checked) {
      setProblem(checked.problem);
      return;
    }
    const chain = editor.chain().focus().setTextSelection({ from: target.from, to: target.to });
    if (existing) chain.extendMarkRange('link').setLink({ href: checked.href }).run();
    else if (target.from === target.to)
      chain
        .insertContent({
          type: 'text',
          text: checked.href,
          marks: [{ type: 'link', attrs: { href: checked.href } }],
        })
        .run();
    else chain.setLink({ href: checked.href }).run();
    onClose();
  };
  return (
    <FloatingPanel
      label="Link"
      getRect={() => rangeRect(editor, target.from, target.to)}
      onDismiss={onClose}
    >
      <form
        className="rd-form"
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
      >
        <label className="rd-label">
          Web address
          <input
            className="rd-field"
            type="text"
            inputMode="url"
            autoFocus
            spellCheck={false}
            value={value}
            aria-invalid={problem ? true : undefined}
            aria-describedby="rd-link-problem"
            placeholder="https://"
            onChange={(event) => {
              setValue(event.target.value);
              setProblem('');
            }}
          />
        </label>
        <p id="rd-link-problem" className="rd-problem" role="alert">
          {problem}
        </p>
        <div className="rd-form__row">
          <button type="submit" className="rd-btn rd-btn--primary">
            Apply
          </button>
          {existing ? (
            <button
              type="button"
              className="rd-btn rd-btn--text"
              onClick={() => {
                editor
                  .chain()
                  .focus()
                  .setTextSelection({ from: target.from, to: target.to })
                  .extendMarkRange('link')
                  .unsetLink()
                  .run();
                onClose();
              }}
            >
              Remove link
            </button>
          ) : null}
          {'href' in checked && checked.href.startsWith('https://') ? (
            <a
              className="rd-btn rd-btn--text"
              href={checked.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in new tab
              <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </form>
    </FloatingPanel>
  );
}

export type EntityTarget = {
  readonly pos: number;
  readonly entityId: string;
  readonly label: string;
};

/** Offered while a record link is selected: its label, a way to open it, and a way to unlink it. */
export function EntityPopover({
  editor,
  target,
  onClose,
}: {
  editor: Editor;
  target: EntityTarget;
  onClose: () => void;
}) {
  const size = editor.state.doc.nodeAt(target.pos)?.nodeSize ?? 1;
  return (
    <FloatingPanel
      label="Record link"
      role="group"
      getRect={() => rangeRect(editor, target.pos, target.pos + size)}
      onDismiss={onClose}
      ignore={() => editor.view.dom}
    >
      <div className="rd-form">
        <label className="rd-label">
          Label
          <input
            id="rd-entity-label"
            className="rd-field"
            type="text"
            value={target.label}
            placeholder="Shown to readers in place of the record's name"
            onChange={(event) =>
              editor
                .chain()
                .updateAttributes('entityLink', {
                  label: event.target.value.replace(/[[\]|]/g, ''),
                })
                .run()
            }
            onBlur={() => {
              const trimmed = safeLabel(target.label);
              if (trimmed !== target.label)
                editor.chain().updateAttributes('entityLink', { label: trimmed }).run();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onClose();
              }
            }}
          />
        </label>
        <div className="rd-form__row">
          <a
            className="rd-btn rd-btn--text"
            href={`/admin/catalog/${encodeURIComponent(target.entityId)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open record
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" />
          </a>
          <button
            type="button"
            className="rd-btn rd-btn--text"
            onClick={() => {
              const text = safeLabel(target.label) || target.entityId;
              const node = editor.state.doc.nodeAt(target.pos);
              editor
                .chain()
                .focus()
                .insertContentAt(
                  { from: target.pos, to: target.pos + size },
                  { type: 'text', text, marks: node?.marks.map((mark) => mark.toJSON()) ?? [] },
                )
                .run();
            }}
          >
            Remove link
          </button>
        </div>
        <p className="rd-hint">Remove link keeps the label as plain text.</p>
      </div>
    </FloatingPanel>
  );
}

/** Insert a citation atom; the caret lands after it. A selected range is collapsed to its end first. */
export function insertCitation(editor: Editor, refId: string): void {
  const { to } = editor.state.selection;
  editor
    .chain()
    .focus()
    .setTextSelection(to)
    .insertContent({ type: 'citation', attrs: { refId } })
    .run();
}

/** Sources attached to the story, filtered as the writer types, ending in a way to add one. */
export function CitationList({
  query,
  references,
  onPick,
  onAdd,
  listRef,
  onActiveId,
}: {
  query: string;
  references: readonly StoryReferenceDoc[];
  onPick: (refId: string) => void;
  onAdd?: (() => void) | undefined;
  listRef: React.Ref<MenuListHandle>;
  onActiveId: (id: string | null) => void;
}) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = references.filter((ref) =>
    words.every((word) => `${ref.label} ${ref.id}`.toLowerCase().includes(word)),
  );
  return (
    <MenuList
      ref={listRef}
      label="Sources"
      onActiveId={onActiveId}
      status={
        references.length === 0
          ? 'No sources are attached to this story yet.'
          : matches.length === 0
            ? `No source matches “${query.trim()}”.`
            : null
      }
      options={[
        ...matches.map((ref) => ({
          key: ref.id,
          onPick: () => onPick(ref.id),
          node: (
            <span className="rd-list__text">
              <span className="rd-list__name">{ref.label || ref.id}</span>
              <span className="rd-list__line">{ref.id}</span>
            </span>
          ),
        })),
        ...(onAdd
          ? [
              {
                key: '__add',
                onPick: onAdd,
                separatorBefore: matches.length > 0,
                node: (
                  <>
                    <FontAwesomeIcon icon={faPlus} className="rd-list__icon" aria-hidden="true" />
                    <span className="rd-list__name">Add a new source…</span>
                  </>
                ),
              },
            ]
          : []),
      ]}
    />
  );
}
