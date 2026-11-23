/**
 * Where a reader is in a story: how far down, and which chapter (the last level-2 heading that
 * has passed under the progress line). Pure, so the screen only measures and draws.
 */
export type ChapterMark = { readonly y: number; readonly text: string };

export type StoryPosition = {
  /** 0 to 1. */
  readonly progress: number;
  /** Undefined above the first chapter heading. */
  readonly chapter: string | undefined;
};

export function storyPosition(
  scrollY: number,
  viewportHeight: number,
  contentHeight: number,
  chapters: readonly ChapterMark[],
): StoryPosition {
  const scrollable = contentHeight - viewportHeight;
  const progress = scrollable > 0 ? Math.min(1, Math.max(0, scrollY / scrollable)) : 0;
  let chapter: string | undefined;
  for (const mark of [...chapters].sort((a, b) => a.y - b.y)) {
    if (mark.y <= scrollY) chapter = mark.text;
  }
  return { progress, chapter };
}
