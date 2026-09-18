/** Deterministic source parsing and ingestion through an injected record writer. */
import { parseGazetteerCountyFile, buildCountyJurisdictionDocs } from './tiger-gazetteer.js';
import { buildStateJurisdictionDocs } from './us-states-source.js';
import { jurisdictionSchema, type JurisdictionDoc } from './schema.js';

export type JurisdictionWriteOutcome = 'created' | 'updated' | 'unchanged';

export type JurisdictionWriter = {
  /** Upserts one doc idempotently and reports what actually happened. */
  upsert(doc: JurisdictionDoc): Promise<JurisdictionWriteOutcome>;
};

export type RunJurisdictionLoadOptions = {
  readonly writer: JurisdictionWriter;
  /** Raw Census Gazetteer county file text; omit to load states only. */
  readonly gazetteerFileText?: string;
  readonly now?: () => string;
  readonly sourceVersion?: string;
};

export type RunJurisdictionLoadSummary = {
  readonly statesProcessed: number;
  readonly countiesProcessed: number;
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly rejectedGazetteerRows: readonly { readonly line: number; readonly reason: string }[];
  readonly outOfScopeCounties: readonly { readonly geoid: string; readonly usps: string }[];
};

export async function runJurisdictionLoad(
  options: RunJurisdictionLoadOptions,
): Promise<RunJurisdictionLoadSummary> {
  const now = options.now ?? (() => new Date().toISOString());
  const buildOptions = {
    now,
    ...(options.sourceVersion ? { sourceVersion: options.sourceVersion } : {}),
  };

  const stateDocs = buildStateJurisdictionDocs(buildOptions);

  let countyDocs: readonly JurisdictionDoc[] = [];
  let rejectedGazetteerRows: RunJurisdictionLoadSummary['rejectedGazetteerRows'] = [];
  let outOfScopeCounties: RunJurisdictionLoadSummary['outOfScopeCounties'] = [];

  if (options.gazetteerFileText !== undefined) {
    const parsed = parseGazetteerCountyFile(options.gazetteerFileText);
    rejectedGazetteerRows = parsed.rejected;
    const built = buildCountyJurisdictionDocs(parsed.rows, buildOptions);
    countyDocs = built.docs;
    outOfScopeCounties = built.outOfScope;
  }

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const doc of [...stateDocs, ...countyDocs]) {
    jurisdictionSchema.parse(doc); // fail closed on a malformed doc before persistence
    const outcome = await options.writer.upsert(doc);
    if (outcome === 'created') created += 1;
    else if (outcome === 'updated') updated += 1;
    else unchanged += 1;
  }

  return {
    statesProcessed: stateDocs.length,
    countiesProcessed: countyDocs.length,
    created,
    updated,
    unchanged,
    rejectedGazetteerRows,
    outOfScopeCounties,
  };
}

/** Compares every field except `createdAt`/`updatedAt` for idempotency's "unchanged" check. */
export function jurisdictionDocsEqualIgnoringTimestamps(
  a: JurisdictionDoc,
  b: JurisdictionDoc,
): boolean {
  const { createdAt: _a1, updatedAt: _a2, ...restA } = a;
  const { createdAt: _b1, updatedAt: _b2, ...restB } = b;
  return JSON.stringify(restA) === JSON.stringify(restB);
}
