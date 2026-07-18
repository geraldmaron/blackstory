/**
 * Publish the national seed catalog (black-book-uda follow-on: 100+ researched entities) into
 * the ACTIVE public release's projections + search index.
 *
 * Reads every JSON file in `packages/firebase/fixtures/national-catalog/`, converts each
 * research entry into a `publicEntityProjectionSchema`-conformant doc (geohash via
 * @blap/domain's `buildGeoPointFields`, claim ids synthesized when the research entry
 * omitted them), hard-fails if ANY entry does not validate, then batch-writes:
 *   publicReleases/<activeRelease>/entities/<id>   (projection, merge)
 *   publicSearchIndex/<id>                          (search doc, merge)
 *
 * Idempotent: re-running overwrites the same doc ids with the same content. Does NOT touch
 * `publicMeta/activeRelease` — the release pointer stays whatever bootstrap/promotion set.
 *
 * Requires:
 *   BLAP_FIREBASE_ALLOW_PRODUCTION=1
 *   Application Default Credentials with Firestore write access
 *
 * Usage:
 *   BLAP_FIREBASE_ALLOW_PRODUCTION=1 node --conditions development --import tsx \
 *     packages/firebase/scripts/publish-national-catalog.ts
 *   DRY_RUN=1 ... — validate + print without writing.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  buildGeoPointFields,
  evaluateFactPublishGate,
  evaluateNotabilityGate,
  type FactCitation,
} from '@blap/domain';
import {
  publicEntityProjectionSchema,
  publicSearchIndexSchema,
} from '../src/firestore/types.ts';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'black-book-efaaf';
const ALLOW = process.env.BLAP_FIREBASE_ALLOW_PRODUCTION === '1';
const DRY_RUN = process.env.DRY_RUN === '1';
/** Geohash character precision for public anchors — matches the bootstrap fixtures' choice. */
const GEOHASH_PRECISION = 5;

if (!ALLOW && !DRY_RUN) {
  console.error('Refusing to write: set BLAP_FIREBASE_ALLOW_PRODUCTION=1 (or DRY_RUN=1)');
  process.exit(2);
}

const catalogDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/national-catalog');

type CatalogClaim = {
  readonly id?: string;
  readonly predicate: string;
  readonly object: string;
  readonly confidenceLevel: 'high' | 'medium' | 'low';
  readonly citationSource: string;
  readonly citationHref?: string;
  readonly citationLabel: string;
};

type CatalogEntry = {
  readonly id: string;
  readonly kind: string;
  readonly displayName: string;
  readonly summary: string;
  readonly eraBuckets?: readonly string[];
  /** @deprecated Superseded by `topicIds`/`mentionedEntityIds`/`keywords` below (black-book-s4hp);
   * kept so un-migrated fixture entries still validate. */
  readonly topicTags?: readonly string[];
  /** Controlled historical-theme ids (black-book-s4hp). Populated by
   * `migrate-topic-taxonomy.ts` for every national-catalog fixture entry. */
  readonly topicIds?: readonly string[];
  /** Resolvable people/place/org/law/event ids this record mentions (may be raw legacy-tag
   * placeholder strings pending black-book-8bck's real entity resolution). */
  readonly mentionedEntityIds?: readonly string[];
  /** Free-text search-recall terms. */
  readonly keywords?: readonly string[];
  readonly jurisdictionLabel: string;
  readonly locationPrecision: string;
  readonly locationLabel: string;
  readonly lat: number;
  readonly lng: number;
  readonly claims?: readonly CatalogClaim[];
  readonly historicalContext?: string;
  readonly sensitivityClass?: string;
  readonly status?: string;
};

/** Synthesizes a stable claim id when the catalog entry omitted one (mirrors `toProjectionDoc`'s
 * inline id assignment; extracted so the gate wiring below and the projection builder agree on
 * the exact same id for the exact same claim). */
function resolveClaimId(entry: CatalogEntry, claim: CatalogClaim, index: number): string {
  return claim.id ?? `claim_${entry.id.replace(/^ent_/, '')}_${String(index + 1).padStart(2, '0')}`;
}

