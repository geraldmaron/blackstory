/**
 * Tests for the admin article cover publish gate: fail closed, role check,
 * and Content helper text on the form contract.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COVER_BRIEF_HELPERS, COVER_LOCK_CURRENT, coverPackageInputFromFields } from '@repo/domain';
import { articleCoverPath, getCoverArticle, listCoverArticles } from './cover-article-catalog.ts';
import {
  COVER_BRIEF_FIELD_COPY,
  COVER_FORM_INTENT,
  COVER_PUBLISH_BLOCKED,
} from './cover-package-copy.ts';
import { attemptCoverPackagePublish } from './cover-package-publish.ts';
import { resetCoverPackageStore } from './cover-package-store.ts';

function validPackage() {
  return coverPackageInputFromFields({
    situation: 'A daughter trying to find the street her grandmother named, not a topic page.',
    metaphor: 'A house key hanging from a clothesline over an empty lot.',
    refuse: 'Black woman looking at camera in golden hour',
    recipe: 'scene',
    plateAssetName: 'key-on-clothesline.png',
    plateLockCite: COVER_LOCK_CURRENT.cite,
    kicker: 'San Antonio',
    headline: 'Before the battle cry',
  });
}

test('the form path opens a real seed article', () => {
  const articles = listCoverArticles();
  assert.ok(articles.some((article) => article.slug === 'before-the-battle-cry'));
  assert.equal(
    articleCoverPath('before-the-battle-cry'),
    '/stories/articles/before-the-battle-cry',
  );
  const article = getCoverArticle('before-the-battle-cry');
  assert.equal(article?.fromSeed, true);
  assert.equal(article?.title, 'Before the battle cry');
});

test('form helper text matches the CoverPackage contract', () => {
  assert.equal(COVER_BRIEF_FIELD_COPY.situation.helper, COVER_BRIEF_HELPERS.situation);
  assert.equal(COVER_BRIEF_FIELD_COPY.metaphor.helper, COVER_BRIEF_HELPERS.metaphor);
  assert.equal(COVER_BRIEF_FIELD_COPY.refuse.helper, COVER_BRIEF_HELPERS.refuse);
  assert.match(COVER_FORM_INTENT, /No brief, no cover/);
  assert.match(COVER_PUBLISH_BLOCKED, /blocked/i);
});

test('publish fails closed when the package is missing or stock-like', () => {
  resetCoverPackageStore();
  const blocked = attemptCoverPackagePublish({
    slug: 'before-the-battle-cry',
    package: {},
    role: 'publication',
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.published, false);
  assert.ok(blocked.issues.length > 0);

  const stock = attemptCoverPackagePublish({
    slug: 'before-the-battle-cry',
    package: {
      ...validPackage(),
      plate: {
        ...validPackage().plate,
        assetName: 'getty-images-portrait.jpg',
        sourceUrl: 'https://www.gettyimages.com/detail/photo/1',
      },
    },
    role: 'publication',
  });
  assert.equal(stock.ok, false);
  assert.ok(
    stock.issues.some((issue) => issue.code === 'plate.stock' || issue.code === 'plate.refuse'),
  );
});

test('research cannot publish; publication can when the package is valid', () => {
  resetCoverPackageStore();
  const denied = attemptCoverPackagePublish({
    slug: 'before-the-battle-cry',
    package: validPackage(),
    role: 'research',
  });
  assert.equal(denied.ok, false);
  assert.match(denied.message, /cannot publish/);

  const allowed = attemptCoverPackagePublish({
    slug: 'before-the-battle-cry',
    package: validPackage(),
    role: 'publication',
  });
  assert.equal(allowed.ok, true);
  if (!allowed.ok) return;
  assert.equal(allowed.published, false);
  assert.equal(allowed.cover.headline, 'Before the battle cry');
  assert.equal(allowed.cover.plate.lockCite, COVER_LOCK_CURRENT.cite);
});
