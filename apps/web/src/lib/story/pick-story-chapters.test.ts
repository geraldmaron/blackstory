/**
 * The running order varies per visit. These pin the parts that must not vary with it.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickStoryChapters } from './pick-story-chapters';
import { STORY_STAGE_ORDER, isValidChapterCamera } from './chapters';
import { copyFor } from '../../components/story/story-copy';

/** A spread of rolls across [0, 1), plus the edges and some junk the caller could pass. */
const ROLLS = [
  0,
  0.05,
  0.17,
  0.29,
  0.33,
  0.42,
  0.5,
  0.61,
  0.68,
  0.75,
  0.83,
  0.91,
  0.999999,
  1,
  -1,
  Number.NaN,
];

test('every roll yields a story that opens and closes on the fixed framing', () => {
  for (const roll of ROLLS) {
    const { chapters } = pickStoryChapters(roll);
    assert.ok(chapters.length >= 5, `roll ${roll} produced too short a story`);
    assert.equal(chapters[0]?.id, 'cold-open', `roll ${roll} does not open on the cold open`);
    assert.equal(
      chapters[chapters.length - 1]?.id,
      'your-turn',
      `roll ${roll} does not close on "Start where you stand"`,
    );
  }
});

test('stages always run in narrative order, whichever chapters were drawn', () => {
  for (const roll of ROLLS) {
    const { chapters } = pickStoryChapters(roll);
    const positions = chapters.map((chapter) => STORY_STAGE_ORDER.indexOf(chapter.stage));
    for (let i = 1; i < positions.length; i += 1) {
      assert.ok(
        positions[i]! >= positions[i - 1]!,
        `roll ${roll} puts ${chapters[i]!.id} (${chapters[i]!.stage}) after a later stage`,
      );
    }
    // The argument itself is always made, in this order.
    const stages = chapters.map((chapter) => chapter.stage);
    for (const required of ['opening', 'shape', 'evidence', 'context', 'time', 'closing']) {
      assert.ok(stages.includes(required as never), `roll ${roll} dropped the ${required} stage`);
    }
  }
});

test('indices are contiguous from zero, so the observer can resolve one back to a chapter', () => {
  for (const roll of ROLLS) {
    const { chapters } = pickStoryChapters(roll);
    chapters.forEach((chapter, position) => {
      assert.equal(chapter.index, position, `roll ${roll}: ${chapter.id} is out of sequence`);
    });
    const ids = new Set(chapters.map((chapter) => chapter.id));
    assert.equal(ids.size, chapters.length, `roll ${roll} repeats a chapter`);
  }
});

test('every drawn chapter is renderable: it has copy and a camera the plate accepts', () => {
  for (const roll of ROLLS) {
    const { chapters } = pickStoryChapters(roll);
    for (const chapter of chapters) {
      assert.ok(copyFor(chapter.id), `${chapter.id} has no copy and would render as a blank card`);
      assert.ok(isValidChapterCamera(chapter.camera), `${chapter.id} carries an invalid camera`);
    }
  }
});

test('every rotating-fact chapter gets a fact, and no two in one visit repeat one', () => {
  for (const roll of ROLLS) {
    const { chapters, factByChapterId } = pickStoryChapters(roll);
    const factChapters = chapters.filter((chapter) => chapter.rotatingFact === true);
    assert.ok(factChapters.length >= 1, `roll ${roll} runs no context chapter`);

    const factIds = factChapters.map((chapter) => {
      const fact = factByChapterId[chapter.id];
      assert.ok(fact, `roll ${roll}: ${chapter.id} rotates a fact but was not given one`);
      assert.ok(fact.source.length > 0, `${fact.id} carries no source`);
      return fact.id;
    });
    assert.equal(
      new Set(factIds).size,
      factIds.length,
      `roll ${roll} shows the same fact on two cards`,
    );
  }
});

test('the running order actually varies across rolls', () => {
  // The whole point of the draw. If every roll produced the same signature, a returning reader
  // would meet the same story and this module would be dead weight.
  const signatures = new Set(
    ROLLS.map((roll) => {
      const { chapters, factByChapterId } = pickStoryChapters(roll);
      return chapters.map((c) => `${c.id}:${factByChapterId[c.id]?.id ?? ''}`).join('|');
    }),
  );
  assert.ok(signatures.size > 1, 'the story is identical on every visit');
});

test('the same roll always yields the same story', () => {
  // Scrolling back up must not re-roll the archive under the reader.
  for (const roll of ROLLS) {
    const a = pickStoryChapters(roll);
    const b = pickStoryChapters(roll);
    assert.deepEqual(
      a.chapters.map((c) => c.id),
      b.chapters.map((c) => c.id),
    );
    assert.deepEqual(a.factByChapterId, b.factByChapterId);
  }
});