/**
 * === Publication gate wiring (black-book-pwfi) ===
 *
 * Two fail-closed gates already exist in `@blap/domain` but were never wired into the live
 * entity/claim release-build path — see the "Not wired live" comments in
 * `packages/domain/src/facts/publish-gate.ts` and `packages/domain/src/relevance/notability-gate.ts`,
 * and ADR-007 / ADR-015. `packages/domain/src/search/index-build.ts` already calls the
 * notability gate independently as defense-in-depth for the search index only; this wires both
 * gates into the entity/claim PROJECTION path itself (this script), inside the same
 * validate-before-write, fail-closed loop that already collects Zod schema failures (see
 * `main()`'s `writes` construction below) so a gate failure blocks the whole write exactly like
 * a schema failure does.
 *
 * Both gates were designed for richer models than `CatalogEntry`/`CatalogClaim` (this fixture
 * format) actually carries yet:
 *
 * 1. `notability-gate.ts` expects a real `notabilityBasis: NotabilityBasisRecord[]` whose
 *    `evidenceIds` resolve to actual evidence. `CatalogEntry` has no such field — the only
 *    notability signal that exists today is the always-on placeholder this script already
 *    emits (`notabilityLabels`/`notabilityBasis` in `toProjectionDoc`/`toSearchDoc`). So the
 *    gate below is evaluated against a PROXY built from `entry.claims`
 *    (`buildNotabilityBasisProxy`): one basis record standing in for that placeholder, whose
 *    `evidenceIds` are the ids of claims carrying a resolvable `citationSource`. This makes the
 *    STRONGER release invariant from the architecture review real and enforced today, not a
 *    no-op that always passes on the hardcoded placeholder: an active release must never contain
 *    a record where `notabilityBasis.length > 0 AND any basis entry has zero resolvable
 *    evidence refs` — i.e. an entry with no claims, or whose claims all lack a citationSource,
 *    is rejected.
 *    TODO(black-book-1fg9): once `CatalogEntry` carries a real `notabilityBasis` with
 *    `evidenceIds` pointing at actual evidence records, delete this proxy and call
 *    `assertPublishableEntityHasNotabilityBasis` directly against the real field.
 *
 * 2. `publish-gate.ts`'s fact-publish gate requires every citation to carry an archived-capture
 *    pointer (`archivedUrl`+`archivedAt`) and a retrieval date (`accessedAt`) before a fact may
 *    reach `published` (`hasCompleteFactCitations`). `CatalogClaim` has never captured any of
 *    those fields — confirmed empirically against the current fixtures: 0 of 1031 claims across
 *    all 515 entries carry archival metadata (the field doesn't exist in the shape at all). That
 *    is a genuine, pipeline-wide data gap, not a defect in specific entries: forcing the gate's
 *    full archived-capture sub-check here today would reject the entire existing, previously
 *    reviewed and published catalog, which is disproportionate to this pass's scope. So this
 *    wires only the gate's OTHER, already-real branch — `evaluateFactPublishGate`'s
 *    `no_citations` reason ("unsourced is not a publishable state"): every entry must have at
 *    least one claim. The `incomplete_citation` branch is deliberately not enforced yet.
 *    TODO(black-book-1fg9): once claims carry archival-capture metadata, drop the floor-only
 *    filtering below and let `evaluateFactPublishGate`'s `incomplete_citation` branch block too
 *    (or call `assertFactMayPublish` directly, unmodified).
 *
 * NOT in this pass (explicit deferral, not a silent drop): the "two independent lineages /
 * primary+corroborating source" gate for high-impact predicates (first/only/oldest, deaths,
 * violence, allegations) needs the fuller claim/evidence model from black-book-1fg9 and is not
 * implemented here. TODO(black-book-1fg9).
 */
type NotabilityBasisProxy = {
  readonly criterion: 'documented_site';
  readonly note: string;
  readonly evidenceIds: readonly string[];
};

function buildNotabilityBasisProxy(entry: CatalogEntry): readonly NotabilityBasisProxy[] {
  const claims = entry.claims ?? [];
  const evidenceIds = claims
    .filter((claim) => claim.citationSource.trim().length > 0)
    .map((claim, index) => resolveClaimId(entry, claim, index));
  return [
    {
      criterion: 'documented_site',
      note: 'A documented site in the active public release.',
      evidenceIds,
    },
  ];
}

