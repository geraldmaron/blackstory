/**
 * repo-n7p6.3 (WS3) — evidence sweep.
 *
 * The missing step. The released catalog was built with no evidence fetch at all: lane records
 * were published from string templates over registry index fields, which is why 2,578 NRHP
 * places read like an index card. This script fetches the actual history and lands it in
 * bb_research.entity_evidence, from which WS4's model harness — and nothing else — is allowed
 * to write public prose.
 *
 * PATH 1 (this script, deterministic, no model):
 *   - nrhp-nomination: the National Register nomination form from NPGallery. Public domain,
 *     10-70k characters of real narrative per property. Richest source we have.
 *   - wikipedia: broad coverage for everything else, CC BY-SA, licence recorded per row.
 *
 * PATH 2 (search-driven agent collection for entities still thin after PATH 1) is deliberately
 * NOT in this script: it needs judgement per entity and is run as a separate pass over the
 * `no-evidence` rows this sweep reports.
 *
 * Discipline enforced here, not left to the caller:
 *   - Identity before capture. Fetching by refnum or search rank is not self-verifying; a
 *     fluent document about the wrong property is worse than no document. Place must
 *     corroborate or the capture is quarantined.
 *   - OCR quality before capture. Nomination forms are scans; a model handed shredded OCR will
 *     smooth it into confident invented history.
 *   - Never pad. An entity with no evidence is recorded `skipped:no-evidence` and keeps its
 *     thin-record state. It does not get generic prose.
 *
 * Default is dry-run. Production writes require:
 *   DRY_RUN=0 EVIDENCE_SWEEP_APPLY=1 DATABASE_URL=postgresql://...
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/sweep-entity-evidence.ts --lanes=nrhp-black-heritage --limit=100
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { extractText, getDocumentProxy } from 'unpdf';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import { selectEntitiesForEnrichment } from './lib/entity-enrichment-selector.ts';
import {
  checkNominationIdentity,
  nominationTextUrl,
  parseNomination,
} from './lib/evidence-collectors/nrhp-nomination.ts';
import { redactStreetAddresses } from './lib/evidence-collectors/redact-address.ts';
import { assessText } from './lib/evidence-collectors/text-quality.ts';
import {
  WIKIPEDIA_LICENCE,
  lookupWikipediaArticle,
  lookupWikipediaArticleByTitle,
} from './lib/evidence-collectors/wikipedia.ts';
import {
  DEFAULT_FETCH_BUDGET,
  DEFAULT_MAX_DEPTH,
  documentKey,
  extractReferenceLinks,
  planReferenceHops,
  subjectTokens,
  type HopSubject,
} from './lib/evidence-collectors/reference-hops.ts';
import { hostLineageKey, isWikipediaHost } from './lib/tier1-sources.ts';
import { safeFetchPage } from './lib/safe-fetch.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '../../..');
const REPORT_DIR = join(REPO_ROOT, '.cache/evidence-sweep');

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.EVIDENCE_SWEEP_APPLY === '1';

/** Greenbook is HARD-EXCLUDED until repo-jzgy triage completes (epic guardrail). */
const EXCLUDED_LANES = new Set(['greenbook']);

function flag(name: string, fallback: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
}

const LANES = flag('lanes', 'nrhp-black-heritage')
  .split(',')
  .map((lane) => lane.trim())
  .filter((lane) => lane.length > 0 && !EXCLUDED_LANES.has(lane));
const LIMIT = Number.parseInt(flag('limit', '100'), 10);
/**
 * Re-sweep specific entities, bypassing the selector. Needed whenever a collector or a
 * redaction rule changes and previously captured rows have to be refetched under the new rule —
 * the selector would otherwise skip them, since it reasons about freshness rather than about
 * which version of the code produced the row.
 */
const ENTITY_IDS = flag('entity-ids', '')
  .split(',')
  .map((id) => id.trim())
  .filter((id) => id.length > 0);
