/**
 * Where the details panel's selected block is after the body changes. The body editor can move
 * or remove a card without telling the frame, and an index that silently points at another block
 * would send the next edit or upload to the wrong one.
 *
 * - Unchanged, or edited in place (only that block differs): same index.
 * - Moved: the index where the same block now is.
 * - Removed or ambiguous: null, so nothing is edited by mistake.
 */
export function followSelectedBlock(
  previous: readonly unknown[],
  next: readonly unknown[],
  selected: number | null,
): number | null {
  if (selected === null || previous === next) return selected;
  const was = previous[selected];
  if (was === undefined) return null;
  const key = JSON.stringify(was);
  if (next.length === previous.length) {
    if (JSON.stringify(next[selected]) === key) return selected;
    const changed = next.filter(
      (block, i) => JSON.stringify(block) !== JSON.stringify(previous[i]),
    );
    if (changed.length === 1) return selected; // edited in place through the panel
  }
  const matches = next.flatMap((block, i) => (JSON.stringify(block) === key ? [i] : []));
  return matches.length === 1 ? matches[0]! : null;
}
