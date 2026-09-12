/**
 * The comparison rules behind the projection-divergence audit.
 *
 * Two classes of case matter here and both are represented by the shapes that actually occur in
 * `bb_public`: the drift this must catch (a column or search row updated without the projection),
 * and the look-alikes it must NOT report, because a false positive in a gate costs more than the
 * drift it invents — an absent `related` key against an empty column, a blank jurisdiction label
 * against an omitted facet, topics in a different order.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PoolClient } from 'pg';
import { NOTABILITY_RUBRIC } from '@repo/domain';
import {
  assertNoProjectionDivergence,
  auditProjectionDivergence,
  divergentFieldsForRow,
  expectedSearchTopics,
  loadProjectionDivergenceRows,
  summarizeProjectionDivergence,
  MISSING_PROJECTION_FIELD,
  MISSING_SEARCH_INDEX_FIELD,
  type ProjectionDivergenceDbRow,
} from './projection-divergence.ts';

const FIRST_TO_DO_X_LABEL = NOTABILITY_RUBRIC.first_to_do_x;

const LOCATION = {
  lat: 41.8781,
  lng: -87.6298,
  geohash: 'dp3wm',
  geohashPrefixes: ['d', 'dp', 'dp3', 'dp3w', 'dp3wm'],
  precision: 'city',
  matchMethod: 'manual_research',
};

const PROJECTION = {
  id: 'ent_a',
  releaseId: 'rel_1',
  kind: 'person',
  displayName: 'Ada Example',
  summary: 'Ada Example was an inventor in Chicago.',
  location: LOCATION,
  claims: [{ id: 'claim_a_01', predicate: 'occupation' }],
  topicIds: ['invention', 'business'],
  topicTags: ['invention', 'business'],
  notabilityLabels: ['inventor'],
  notabilityBasis: [{ kind: 'patent', evidenceIds: ['ev_1'] }],
  eraBuckets: ['1900s'],
  keywords: ['patent'],
  mentionedEntityIds: [],
  researchCoverage: { level: 'partial', sourceCount: 2 },
  jurisdictionLabel: 'Illinois',
  status: 'deceased',
};

/** A row whose every derived copy agrees with its projection. */
function cleanRow(overrides: Partial<ProjectionDivergenceDbRow> = {}): ProjectionDivergenceDbRow {
  return {
    entity_id: 'ent_a',
    display_name: 'Ada Example',
    kind: 'person',
    summary: 'Ada Example was an inventor in Chicago.',
    location: LOCATION,
    geohash: 'dp3wm',
    lat: 41.8781,
    lng: -87.6298,
    claims: [{ id: 'claim_a_01', predicate: 'occupation' }],
    taxonomy: {
      topicIds: ['invention', 'business'],
      topicTags: ['invention', 'business'],
      notabilityLabels: ['inventor'],
    },
    related: [],
    primary_image: null,
    projection: PROJECTION,
    si_present: true,
    si_kind: 'person',
    si_status: 'deceased',
    si_topics: ['invention', 'business'],
    si_facets: {
      eraBuckets: ['1900s'],
      keywords: ['patent'],
      researchCoverage: { level: 'partial', sourceCount: 2 },
      recordMaturity: 'partial_enrichment',
      confidenceTier: 'medium',
      topicIds: ['invention', 'business'],
      mentionedEntityIds: [],
      notabilityBasis: [{ kind: 'patent', evidenceIds: ['ev_1'] }],
      notabilityLabels: ['inventor'],
      jurisdictionState: 'Illinois',
    },
    ...overrides,
  };
}

function fakeClient(rows: readonly ProjectionDivergenceDbRow[]) {
  const calls: Array<{ sql: string; params: readonly unknown[] | undefined }> = [];
  return {
    calls,
    query: async (sql: string, params?: readonly unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('v_active_release_id')) return { rows: [{ release_id: 'rel_active' }] };
      return { rows };
    },
    // biome-ignore lint: test double, cast to the shape the module expects
  } as unknown as PoolClient & { readonly calls: typeof calls };
}

