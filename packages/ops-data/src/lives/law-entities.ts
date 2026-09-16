/**
 * Validation for authored law and court-case catalog candidates, and the
 * `bb_research.landscape_candidates` row each one becomes.
 *
 * These records are drafted by hand from a research packet, not swept by a lane importer, so
 * nothing upstream has already checked them. This module is the check: it validates the authored
 * shape, then builds the exact row the incremental publisher will read. The publisher
 * (publish-release-entities-incremental.ts) is the only path into `bb_public.release_entities`
 * and it sources rows from this table alone, so a record that is wrong here is wrong in public.
 *
 * Pure by design, like `applicability.ts` next to it: no database, no filesystem, so the rules are
 * unit-testable and the loader script stays thin I/O.
 *
 * WHAT THE PUBLISHER DOES WITH THE ROW, and therefore why the payload is shaped this way.
 * `buildReleaseSourceFromLandscape` derives every published claim from two places and nowhere
 * else:
 *   - `canonical_url`, which becomes ONE `record_index` claim whose object is the summary; and
 *   - `payload.evidenceCitations`, one `evidence` claim per DISTINCT document, whose object is
 *     that citation's quote and whose citationLabel is its title.
 * A citation on the same document as `canonical_url` is dropped (the record would be citing
 * itself), so the canonical source is named once, as the canonical source, and never repeated in
 * the evidence list. The predicate on both is fixed at 'source states' by the publisher; it is
 * not ours to choose, which is why `evidence[].verbatim` exists instead — see below.
 *
 * WHY `verbatim` IS A FIELD. Every claim publishes under "source states", so a reader cannot tell
 * a quotation from a paraphrase by looking. The packet supplies verbatim text for some citations
 * and, for others, only its own sourced statement of what that document establishes. Both are
 * legitimate claim objects; presenting the second as a quotation is not. The flag records which
 * is which, the loader reports the split, and a record whose every claim is a paraphrase is
 * reported as such rather than passing silently.
 *
 * WHY THESE RECORDS CARRY COORDINATES. A statute is not a place, and the instinct is to leave
 * lat/lng null. The publisher forbids it: `gateLandscapePublishCandidate` skips a NEW candidate
 * with no coordinates as `missing_location`, because `ReleaseEntityUpsertRow.lat/lng` are
 * non-nullable and `buildGeoPointFields` throws on a non-finite pair. (The published case records
 * whose landscape rows show `lat: null` are republishes, which inherit the point their live row
 * already carries — a path a new record has no access to.) So the question is not whether to
 * carry a point but which point is honest:
 *   - Federal records take the Washington, District of Columbia point the two already-published
 *     law-editorial rows use (ent_law_anti_drug_abuse_act_1986, ent_law_fair_sentencing_act_2010).
 *     A Supreme Court ruling takes the Supreme Court Building point the catalog already uses for
 *     ent_case_bolling_v_sharpe_1954.
 *   - State records take their own state at `state` precision — the coarsest tier that still says
 *     something true. A capital-city point would read as a claim about a city the packet never
 *     names, and for the 1907 Oklahoma statute it would name the wrong one: Oklahoma's capital in
 *     1907 was not where it is now. State precision says "this state", which is exactly the
 *     record's reach and exactly what a rules timeline needs.
 * Precision travels with the point, so the map affordance says how precise the point is instead
 * of implying a building.
 */

import {
  LIVES_APPLICABILITY_SLICES,
  LIVES_LIFE_DOMAINS,
  LIVES_TEXT_POSTURES,
} from './applicability.js';

/** Kinds this loader authors. Anything else belongs to a different lane. */
export const LAW_ENTITY_KINDS = ['law', 'case'] as const;

/** Summary bounds the publisher enforces (`SUMMARY_MIN_CHARS`/`SUMMARY_MAX_CHARS`). */
export const LAW_ENTITY_SUMMARY_MIN_CHARS = 400;
export const LAW_ENTITY_SUMMARY_MAX_CHARS = 900;

/**
 * `CONTENT_EXPECTATIONS.law` and `.case` both require at least two narrative paragraphs and an
 * impact statement. That is an audit rather than a publish gate, so a shortfall is reported as a
 * warning, not a failure — but it is reported, because a record that lands under the bar its own
 * kind sets will be flagged the moment the content audit runs.
 */
export const LAW_ENTITY_MIN_NARRATIVE_PARAGRAPHS = 2;

