/**
 * The running order for one visit.
 *
 * The story used to be a fixed six-chapter script: a reader who came back met the same sentences in
 * the same order, which is a brochure, not an archive. This draws a running order per visit so a
 * second read teaches something the first did not.
 *
 * What varies is *which* points are made and how many: the context stage runs one or two chapters,
 * each carrying a different cited fact from the twenty in `story-facts.ts`, and the record chapter
 * already draws its own pin from the release.
 *
 * What does not vary is the shape of the argument. Every chapter declares a `StoryStage`, selection
 * happens strictly within a stage, and the stages always run in `STORY_STAGE_ORDER`: the archive is
 * introduced, shown to be uneven, opened on one pin, given context, run across time, then handed
 * over. That is the difference between a story that varies and a shuffled deck. In particular the
 * opening and the closing are fixed, so a visit always starts by saying what this is and always
 * ends on "Start where you stand".
 *
 * Every input is a `roll` in [0, 1) passed in by the caller rather than drawn here, so the order is
 * stable for the length of a visit and pinnable in a test.
 */

import { STORY_CHAPTERS, STORY_STAGE_ORDER, type StoryChapter, type StoryStage } from './chapters';
import { STORY_FACTS, type StoryFact } from './story-facts';

export type StoryRunOrder = {
  /** The chapters to render, in order, with `index` reassigned to their position this visit. */
  readonly chapters: readonly StoryChapter[];
  /** The fact each `rotatingFact` chapter carries. Keyed by chapter id. */
  readonly factByChapterId: Readonly<Record<string, StoryFact>>;
};

/**
 * Stages that always appear. The opening and closing frame the whole thing, and the three in
 * between carry the argument the site exists to make: the record is uneven, a pin opens into
 * evidence, and the archive fills across four centuries. Dropping any of them to add variety would
 * buy novelty with coherence.
 */
const REQUIRED_STAGES: readonly StoryStage[] = ['opening', 'shape', 'evidence', 'time', 'closing'];

/** How many chapters the context stage runs. Two on roughly half of visits. */
const MIN_CONTEXT_CHAPTERS = 1;
const MAX_CONTEXT_CHAPTERS = 2;

function bounded(roll: number): number {
  return Number.isFinite(roll) ? Math.min(Math.max(roll, 0), 0.999999) : 0;
}

/**
 * Deterministic sub-rolls from one seed, so a single `Math.random()` at mount drives every choice
 * without the caller having to thread half a dozen separate rolls through.
 */
function subRolls(roll: number, count: number): readonly number[] {
  let state = Math.floor(bounded(roll) * 0xffffffff) >>> 0 || 0x9e3779b9;
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    out.push(((t ^ (t >>> 14)) >>> 0) / 4294967296);
  }
  return out;
}

/** Distinct facts, so two context chapters in one visit never make the same point twice. */
function drawDistinctFacts(rolls: readonly number[], count: number): readonly StoryFact[] {
  const pool = [...STORY_FACTS];
  const drawn: StoryFact[] = [];
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    const roll = bounded(rolls[i] ?? 0);
    const [fact] = pool.splice(Math.floor(roll * pool.length), 1);
    if (fact) {
      drawn.push(fact);
    }
  }
  return drawn;
}

export function pickStoryChapters(roll: number): StoryRunOrder {
  const [countRoll, orderRoll, ...factRolls] = subRolls(roll, 2 + MAX_CONTEXT_CHAPTERS);

  const contextPool = STORY_CHAPTERS.filter((chapter) => chapter.stage === 'context');
  const contextCount = Math.min(
    contextPool.length,
    MIN_CONTEXT_CHAPTERS +
      Math.floor(bounded(countRoll ?? 0) * (MAX_CONTEXT_CHAPTERS - MIN_CONTEXT_CHAPTERS + 1)),
  );

  // Which context chapters run. When only one runs, alternate which of the two it is rather than
  // always falling back to the first: the two sit at different cameras, so the plate differs too.
  const contextChapters =
    contextCount >= contextPool.length
      ? contextPool
      : contextPool
          .slice(Math.floor(bounded(orderRoll ?? 0) * contextPool.length))
          .concat(contextPool)
          .slice(0, contextCount);

  const selected: StoryChapter[] = [];
  for (const stage of STORY_STAGE_ORDER) {
    if (stage === 'context') {
      selected.push(...contextChapters);
      continue;
    }
    if (!REQUIRED_STAGES.includes(stage)) {
      continue;
    }
    const chapter = STORY_CHAPTERS.find((candidate) => candidate.stage === stage);
    if (chapter) {
      selected.push(chapter);
    }
  }

  // Facts are handed out in running order so the first context chapter always gets the first draw,
  // which keeps the pairing stable for a given roll.
  const factChapters = selected.filter((chapter) => chapter.rotatingFact === true);
  const facts = drawDistinctFacts(factRolls, factChapters.length);
  const factByChapterId: Record<string, StoryFact> = {};
  factChapters.forEach((chapter, position) => {
    const fact = facts[position];
    if (fact) {
      factByChapterId[chapter.id] = fact;
    }
  });

  return {
    // `index` is the position this visit, not the authored one: the observer, the `data-chapter`
    // attribute and the "is this the last chapter" check all read it.
    chapters: selected.map((chapter, index) => ({ ...chapter, index })),
    factByChapterId,
  };
}
