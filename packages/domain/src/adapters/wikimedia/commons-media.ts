/**
 * Deterministic Wikimedia Commons media enrichment for entities.
 * QID → P18 → Commons license map → propose/review (no LLM).
 */
import type { PublishableRightsStatus } from '../../provenance/rights.js';
import type { WikidataClaim, WikidataEntity } from './types.js';

export const COMMONS_MEDIA_PROPOSE_VERSION = 'commons-media-propose.v1' as const;

export const COMMONS_MEDIA_OUTCOMES = [
  'auto_propose',
  'needs_review',
  'no_qid',
  'qid_ambiguous',
  'no_p18',
  'p18_ambiguous',
  'license_unmapped',
  'missing_credit_or_alt',
  'already_has_image',
  'skipped',
] as const;

export type CommonsMediaOutcome = (typeof COMMONS_MEDIA_OUTCOMES)[number];

export type CommonsP18Candidate = {
  readonly fileTitle: string;
  readonly rank: 'preferred' | 'normal' | 'deprecated' | 'unknown';
};

export type CommonsImageMetadata = {
  readonly fileTitle: string;
  readonly commonsPageUrl: string;
  readonly thumbUrl?: string;
  readonly fullUrl?: string;
  readonly licenseShortName?: string;
  readonly artist?: string;
  readonly credit?: string;
  readonly imageDescription?: string;
  readonly attributionRequired?: boolean;
  readonly copyrighted?: boolean;
};

export type EntityMediaEnrichmentInput = {
  readonly entityId: string;
  readonly displayName: string;
  readonly kind?: string;
  /** Exact trusted Wikidata QID when already on the entity. */
  readonly wikidataId?: string;
  readonly hasPrimaryImage?: boolean;
};

export type CommonsMediaPropose = {
  readonly schemaVersion: typeof COMMONS_MEDIA_PROPOSE_VERSION;
  readonly entityId: string;
  readonly displayName: string;
  readonly outcome: CommonsMediaOutcome;
  readonly reason: string;
  readonly wikidataId?: string;
  readonly qidMatchMethod?: 'trusted_identifier' | 'enwiki_exact_title';
  readonly fileTitle?: string;
  readonly commonsPageUrl?: string;
  readonly sourceImageUrl?: string;
  readonly alt?: string;
  readonly credit?: string;
  readonly rightsStatus?: PublishableRightsStatus;
  readonly licenseShortName?: string;
  /** Non-image resource links discovered during enrichment (Wikipedia / Commons). */
  readonly resourceLinks?: readonly EntityResourceLinkPropose[];
};

export type EntityResourceLinkPropose = {
  readonly kind: 'wikipedia' | 'wikidata' | 'commons_file' | 'commons_category';
  readonly title: string;
  readonly url: string;
};

/** Normalize a display name into an English Wikipedia title candidate. */
export function enwikiTitleFromDisplayName(displayName: string): string {
  return displayName
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/ /g, '_');
}

/**
 * Exact, case-insensitive label match against a Wikidata/enwiki entity label.
 * Rejects missing/missing-label entities. Does not fuzzy-match.
 */
export function isExactLabelMatch(
  displayName: string,
  entityLabel: string | undefined,
): boolean {
  if (!entityLabel) return false;
  return normalizeLabel(displayName) === normalizeLabel(entityLabel);
}

export function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Extract P18 (image) file titles from a Wikidata entity.
 * Preferred-rank claims win; deprecated claims are ignored.
 */
export function extractP18Candidates(entity?: WikidataEntity): readonly CommonsP18Candidate[] {
  if (!entity?.claims?.P18) return [];

  const out: CommonsP18Candidate[] = [];
  for (const claim of entity.claims.P18) {
    const fileTitle = commonsFileTitleFromClaim(claim);
    if (!fileTitle) continue;
    const rank = claimRank(claim);
    if (rank === 'deprecated') continue;
    out.push({ fileTitle, rank });
  }

  const preferred = out.filter((c) => c.rank === 'preferred');
  if (preferred.length > 0) return preferred;
  return out;
}