describe('divergentFieldsForRow — a synchronized row', () => {
  it('reports nothing when every derived copy matches', () => {
    assert.deepEqual(divergentFieldsForRow(cleanRow()), []);
  });

  it('does not report an absent projection.related against an empty related column', () => {
    // backfill-release-related-empty-array wrote `[]` onto the column while the projection simply
    // has no `related` key, as PROJECTION above does not. Same meaning; reporting it would bury
    // the real findings.
    assert.deepEqual(divergentFieldsForRow(cleanRow({ related: [] })), []);
  });

  it('does not report topics that differ only in order', () => {
    const row = cleanRow({ si_topics: ['business', 'invention'] });
    assert.deepEqual(divergentFieldsForRow(row), []);
  });

  it('does not report an omitted jurisdictionState facet when the projection label is blank', () => {
    // toSearchIndexRow omits the facet rather than writing it empty, deliberately.
    const row = cleanRow({
      projection: { ...PROJECTION, jurisdictionLabel: '   ' },
      si_facets: {
        ...(cleanRow().si_facets as Record<string, unknown>),
        jurisdictionState: undefined,
      },
    });
    assert.deepEqual(divergentFieldsForRow(row), []);
  });
});

describe('divergentFieldsForRow — drift on the release_entities columns', () => {
  it('catches a summary backfill that wrote the column and skipped the projection', () => {
    const row = cleanRow({ summary: 'Corrected summary the public never sees.' });
    assert.deepEqual(divergentFieldsForRow(row), ['summary']);
  });

  it('catches a location resync applied to one store only', () => {
    const row = cleanRow({
      location: { ...LOCATION, precision: 'site', geohash: 'dp3wm1abc' },
      geohash: 'dp3wm1abc',
    });
    assert.deepEqual(divergentFieldsForRow(row), ['location', 'geohash']);
  });

  it('catches lat/lng written to the scalar columns alone', () => {
    const row = cleanRow({ lat: 42, lng: -87 });
    assert.deepEqual(divergentFieldsForRow(row), ['lat', 'lng']);
  });

  it('catches claims corrected on the column but not in the projection', () => {
    const row = cleanRow({ claims: [] });
    assert.deepEqual(divergentFieldsForRow(row), ['claims']);
  });

  it('catches a primaryImage pinned into the projection but not onto the column', () => {
    const row = cleanRow({
      projection: { ...PROJECTION, primaryImage: { url: 'https://example.org/a.jpg' } },
    });
    assert.deepEqual(divergentFieldsForRow(row), ['primary_image']);
  });

  it('catches a taxonomy re-sync that updated the column and left the projection behind', () => {
    // applyReleaseTaxonomySync writes the taxonomy column only. This is the exact shape it leaves.
    const row = cleanRow({
      taxonomy: {
        topicIds: ['invention', 'business', 'women'],
        topicTags: ['invention', 'business', 'women'],
        notabilityLabels: ['inventor'],
      },
    });
    assert.deepEqual(divergentFieldsForRow(row), ['taxonomy']);
  });

  it('ignores taxonomy keys the projection does not claim to own', () => {
    const row = cleanRow({
      taxonomy: { ...(cleanRow().taxonomy as Record<string, unknown>), somethingElse: ['x'] },
    });
    assert.deepEqual(divergentFieldsForRow(row), []);
  });
});

describe('divergentFieldsForRow — drift on bb_public.search_index', () => {
  it('catches an empty topics column against a projection carrying topicIds', () => {
    // The measured shape: incrementally published rows built with topicTags: [] published
    // topics: [] because `??` falls through on null only, so topic browse misses them.
    const row = cleanRow({
      projection: { ...PROJECTION, topicTags: [] },
      taxonomy: {
        topicIds: ['invention', 'business'],
        topicTags: [],
        notabilityLabels: ['inventor'],
      },
      si_topics: [],
    });
    assert.deepEqual(divergentFieldsForRow(row), ['search_index.topics']);
  });

  it('catches a facets object missing the keys a whole-object replace dropped', () => {
    const row = cleanRow({
      si_facets: {
        eraBuckets: ['1900s'],
        keywords: ['patent'],
        researchCoverage: { level: 'partial', sourceCount: 2 },
        topicIds: ['invention', 'business'],
        mentionedEntityIds: [],
        notabilityBasis: [{ kind: 'patent', evidenceIds: ['ev_1'] }],
        notabilityLabels: ['inventor'],
      },
    });
    assert.deepEqual(divergentFieldsForRow(row), ['search_index.facets.jurisdictionState']);
  });

  it('catches a kind reclassification applied to the projection but not the search row', () => {
    const row = cleanRow({
      projection: { ...PROJECTION, kind: 'invention' },
      kind: 'invention',
    });
    assert.deepEqual(divergentFieldsForRow(row), ['search_index.kind']);
  });

  it('catches a status the search row never received', () => {
    const row = cleanRow({ si_status: null });
    assert.deepEqual(divergentFieldsForRow(row), ['search_index.status']);
  });

  it('reports a missing twin once instead of every search_index field', () => {
    const row = cleanRow({
      si_present: false,
      si_kind: null,
      si_status: null,
      si_topics: null,
      si_facets: null,
    });
    assert.deepEqual(divergentFieldsForRow(row), [MISSING_SEARCH_INDEX_FIELD]);
  });
});