const STALE_DAYS = Number.parseInt(flag('stale-days', '30'), 10);
/**
 * Re-fetch entities that already have captured evidence. Off by default so consecutive batches
 * advance through the lane instead of redoing the same rows; turn it on after a collector or
 * parser change, when the same documents should be reprocessed under the new code.
 */
const REFETCH = process.argv.includes('--refetch');
/** Politeness delay between outbound fetches. NPS assets are multi-MB scans. */
const FETCH_DELAY_MS = Number.parseInt(flag('delay-ms', '750'), 10);

type CandidateRow = {
  readonly id: string;
  readonly lane: string;
  readonly display_name: string;
  readonly payload: {
    readonly refnum?: string;
    readonly city?: string;
    readonly county?: string;
    readonly state?: string;
    readonly restrictedAddress?: boolean;
    readonly kind?: string;
    readonly canonicalUrl?: string;
  };
};

type EvidenceRow = {
  readonly id: string;
  readonly entityId: string;
  readonly lane: string;
  readonly collector: string;
  readonly sourceUrl: string;
  readonly sourceTier: 'tier1' | 'tier2' | 'lead';
  readonly title: string | null;
  readonly contentText: string;
  readonly contentHash: string;
  readonly charCount: number;
  readonly qualityScore: number;
  readonly status: 'captured' | 'quarantined';
  readonly provenance: Record<string, unknown>;
};