export function selectSingleP18(
  candidates: readonly CommonsP18Candidate[],
): { readonly ok: true; readonly fileTitle: string } | { readonly ok: false; readonly reason: string } {
  if (candidates.length === 0) {
    return { ok: false, reason: 'no_p18' };
  }
  if (candidates.length > 1) {
    return { ok: false, reason: 'p18_ambiguous' };
  }
  return { ok: true, fileTitle: candidates[0]!.fileTitle };
}

/**
 * Map Commons license short names to publishable rights.
 * Unmapped / NC / ND / fair-use-only → undefined (needs review).
 */
export function mapCommonsLicenseToRights(
  licenseShortName: string | undefined,
): PublishableRightsStatus | undefined {
  if (!licenseShortName) return undefined;
  const key = licenseShortName.trim().toLowerCase().replace(/\s+/g, ' ');

  if (
    key === 'public domain' ||
    key === 'pd' ||
    key === 'pd-us' ||
    key === 'pd-old' ||
    key === 'pd-art' ||
    key === 'cc0' ||
    key === 'cc-zero' ||
    key.startsWith('pd-') ||
    key.includes('public domain')
  ) {
    return 'public_domain';
  }

  // Attribution-required libre licenses we can display with credit.
  if (
    key === 'cc by 4.0' ||
    key === 'cc by 3.0' ||
    key === 'cc by 2.0' ||
    key === 'cc by 2.5' ||
    key === 'cc by-sa 4.0' ||
    key === 'cc by-sa 3.0' ||
    key === 'cc by-sa 2.0' ||
    key === 'cc by-sa 2.5' ||
    key === 'cc-by-4.0' ||
    key === 'cc-by-3.0' ||
    key === 'cc-by-sa-4.0' ||
    key === 'cc-by-sa-3.0' ||
    /^cc[- ]by([- ]sa)?[- ]?[1-4](\.[0-9])?$/.test(key)
  ) {
    // Exclude NC/ND variants explicitly.
    if (key.includes('nc') || key.includes('nd')) return undefined;
    return 'licensed';
  }

  return undefined;
}

