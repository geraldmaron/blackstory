import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_STATUS_COMPARISON_COLUMNS,
  mergedPayloadSql,
  ownedKeysArrayLiteral,
  statusOnConflictSql,
} from './landscape-candidate-upsert.ts';

test('ownedKeysArrayLiteral renders a validated text[] literal', () => {
  assert.equal(
    ownedKeysArrayLiteral(['city', 'state', 'historicalContext']),
    "ARRAY['city','state','historicalContext']::text[]",
  );
});

test('ownedKeysArrayLiteral renders an empty owned-key list as an empty typed array', () => {
  assert.equal(ownedKeysArrayLiteral([]), 'ARRAY[]::text[]');
});

test('ownedKeysArrayLiteral rejects a key that is not a bare identifier', () => {
  assert.throws(() => ownedKeysArrayLiteral(['city; DROP TABLE x']), /does not match/u);
});

test('ownedKeysArrayLiteral rejects a key starting with a digit', () => {
  assert.throws(() => ownedKeysArrayLiteral(['1topic']), /does not match/u);
});

test('ownedKeysArrayLiteral rejects a key containing a quote', () => {
  assert.throws(() => ownedKeysArrayLiteral(["city'--"]), /does not match/u);
});

test('ownedKeysArrayLiteral accepts underscores and mixed case', () => {
  assert.equal(
    ownedKeysArrayLiteral(['topic_ids', 'eraBuckets']),
    "ARRAY['topic_ids','eraBuckets']::text[]",
  );
});

test('mergedPayloadSql subtracts owned keys from the stored payload before merging in the new one', () => {
  const sql = mergedPayloadSql(['city', 'state']);
  assert.match(sql, /landscape_candidates\.payload - ARRAY\['city','state'\]::text\[\]/u);
  assert.match(sql, /\|\| EXCLUDED\.payload$/u);
  // The subtraction must happen before the merge, i.e. the merge operand is the whole
  // subtraction expression, not just landscape_candidates.payload.
  assert.equal(
    sql,
    "(landscape_candidates.payload - ARRAY['city','state']::text[]) || EXCLUDED.payload",
  );
});

test('mergedPayloadSql validates owned keys even when the caller never renders the literal directly', () => {
  assert.throws(() => mergedPayloadSql(['ok', 'not ok']), /does not match/u);
});

test('mergedPayloadSql can additionally strip keys out of the incoming payload for a caller-handled CASE', () => {
  const sql = mergedPayloadSql(['city', 'state'], { excludeFromIncoming: ['personReview'] });
  assert.equal(
    sql,
    "(landscape_candidates.payload - ARRAY['city','state']::text[]) || (EXCLUDED.payload - ARRAY['personReview']::text[])",
  );
});

test('statusOnConflictSql references the merged payload, not EXCLUDED.payload alone', () => {
  const sql = statusOnConflictSql(['city', 'state']);
  // The merged-payload subtraction-then-merge shape must appear inside the CASE.
  assert.match(sql, /landscape_candidates\.payload - ARRAY\['city','state'\]::text\[\]/u);
  assert.match(sql, /\|\| EXCLUDED\.payload\) IS DISTINCT FROM landscape_candidates\.payload/u);
  // A bare EXCLUDED.payload comparison (the old, buggy shape) must not appear on its own.
  assert.doesNotMatch(sql, /WHEN[^)]*EXCLUDED\.payload\s*$/mu);
});

test('statusOnConflictSql compares every default column plus the merged payload', () => {
  const sql = statusOnConflictSql(['city']);
  for (const column of DEFAULT_STATUS_COMPARISON_COLUMNS) {
    assert.match(
      sql,
      new RegExp(`landscape_candidates\\.${column} IS DISTINCT FROM EXCLUDED\\.${column}`, 'u'),
    );
  }
  assert.match(sql, /THEN 'pending'/u);
  assert.match(sql, /ELSE landscape_candidates\.status/u);
});

test('statusOnConflictSql accepts a narrower extraColumns list', () => {
  const sql = statusOnConflictSql(['city'], ['display_name']);
  assert.match(sql, /landscape_candidates\.display_name IS DISTINCT FROM EXCLUDED\.display_name/u);
  assert.doesNotMatch(sql, /landscape_candidates\.summary/u);
});

test('statusOnConflictSql accepts an empty extraColumns list and still compares payload', () => {
  const sql = statusOnConflictSql(['city'], []);
  assert.doesNotMatch(
    sql,
    /IS DISTINCT FROM EXCLUDED\.(display_name|summary|canonical_url|lat|lng|provenance)/u,
  );
  assert.match(sql, /IS DISTINCT FROM landscape_candidates\.payload/u);
});

test('statusOnConflictSql uses a caller-supplied payloadExpr in place of the default merge', () => {
  const sql = statusOnConflictSql(['city'], DEFAULT_STATUS_COMPARISON_COLUMNS, 'some_custom_expr');
  assert.match(sql, /\(some_custom_expr\) IS DISTINCT FROM landscape_candidates\.payload/u);
  assert.doesNotMatch(sql, /landscape_candidates\.payload - ARRAY/u);
});

test('statusOnConflictSql still validates owned keys when a payloadExpr override is supplied', () => {
  assert.throws(
    () => statusOnConflictSql(['bad key'], DEFAULT_STATUS_COMPARISON_COLUMNS, 'x'),
    /does not match/u,
  );
});