type EntityOutcome = {
  readonly entityId: string;
  readonly displayName: string;
  readonly evidence: readonly EvidenceRow[];
  readonly notes: readonly string[];
  /**
   * Off-policy hosts the hop walk judged relevant but would not fetch (the Mizell pattern —
   * reference-hops.ts). No promotion table exists yet, so these surface only in the run report
   * for a human to review as candidate tier1-sources.ts additions; nothing here is ever stored
   * as evidence.
   */
  readonly leads: readonly { readonly entityId: string; readonly url: string; readonly anchorText: string }[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function hashContent(text: string): string {
  return createHash('sha256').update(text.replace(/\s+/gu, ' ').trim()).digest('hex');
}

/** Deterministic evidence id so a re-run UPSERTs the same row instead of duplicating it. */
function evidenceId(entityId: string, collector: string, sourceUrl: string): string {
  return `ev_${createHash('sha1').update(`${entityId}|${collector}|${sourceUrl}`).digest('hex').slice(0, 24)}`;
}

/**
 * A collector declining to produce evidence, with the reason. Distinct from a thrown Error:
 * "NPS has no nomination for this refnum" is an expected outcome that tells us about source
 * coverage, while "our parser did not recognise the form vintage" is a gap we can close. Both
 * used to collapse into a bare `null` and were indistinguishable in the run report, which made
 * the sweep's real yield impossible to reason about.
 */
class SkipReason extends Error {}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'BlackStory-research/1.0 (evidence sweep; repo-n7p6.3)' },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * NRHP nomination form. Quarantines rather than captures when the OCR is too damaged to trust
 * or when the document does not corroborate the property's place — see the module docs for why
 * both gates exist. Returns null when there is simply no form to fetch.
 */
async function collectNomination(row: CandidateRow): Promise<EvidenceRow | null> {
  const refnum = row.payload.refnum;
  if (refnum === undefined || !/^[0-9]{8}$/u.test(refnum)) {
    throw new SkipReason('no usable refnum on the roster row');
  }

  const url = nominationTextUrl(refnum);
  const response = await fetchWithTimeout(url, 90_000);
  if (!response.ok) throw new SkipReason(`NPGallery HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('pdf')) {
    // NPGallery answers 200 with a placeholder image for refnums it has no document for, so
    // content-type is the real "does this form exist" test, not the status code.
    throw new SkipReason(`NPGallery served ${contentType || 'unknown type'}, not a PDF`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const doc = await getDocumentProxy(bytes);
  const { text } = await extractText(doc, { mergePages: true });
  if (text.trim().length === 0) {
    throw new SkipReason(`PDF has no text layer (${bytes.length} bytes, needs OCR)`);
  }

  const parsed = parseNomination(text, row.display_name);
  if (parsed.narrative.length === 0) {
    // Distinguishable from "no document": we HAVE the form and it has text, but the section
    // headers did not match. That is our parser's gap to close, not an NPS coverage gap.
    throw new SkipReason(
      `no sections 7/8 parsed from ${text.length} chars of form text (unhandled form vintage?)`,
    );
  }

  const quality = assessText(parsed.narrative);
  // Identity is checked against the WHOLE document, not the narrative excerpt: the county is
  // printed on the front form, which sections 7 and 8 do not include.
  const identity = checkNominationIdentity(text, {
    displayName: row.display_name,
    state: row.payload.state,
    county: row.payload.county,
    city: row.payload.city,
  });

  const status: 'captured' | 'quarantined' =
    quality.usable && identity.placeCorroborated ? 'captured' : 'quarantined';
  const quarantineReason = !identity.placeCorroborated
    ? 'identity not corroborated by place'
    : quality.reason;

  return {
    id: evidenceId(row.id, 'nrhp-nomination', url),
    entityId: row.id,
    lane: row.lane,
    collector: 'nrhp-nomination',
    sourceUrl: url,
    sourceTier: 'tier1',
    title: `National Register nomination — ${row.display_name}`,
    contentText: parsed.narrative,
    contentHash: hashContent(parsed.narrative),
    charCount: parsed.narrative.length,
    qualityScore: quality.score,
    status,
    provenance: {
      refnum,
      rightsStatus: 'public-domain-us-federal',
      publisher: 'National Park Service',
      sectionsFound: parsed.sections.map((section) => section.section),
      hasSignificance: parsed.hasSignificance,
      // 'section-table' came from the form's own numbered section boxes; 'narrative-headings'
      // came from the looser fallback used when OCR destroyed that table (repo-n7p6.12). Worth
      // recording: the fallback can run a section to end-of-document when the closing heading
      // is missing, so its captures are slightly noisier at the tail.
      segmentation: parsed.segmentation,
      identity,
      // Recorded, not resolved: place agrees but the name does not, so a human decides whether
      // this is one property under two names (the Castle Rock case) or a genuine mis-attach.
      needsNameAdjudication: identity.nameMismatch,
      quarantineReason: status === 'quarantined' ? quarantineReason : undefined,
      qualitySignals: quality.signals,
    },
  };
}

async function collectWikipedia(row: CandidateRow): Promise<EvidenceRow | null> {
  const article = await lookupWikipediaArticle({
    displayName: row.display_name,
    city: row.payload.city,
    county: row.payload.county,
    state: row.payload.state,
  });
  if (article === null) {
    throw new SkipReason('no enwiki article corroborating the registry place');
  }

  const quality = assessText(article.extract);
  return {
    id: evidenceId(row.id, 'wikipedia', article.url),
    entityId: row.id,
    lane: row.lane,
    collector: 'wikipedia',
    sourceUrl: article.url,
    // Wikipedia is a reputable tertiary source, not an official record: tier2, and WS4 must
    // prefer the tier1 nomination text where both exist.
    sourceTier: 'tier2',
    title: article.title,
    contentText: article.extract,
    contentHash: hashContent(article.extract),
    charCount: article.extract.length,
    qualityScore: quality.score,
    status: quality.usable ? 'captured' : 'quarantined',
    provenance: {
      pageId: article.pageId,
      licence: WIKIPEDIA_LICENCE,
      publisher: 'Wikipedia contributors',
      attributionRequired: true,
      quarantineReason: quality.usable ? undefined : quality.reason,
    },
  };
}

/**
 * DC HPO's own inventory page for the site (dcpreservation.org, tier2 by tier1-sources policy).
 * Unlike the NRHP/Wikipedia paths there is no search step here: the row's canonicalUrl was
 * assigned at import time straight from the DC Historic Preservation Office's own ArcGIS feature
 * for this exact record, so the URL already IS the identity — nothing to corroborate against.
 */
async function collectDcHpo(row: CandidateRow): Promise<EvidenceRow | null> {
  if (row.lane !== 'dc-sites') throw new SkipReason('not a dc-sites row');
  const url = row.payload.canonicalUrl;
  if (url === undefined) throw new SkipReason('dc-sites row has no canonicalUrl');

  const page = await safeFetchPage(url, { allowedContentTypes: ['text/html'] });
  if (page === undefined) throw new SkipReason('safeFetchPage rejected or could not reach canonicalUrl');

  const quality = assessText(page.text);
  return {
    id: evidenceId(row.id, 'dc-hpo', url),
    entityId: row.id,
    lane: row.lane,
    collector: 'dc-hpo',
    sourceUrl: page.finalUrl,
    sourceTier: 'tier2',
    title: row.display_name,
    contentText: page.text,
    contentHash: hashContent(page.text),
    charCount: page.text.length,
    qualityScore: quality.score,
    status: quality.usable ? 'captured' : 'quarantined',
    provenance: {
      publisher: 'DC Office of Planning, Historic Preservation Office',
      licence: 'CC BY 4.0',
      quarantineReason: quality.usable ? undefined : quality.reason,
    },
  };
}

/**
 * Person-kind landscape candidates (discovered from a Wikidata QID, or from a mention gap-fill —
 * see repo-n7p6.3 notes). When the row already carries a Wikipedia canonicalUrl its identity was
 * anchored at discovery time by the QID binding, so this fetches that exact article by title
 * rather than re-running `collectWikipedia`'s place-corroborated search: these rows have no
 * city/county/state at all, which would make `articleCorroboratesPlace` reject every hit.
 */
async function collectPersonWikipedia(row: CandidateRow): Promise<EvidenceRow | null> {
  if (row.payload.kind !== 'person') throw new SkipReason('not a person-kind row');
  const canonicalUrl = row.payload.canonicalUrl;
  if (canonicalUrl === undefined || !isWikipediaHost(canonicalUrl)) {
    throw new SkipReason('person row has no wikipedia canonicalUrl to anchor identity');
  }
  const title = decodeURIComponent(new URL(canonicalUrl).pathname.replace(/^\/wiki\//u, '')).replace(
    /_/gu,
    ' ',
  );

  const article = await lookupWikipediaArticleByTitle(title);
  if (article === null) throw new SkipReason(`wikipedia has no article at title "${title}"`);

  const quality = assessText(article.extract);
  return {
    id: evidenceId(row.id, 'person-wikipedia', article.url),
    entityId: row.id,
    lane: row.lane,
    collector: 'person-wikipedia',
    sourceUrl: article.url,
    sourceTier: 'tier2',
    title: article.title,
    contentText: article.extract,
    contentHash: hashContent(article.extract),
    charCount: article.extract.length,
    qualityScore: quality.score,
    status: quality.usable ? 'captured' : 'quarantined',
    provenance: {
      licence: WIKIPEDIA_LICENCE,
      publisher: 'Wikipedia contributors',
      attributionRequired: true,
      identityAnchor: 'canonicalUrl (assigned from Wikidata QID at discovery)',
      quarantineReason: quality.usable ? undefined : quality.reason,
    },
  };
}

/**
 * repo-n7p6.17 (WS3 PATH 2) — fetching loop over the pure traversal policy in reference-hops.ts.
 *
 * Runs only when PATH 1 left the entity thin: a nomination form or a solid Wikipedia article is
 * already the richest source we have, and re-walking their citations would spend the entity's
 * hop budget for little gain. "Thin" here means no tier1 evidence, or under 4,000 combined
 * captured characters — a threshold, not a law; the epic's PATH 2 charter is "entities still thin
 * after PATH 1" and this is what operationalizes that.
 *
 * Only PATH 1 rows with a real fetched page (dc-hpo, nomination-quality Wikipedia) can seed a
 * walk: the NRHP nomination is a PDF, not an HTML page with a reference list, so it is never a
 * seed even though it is tier1.
 */
type ReferenceHopResult = {
  readonly evidence: readonly EvidenceRow[];
  readonly leads: readonly { readonly url: string; readonly anchorText: string }[];
};

async function collectReferenceHops(
  row: CandidateRow,
  path1Evidence: readonly EvidenceRow[],
): Promise<ReferenceHopResult> {
  const captured = path1Evidence.filter((item) => item.status === 'captured');
  const totalChars = captured.reduce((sum, item) => sum + item.charCount, 0);
  const alreadyRich = captured.some((item) => item.sourceTier === 'tier1') && totalChars >= 4000;
  if (alreadyRich) {
    throw new SkipReason('entity already has rich tier1 evidence from PATH 1');
  }

  const seeds = captured
    .filter((item) => item.collector === 'wikipedia' || item.collector === 'person-wikipedia')
    .map((item) => ({ url: item.sourceUrl, sourceId: item.id }));
  if (seeds.length === 0) {
    throw new SkipReason('no seed page with a fetchable reference list (wikipedia collectors only)');
  }

  const subject: HopSubject = {
    displayName: row.display_name,
    city: row.payload.city,
    county: row.payload.county,
    state: row.payload.state,
  };
  const tokens = subjectTokens(subject);
  const visited = new Set<string>(
    seeds.map((seed) => documentKey(seed.url)).filter((key): key is string => key !== null),
  );
  const capturedHosts = new Set<string>(
    captured.flatMap((item) => {
      const key = hostLineageKey(item.sourceUrl);
      return key === undefined ? [] : [key];
    }),
  );

  let remainingFetches = DEFAULT_FETCH_BUDGET;
  let frontier = seeds;
  const results: EvidenceRow[] = [];
  const leads: { url: string; anchorText: string }[] = [];

  for (let depth = 1; depth <= DEFAULT_MAX_DEPTH && remainingFetches > 0 && frontier.length > 0; depth++) {
    const nextFrontier: typeof seeds = [];
    for (const seed of frontier) {
      if (remainingFetches <= 0) break;
      const seedPage = await safeFetchPage(seed.url, { allowedContentTypes: ['text/html'] });
      if (seedPage === undefined) continue;

      const candidates = extractReferenceLinks(seedPage.html, seedPage.finalUrl);
      const plan = planReferenceHops({ candidates, subject, visited, capturedHosts, remainingFetches });
      leads.push(
        ...plan.leads.map((candidate) => ({ url: candidate.url, anchorText: candidate.anchorText })),
      );

      for (const hop of plan.follow) {
        if (remainingFetches <= 0) break;
        remainingFetches -= 1;
        const key = documentKey(hop.candidate.url);
        if (key !== null) visited.add(key);

        await sleep(FETCH_DELAY_MS);
        const hopPage = await safeFetchPage(hop.candidate.url, { allowedContentTypes: ['text/html'] });
        if (hopPage === undefined) continue;

        const quality = assessText(hopPage.text);
        // The relevance gate that picked this candidate is a budget filter, not an evidence
        // gate (reference-hops.ts docs): what actually clears a fetched page for storage is the
        // same identity discipline every other collector applies — the full page text must
        // corroborate the subject, not just the anchor's 300-char context window.
        const identityCorroborated = tokens.some((token) =>
          hopPage.text.toLowerCase().includes(token),
        );
        const evId = evidenceId(row.id, 'reference-hop', hop.candidate.url);
        const status: 'captured' | 'quarantined' =
          quality.usable && identityCorroborated ? 'captured' : 'quarantined';
        const evRow: EvidenceRow = {
          id: evId,
          entityId: row.id,
          lane: row.lane,
          collector: 'reference-hop',
          sourceUrl: hopPage.finalUrl,
          sourceTier: hop.tier,
          title: hop.candidate.anchorText.length > 0 ? hop.candidate.anchorText : null,
          contentText: hopPage.text,
          contentHash: hashContent(hopPage.text),
          charCount: hopPage.text.length,
          qualityScore: quality.score,
          status,
          provenance: {
            hopDepth: depth,
            referringSourceId: seed.sourceId,
            relevanceScore: hop.relevanceScore,
            quarantineReason: status === 'quarantined'
              ? (!identityCorroborated ? 'identity not corroborated by subject text' : quality.reason)
              : undefined,
          },
        };
        results.push(evRow);
        if (status === 'captured') {
          const lineage = hostLineageKey(hop.candidate.url);
          if (lineage !== undefined) capturedHosts.add(lineage);
          nextFrontier.push({ url: hopPage.finalUrl, sourceId: evId });
        }
      }
    }
    frontier = nextFrontier;
  }

  if (results.length === 0 && leads.length === 0) {
    throw new SkipReason('no in-policy reference passed the relevance gate');
  }
  return { evidence: results, leads };
}

/**
 * Address-restricted properties (63 in this lane) are withheld from the NPS public dataset for
 * safety, but the nomination PDF still states the address in full. Redact before the row is
 * stored, not before it is published: evidence never captured cannot leak through a later bug
 * in a downstream gate.
 */
function applyAddressRestriction(row: CandidateRow, item: EvidenceRow): EvidenceRow {
  // Person entities get the same capture-time redaction as address-restricted properties:
  // living status is usually unknown at capture time, treatAsLiving('unknown') is true, and the
  // constitution's neverStoreResidentialAsOrdinaryPersonLocation applies to the stored evidence
  // itself, not just published prose. A deceased figure losing a street mention in a bio is the
  // cheap side of that trade.
  const guardApplies = row.payload.restrictedAddress === true || row.payload.kind === 'person';
  if (!guardApplies) return item;
  const { text, redactionCount } = redactStreetAddresses(item.contentText);
  return {
    ...item,
    contentText: text,
    contentHash: hashContent(text),
    charCount: text.length,
    provenance: {
      ...item.provenance,
      addressRestricted: row.payload.restrictedAddress === true,
      personAddressGuard: row.payload.kind === 'person' || undefined,
      redactionCount,
      // Zero redactions on a restricted PROPERTY means the patterns matched nothing — a signal
      // to check the row by hand. A clean person bio with zero redactions is normal, not suspect.
      redactionSuspicious: row.payload.restrictedAddress === true && redactionCount === 0,
    },
  };
}

async function sweepEntity(row: CandidateRow): Promise<EntityOutcome> {
  const evidence: EvidenceRow[] = [];
  const notes: string[] = [];

  for (const [name, collect] of [
    ['nrhp-nomination', collectNomination],
    ['wikipedia', collectWikipedia],
    ['dc-hpo', collectDcHpo],
    ['person-wikipedia', collectPersonWikipedia],
  ] as const) {
    try {
      const found = await collect(row);
      if (found !== null) evidence.push(applyAddressRestriction(row, found));
    } catch (error) {
      // One collector declining or failing must not lose the others' results, and must not
      // abort the batch. Skips and errors are labelled differently so the run report separates
      // "the source has nothing" from "our code broke".
      const prefix = error instanceof SkipReason ? 'skip' : 'error';
      notes.push(`${name}: ${prefix} — ${(error as Error).message}`);
    }
    await sleep(FETCH_DELAY_MS);
  }

  let leads: EntityOutcome['leads'] = [];
  try {
    const hops = await collectReferenceHops(row, evidence);
    for (const item of hops.evidence) evidence.push(applyAddressRestriction(row, item));
    leads = hops.leads.map((lead) => ({ entityId: row.id, ...lead }));
  } catch (error) {
    const prefix = error instanceof SkipReason ? 'skip' : 'error';
    notes.push(`reference-hop: ${prefix} — ${(error as Error).message}`);
  }

  return { entityId: row.id, displayName: row.display_name, evidence, notes, leads };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');
  if (LANES.length === 0) throw new Error('No lanes selected (greenbook is hard-excluded)');

  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));

  // WS2 selector decides which released entities are in scope, unless an explicit id list
  // overrides it for a targeted re-sweep.
  const inScope =
    ENTITY_IDS.length > 0
      ? ENTITY_IDS
      : await selectEntitiesForEnrichment(pool, {
          lanes: LANES,
          staleDays: STALE_DAYS,
          missingFields: ['historicalContext'],
        });

  // Then subtract what this sweep has already fetched.
  //
  // The selector alone is NOT a batching cursor for this script. Its freshness predicates are
  // about enrichment OUTPUT — `historicalContext` is the field WS4 writes, and it stays empty
  // until WS4 runs — so an entity whose evidence we captured an hour ago still matches every
  // one of them. Measured: after the first 100-entity batch, the selector returned all 2,550
  // lane entities and 99 of them already had captured evidence. Batch 2 would have re-fetched
  // multi-megabyte PDFs for every entity in batch 1 and never advanced.
  //
  // Evidence freshness lives in entity_evidence.fetched_at, so that is what gates a re-fetch.
  const alreadyCaptured = await pool.query<{ entity_id: string }>(
    `SELECT DISTINCT entity_id
       FROM bb_research.entity_evidence
      WHERE status = 'captured'
        AND fetched_at >= now() - make_interval(days => $1::int)`,
    [STALE_DAYS],
  );
  const capturedSet = new Set(alreadyCaptured.rows.map((row) => row.entity_id));
  const entityIds = REFETCH ? inScope : inScope.filter((id) => !capturedSet.has(id));
  if (!REFETCH && capturedSet.size > 0) {
    console.log(
      `Skipping ${inScope.length - entityIds.length} entities with evidence captured in the last ${STALE_DAYS} days (--refetch to override).`,
    );
  }
  const targeted = entityIds.slice(0, LIMIT);
  console.log(
    `Selector returned ${entityIds.length} entities needing evidence (lanes=${LANES.join(',')}); taking ${targeted.length}.`,
  );
  if (targeted.length === 0) {
    await pool.end();
    return;
  }

  const rows = await pool.query<CandidateRow>(
    `SELECT id, lane, display_name, payload
       FROM bb_research.landscape_candidates
      WHERE id = ANY($1::text[])
      ORDER BY id`,
    [targeted],
  );

  const outcomes: EntityOutcome[] = [];
  let index = 0;
  for (const row of rows.rows) {
    index += 1;
    const outcome = await sweepEntity(row);
    outcomes.push(outcome);
    const captured = outcome.evidence.filter((item) => item.status === 'captured');
    console.log(
      `[${index}/${rows.rows.length}] ${row.display_name} — captured=${captured.length} ` +
        `chars=${captured.reduce((sum, item) => sum + item.charCount, 0)} ` +
        `${outcome.notes.length > 0 ? `(${outcome.notes.join('; ')})` : ''}`,
    );
  }

  const allEvidence = outcomes.flatMap((outcome) => outcome.evidence);
  const captured = allEvidence.filter((item) => item.status === 'captured');
  const quarantined = allEvidence.filter((item) => item.status === 'quarantined');
  const withNoEvidence = outcomes.filter(
    (outcome) => outcome.evidence.filter((item) => item.status === 'captured').length === 0,
  );
  const allLeads = outcomes.flatMap((outcome) => outcome.leads);

  console.log(
    `\nEntities swept: ${outcomes.length}. Evidence captured: ${captured.length}. ` +
      `Quarantined: ${quarantined.length}. Entities with no usable evidence: ${withNoEvidence.length}. ` +
      `Off-policy leads for review: ${allLeads.length}.`,
  );
  console.log(
    `Needs name adjudication: ${captured.filter((item) => item.provenance['needsNameAdjudication'] === true).length}`,
  );

  const generatedAt = new Date().toISOString();
  mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = join(REPORT_DIR, `evidence-sweep-${generatedAt.replace(/[:.]/gu, '-')}.json`);
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt,
        dryRun: DRY_RUN || !APPLY,
        lanes: LANES,
        selected: entityIds.length,
        swept: outcomes.length,
        capturedCount: captured.length,
        quarantinedCount: quarantined.length,
        noEvidenceEntityIds: withNoEvidence.map((outcome) => outcome.entityId),
        // Off-policy hosts the hop walk found relevant (Mizell pattern): candidates for a human
        // to review as tier1-sources.ts additions. Never fetched, never evidence.
        leads: allLeads,
        outcomes: outcomes.map((outcome) => ({
          ...outcome,
          // Keep the report readable; full text lives in the DB after an --apply run.
          evidence: outcome.evidence.map((item) => ({
            ...item,
            contentText: `${item.contentText.slice(0, 500)}…`,
          })),
        })),
      },
      null,
      2,
    ),
  );
  console.log(`Report written to ${reportPath}`);

  if (DRY_RUN || !APPLY) {
    console.log(
      '\nDRY_RUN=1 (default): no database writes. Set DRY_RUN=0 EVIDENCE_SWEEP_APPLY=1 to apply.',
    );
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of allEvidence) {
      await client.query(
        `INSERT INTO bb_research.entity_evidence
           (id, entity_id, lane, collector, source_url, source_tier, title, content_text,
            content_hash, char_count, quality_score, status, provenance, fetched_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now())
         ON CONFLICT (entity_id, collector, source_url) DO UPDATE SET
           content_text = EXCLUDED.content_text,
           content_hash = EXCLUDED.content_hash,
           char_count = EXCLUDED.char_count,
           quality_score = EXCLUDED.quality_score,
           status = EXCLUDED.status,
           provenance = EXCLUDED.provenance,
           fetched_at = now()`,
        [
          item.id,
          item.entityId,
          item.lane,
          item.collector,
          item.sourceUrl,
          item.sourceTier,
          item.title,
          item.contentText,
          item.contentHash,
          item.charCount,
          item.qualityScore,
          item.status,
          JSON.stringify(item.provenance),
        ],
      );
    }

    // Ledger: evidence_digest is what WS4 compares to decide "nothing changed since last pass".
    for (const outcome of outcomes) {
      const capturedForEntity = outcome.evidence.filter((item) => item.status === 'captured');
      const digest =
        capturedForEntity.length === 0
          ? null
          : hashContent(
              capturedForEntity
                .map((item) => item.contentHash)
                .sort()
                .join('|'),
            );
      const row = rows.rows.find((candidate) => candidate.id === outcome.entityId);
      await client.query(
        `INSERT INTO bb_research.entity_enrichment
           (entity_id, lane, status, evidence_digest, notes, updated_at)
         VALUES ($1,$2,$3,$4,$5, now())
         ON CONFLICT (entity_id) DO UPDATE SET
           lane = EXCLUDED.lane,
           status = EXCLUDED.status,
           evidence_digest = EXCLUDED.evidence_digest,
           notes = EXCLUDED.notes,
           updated_at = now()`,
        [
          outcome.entityId,
          row?.lane ?? null,
          // 'pending' = evidence is in hand, WS4 has not enriched from it yet. 'skipped' = both
          // PATH 1 collectors came back empty; the record keeps its thin-record notice.
          capturedForEntity.length > 0 ? 'pending' : 'skipped',
          digest,
          JSON.stringify({
            ws: 'repo-n7p6.3',
            collectors: capturedForEntity.map((item) => item.collector),
            notes: outcome.notes,
            reason: capturedForEntity.length === 0 ? 'no-evidence' : undefined,
          }),
        ],
      );
    }
    await client.query('COMMIT');
    console.log(
      `Applied: ${allEvidence.length} evidence row(s), ${outcomes.length} ledger row(s).`,
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
