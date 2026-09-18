import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  attachPublicCitationArchives,
  assertArchiveHydrationTargetIsUnsigned,
  loadPublicCitationArchives,
  selectPublicCitationArchives,
  type CitationArchiveCandidateRow,
} from './citation-archive-publication.ts';

const SOURCE = 'https://example.gov/record/1';
const PUBLISHED_AT = '2026-09-18T12:00:00.000Z';

function decision(overrides: Record<string, unknown> = {}) {
  return {
    sourceUrl: SOURCE,
    allowTextRetention: false,
    allowArchive: true,
    sensitivity: 'public',
    reviewedBy: 'operator-1',
    reviewedAt: '2026-09-01T00:00:00.000Z',
    expiresAt: '2027-09-01T00:00:00.000Z',
    basis: 'Public government record approved for archival capture.',
    ...overrides,
  };
}

function row(
  timestamp: string,
  overrides: Partial<CitationArchiveCandidateRow> = {},
): CitationArchiveCandidateRow {
  const archivedAt = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}T${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}.000Z`;
  return {
    source_url: SOURCE,
    capture_id: `cap-${timestamp}`,
    content_hash_digest: timestamp.padEnd(64, 'a'),
    retention_revoked_at: null,
    preservation_state: 'anchored',
    preservation_decision: decision(),
    current_preservation_decision: decision({ reviewedBy: 'operator-2' }),
    preservation_result: {
      status: 'anchored',
      waybackCaptureUrl: `https://web.archive.org/web/${timestamp}/${SOURCE}`,
      waybackCapturedAt: archivedAt,
    },
    ...overrides,
    claim_id: overrides.claim_id ?? 'claim-1',
  };
}