export const LAW_ENTITY_LANE = 'other';
export const LAW_ENTITY_SOURCE_PROGRAM_ID = 'law-editorial';
export const LAW_ENTITY_SOURCE_CATEGORY = 'Legislation';

export type AuthoredLawEvidence = {
  readonly sourceUrl: string;
  readonly title: string;
  readonly quote: string;
  /** True when `quote` is text read in the source; false when it is the packet's sourced statement. */
  readonly verbatim: boolean;
};

export type AuthoredLawDisputePosition = {
  readonly label: string;
  readonly claim: string;
  readonly heldBy?: readonly string[];
  readonly citationUrl: string;
  readonly readerNote?: string;
};

export type AuthoredLawDispute = {
  readonly id: string;
  readonly question: string;
  readonly notInDispute?: string;
  readonly positions: readonly AuthoredLawDisputePosition[];
  readonly handling: string;
};

export type AuthoredLawApplicability = {
  readonly id: string;
  readonly jurisdictionId: string;
  readonly scopeLevel: 'federal' | 'state' | 'local';
  readonly inForceFromEdtf: string;
  readonly inForceToEdtf?: string | null;
  readonly lifeDomains: readonly string[];
  readonly textPosture: string;
  readonly appliesToSlices: readonly string[];
  readonly groupsNamed?: readonly string[];
  readonly disputed?: boolean;
  readonly notes?: string | null;
};

export type AuthoredLawEntity = {
  readonly id: string;
  readonly packetItem: number;
  readonly kind: (typeof LAW_ENTITY_KINDS)[number];
  readonly displayName: string;
  readonly scope: {
    readonly level: 'federal' | 'state' | 'local';
    readonly jurisdictionId: string;
    readonly jurisdictionName: string;
    readonly regionServed?: string;
  };
  readonly place: {
    readonly state: string;
    readonly lat: number;
    readonly lng: number;
    readonly precision: string;
    readonly city?: string;
    readonly historicAddress?: string;
  };
  readonly summary: string;
  readonly historicalContext: string;
  readonly impactStatement: string;
  readonly topicIds?: readonly string[];
  readonly eraBuckets?: readonly string[];
  readonly keywords?: readonly string[];
  readonly canonicalSource: { readonly url: string; readonly title: string };
  readonly evidence: readonly AuthoredLawEvidence[];
  readonly disputes?: readonly AuthoredLawDispute[];
  readonly applicability: AuthoredLawApplicability;
  readonly gaps?: readonly string[];
};

export type AuthoredLawEntityFile = {
  readonly version: number;
  readonly source: string;
  readonly records: readonly AuthoredLawEntity[];
};

/** The row this loader writes, column for column. */
export type LawEntityDbRow = {
  readonly id: string;
  readonly run_id: string;
  readonly lane: string;
  readonly source_program_id: string;
  readonly source_item_id: string;
  readonly display_name: string;
  readonly kind: string;
  readonly summary: string;
  readonly lat: number;
  readonly lng: number;
  readonly canonical_url: string;
  readonly research_lane_only: boolean;
  readonly status: string;
  readonly provenance: Readonly<Record<string, unknown>>;
  readonly payload: Readonly<Record<string, unknown>>;
};

export type LawEntityValidation =
  | { readonly ok: true; readonly row: LawEntityDbRow; readonly warnings: readonly string[] }
  | { readonly ok: false; readonly id: string; readonly errors: readonly string[] };

const ID_PATTERN = /^ent_(?:law|case)_[a-z0-9_]+$/;
const HTTPS_URL = /^https:\/\/\S+$/;

/** Host+path+query, matching the publisher's own `documentKey`, so "same document" means the same thing here. */
export function documentKeyForUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/u, '');
    return `${parsed.hostname.replace(/^www\./iu, '').toLowerCase()}${path}${parsed.search}`;
  } catch {
    return null;
  }
}

/** Paragraphs are blank-line separated, the same split the content-expectations audit uses. */
export function countNarrativeParagraphs(prose: string): number {
  return prose
    .split(/\n\s*\n/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0).length;
}

/**
 * Mirrors `resolveReleaseClaimId` for a claim with no authored id, which is every claim the
 * landscape path produces. Restated here rather than imported because this module is pure and
 * `@repo/domain` is not in its dependency surface; the loader script asserts the two agree by
 * calling the real function on the rows it builds.
 */
export function predictedClaimId(entityId: string, index: number): string {
  return `claim_${entityId.replace(/^ent_/u, '')}_${String(index + 1).padStart(2, '0')}`;
}