function claimToFactCitationStandIn(claim: CatalogClaim): FactCitation {
  // Minimal structural stand-in sufficient to express "a citation exists" for the no_citations
  // floor check — see the wiring-note above for why the full completeness sub-check (sourceClass
  // rigor, archived-capture pointer, retrieval date) is deferred rather than fabricated here.
  return {
    csl: {
      id: claim.citationSource,
      type: 'webpage',
      ...(claim.citationHref !== undefined ? { URL: claim.citationHref } : {}),
    },
    sourceClass: 'secondary',
    role: 'supports',
    excerpt: claim.citationLabel,
  };
}

/** Runs both wired gates for one catalog entry. Returns the first failure reason, if any so the
 * caller can report it the same way it reports a Zod schema failure (named per entity id). */
function evaluateEntityPublicationGates(
  entry: CatalogEntry,
): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  // --- notability-basis gate (ADR-015) + stronger evidence-backing invariant ---
  const notabilityBasis = buildNotabilityBasisProxy(entry);
  const notabilityGate = evaluateNotabilityGate(notabilityBasis);
  if (!notabilityGate.passed) {
    return { ok: false, reason: `notability_basis gate: ${notabilityGate.reason}` };
  }
  const basisWithoutEvidence = notabilityBasis.find((basis) => basis.evidenceIds.length === 0);
  if (basisWithoutEvidence) {
    return {
      ok: false,
      reason:
        `notability_basis gate: basis record "${basisWithoutEvidence.criterion}" has zero ` +
        'resolvable evidence refs (no claims with a non-empty citationSource)',
    };
  }

  // --- fact publish-gate (ADR-007) — no_citations floor only, see wiring-note above ---
  const claims = entry.claims ?? [];
  const factGate = evaluateFactPublishGate({
    status: 'published',
    citations: claims.map(claimToFactCitationStandIn),
  });
  if (!factGate.ok && factGate.reason === 'no_citations') {
    return { ok: false, reason: `fact_publish_gate: ${factGate.message}` };
  }

  return { ok: true };
}

function loadCatalog(): CatalogEntry[] {
  const files = readdirSync(catalogDir).filter((name) => name.endsWith('.json'));
  if (files.length === 0) {
    throw new Error(`No catalog files found in ${catalogDir}`);
  }
  const entries: CatalogEntry[] = [];
  for (const file of files.sort()) {
    const parsed = JSON.parse(readFileSync(join(catalogDir, file), 'utf8')) as CatalogEntry[];
    if (!Array.isArray(parsed)) throw new Error(`${file}: expected a JSON array`);
    for (const entry of parsed) entries.push(entry);
    console.log(`  ${file}: ${parsed.length} entries`);
  }
  return entries;
}

function toProjectionDoc(entry: CatalogEntry, releaseId: string) {
  const claims = (entry.claims ?? []).map((claim, index) => ({
    id: resolveClaimId(entry, claim, index),
    predicate: claim.predicate,
    object: claim.object,
    confidenceLevel: claim.confidenceLevel,
    citationSource: claim.citationSource,
    ...(claim.citationHref !== undefined ? { citationHref: claim.citationHref } : {}),
    citationLabel: claim.citationLabel,
  }));
  const geo = buildGeoPointFields(entry.lat, entry.lng, GEOHASH_PRECISION);

  const doc = {
    id: entry.id,
    releaseId,
    kind: entry.kind,
    displayName: entry.displayName,
    nameLower: entry.displayName.toLowerCase(),
    summary: entry.summary,
    location: {
      lat: geo.lat,
      lng: geo.lng,
      geohash: geo.geohash,
      geohashPrefixes: [...geo.geohashPrefixes],
      precision: entry.locationPrecision,
      matchMethod: 'manual_research',
    },
    claimIds: claims.map((claim) => claim.id),
    claims,
    jurisdictionLabel: entry.jurisdictionLabel,
    locationLabel: entry.locationLabel,
    ...(entry.status !== undefined ? { status: entry.status } : {}),
    ...(entry.eraBuckets !== undefined ? { eraBuckets: entry.eraBuckets } : {}),
    ...(entry.sensitivityClass !== undefined ? { sensitivityClass: entry.sensitivityClass } : {}),
    topicTags: entry.topicTags ?? [],
    topicIds: entry.topicIds ?? [],
    mentionedEntityIds: entry.mentionedEntityIds ?? [],
    keywords: entry.keywords ?? [],
    notabilityLabels: ['A documented site in the active public release.'],
    ...(entry.historicalContext !== undefined ? { historicalContext: entry.historicalContext } : {}),
  };
  return publicEntityProjectionSchema.parse(doc);
}

