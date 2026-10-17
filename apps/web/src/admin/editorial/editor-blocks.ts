/** Top-level block moves for the article editor: toolbar buttons, card actions and Alt+Arrow. */
import type { Editor } from '@tiptap/core';
import { NodeSelection, Selection } from '@tiptap/pm/state';

/**
 * Swap the block at `index` with its neighbor. Returns false at the document edge so the key
 * binding falls through to the browser instead of swallowing Alt+Arrow for nothing.
 */
export function moveTopLevelBlock(editor: Editor, index: number, delta: -1 | 1): boolean {
  const { state, view } = editor;
  const blocks: { readonly offset: number; readonly size: number; readonly atom: boolean }[] = [];
  state.doc.forEach((node, offset) =>
    blocks.push({ offset, size: node.nodeSize, atom: node.isAtom }),
  );
  const from = blocks[index];
  const to = blocks[index + delta];
  if (!from || !to) return false;

  const tr = state.tr;
  const moved = state.doc.nodeAt(from.offset);
  if (!moved) return false;
  tr.delete(from.offset, from.offset + from.size);
  // Moving up lands before the neighbor; moving down lands after it, which has shifted left by
  // the size of the block just removed.
  const insertAt = delta < 0 ? to.offset : to.offset - from.size + to.size;
  tr.insert(insertAt, moved);
  tr.setSelection(
    moved.isAtom
      ? NodeSelection.create(tr.doc, insertAt)
      : Selection.near(tr.doc.resolve(insertAt + 1)),
  );
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

/** Remove the block at `index`. ProseMirror history makes this undoable. */
export function removeTopLevelBlock(editor: Editor, index: number): boolean {
  const { state, view } = editor;
  let offset = -1;
  let size = 0;
  state.doc.forEach((node, at, position) => {
    if (position === index) {
      offset = at;
      size = node.nodeSize;
    }
  });
  if (offset < 0) return false;
  view.dispatch(state.tr.delete(offset, offset + size).scrollIntoView());
  view.focus();
  return true;
}
