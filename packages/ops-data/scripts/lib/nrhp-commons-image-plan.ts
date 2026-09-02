/**
 * Pure mapping/parsing helpers for repo-4vuf (WS5) — resolving NRHP Black
 * heritage place images via Wikidata P649 (NRHP reference number) → P18
 * (image) → Commons license map.
 *
 * These functions are deliberately network-free so they can be unit tested:
 * parseNrhpImageSparqlResults / commonsFileTitleFromImageIri turn a raw
 * Wikidata SPARQL JSON response into a per-refnum lookup, and
 * buildNrhpCommonsImageRow turns that lookup (plus optional Commons
 * imageinfo metadata) into the same CommonsMediaPropose row shape the
 * dry-run-commons-qid-leftover.ts / promote-commons-auto-propose.ts pair
 * already uses, so this lane's plan file is a drop-in --from input for the
 * existing promotion script.
 */
import {
  evaluateCommonsMediaPropose,
  type CommonsImageMetadata,
  type CommonsMediaPropose,
  type EntityMediaEnrichmentInput,
} from '../../../domain/src/adapters/wikimedia/commons-media.ts';

/** Which SPARQL stage a row resolved at, before any Commons metadata fetch. */
export const NRHP_IMAGE_STAGES = ['no_item', 'item_no_image', 'image_found'] as const;
export type NrhpImageStage = (typeof NRHP_IMAGE_STAGES)[number];

export type NrhpCommonsImageRow = CommonsMediaPropose & {
  readonly kind: 'place';
  readonly stage: NrhpImageStage;
  readonly refnum: string;
  /** Only set on image_found rows with more than one P18 value on the item. */
  readonly imageCandidateCount?: number;
};

export type SparqlBindingValue = { readonly value: string };
export type SparqlNrhpImageBinding = {
  readonly ref?: SparqlBindingValue;
  readonly item?: SparqlBindingValue;
  readonly image?: SparqlBindingValue;
};
export type SparqlNrhpImageResponse = {
  readonly results?: { readonly bindings?: readonly SparqlNrhpImageBinding[] };
};

export type NrhpImageLookup = {
  readonly qid?: string;
  /** Commons File: titles in the order Wikidata returned them (P18 statement order). */
  readonly fileTitles: readonly string[];
};

/** Extract the QID from a Wikidata entity IRI, e.g. "http://www.wikidata.org/entity/Q6386091". */
export function qidFromWikidataIri(iri: string): string | undefined {
  const match = /\/entity\/(Q\d+)$/i.exec(iri.trim());
  return match?.[1]?.toUpperCase();
}

/**
 * Extract a Commons File: title from the Special:FilePath IRI SPARQL returns for an image-typed
 * value, e.g. "http://commons.wikimedia.org/wiki/Special:FilePath/KellyIngramPark.jpg" →
 * "File:KellyIngramPark.jpg".
 */