describe('divergentFieldsForRow — an unpublished projection', () => {
  it('reports an empty projection once rather than as eleven stale fields', () => {
    const row = cleanRow({ projection: {} });
    assert.deepEqual(divergentFieldsForRow(row), [MISSING_PROJECTION_FIELD]);
  });

  it('treats a null projection the same way', () => {
    const row = cleanRow({ projection: null });
    assert.deepEqual(divergentFieldsForRow(row), [MISSING_PROJECTION_FIELD]);
  });
});

describe("divergentFieldsForRow — scope 'all' (repo-rm2y builder staleness)", () => {
  /**
   * A row whose copies all agree and whose derived fields ARE what its claims say. Separate from
   * `cleanRow`, whose projection is a synthetic shape built to exercise the copy comparison: it
   * carries a basis record with no `criterion` and a researchCoverage object, neither of which the
   * builder would ever produce. Keeping the two fixtures apart is deliberate — bending the shared
   * one to satisfy the builder would have weakened every copy-vs-copy test in this file.
   */
  function builderCleanRow(
    overrides: Partial<ProjectionDivergenceDbRow> = {},
  ): ProjectionDivergenceDbRow {
    const claims = [
      {
        id: 'claim_b_01',
        predicate: 'was the first Black woman admitted to the bar',
        object: 'Example Person',
        confidenceLevel: 'high',
        citationSource: 'example.org',
        citationLabel: 'Example',
      },
    ];
    const projection = {
      id: 'ent_b',
      kind: 'person',
      displayName: 'Example Person',
      summary: 'A researched summary of a real life, long enough to carry its own detail.',
      location: LOCATION,
      claims,
      notabilityBasis: [
        {
          criterion: 'first_to_do_x',
          note: 'Was the first Black woman admitted to the bar.',
          evidenceIds: ['claim_b_01'],
        },
      ],
      notabilityLabels: [FIRST_TO_DO_X_LABEL],
      researchCoverage: 'minimal',
    };
    return {
      ...cleanRow(),
      entity_id: 'ent_b',
      display_name: 'Example Person',
      summary: projection.summary,
      claims,
      taxonomy: { topicIds: [], topicTags: [], notabilityLabels: [FIRST_TO_DO_X_LABEL] },
      projection,
      si_present: false,
      ...overrides,
    };
  }

  it("reports nothing extra when the derived fields match the record's own claims", () => {
    assert.deepEqual(divergentFieldsForRow(builderCleanRow(), 'all'), [MISSING_SEARCH_INDEX_FIELD]);
  });

  it('catches a basis record whose evidenceId no longer resolves (the eula-johnson shape)', () => {
    const clean = builderCleanRow();
    const projection = {
      ...(clean.projection as Record<string, unknown>),
      notabilityBasis: [
        {
          criterion: 'first_to_do_x',
          note: 'Documented site the old summary.',
          evidenceIds: ['claim_that_is_gone'],
        },
      ],
    };
    const fields = divergentFieldsForRow(builderCleanRow({ projection }), 'all');
    assert.ok(fields.includes('builder.notabilityBasis'));
    // The copy comparison alone sees nothing wrong, which is the whole reason this scope exists.
    assert.ok(
      !divergentFieldsForRow(builderCleanRow({ projection })).includes('builder.notabilityBasis'),
    );
  });

  it('catches a label that no longer matches the rubric text for its own criterion', () => {
    const clean = builderCleanRow();
    const projection = {
      ...(clean.projection as Record<string, unknown>),
      notabilityLabels: ['An older spelling of the rubric sentence.'],
    };
    assert.ok(
      divergentFieldsForRow(builderCleanRow({ projection }), 'all').includes(
        'builder.notabilityLabels',
      ),
    );
  });

  it('catches a researchCoverage the claims no longer support', () => {
    const clean = builderCleanRow();
    const projection = {
      ...(clean.projection as Record<string, unknown>),
      researchCoverage: 'substantial',
    };
    assert.ok(
      divergentFieldsForRow(builderCleanRow({ projection }), 'all').includes(
        'builder.researchCoverage',
      ),
    );
  });

  it('never calls a record with no claims stale — that is a research gap, not drift', () => {
    const clean = builderCleanRow();
    const projection = {
      ...(clean.projection as Record<string, unknown>),
      claims: [],
      researchCoverage: 'minimal',
    };
    assert.ok(
      !divergentFieldsForRow(builderCleanRow({ claims: [], projection }), 'all').includes(
        'builder.notabilityBasis',
      ),
    );
  });
});

