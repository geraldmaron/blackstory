/**
 * Editorial title accent for story headlines: one warm serif italic word,
 * matching the v5 `.ds-page__title em` register used on search/history/home.
 */
import React from 'react';

void React;

/** Story slug → substring to wrap in `<em>` (first match, case-sensitive). */
export const STORY_TITLE_ACCENTS: Readonly<Record<string, string>> = {
  'before-the-battle-cry': 'battle',
  'what-the-winners-wrote': 'winners',
  'the-log-cabin-costume': 'costume',
  'twelve-years-then-redemption': 'redemption',
  'after-the-second-reconstruction': 'second',
};

export function renderStoryTitle(slug: string, title: string): React.ReactNode {
  const accent = STORY_TITLE_ACCENTS[slug];
  if (!accent) return title;
  const index = title.indexOf(accent);
  if (index < 0) return title;
  return (
    <>
      {title.slice(0, index)}
      <em>{accent}</em>
      {title.slice(index + accent.length)}
    </>
  );
}
