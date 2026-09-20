import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { HydratedArticle } from '../articles/hydrate';
import {
  livesNarrativeSeriesId,
  mapLivesNarrativesToEras,
  renumberLivesNarrativeReferences,
} from './lives-narratives';

function narrative(
  slug: string,
  position: number,
  eraLabel: string,
  refs: number,
  blockType = 'paragraph',
): HydratedArticle {
  return {
    doc: {
      slug,
      eraLabel,
      series: { id: 'lives-home', label: 'Keeping a home', position },
      body: [{ type: blockType, text: 'Prose.' }],
    },
    blocks: [],
    references: Array.from({ length: refs }, (_, index) => ({
      number: index + 1,
      key: `${slug}-r${index + 1}`,
      label: `Source ${index + 1}`,
      url: 'https://www.loc.gov/',
    })),
    refNumberById: new Map(
      Array.from({ length: refs }, (_, index) => [`${slug}-r${index + 1}`, index + 1] as const),
    ),
  } as unknown as HydratedArticle;
}

test('a column is the series named for its question', () => {
  assert.equal(livesNarrativeSeriesId('home'), 'lives-home');
});

test('series position is the join to an era, and every mismatch is reported', () => {
  const { byEraId, problems } = mapLivesNarrativesToEras([
    narrative('home-1900', 2, '1900s–1930s', 2),
    narrative('home-1900-again', 2, '1900s–1930s', 1),
    narrative('home-nowhere', 9, '2090s', 1),
    narrative('home-1940', 3, '1940–1960', 1),
    narrative('home-1970', 4, '1970s–1980s', 1, 'figure'),
  ]);
  assert.deepEqual([...byEraId.keys()], ['1900-1930', '1940-1960', '1970-1980']);
  assert.equal(byEraId.get('1900-1930')?.doc.slug, 'home-1900');
  assert.equal(problems.length, 4);
  assert.match(problems.join('\n'), /a second narrative claims era 1900-1930/);
  assert.match(problems.join('\n'), /position 9 is not an era/);
  assert.match(problems.join('\n'), /eraLabel "1940–1960" does not match era "1940s–1960s"/);
  assert.match(problems.join('\n'), /cannot carry a "figure" block/);
});

test('references number continuously down the page, so anchors never collide', () => {
  const { byEraId } = mapLivesNarrativesToEras([
    narrative('home-1940', 3, '1940s–1960s', 2),
    narrative('home-1900', 2, '1900s–1930s', 3),
  ]);
  const numbered = renumberLivesNarrativeReferences(byEraId);
  assert.deepEqual(
    numbered.get('1900-1930')?.references.map((ref) => ref.number),
    [1, 2, 3],
  );
  assert.deepEqual(
    numbered.get('1940-1960')?.references.map((ref) => ref.number),
    [4, 5],
  );
  assert.equal(numbered.get('1940-1960')?.refNumberById.get('home-1940-r1'), 4);
});