function validateEvidence(record: AuthoredLawEntity, errors: string[], warnings: string[]): void {
  const canonicalKey = documentKeyForUrl(record.canonicalSource.url);
  if (canonicalKey === null) errors.push(`canonicalSource.url is not a parseable URL`);
  if (!HTTPS_URL.test(record.canonicalSource.url)) {
    errors.push('canonicalSource.url must be an https URL');
  }
  if (record.canonicalSource.title.trim().length === 0) {
    errors.push('canonicalSource.title is empty');
  }
  if (record.evidence.length === 0) {
    errors.push(
      'evidence is empty: a record with no independent source cannot clear the depth gate',
    );
  }

  const seen = new Set<string>();
  for (const [index, citation] of record.evidence.entries()) {
    const where = `evidence[${index}]`;
    if (!HTTPS_URL.test(citation.sourceUrl)) errors.push(`${where}.sourceUrl must be an https URL`);
    if (citation.quote.trim().length === 0) {
      // The publisher silently drops a citation with an empty quote, so the record would publish
      // with fewer sources than it appears to have. Fail here instead.
      errors.push(`${where}.quote is empty; the publisher would drop this citation`);
    }
    if (citation.title.trim().length === 0) errors.push(`${where}.title is empty`);
    if (typeof citation.verbatim !== 'boolean') {
      errors.push(`${where}.verbatim must be stated true or false`);
    }
    const key = documentKeyForUrl(citation.sourceUrl);
    if (key === null) {
      errors.push(`${where}.sourceUrl is not a parseable URL`);
      continue;
    }
    if (key === canonicalKey) {
      errors.push(
        `${where} cites the same document as canonicalSource; the publisher drops it and the quote is lost`,
      );
    }
    if (seen.has(key)) {
      errors.push(`${where} repeats document ${key}; one claim per distinct document`);
    }
    seen.add(key);
  }

  // Two DISTINCT documents is what CONTENT_EXPECTATIONS asks of a law or case record.
  const distinctDocuments = new Set([canonicalKey, ...seen].filter((k): k is string => k !== null));
  if (distinctDocuments.size < 2) {
    errors.push(
      `only ${distinctDocuments.size} distinct source document(s); law and case records require 2`,
    );
  }
  if (record.evidence.every((citation) => !citation.verbatim) && record.evidence.length > 0) {
    warnings.push(
      'no evidence citation carries verbatim source text; every claim object is a sourced statement',
    );
  }
}

function validateApplicabilityHints(record: AuthoredLawEntity, errors: string[]): void {
  const applicability = record.applicability;
  if (applicability.scopeLevel !== record.scope.level) {
    errors.push(
      `applicability.scopeLevel ${applicability.scopeLevel} disagrees with scope.level ${record.scope.level}`,
    );
  }
  if (applicability.jurisdictionId !== record.scope.jurisdictionId) {
    errors.push('applicability.jurisdictionId disagrees with scope.jurisdictionId');
  }
  // The same prefix rule `validateApplicability` applies, answered here so a scope error is caught
  // while the record is still being authored rather than at bind time.
  const prefix =
    applicability.scopeLevel === 'federal'
      ? 'nation:'
      : applicability.scopeLevel === 'state'
        ? 'state:'
        : null;
  if (prefix !== null && !applicability.jurisdictionId.startsWith(prefix)) {
    errors.push(
      `${applicability.scopeLevel} scope cannot sit on jurisdiction ${applicability.jurisdictionId}`,
    );
  }
  if (applicability.scopeLevel === 'state' && applicability.jurisdictionId === 'nation:US') {
    errors.push('a state rule cannot be authored against the nation');
  }
  for (const domain of applicability.lifeDomains) {
    if (!(LIVES_LIFE_DOMAINS as readonly string[]).includes(domain)) {
      errors.push(`life domain ${domain} is not allowed`);
    }
  }
  if (applicability.lifeDomains.length === 0) errors.push('applicability.lifeDomains is empty');
  for (const slice of applicability.appliesToSlices) {
    if (!(LIVES_APPLICABILITY_SLICES as readonly string[]).includes(slice)) {
      errors.push(`slice ${slice} is not allowed`);
    }
  }
  if (applicability.appliesToSlices.length === 0) {
    errors.push('applicability.appliesToSlices is empty');
  }
  if (!(LIVES_TEXT_POSTURES as readonly string[]).includes(applicability.textPosture)) {
    errors.push(`text posture ${applicability.textPosture} is not allowed`);
  }
}

