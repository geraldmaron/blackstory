'use client';
/** The `@` record menu and the `/` block menu, both driven by @tiptap/suggestion. */
import { Extension, type Editor } from '@tiptap/core';
import { PluginKey, type EditorState } from '@tiptap/pm/state';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { type SuggestionProps } from '@tiptap/suggestion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { forwardRef } from 'react';
import { MenuList, RecordPicker, type MenuListHandle } from './menus';
import { filterInsertEntries, runInsert, type InsertContext, type InsertEntry } from './insert';
import { safeLabel, type RecordHit } from './record-session';

/** Points the editor's own element at the open list, so a screen reader hears the highlight. */
function describeOpenList(editor: Editor) {
  const dom = editor.view.dom;
  dom.setAttribute('aria-haspopup', 'listbox');
  return {
    active: (id: string | null) => {
      dom.setAttribute('aria-expanded', 'true');
      if (id) dom.setAttribute('aria-activedescendant', id);
      else dom.removeAttribute('aria-activedescendant');
    },
    close: () => {
      for (const name of ['aria-haspopup', 'aria-expanded', 'aria-activedescendant'])
        dom.removeAttribute(name);
    },
  };
}

function suggestionRender<Props extends object, Item>(
  Component: React.ComponentType<Props & React.RefAttributes<MenuListHandle>>,
  toProps: (props: SuggestionProps<Item, Item>, onActiveId: (id: string | null) => void) => Props,
) {
  return () => {
    let renderer: ReactRenderer<
      MenuListHandle,
      Props & React.RefAttributes<MenuListHandle>
    > | null = null;
    let unmount: (() => void) | null = null;
    let aria: ReturnType<typeof describeOpenList> | null = null;
    return {
      onStart: (props: SuggestionProps<Item, Item>) => {
        aria = describeOpenList(props.editor);
        renderer = new ReactRenderer(Component, {
          editor: props.editor,
          props: toProps(props, aria.active) as Props & React.RefAttributes<MenuListHandle>,
        });
        renderer.element.classList.add('rd-panel', 'rd-panel--suggest');
        unmount = props.mount(renderer.element as HTMLElement);
      },
      onUpdate: (props: SuggestionProps<Item, Item>) => {
        if (aria)
          renderer?.updateProps(
            toProps(props, aria.active) as Props & React.RefAttributes<MenuListHandle>,
          );
      },
      onKeyDown: ({ event }: { event: KeyboardEvent }) => renderer?.ref?.onKeyDown(event) ?? false,
      onExit: () => {
        unmount?.();
        renderer?.destroy();
        aria?.close();
        renderer = null;
      },
    };
  };
}

const allowedHere = ({ state, range }: { state: EditorState; range: { from: number } }) => {
  const { $from } = state.selection;
  // Headings are plain text in the contract: no record links there.
  return $from.parent.type.name !== 'heading' && range.from >= $from.start();
};

/** `@` after a space or at the start of a line searches records and inserts a record atom. */
export const RecordMention = Extension.create({
  name: 'recordMention',
  addProseMirrorPlugins() {
    return [
      Suggestion<RecordHit, RecordHit>({
        editor: this.editor,
        pluginKey: new PluginKey('recordMention'),
        char: '@',
        allowSpaces: true,
        allowedPrefixes: [' '],
        floatingUi: { strategy: 'fixed' },
        allow: ({ state, range }) =>
          allowedHere({ state, range }) && range.from + 60 > state.selection.from,
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, {
              type: 'entityLink',
              attrs: { entityId: props.id, label: safeLabel(props.display_name) },
            })
            .run();
        },
        render: suggestionRender(RecordPicker, (props, onActiveId) => ({
          query: props.query,
          onPick: (hit: RecordHit) => props.command(hit),
          onActiveId,
        })),
      }),
    ];
  },
});

export const InsertList = forwardRef<
  MenuListHandle,
  {
    query: string;
    onPick: (entry: InsertEntry) => void;
    onActiveId?: (id: string | null) => void;
  }
>(function InsertList({ query, onPick, onActiveId }, ref) {
  const entries = filterInsertEntries(query);
  return (
    <MenuList
      ref={ref}
      label="Insert"
      status={entries.length ? null : `Nothing matches “${query.trim()}”. Esc keeps it as text.`}
      options={entries.map((entry) => ({
        key: entry.id,
        separatorBefore: entry.separatorBefore === true && !query.trim(),
        onPick: () => onPick(entry),
        node: (
          <>
            <FontAwesomeIcon icon={entry.icon} className="rd-list__icon" aria-hidden="true" />
            <span className="rd-list__text">
              <span className="rd-list__name">{entry.label}</span>
              <span className="rd-list__line">{entry.description}</span>
            </span>
          </>
        ),
      }))}
      {...(onActiveId ? { onActiveId } : {})}
    />
  );
});

/** `/` at the start of an empty paragraph opens the block menu. */
export const SlashInsert = Extension.create<{ getContext: () => InsertContext }>({
  name: 'slashInsert',
  addOptions: () => ({ getContext: () => ({ onInsertBlock: () => {} }) }),
  addProseMirrorPlugins() {
    const getContext = this.options.getContext;
    return [
      Suggestion<InsertEntry, InsertEntry>({
        editor: this.editor,
        pluginKey: new PluginKey('slashInsert'),
        char: '/',
        startOfLine: true,
        allowedPrefixes: null,
        floatingUi: { strategy: 'fixed' },
        allow: ({ state }) => {
          const { $from } = state.selection;
          return $from.depth === 1 && $from.parent.type.name === 'paragraph';
        },
        command: ({ editor, range, props }) => {
          editor.chain().focus().deleteRange(range).run();
          runInsert(editor, props.id, getContext());
        },
        render: suggestionRender(InsertList, (props, onActiveId) => ({
          query: props.query,
          onPick: (entry: InsertEntry) => props.command(entry),
          onActiveId,
        })),
      }),
    ];
  },
});
