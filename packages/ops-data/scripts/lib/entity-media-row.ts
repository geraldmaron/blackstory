/**
 * Pure row-shaping for pin-commons-primary-images.ts's Postgres apply path (repo-4vuf, WS5).
 *
 * Kept separate from the script so the shape of what gets written — the release_entities
 * `projection.primaryImage` jsonb object and the bb_canonical.entity_media upsert row — is
 * testable without a database connection. Both builders are deliberately dumb: no gating, no
 * defaults beyond what the caller passes in. Gating (dignity, place-kind, missing fields)
 * happens earlier, in evaluatePinGate; sanitizePrimaryImageForRelease (imported by the script,
 * not here, to avoid this module depending on @repo/domain) is the last-line rights/alt/credit
 * check applied to buildPrimaryImageForRelease's output before either write happens.
 */
import type { PinPlanRow } from './pin-commons-primary-images-plan.ts';

/** Matches @repo/domain-core's PublicEntityPrimaryImage shape (kept structural, not imported,
 * so this file has zero package dependencies beyond its sibling plan-row type). */
export type PrimaryImageFields = {
  readonly url: string;
  readonly alt: string;
  readonly credit: string;
  readonly rightsStatus: 'public_domain' | 'licensed' | 'fair_use';
  readonly sourceSystem: 'wikimedia_commons';
  readonly fileTitle: string;
  readonly sha1?: string;
  readonly sourcePageUrl: string;
  readonly license?: string;
  readonly pinnedAt: string;
};

/**
 * Build the primaryImage fields for one pin-plan row. Pure function of the row + the rights
 * status the gate already resolved (evaluatePinGate never lets a row through without a
 * `rightsStatus`, but that field lives on the source CommonsAutoProposeRow, not PinPlanRow —
 * see the script's rightsStatusByEntityId map) + a pinnedAt timestamp the caller supplies so
 * this stays deterministic and testable (no `new Date()` inside).
 */
export function buildPrimaryImageForRelease(
  row: PinPlanRow,
  rightsStatus: 'public_domain' | 'licensed' | 'fair_use',
  pinnedAt: string,
): PrimaryImageFields {
  return {
    url: row.url,
    alt: row.alt,
    credit: row.credit,
    rightsStatus,
    sourceSystem: 'wikimedia_commons',
    fileTitle: row.fileTitle,
    ...(row.sha1 !== undefined ? { sha1: row.sha1 } : {}),
    sourcePageUrl: row.sourcePageUrl,
    ...(row.license !== undefined ? { license: row.license } : {}),
    pinnedAt,
  };
}

/** One row for the `bb_canonical.entity_media` upsert (snake_case, matching the migration's
 * column names 1:1) — the canonical counterpart to the release_entities projection patch. */
export type EntityMediaRow = {
  readonly entityId: string;
  readonly role: 'primary';
  readonly sourceSystem: string;
  readonly fileTitle: string;
  readonly sha1: string | null;
  readonly sourcePageUrl: string;
  readonly license: string | null;
  readonly credit: string;
  readonly alt: string;
  readonly url: string;
  readonly pinnedAt: string;
};

/** Build the bb_canonical.entity_media row for one entity from its resolved primaryImage. */
export function buildEntityMediaRow(entityId: string, image: PrimaryImageFields): EntityMediaRow {
  return {
    entityId,
    role: 'primary',
    sourceSystem: image.sourceSystem,
    fileTitle: image.fileTitle,
    sha1: image.sha1 ?? null,
    sourcePageUrl: image.sourcePageUrl,
    license: image.license ?? null,
    credit: image.credit,
    alt: image.alt,
    url: image.url,
    pinnedAt: image.pinnedAt,
  };
}
