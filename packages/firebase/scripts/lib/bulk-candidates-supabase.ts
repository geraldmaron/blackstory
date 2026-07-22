/**
 * Maps git-durable bulk discovery fixtures to bb_research.landscape_candidates rows.
 * Pure functions only — no network or database I/O.
 */
export type BulkLane = 'dc-sites' | 'greenbook' | 'hbcu' | 'nrhp' | 'other';

export type BulkFixtureCapture = {
  readonly url: string;
  readonly cachedAs: string;
  readonly contentSha256: string;
  readonly bytes: number;
};

export type BulkFixtureMetadata = {
  readonly sourceProgramId: string;
  readonly sourceProgramName: string;
  readonly custodian?: string;
  readonly license?: string;
  readonly attribution?: string;
  readonly canonicalUrl?: string;
  readonly retrievedAt?: string;
  readonly count?: number;
  readonly droppedCount?: number;
  readonly sourceCaptures?: readonly BulkFixtureCapture[];
  readonly methodologyNotes?: readonly string[];
};

export type BulkFixtureCandidate = {
  readonly id: string;
  readonly kind: string;
  readonly displayName: string;
  readonly summary: string;
  readonly canonicalUrl?: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly discoveredAt: string;
  readonly researchLaneOnly?: boolean;
  readonly provenance?: Readonly<Record<string, unknown>>;
};

export type BulkFixtureFile = {
  readonly generatedAt: string;
  readonly metadata: BulkFixtureMetadata;
  readonly summary?: {
    readonly rowsFetched?: number;
    readonly newCandidates?: number;
    readonly skippedUnusable?: number;
  };
  readonly candidates: readonly BulkFixtureCandidate[];
};

export type SourceProgramRunRow = {
  readonly id: string;
  readonly lane: BulkLane;
  readonly source_program_id: string;
  readonly source_program_name: string;
  readonly custodian: string | null;
  readonly license: string | null;
  readonly canonical_url: string | null;
  readonly attribution: string | null;
  readonly retrieved_at: string;
  readonly fixture_path: string | null;
  readonly rows_fetched: number;
  readonly candidate_count: number;
  readonly dropped_count: number;
  readonly summary: Readonly<Record<string, unknown>>;
  readonly methodology_notes: readonly string[];
};

export type SourceAcquisitionCaptureRow = {
  readonly id: string;
  readonly run_id: string;
  readonly url: string;
  readonly content_sha256: string;
  readonly bytes: number;
  readonly cached_as: string | null;
  readonly fetched_at: string;
};

export type LandscapeCandidateRow = {
  readonly id: string;
  readonly run_id: string;
  readonly lane: BulkLane;
  readonly source_program_id: string;
  readonly source_item_id: string;
  readonly display_name: string;
  readonly kind: string;
  readonly summary: string | null;
  readonly lat: number | null;
  readonly lng: number | null;
  readonly canonical_url: string | null;
  readonly research_lane_only: true;
  readonly status: 'pending';
  readonly provenance: Readonly<Record<string, unknown>>;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly discovered_at: string;
};

export type BulkFixtureLoadPlan = {
  readonly run: SourceProgramRunRow;
  readonly captures: readonly SourceAcquisitionCaptureRow[];
  readonly candidates: readonly LandscapeCandidateRow[];
};

function asLane(value: string): BulkLane {
  if (
    value === 'dc-sites' ||
    value === 'greenbook' ||
    value === 'hbcu' ||
    value === 'nrhp'
  ) {
    return value;
  }
  return 'other';
}

/** Stable run id for idempotent re-imports of the same fixture day. */
export function buildSourceProgramRunId(lane: BulkLane, generatedAt: string): string {
  return `${lane}-${generatedAt.slice(0, 10)}`;
}

export function mapBulkFixtureToLoadPlan(input: {
  readonly fixture: BulkFixtureFile;
  readonly lane: string;
  readonly fixturePath?: string;
}): BulkFixtureLoadPlan {
  const lane = asLane(input.lane);
  const metadata = input.fixture.metadata;
  const runId = buildSourceProgramRunId(lane, input.fixture.generatedAt);
  const retrievedAt = metadata.retrievedAt ?? input.fixture.generatedAt;
  const rowsFetched = input.fixture.summary?.rowsFetched ?? metadata.count ?? input.fixture.candidates.length;
  const candidateCount = metadata.count ?? input.fixture.candidates.length;
  const droppedCount = metadata.droppedCount ?? input.fixture.summary?.skippedUnusable ?? 0;

  const run: SourceProgramRunRow = {
    id: runId,
    lane,
    source_program_id: metadata.sourceProgramId,
    source_program_name: metadata.sourceProgramName,
    custodian: metadata.custodian ?? null,
    license: metadata.license ?? null,
    canonical_url: metadata.canonicalUrl ?? null,
    attribution: metadata.attribution ?? null,
    retrieved_at: retrievedAt,
    fixture_path: input.fixturePath ?? null,
    rows_fetched: rowsFetched,
    candidate_count: candidateCount,
    dropped_count: droppedCount,
    summary: {
      ...(input.fixture.summary ?? {}),
      generatedAt: input.fixture.generatedAt,
    },
    methodology_notes: metadata.methodologyNotes ?? [],
  };

  const captures: SourceAcquisitionCaptureRow[] = (metadata.sourceCaptures ?? []).map(
    (capture, index) => ({
      id: `${runId}-capture-${index}`,
      run_id: runId,
      url: capture.url,
      content_sha256: capture.contentSha256,
      bytes: capture.bytes,
      cached_as: capture.cachedAs ?? null,
      fetched_at: retrievedAt,
    }),
  );

  const candidates: LandscapeCandidateRow[] = input.fixture.candidates.map((candidate) => {
    const provenance = candidate.provenance ?? {};
    const sourceItemId =
      typeof provenance.sourceItemId === 'string' && provenance.sourceItemId.length > 0
        ? provenance.sourceItemId
        : candidate.id;
    if (candidate.researchLaneOnly === false) {
      throw new Error(`candidate ${candidate.id} is not research-lane-only`);
    }
    return {
      id: candidate.id,
      run_id: runId,
      lane,
      source_program_id: metadata.sourceProgramId,
      source_item_id: sourceItemId,
      display_name: candidate.displayName,
      kind: candidate.kind,
      summary: candidate.summary ?? null,
      lat: candidate.lat ?? null,
      lng: candidate.lng ?? null,
      canonical_url: candidate.canonicalUrl ?? null,
      research_lane_only: true as const,
      status: 'pending' as const,
      provenance,
      payload: { ...candidate },
      discovered_at: candidate.discoveredAt,
    };
  });

  const ids = new Set(candidates.map((row) => row.id));
  if (ids.size !== candidates.length) {
    throw new Error('duplicate candidate ids in fixture');
  }

  return { run, captures, candidates };
}

export const DEFAULT_BULK_FIXTURES: Readonly<Record<BulkLane, string>> = {
  'dc-sites':
    'packages/firebase/fixtures/discovery-candidates/bulk-dc-sites-2026-07-19.json',
  greenbook:
    'packages/firebase/fixtures/discovery-candidates/bulk-greenbook-2026-07-19.json',
  hbcu: 'packages/firebase/fixtures/discovery-candidates/bulk-hbcu-2026-07-21.json',
  nrhp: '',
  other: '',
};