describe('public citation archive selection', () => {
  test('selects the newest eligible exact-source revision deterministically', () => {
    const older = row('20260901000000');
    const newer = row('20260902000000');
    const key = `claim-1\u001f${SOURCE}`;
    const first = selectPublicCitationArchives([older, newer], PUBLISHED_AT).get(key);
    const reversed = selectPublicCitationArchives([newer, older], PUBLISHED_AT).get(key);
    assert.deepEqual(first, reversed);
    assert.equal(first?.archivedAt, '2026-09-02T00:00:00.000Z');
  });

  test('rejects mismatched originals, revoked rows, expired decisions and pending jobs', () => {
    const candidates = [
      row('20260901000000', {
        preservation_result: {
          status: 'anchored',
          waybackCaptureUrl:
            'https://web.archive.org/web/20260901000000/https://other.gov/record/1',
          waybackCapturedAt: '2026-09-01T00:00:00.000Z',
        },
      }),
      row('20260902000000', { retention_revoked_at: '2026-09-10T00:00:00.000Z' }),
      row('20260903000000', {
        preservation_decision: decision({ expiresAt: PUBLISHED_AT }),
      }),
      row('20260904000000', { preservation_state: 'pending' }),
    ];
    assert.equal(selectPublicCitationArchives(candidates, PUBLISHED_AT).size, 0);
  });

  test('rejects malformed, untrusted, incomplete and policy-ineligible archive data', () => {
    const candidates = [
      row('20260901000000', {
        preservation_result: {
          status: 'anchored',
          waybackCaptureUrl: 'https://evil.example/archive',
          waybackCapturedAt: '2026-09-01T00:00:00.000Z',
        },
      }),
      row('20260902000000', { preservation_result: { status: 'pending' } }),
      row('20260903000000', {
        preservation_decision: decision({ allowArchive: false }),
      }),
      row('20260904000000', {
        preservation_decision: decision({ sensitivity: 'restricted' }),
      }),
    ];
    assert.equal(selectPublicCitationArchives(candidates, PUBLISHED_AT).size, 0);
  });

  test('requires the latest current origin decision to remain complete and eligible', () => {
    const missingReviewer = decision();
    delete (missingReviewer as { reviewedBy?: string }).reviewedBy;
    const candidates = [
      row('20260901000000', {
        current_preservation_decision: decision({ allowArchive: false }),
      }),
      row('20260902000000', { current_preservation_decision: missingReviewer }),
      row('20260903000000', {
        current_preservation_decision: decision({ reviewedAt: '2026-09-19T00:00:00.000Z' }),
      }),
      row('20260904000000', {
        current_preservation_decision: decision({ expiresAt: PUBLISHED_AT }),
      }),
    ];
    assert.equal(selectPublicCitationArchives(candidates, PUBLISHED_AT).size, 0);
  });

  test('loads only anchored non-revoked SPN2 jobs and publishes no storage object', async () => {
    let sql = '';
    const archives = await loadPublicCitationArchives(
      {
        async query<T extends Record<string, unknown>>(statement: string) {
          sql = statement;
          return { rows: [row('20260901000000') as unknown as T] };
        },
      },
      [
        {
          claimId: 'claim-1',
          sourceUrl: SOURCE,
          sourceItemId: 'source-item-1',
          captureId: 'cap-20260901000000',
          contentHashDigest: '20260901000000'.padEnd(64, 'a'),
        },
      ],
      PUBLISHED_AT,
    );
    assert.match(sql, /research\.preservation_jobs/u);
    assert.match(sql, /job\.state='anchored'/u);
    assert.match(sql, /retention_revoked_at IS NULL/u);
    assert.match(sql, /storage_object->'preservationDecision'/u);
    assert.match(sql, /capture\.content_hash_digest=reviewed_capture\.content_hash_digest/u);
    assert.doesNotMatch(sql, /SELECT\s+origin\.storage_object\s*[,\n]/u);
    assert.equal(archives.size, 1);
  });

  test('only a reviewed capture and digest pair can authorize a claim archive', async () => {
    const reviewedOlder = row('20260901000000');
    const unrelatedNewer = row('20260902000000');
    const queries: { sql: string; params: readonly unknown[] | undefined }[] = [];
    const archives = await loadPublicCitationArchives(
      {
        async query<T extends Record<string, unknown>>(sql: string, params?: readonly unknown[]) {
          queries.push({ sql, params });
          return { rows: [reviewedOlder] as unknown as T[] };
        },
      },
      [
        {
          claimId: 'claim-1',
          sourceUrl: SOURCE,
          sourceItemId: 'source-item-1',
          captureId: reviewedOlder.capture_id,
          contentHashDigest: reviewedOlder.content_hash_digest,
        },
      ],
      PUBLISHED_AT,
    );
    assert.deepEqual(queries[0]?.params, [
      ['claim-1'],
      [SOURCE],
      ['source-item-1'],
      [reviewedOlder.capture_id],
      [reviewedOlder.content_hash_digest],
    ]);
    assert.equal(archives.get(`claim-1\u001f${SOURCE}`)?.archivedAt, '2026-09-01T00:00:00.000Z');
    assert.ok(!JSON.stringify(queries[0]?.params).includes(unrelatedNewer.capture_id));
    // SQL is the security boundary: all reviewed identity fields are joined before a row
    // can return, so the newer unreviewed revision is not a candidate.
    assert.match(queries[0]!.sql, /origin\.source_item_id=reviewed_capture\.source_item_id/u);
    assert.match(queries[0]!.sql, /origin\.capture_id=reviewed_capture\.capture_id/u);
  });

  test('archive authorization remains scoped to the reviewed claim', () => {
    const archives = selectPublicCitationArchives([row('20260901000000')], PUBLISHED_AT);
    const projected = attachPublicCitationArchives(
      {
        claims: [
          { id: 'claim-1', citationHref: SOURCE },
          { id: 'claim-2', citationHref: SOURCE },
        ],
      },
      archives,
    ) as { claims: { id: string; archivedUrl?: string }[] };
    assert.match(projected.claims[0]?.archivedUrl ?? '', /^https:\/\/web\.archive\.org/u);
    assert.equal(projected.claims[1]?.archivedUrl, undefined);
  });

  test('transaction lookup locks current origin and preservation job state', async () => {
    let sql = '';
    await loadPublicCitationArchives(
      {
        async query<T extends Record<string, unknown>>(statement: string) {
          sql = statement;
          return { rows: [] as T[] };
        },
      },
      [
        {
          claimId: 'claim-1',
          sourceUrl: SOURCE,
          sourceItemId: 'source-item-1',
          captureId: 'capture-1',
          contentHashDigest: 'a'.repeat(64),
        },
      ],
      PUBLISHED_AT,
      { lock: true },
    );
    assert.match(sql, /FOR UPDATE OF origin, job/u);
  });

  test('adds archive fields and retains the original citation independently', () => {
    const archive = selectPublicCitationArchives([row('20260901000000')], PUBLISHED_AT);
    const projected = attachPublicCitationArchives(
      { claims: [{ id: 'claim-1', citationHref: SOURCE }] },
      archive,
    ) as { claims: { citationHref: string; archivedUrl: string; archivedAt: string }[] };
    assert.equal(projected.claims[0]?.citationHref, SOURCE);
    assert.match(projected.claims[0]?.archivedUrl ?? '', /^https:\/\/web\.archive\.org\/web\//u);
    assert.equal(projected.claims[0]?.archivedAt, '2026-09-01T00:00:00.000Z');
  });

  test('a later reviewed publication removes a pointer after revocation or expiry', () => {
    const projected = attachPublicCitationArchives(
      {
        claims: [
          {
            id: 'claim-1',
            citationHref: SOURCE,
            archivedUrl: 'https://web.archive.org/web/20260901000000/https://example.gov/record/1',
            archivedAt: '2026-09-01T00:00:00.000Z',
          },
        ],
      },
      new Map(),
    ) as { claims: { citationHref: string; archivedUrl?: string; archivedAt?: string }[] };
    assert.equal(projected.claims[0]?.citationHref, SOURCE);
    assert.equal(projected.claims[0]?.archivedUrl, undefined);
    assert.equal(projected.claims[0]?.archivedAt, undefined);
  });

  test('refuses every incremental write on signed, absent, or malformed release state', () => {
    assert.doesNotThrow(() => assertArchiveHydrationTargetIsUnsigned({}, 1));
    assert.doesNotThrow(() => assertArchiveHydrationTargetIsUnsigned({ signature: 'x' }, 0));
    // An equivalent rebuilt projection may report zero archive changes, but its upsert is still
    // a write and must not target a signed release.
    assert.throws(
      () => assertArchiveHydrationTargetIsUnsigned({ signature: 'x' }, 1),
      /new release/u,
    );
    // A removal of a stale pointer also contributes one projection change and is rejected.
    assert.throws(
      () => assertArchiveHydrationTargetIsUnsigned({ manifestHash: 'signed' }, 1),
      /new release/u,
    );
    assert.throws(() => assertArchiveHydrationTargetIsUnsigned(undefined, 1), /Cannot verify/u);
    assert.throws(() => assertArchiveHydrationTargetIsUnsigned(null, 1), /Cannot verify/u);
    assert.throws(() => assertArchiveHydrationTargetIsUnsigned([], 1), /Cannot verify/u);
    assert.throws(() => assertArchiveHydrationTargetIsUnsigned('invalid', 1), /Cannot verify/u);
  });

  test('an equivalent rebuild cannot write a signed release when hydration reports no change', () => {
    const rebuiltProjection = {
      claims: [{ id: 'claim-1', predicate: 'founded', object: 'Founded in 1920' }],
    };
    assert.equal(attachPublicCitationArchives(rebuiltProjection, new Map()), rebuiltProjection);
    assert.throws(
      () => assertArchiveHydrationTargetIsUnsigned({ manifestHash: 'signed' }, 1),
      /already signed/u,
    );
  });
});