function validateDisputes(record: AuthoredLawEntity, errors: string[], warnings: string[]): void {
  const disputes = record.disputes ?? [];
  if (disputes.length > 0 && record.applicability.disputed !== true) {
    // A dispute that does not set the flag renders as a finding downstream, which is the single
    // failure this whole record type exists to avoid.
    errors.push('record carries disputes but applicability.disputed is not true');
  }
  const citedUrls = new Set(record.evidence.map((citation) => citation.sourceUrl));
  citedUrls.add(record.canonicalSource.url);
  for (const dispute of disputes) {
    if (dispute.positions.length < 2) {
      errors.push(
        `dispute ${dispute.id} has fewer than two positions; that is a finding, not a dispute`,
      );
    }
    if (dispute.handling.trim().length === 0) {
      errors.push(`dispute ${dispute.id} states no handling instruction`);
    }
    for (const position of dispute.positions) {
      if (position.claim.trim().length === 0) {
        errors.push(`dispute ${dispute.id} position ${position.label} states no claim`);
      }
      if (!citedUrls.has(position.citationUrl)) {
        // A position whose source is not among the record's citations never reaches a reader.
        errors.push(
          `dispute ${dispute.id} position ${position.label} cites ${position.citationUrl}, which is not one of this record's sources`,
        );
      }
      if ((position.heldBy ?? []).length === 0) {
        warnings.push(
          `dispute ${dispute.id} position ${position.label} names no holder; the packet supplies none and none is invented`,
        );
      }
    }
  }
}

export function validateLawEntity(
  record: AuthoredLawEntity,
  options: { readonly runId: string },
): LawEntityValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!ID_PATTERN.test(record.id)) {
    errors.push(`id "${record.id}" must match ent_law_* or ent_case_*`);
  }
  if (!(LAW_ENTITY_KINDS as readonly string[]).includes(record.kind)) {
    errors.push(`kind ${record.kind} is not law or case`);
  }
  if (record.kind === 'law' && !record.id.startsWith('ent_law_')) {
    errors.push('a law record must carry an ent_law_ id');
  }
  if (record.kind === 'case' && !record.id.startsWith('ent_case_')) {
    errors.push('a case record must carry an ent_case_ id');
  }
  if (record.displayName.trim().length === 0) errors.push('displayName is empty');

  const summary = record.summary.trim();
  if (
    summary.length < LAW_ENTITY_SUMMARY_MIN_CHARS ||
    summary.length > LAW_ENTITY_SUMMARY_MAX_CHARS
  ) {
    errors.push(
      `summary length ${summary.length} outside publisher bounds ` +
        `${LAW_ENTITY_SUMMARY_MIN_CHARS}..${LAW_ENTITY_SUMMARY_MAX_CHARS}`,
    );
  }
  if (record.historicalContext.trim().length === 0) {
    // Not cosmetic: a non-empty historicalContext is the first thing `assessLandscapeDepth` reads,
    // and the fastest honest way past the depth gate.
    errors.push('historicalContext is empty');
  }
  const paragraphs = countNarrativeParagraphs(record.historicalContext);
  if (paragraphs < LAW_ENTITY_MIN_NARRATIVE_PARAGRAPHS) {
    warnings.push(
      `historicalContext has ${paragraphs} paragraph(s); CONTENT_EXPECTATIONS.${record.kind} expects ${LAW_ENTITY_MIN_NARRATIVE_PARAGRAPHS}`,
    );
  }
  if (record.impactStatement.trim().length === 0) {
    warnings.push(`impactStatement is empty; CONTENT_EXPECTATIONS.${record.kind} requires one`);
  }

  if (!Number.isFinite(record.place.lat) || !Number.isFinite(record.place.lng)) {
    errors.push(
      'place.lat/place.lng must both be finite; the publisher skips a coordinate-less new record',
    );
  }
  if (record.place.state.trim().length === 0) errors.push('place.state is empty');

  validateEvidence(record, errors, warnings);
  validateApplicabilityHints(record, errors);
  validateDisputes(record, errors, warnings);

  if (errors.length > 0) return { ok: false, id: record.id, errors };
  return { ok: true, row: buildLawEntityRow(record, options), warnings };
}

/**
 * The landscape row, built to be read back by `buildReleaseSourceFromLandscape` exactly as
 * written. Every payload key here is one that function reads; anything it ignores is grouped under
 * `authored` so it is obvious at a glance which half is publisher input and which half is
 * downstream input (the applicability binder's, chiefly).
 */