export function buildAltText(input: {
  readonly displayName: string;
  readonly imageDescription?: string;
  readonly fileTitle: string;
}): string {
  const fromDesc = input.imageDescription?.replace(/<[^>]+>/g, '').trim();
  if (fromDesc && fromDesc.length > 0 && fromDesc.length <= 240) {
    return fromDesc;
  }
  const fromFile = input.fileTitle
    .replace(/^File:/i, '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/_/g, ' ')
    .trim();
  if (fromFile.length > 0) {
    return `${input.displayName} — ${fromFile}`;
  }
  return `Image of ${input.displayName}`;
}

export function buildCreditLine(input: {
  readonly artist?: string;
  readonly credit?: string;
  readonly licenseShortName?: string;
}): string | undefined {
  const artist = stripHtml(input.artist);
  const credit = stripHtml(input.credit);
  const parts: string[] = [];
  if (artist) parts.push(artist);
  else if (credit) parts.push(credit);
  if (input.licenseShortName) parts.push(input.licenseShortName);
  parts.push('Wikimedia Commons');
  const line = parts.filter(Boolean).join(' · ');
  return line.length > 0 ? line : undefined;
}

export function commonsFilePageUrl(fileTitle: string): string {
  const title = fileTitle.startsWith('File:') ? fileTitle : `File:${fileTitle}`;
  return `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

export function wikipediaEnUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

export function wikidataUrl(qid: string): string {
  return `https://www.wikidata.org/wiki/${encodeURIComponent(qid)}`;
}

/**
 * Pure decision function for one entity given resolved QID + optional Commons metadata.
 */
export function evaluateCommonsMediaPropose(input: {
  readonly entity: EntityMediaEnrichmentInput;
  readonly wikidataId?: string;
  readonly qidMatchMethod?: CommonsMediaPropose['qidMatchMethod'];
  readonly qidAmbiguous?: boolean;
  readonly p18Candidates?: readonly CommonsP18Candidate[];
  readonly image?: CommonsImageMetadata;
  readonly enwikiTitle?: string;
}): CommonsMediaPropose {
  const { entity } = input;
  const base = {
    schemaVersion: COMMONS_MEDIA_PROPOSE_VERSION,
    entityId: entity.entityId,
    displayName: entity.displayName,
  } as const;

  if (entity.hasPrimaryImage) {
    return {
      ...base,
      outcome: 'already_has_image',
      reason: 'Entity already has a cleared primaryImage; skip enrichment',
      ...(input.wikidataId !== undefined ? { wikidataId: input.wikidataId } : {}),
    };
  }

  if (input.qidAmbiguous) {
    return {
      ...base,
      outcome: 'qid_ambiguous',
      reason: 'Multiple enwiki title matches; refusing non-LLM auto-select',
    };
  }

  if (!input.wikidataId) {
    return {
      ...base,
      outcome: 'no_qid',
      reason: 'No trusted Wikidata QID and no exact enwiki title match',
    };
  }

  const resourceLinks: EntityResourceLinkPropose[] = [
    {
      kind: 'wikidata',
      title: input.wikidataId,
      url: wikidataUrl(input.wikidataId),
    },
  ];
  if (input.enwikiTitle) {
    resourceLinks.push({
      kind: 'wikipedia',
      title: input.enwikiTitle.replace(/_/g, ' '),
      url: wikipediaEnUrl(input.enwikiTitle),
    });
  }

  const p18 = selectSingleP18(input.p18Candidates ?? []);
  if (!p18.ok) {
    return {
      ...base,
      outcome: p18.reason === 'p18_ambiguous' ? 'p18_ambiguous' : 'no_p18',
      reason:
        p18.reason === 'p18_ambiguous'
          ? 'Multiple P18 images without a single preferred claim'
          : 'Wikidata entity has no usable P18 image claim',
      wikidataId: input.wikidataId,
      ...(input.qidMatchMethod !== undefined ? { qidMatchMethod: input.qidMatchMethod } : {}),
      resourceLinks,
    };
  }

  if (!input.image) {
    return {
      ...base,
      outcome: 'needs_review',
      reason: 'P18 present but Commons imageinfo metadata not loaded',
      wikidataId: input.wikidataId,
      ...(input.qidMatchMethod !== undefined ? { qidMatchMethod: input.qidMatchMethod } : {}),
      fileTitle: p18.fileTitle,
      commonsPageUrl: commonsFilePageUrl(p18.fileTitle),
      resourceLinks: [
        ...resourceLinks,
        {
          kind: 'commons_file',
          title: p18.fileTitle,
          url: commonsFilePageUrl(p18.fileTitle),
        },
      ],
    };
  }

  const rightsStatus = mapCommonsLicenseToRights(input.image.licenseShortName);
  const alt = buildAltText({
    displayName: entity.displayName,
    ...(input.image.imageDescription !== undefined
      ? { imageDescription: input.image.imageDescription }
      : {}),
    fileTitle: p18.fileTitle,
  });
  const credit = buildCreditLine({
    ...(input.image.artist !== undefined ? { artist: input.image.artist } : {}),
    ...(input.image.credit !== undefined ? { credit: input.image.credit } : {}),
    ...(input.image.licenseShortName !== undefined
      ? { licenseShortName: input.image.licenseShortName }
      : {}),
  });

  const commonsLink: EntityResourceLinkPropose = {
    kind: 'commons_file',
    title: p18.fileTitle,
    url: input.image.commonsPageUrl,
  };

  if (!rightsStatus) {
    return {
      ...base,
      outcome: 'license_unmapped',
      reason: `Commons license "${input.image.licenseShortName ?? 'unknown'}" is not auto-publishable`,
      wikidataId: input.wikidataId,
      ...(input.qidMatchMethod !== undefined ? { qidMatchMethod: input.qidMatchMethod } : {}),
      fileTitle: p18.fileTitle,
      commonsPageUrl: input.image.commonsPageUrl,
      ...(input.image.fullUrl !== undefined ? { sourceImageUrl: input.image.fullUrl } : {}),
      ...(input.image.licenseShortName !== undefined
        ? { licenseShortName: input.image.licenseShortName }
        : {}),
      alt,
      ...(credit !== undefined ? { credit } : {}),
      resourceLinks: [...resourceLinks, commonsLink],
    };
  }

  if (!credit || !alt) {
    return {
      ...base,
      outcome: 'missing_credit_or_alt',
      reason: 'Could not build deterministic alt and credit from Commons metadata',
      wikidataId: input.wikidataId,
      ...(input.qidMatchMethod !== undefined ? { qidMatchMethod: input.qidMatchMethod } : {}),
      fileTitle: p18.fileTitle,
      commonsPageUrl: input.image.commonsPageUrl,
      rightsStatus,
      alt,
      ...(credit !== undefined ? { credit } : {}),
      resourceLinks: [...resourceLinks, commonsLink],
    };
  }

  return {
    ...base,
    outcome: 'auto_propose',
    reason: 'Exact QID + single P18 + mappable license + alt/credit',
    wikidataId: input.wikidataId,
    ...(input.qidMatchMethod !== undefined ? { qidMatchMethod: input.qidMatchMethod } : {}),
    fileTitle: p18.fileTitle,
    commonsPageUrl: input.image.commonsPageUrl,
    ...(input.image.fullUrl !== undefined
      ? { sourceImageUrl: input.image.fullUrl }
      : input.image.thumbUrl !== undefined
        ? { sourceImageUrl: input.image.thumbUrl }
        : {}),
    alt,
    credit,
    rightsStatus,
    ...(input.image.licenseShortName !== undefined
      ? { licenseShortName: input.image.licenseShortName }
      : {}),
    resourceLinks: [...resourceLinks, commonsLink],
  };
}

export type CommonsMediaDryRunCounts = Readonly<Record<CommonsMediaOutcome, number>> & {
  readonly total: number;
  readonly withQid: number;
  readonly autoProposeRate: number;
};

export function summarizeCommonsMediaProposes(
  proposes: readonly CommonsMediaPropose[],
): CommonsMediaDryRunCounts {
  const counts = Object.fromEntries(COMMONS_MEDIA_OUTCOMES.map((o) => [o, 0])) as Record<
    CommonsMediaOutcome,
    number
  >;
  let withQid = 0;
  for (const p of proposes) {
    counts[p.outcome] += 1;
    if (p.wikidataId) withQid += 1;
  }
  const total = proposes.length;
  return {
    ...counts,
    total,
    withQid,
    autoProposeRate: total === 0 ? 0 : counts.auto_propose / total,
  };
}

/** Chunk an array for Wikimedia batch APIs (default 50 titles/ids). */
export function chunkForWikimediaBatch<T>(items: readonly T[], size = 50): readonly (readonly T[])[] {
  if (size < 1) throw new Error('batch size must be >= 1');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function commonsFileTitleFromClaim(claim: WikidataClaim): string | undefined {
  const raw = claim.mainsnak.datavalue?.value;
  if (typeof raw === 'string' && raw.trim().length > 0) {
    const title = raw.trim();
    return title.startsWith('File:') ? title : `File:${title}`;
  }
  if (raw && typeof raw === 'object' && typeof raw.text === 'string' && raw.text.trim()) {
    const title = raw.text.trim();
    return title.startsWith('File:') ? title : `File:${title}`;
  }
  return undefined;
}

function claimRank(claim: WikidataClaim): CommonsP18Candidate['rank'] {
  const rank = (claim as { readonly rank?: string }).rank;
  if (rank === 'preferred' || rank === 'normal' || rank === 'deprecated') return rank;
  return 'unknown';
}

function stripHtml(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : undefined;
}
