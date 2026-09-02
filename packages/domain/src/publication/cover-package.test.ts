/**
 * Fail-closed cover package gate: missing brief/recipe/plate+lock/kicker/headline
 * or a stock-like plate cannot publish.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COVER_BRIEF_HELPERS,
  COVER_LOCK_CURRENT,
  COVER_RECIPES,
  CoverPackagePublishError,
  assertCoverPackageForPublish,
  coverPackageInputFromFields,
  evaluateCoverPackage,
  type CoverPackageInput,
} from './cover-package.js';

function validInput(overrides: CoverPackageInput = {}): CoverPackageInput {
  const base = coverPackageInputFromFields({
    situation: 'A daughter trying to find the street her grandmother named, not a topic page.',
    metaphor: 'A house key hanging from a clothesline over an empty lot.',
    refuse: 'Black woman looking at camera in golden hour',
    recipe: 'object-as-metaphor',
    plateAssetName: 'key-on-clothesline.png',
    plateLockCite: COVER_LOCK_CURRENT.cite,
    plateAlt: 'Felt-tip drawing of a key hanging over a vacant lot',
    kicker: 'San Antonio',
    headline: 'Before the battle cry',
  });
  return {
    ...base,
    ...overrides,
    brief: { ...base.brief, ...overrides.brief },
    plate: { ...base.plate, ...overrides.plate },
  };
}

test('helper text is the Content brief, not a style memo', () => {
  assert.equal(
    COVER_BRIEF_HELPERS.situation,
    'who is this for, and what are they stuck in? A person, not a topic.',
  );
  assert.equal(
    COVER_BRIEF_HELPERS.metaphor,
    'the picture that asks the question. If you can google it, start over.',
  );
  assert.equal(COVER_BRIEF_HELPERS.refuse, "name the stock photo so we don't ship it.");
});

test('recipe enum is closed', () => {
  assert.deepEqual(
    [...COVER_RECIPES],
    ['object-as-metaphor', 'scene', 'character', 'doodle-diagram'],
  );
});

test('a complete package drawn against the house lock may publish', () => {
  const result = evaluateCoverPackage(validInput());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.cover.kind, 'article.cover.package.v1');
  assert.equal(result.cover.recipe, 'object-as-metaphor');
  assert.equal(result.cover.plate.lockCite, COVER_LOCK_CURRENT.cite);
  assert.equal(assertCoverPackageForPublish(validInput()).headline, 'Before the battle cry');
});

test('missing any required field fails closed', () => {
  const missing: readonly { label: string; input: CoverPackageInput }[] = [
    { label: 'situation', input: validInput({ brief: { situation: '' } }) },
    { label: 'metaphor', input: validInput({ brief: { metaphor: '   ' } }) },
    { label: 'refuse', input: validInput({ brief: { refuse: '' } }) },
    { label: 'recipe', input: validInput({ recipe: 'portrait' }) },
    { label: 'plate', input: validInput({ plate: { assetName: '' } }) },
    { label: 'lock cite', input: validInput({ plate: { lockCite: '' } }) },
    { label: 'kicker', input: validInput({ kicker: '' }) },
    { label: 'headline', input: validInput({ headline: '' }) },
  ];

  for (const item of missing) {
    const result = evaluateCoverPackage(item.input);
    assert.equal(result.ok, false, `${item.label} should fail closed`);
    assert.ok(result.issues.length > 0, `${item.label} should name an issue`);
  }
});

test('empty or null input fails closed', () => {
  assert.equal(evaluateCoverPackage(undefined).ok, false);
  assert.equal(evaluateCoverPackage(null).ok, false);
  assert.equal(evaluateCoverPackage({}).ok, false);
});

test('an unknown lock cite fails closed', () => {
  const result = evaluateCoverPackage(validInput({ plate: { lockCite: 'cover-lock/v99' } }));
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === 'plate.lock_cite'));
});

test('a stock-library plate fails closed even with a lock cite', () => {
  const result = evaluateCoverPackage(
    validInput({
      plate: {
        assetName: 'unsplash-black-history.jpg',
        sourceUrl: 'https://images.unsplash.com/photo-123',
      },
    }),
  );
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === 'plate.stock'));
});

test('a plate that matches the named refuse stock fails closed', () => {
  const result = evaluateCoverPackage(
    validInput({
      plate: { assetName: 'black-woman-looking-at-camera-in-golden-hour.jpg' },
    }),
  );
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === 'plate.refuse'));
});

test('assertCoverPackageForPublish throws and does not return a cover', () => {
  assert.throws(
    () => assertCoverPackageForPublish({}),
    (error: unknown) => error instanceof CoverPackagePublishError && error.issues.length > 0,
  );
});