describe('expectedSearchTopics', () => {
  it('prefers topicTags when the projection declares any', () => {
    assert.deepEqual(expectedSearchTopics({ topicTags: ['b', 'a'], topicIds: ['z'] }), ['a', 'b']);
  });

  it('falls through to topicIds on an EMPTY topicTags, which `??` does not', () => {
    assert.deepEqual(expectedSearchTopics({ topicTags: [], topicIds: ['invention'] }), [
      'invention',
    ]);
  });

  it('is empty when the projection declares no topics at all', () => {
    assert.deepEqual(expectedSearchTopics({}), []);
  });
});

describe('summarizeProjectionDivergence', () => {
  it('counts per field, orders by size, and caps the samples', () => {
    const rows = [
      cleanRow({ entity_id: 'ent_1', summary: 'stale 1' }),
      cleanRow({ entity_id: 'ent_2', summary: 'stale 2' }),
      cleanRow({ entity_id: 'ent_3', summary: 'stale 3', si_status: null }),
      cleanRow({ entity_id: 'ent_4' }),
    ];
    const report = summarizeProjectionDivergence('rel_1', rows, 2);
    assert.equal(report.scanned, 4);
    assert.equal(report.divergentRows, 3);
    assert.equal(report.totalDivergences, 4);
    assert.deepEqual(
      report.fields.map((field) => [field.field, field.count]),
      [
        ['summary', 3],
        ['search_index.status', 1],
      ],
    );
    assert.deepEqual(report.fields[0]?.sampleEntityIds, ['ent_1', 'ent_2']);
  });

  it('reports zero for a release with no drift', () => {
    const report = summarizeProjectionDivergence('rel_1', [cleanRow()]);
    assert.equal(report.divergentRows, 0);
    assert.equal(report.totalDivergences, 0);
    assert.deepEqual(report.fields, []);
  });
});

describe('database plumbing (fake client)', () => {
  it('passes a null id filter when auditing a whole release', async () => {
    const client = fakeClient([cleanRow()]);
    const report = await auditProjectionDivergence(client, { releaseId: 'rel_1' });
    assert.equal(report.releaseId, 'rel_1');
    assert.deepEqual(client.calls[0]?.params, ['rel_1', null]);
  });

  it('scopes the query to the requested ids', async () => {
    const client = fakeClient([cleanRow()]);
    await loadProjectionDivergenceRows(client, 'rel_1', ['ent_a', 'ent_b']);
    assert.deepEqual(client.calls[0]?.params, ['rel_1', ['ent_a', 'ent_b']]);
  });

  it('resolves the active release when none is given', async () => {
    const client = fakeClient([cleanRow()]);
    const report = await auditProjectionDivergence(client);
    assert.equal(report.releaseId, 'rel_active');
  });

  it('issues SELECT only', async () => {
    const client = fakeClient([cleanRow()]);
    await auditProjectionDivergence(client);
    for (const call of client.calls) {
      assert.match(call.sql.trimStart(), /^SELECT/i);
    }
  });
});

describe('assertNoProjectionDivergence', () => {
  it('returns the report when the written ids are in sync', async () => {
    const client = fakeClient([cleanRow()]);
    const report = await assertNoProjectionDivergence(client, ['ent_a'], { releaseId: 'rel_1' });
    assert.equal(report.totalDivergences, 0);
  });

  it('throws naming the field and a sample id when they are not', async () => {
    const client = fakeClient([cleanRow({ si_topics: [] })]);
    await assert.rejects(
      () => assertNoProjectionDivergence(client, ['ent_a'], { releaseId: 'rel_1' }),
      (error: Error) => {
        assert.match(error.message, /search_index\.topics/);
        assert.match(error.message, /ent_a/);
        return true;
      },
    );
  });
});