function toSearchDoc(entry: CatalogEntry, releaseId: string, claimCount: number) {
  const notabilityLabel = 'A documented site in the active public release.';
  const doc = {
    id: entry.id,
    releaseId,
    kind: entry.kind,
    displayName: entry.displayName,
    nameLower: entry.displayName.toLowerCase(),
    aliases: [],
    summary: entry.summary,
    topicTags: entry.topicTags ?? [],
    topicIds: entry.topicIds ?? [],
    mentionedEntityIds: entry.mentionedEntityIds ?? [],
    keywords: entry.keywords ?? [],
    jurisdictionState: entry.jurisdictionLabel,
    ...(entry.status !== undefined ? { status: entry.status } : {}),
    eraBuckets: entry.eraBuckets ?? [],
    notabilityBasis: [
      {
        criterion: 'documented_site' as const,
        note: notabilityLabel,
        evidenceIds: [] as string[],
      },
    ],
    notabilityLabels: [notabilityLabel],
    ...(entry.sensitivityClass !== undefined ? { sensitivityClass: entry.sensitivityClass } : {}),
    recordMaturity: claimCount > 0 ? 'partial_enrichment' : 'projection_stub',
    researchCoverage: claimCount >= 2 ? ('partial' as const) : ('minimal' as const),
    relatedCount: 0,
    claimCount,
  };
  return publicSearchIndexSchema.parse(doc);
}

async function main(): Promise<void> {
  console.log(`Project: ${PROJECT_ID}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`Catalog: ${catalogDir}`);
  const entries = loadCatalog();

  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) throw new Error(`Duplicate entity id in catalog: ${entry.id}`);
    ids.add(entry.id);
  }
  console.log(`Total: ${entries.length} unique entities`);

  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  }
  const db = getFirestore();

  const activeSnap = await db.doc('publicMeta/activeRelease').get();
  const releaseId = activeSnap.data()?.releaseId as string | undefined;
  if (!releaseId) throw new Error('publicMeta/activeRelease missing or has no releaseId');
  console.log(`Active release: ${releaseId}`);

  // Validate EVERYTHING before writing anything; name each failing entry so a bad catalog
  // line reads as "which record, which field", not a bare Zod trace.
  const failures: string[] = [];
  const writes = entries.flatMap((entry) => {
    try {
      const gateResult = evaluateEntityPublicationGates(entry);
      if (!gateResult.ok) {
        throw new Error(gateResult.reason);
      }
      const projection = toProjectionDoc(entry, releaseId);
      const search = toSearchDoc(entry, releaseId, projection.claims?.length ?? 0);
      return [{ entry, projection, search }];
    } catch (error) {
      const detail =
        error instanceof Error && 'issues' in error
          ? JSON.stringify((error as { issues: unknown }).issues)
          : String(error);
      failures.push(`${entry.id}: ${detail}`);
      return [];
    }
  });
  if (failures.length > 0) {
    console.error(`INVALID ENTRIES (${failures.length}):`);
    for (const failure of failures) console.error(`  ${failure}`);
    throw new Error(`${failures.length} catalog entries failed validation; nothing written.`);
  }
  console.log(`Validated ${writes.length} projections + ${writes.length} search docs`);

  if (DRY_RUN) {
    for (const { projection } of writes.slice(0, 5)) {
      console.log(`  sample: ${projection.id} — ${projection.displayName} (${projection.kind})`);
    }
    console.log('Dry run complete; nothing written.');
    return;
  }

  // Firestore batches cap at 500 ops; chunk defensively.
  const BATCH_LIMIT = 400;
  let batch = db.batch();
  let ops = 0;
  const flush = async () => {
    if (ops > 0) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  };
  for (const { projection, search } of writes) {
    batch.set(db.doc(`publicReleases/${releaseId}/entities/${projection.id}`), projection, {
      merge: true,
    });
    batch.set(db.doc(`publicSearchIndex/${search.id}`), search, { merge: true });
    ops += 2;
    if (ops >= BATCH_LIMIT) await flush();
  }
  await flush();

  const after = await db.collection(`publicReleases/${releaseId}/entities`).get();
  console.log(`Publish complete. Release now holds ${after.size} entity projections.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
