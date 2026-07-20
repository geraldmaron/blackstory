/**
 * Builds the text an entity is embedded from, and the pre-filter fields (kind/state/eraBucket)
 * stored alongside its vector. Pure string/number logic no I/O.
 *
 * Decade-bucketing math delegates to @repo/domain's shared `deriveEraBuckets` (
 * packages/domain/src/era.ts) rather than duplicating it locally `deriveEraBucket` below is a
 * thin single-bucket adapter over that shared function, kept for this module's existing
 * single-value `eraBucket` pre-filter field (see ADR-014's composite vector indexes).
 */
import { deriveEraBuckets } from '@repo/domain';
import type { CanonicalEntityDoc, EntityKindDoc } from '../firestore/types.js';

/** Caller-resolved location context the pipeline does not itself geocode/resolve state. */
export type EntityLocationContext = {
  /** Two-letter US state code (or D.C.), already resolved by the caller. */
  readonly state?: string;
  /** Human-readable place label folded into the embedding text (city, region, etc.). */
  readonly placeLabel?: string;
};

export type EntityEmbeddingSource = Pick<CanonicalEntityDoc, 'kind' | 'displayName'> &
  Partial<
    Pick<
      CanonicalEntityDoc,
      | 'aliases'
      | 'person'
      | 'place'
      | 'school'
      | 'organization'
      | 'institution'
      | 'event'
      | 'law'
      | 'case'
      | 'publication'
      | 'artifact'
    >
  > & {
    /** Free-text summary when the caller has one that isn't already on a kind-specific field. */
    readonly summary?: string;
  };

function yearOf(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const match = /-?\d{1,4}/.exec(value);
  if (!match) return undefined;
  const year = Number.parseInt(match[0], 10);
  return Number.isFinite(year) ? year : undefined;
}

export type EntityYearSpan = {
  readonly startYear?: number;
  readonly endYear?: number;
};

function yearSpan(startYear: number | undefined, endYear: number | undefined): EntityYearSpan {
  return {
    ...(startYear !== undefined ? { startYear } : {}),
    ...(endYear !== undefined ? { endYear } : {}),
  };
}

/** Resolves a rough [startYear, endYear] temporal span for whichever kind fields are present. */
export function resolveEntityYearSpan(entity: EntityEmbeddingSource): EntityYearSpan {
  switch (entity.kind) {
    case 'person':
      return yearSpan(entity.person?.birthYear ?? undefined, entity.person?.deathYear ?? undefined);
    case 'organization':
      return yearSpan(
        entity.organization?.foundedYear ?? undefined,
        entity.organization?.dissolvedYear ?? undefined,
      );
    case 'institution':
      return yearSpan(
        entity.institution?.foundedYear ?? undefined,
        entity.institution?.closedYear ?? undefined,
      );
    case 'event':
      return yearSpan(yearOf(entity.event?.startAt), yearOf(entity.event?.endAt));
    case 'law':
      return yearSpan(yearOf(entity.law?.enactedAt), yearOf(entity.law?.repealedAt));
    case 'case':
      return yearSpan(yearOf(entity.case?.filedAt), yearOf(entity.case?.decidedAt));
    case 'publication':
      return yearSpan(yearOf(entity.publication?.publishedAt), undefined);
    case 'artifact':
      return yearSpan(yearOf(entity.artifact?.createdAtApprox), undefined);
    case 'school': {
      // SchoolFields.statusHistory was renamed to `milestones` to resolve a naming
      // collision with the new entity-level CanonicalEntity.statusHistory (see
      // packages/domain/src/school.ts).
      const founded = entity.school?.milestones?.find((entry) =>
        entry.status.toLowerCase().includes('found'),
      );
      return yearSpan(yearOf(founded?.at), undefined);
    }
    default:
      return {};
  }
}

/**
 * Buckets a year span into a single decade label ("1950s"), preferring the start year.
 * Undefined when no temporal anchor exists at all the pre-filter simply omits eraBucket for
 * those entities. This is a thin, single-bucket adapter over the shared
 * `deriveEraBuckets` (@repo/domain) — the anchor resolves to exactly one decade
 * because it is passed as a single-point span (no end), matching this function's pre-existing
 * anchor-only behavior. Multi-decade spans (e.g. a person's full birth–death range) are exposed
 * via the plural `deriveEraBuckets` directly for callers that want every overlapping decade,
 * not just the anchor's.
 */
export function deriveEraBucket(entity: EntityEmbeddingSource): string | undefined {
  const { startYear, endYear } = resolveEntityYearSpan(entity);
  const anchor = startYear ?? endYear;
  if (anchor === undefined || !Number.isFinite(anchor)) return undefined;
  const [bucket] = deriveEraBuckets({ validFrom: String(anchor), datePrecision: 'year' });
  return bucket;
}

export type EntityVectorFilters = {
  readonly kind: EntityKindDoc;
  readonly state?: string;
  readonly eraBucket?: string;
};

/** The three pre-filter fields the composite vector indexes are built around (see ADR-014). */
export function deriveEntityFilters(
  entity: EntityEmbeddingSource,
  location?: EntityLocationContext,
): EntityVectorFilters {
  const eraBucket = deriveEraBucket(entity);
  const state = location?.state?.trim().toUpperCase() || undefined;
  return {
    kind: entity.kind,
    ...(state ? { state } : {}),
    ...(eraBucket ? { eraBucket } : {}),
  };
}

function summaryFor(entity: EntityEmbeddingSource): string | undefined {
  if (entity.summary) return entity.summary;
  if (entity.kind === 'person' && entity.person?.biographySummary) {
    return entity.person.biographySummary;
  }
  return undefined;
}

function eraLabel(entity: EntityEmbeddingSource): string | undefined {
  const { startYear, endYear } = resolveEntityYearSpan(entity);
  if (startYear === undefined && endYear === undefined) return undefined;
  if (startYear !== undefined && endYear !== undefined && startYear !== endYear) {
    return `${startYear}–${endYear}`;
  }
  return `${startYear ?? endYear}`;
}

function placeLabelFor(
  entity: EntityEmbeddingSource,
  location?: EntityLocationContext,
): string | undefined {
  if (location?.placeLabel) return location.placeLabel;
  if (entity.kind === 'place' && entity.place?.historicalNames?.length) {
    return entity.place.historicalNames.join(', ');
  }
  return undefined;
}

/**
 * Concatenates title + summary + place/era context into the text that gets embedded.
 * Deterministic and whitespace-normalized so the same logical entity always produces the same
 * text (and, via sourceTextHash, lets the backfill skip re-embedding unchanged entities).
 */
export function buildEntityEmbeddingText(
  entity: EntityEmbeddingSource,
  location?: EntityLocationContext,
): string {
  const lines: string[] = [entity.displayName];

  if (entity.aliases?.length) {
    const aliasNames = entity.aliases.map((alias) => alias.value).filter(Boolean);
    if (aliasNames.length) lines.push(`Also known as: ${aliasNames.join(', ')}`);
  }

  const summary = summaryFor(entity);
  if (summary) lines.push(summary);

  const place = placeLabelFor(entity, location);
  if (place) lines.push(`Place: ${place}`);

  const era = eraLabel(entity);
  if (era) lines.push(`Era: ${era}`);

  return lines
    .map((line) => line.normalize('NFKC').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}