export function commonsFileTitleFromImageIri(iri: string): string | undefined {
  const match = /Special:FilePath\/([^?#]+)/i.exec(iri.trim());
  if (!match) return undefined;
  let decoded: string;
  try {
    decoded = decodeURIComponent(match[1]!.replace(/\+/g, '%20'));
  } catch {
    decoded = match[1]!;
  }
  const name = decoded.replace(/_/g, ' ').trim();
  return name.length > 0 ? `File:${name}` : undefined;
}

/**
 * Group a raw Wikidata SPARQL JSON response (?ref ?item ?image, with ?item/?image OPTIONAL) by
 * refnum. A ref with no bindings at all is simply absent from the returned map — callers treat
 * that as no_item. A ref bound to an item but never to an image keeps an empty fileTitles array
 * (item_no_image). Multiple ?item bindings for one ref (a genuinely ambiguous P649 value) keep
 * only the first item encountered and its images; later distinct items are ignored, which is a
 * conservative "don't auto-select across two different Wikidata items" choice.
 */
export function parseNrhpImageSparqlResults(
  response: SparqlNrhpImageResponse,
): ReadonlyMap<string, NrhpImageLookup> {
  const out = new Map<string, { qid?: string; fileTitles: string[] }>();
  for (const binding of response.results?.bindings ?? []) {
    const ref = binding.ref?.value?.trim();
    if (!ref) continue;
    const qid = binding.item?.value ? qidFromWikidataIri(binding.item.value) : undefined;
    const entry = out.get(ref) ?? { fileTitles: [] };
    if (qid && entry.qid === undefined) entry.qid = qid;
    if (
      binding.image?.value &&
      (entry.qid === undefined || qid === undefined || qid === entry.qid)
    ) {
      const title = commonsFileTitleFromImageIri(binding.image.value);
      if (title && !entry.fileTitles.includes(title)) entry.fileTitles.push(title);
    }
    out.set(ref, entry);
  }
  return out;
}

/**
 * Build one plan row for a single NRHP entity, given what the SPARQL stage resolved (qid +
 * ordered file titles) and, for image_found rows, the fetched Commons metadata for the first file
 * title (if fetched yet). Delegates the actual license/alt/credit/outcome decision to the shared,
 * already-reviewed evaluateCommonsMediaPropose so this lane produces rows the existing
 * promote-commons-auto-propose.ts gate already knows how to read.
 */
export function buildNrhpCommonsImageRow(input: {
  readonly entityId: string;
  readonly displayName: string;
  readonly refnum: string;
  readonly lookup?: NrhpImageLookup;
  readonly image?: CommonsImageMetadata;
}): NrhpCommonsImageRow {
  const entity: EntityMediaEnrichmentInput = {
    entityId: input.entityId,
    displayName: input.displayName,
    kind: 'place',
    hasPrimaryImage: false,
  };

  const qid = input.lookup?.qid;
  if (!qid) {
    const propose = evaluateCommonsMediaPropose({ entity });
    return { ...propose, kind: 'place', stage: 'no_item', refnum: input.refnum };
  }

  const fileTitles = input.lookup?.fileTitles ?? [];
  if (fileTitles.length === 0) {
    const propose = evaluateCommonsMediaPropose({
      entity,
      wikidataId: qid,
      p18Candidates: [],
    });
    return { ...propose, kind: 'place', stage: 'item_no_image', refnum: input.refnum };
  }

  const first = fileTitles[0]!;
  const propose = evaluateCommonsMediaPropose({
    entity,
    wikidataId: qid,
    p18Candidates: [{ fileTitle: first, rank: 'preferred' }],
    ...(input.image !== undefined ? { image: input.image } : {}),
  });
  return {
    ...propose,
    kind: 'place',
    stage: 'image_found',
    refnum: input.refnum,
    ...(fileTitles.length > 1 ? { imageCandidateCount: fileTitles.length } : {}),
  };
}

export type NrhpCommonsImagePlanCounts = {
  readonly total: number;
  readonly no_item: number;
  readonly item_no_image: number;
  readonly image_found: number;
  readonly auto_propose: number;
  readonly license_hold: number;
};

/**
 * license_hold groups every image_found row whose outcome is not auto_propose (license_unmapped,
 * missing_credit_or_alt, p18_ambiguous, etc.) — the taxonomy the resolver script reports, kept
 * separate from the real `outcome` field so the plan file stays a faithful
 * promote-commons-auto-propose.ts --from input.
 */
export function summarizeNrhpCommonsImageRows(
  rows: readonly NrhpCommonsImageRow[],
): NrhpCommonsImagePlanCounts {
  let no_item = 0;
  let item_no_image = 0;
  let image_found = 0;
  let auto_propose = 0;
  let license_hold = 0;
  for (const row of rows) {
    if (row.stage === 'no_item') no_item += 1;
    else if (row.stage === 'item_no_image') item_no_image += 1;
    else {
      image_found += 1;
      if (row.outcome === 'auto_propose') auto_propose += 1;
      else license_hold += 1;
    }
  }
  return { total: rows.length, no_item, item_no_image, image_found, auto_propose, license_hold };
}