export function buildLawEntityRow(
  record: AuthoredLawEntity,
  options: { readonly runId: string },
): LawEntityDbRow {
  const provenance: Record<string, unknown> = {
    generatedBy: options.runId,
    sourceCategory: LAW_ENTITY_SOURCE_CATEGORY,
    sourceState: record.place.state,
    // A law has no street address. `historicAddress` is set only where the catalog already places
    // a record at a named building (the Supreme Court), never invented for a statute.
    ...(record.place.city !== undefined ? { sourceCity: record.place.city } : {}),
    ...(record.place.historicAddress !== undefined
      ? { historicAddress: record.place.historicAddress }
      : {}),
    sourceUrl: record.canonicalSource.url,
    locationBasis:
      record.place.precision === 'state'
        ? 'the enacting state, at state precision; the packet names no city and none is invented'
        : 'the seat of the enacting or deciding body, following the catalog rows already published for this kind',
    packet: 'docs/research/lives-missing-laws-packet.md',
    packetItem: record.packetItem,
  };

  const payload: Record<string, unknown> = {
    id: record.id,
    kind: record.kind,
    provenance: { ...provenance },
    canonicalUrl: record.canonicalSource.url,
    sourceUrls: [record.canonicalSource.url, ...record.evidence.map((c) => c.sourceUrl)],
    geocode: { precision: record.place.precision },
    historicalContext: record.historicalContext,
    impactStatement: record.impactStatement,
    ...(record.topicIds !== undefined ? { topicIds: record.topicIds } : {}),
    ...(record.eraBuckets !== undefined ? { eraBuckets: record.eraBuckets } : {}),
    ...(record.keywords !== undefined ? { keywords: record.keywords } : {}),
    evidenceCitations: record.evidence.map((citation) => ({
      sourceUrl: citation.sourceUrl,
      title: citation.title,
      quote: citation.quote,
    })),
    // Ignored by the publisher; read by whoever authors the law_applicability rows next, and kept
    // on the row so the binding does not have to be re-derived from the packet by hand.
    authored: {
      packet: 'docs/research/lives-missing-laws-packet.md',
      packetItem: record.packetItem,
      scope: record.scope,
      applicability: record.applicability,
      disputes: record.disputes ?? [],
      gaps: record.gaps ?? [],
      evidenceVerbatim: record.evidence.map((citation) => ({
        sourceUrl: citation.sourceUrl,
        verbatim: citation.verbatim,
      })),
    },
  };

  return {
    id: record.id,
    run_id: options.runId,
    lane: LAW_ENTITY_LANE,
    source_program_id: LAW_ENTITY_SOURCE_PROGRAM_ID,
    source_item_id: record.id,
    display_name: record.displayName,
    kind: record.kind,
    summary: record.summary.trim(),
    lat: record.place.lat,
    lng: record.place.lng,
    canonical_url: record.canonicalSource.url,
    research_lane_only: true,
    status: 'pending',
    provenance,
    payload,
  };
}

export type CitedYearCheck = {
  readonly year: number;
  readonly role: 'start' | 'end';
  readonly cited: boolean;
  readonly citedBy: readonly string[];
};

/**
 * The bind-time test, answered now instead of after publication.
 *
 * `validateApplicability` requires every in-force year to appear in the text of a cited basis
 * claim, where the text it searches is `object + ' ' + citationLabel` and the claim must carry a
 * non-empty citationHref. Both are knowable from the authored record, so this runs the same test
 * against the claims the publisher WOULD produce, in the publisher's own order: the record_index
 * claim first (object = summary, label = the canonical host), then one evidence claim per
 * citation (object = quote, label = title).
 *
 * The caller supplies the claim texts because only it knows the real ones — it builds them with
 * the publisher's own function rather than a second copy of the rule.
 */
export function checkCitedYears(input: {
  readonly inForceFromEdtf: string;
  readonly inForceToEdtf?: string | null;
  readonly claimText: ReadonlyMap<string, string>;
}): readonly CitedYearCheck[] {
  const checks: CitedYearCheck[] = [];
  const add = (edtf: string, role: 'start' | 'end'): void => {
    const year = Number(edtf.slice(0, 4));
    if (!Number.isFinite(year)) return;
    const citedBy = [...input.claimText.entries()]
      .filter(([, text]) => text.includes(String(year)))
      .map(([id]) => id);
    checks.push({ year, role, cited: citedBy.length > 0, citedBy });
  };
  add(input.inForceFromEdtf, 'start');
  if (input.inForceToEdtf) add(input.inForceToEdtf, 'end');
  return checks;
}
