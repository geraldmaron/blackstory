/**
 * repo-el9p (WS3) — write `projection.visit` onto the active release from canonical data.
 *
 * The release builder emits `visit` through `publicVisitForTier`, but the incremental publish
 * path still builds its entries from landscape rows and never reads `bb_canonical.entity_visit`
 * or `entity_locations.street` (tracked as a follow-up bead). Until that lands, this script is
 * the one path that carries the backfilled contact and address data into the public row, using
 * the very same gate so the projection can never say more than the builder would.
 *
 * Inputs, per active-release entity:
 *   - bb_canonical.entity_visit (phone, website, hours, visitability, source_ids)
 *   - bb_canonical.entity_locations (street, postal_code) — the first row per entity
 *   - bb_public.release_entities.projection (kind, livingStatus, location.precision,
 *     jurisdictionLabel for city/state)
 *
 * Output: `UPDATE bb_public.release_entities SET projection = jsonb_set(projection, '{visit}', …)`
 * for entities whose gated visit is non-empty; `visit` is removed where it gates to nothing.
 * The release-catalog watermark trigger marks the artifacts dirty on write.
 *
 * Default is dry-run. Apply requires:
 *   DRY_RUN=0 SYNC_VISIT_APPLY=1
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   node --conditions development --import tsx packages/ops-data/scripts/sync-visit-to-projection.ts
 */
import pg from 'pg';
import { publicVisitForTier, type PublicVisit } from '@repo/domain';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.SYNC_VISIT_APPLY === '1';

type Row = {
  readonly entity_id: string;
  readonly kind: string;
  readonly living_status: string | null;
  readonly precision: string | null;
  readonly jurisdiction_label: string | null;
  readonly has_visit: boolean;
  readonly phone_e164: string | null;
  readonly phone_display: string | null;
  readonly website: string | null;
  readonly hours: string | null;
  readonly visitability: string | null;
  readonly source_ids: readonly string[] | null;
  readonly street: string | null;
  readonly postal_code: string | null;
};

/** "Washington, DC" → { city: 'Washington', state: 'DC' }; anything else stays unsplit. */
export function cityStateFromJurisdiction(label: string | null): {
  readonly city?: string;
  readonly state?: string;
} {
  if (!label) return {};
  const parts = label
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const state = parts[parts.length - 1];
    const city = parts.slice(0, -1).join(', ');
    return { city, ...(state ? { state } : {}) };
  }
  return parts[0] ? { city: parts[0] } : {};
}

/**
 * E.164 from whatever the source stored. Wikidata P1329 values arrive as display strings such
 * as "+1-212-491-2200"; the backfill kept the display form only, so derive the E.164 form here
 * when the number already carries its country code. Anything without a leading + is left out
 * rather than guessed.
 */
export function phoneFromRow(row: {
  readonly phone_e164: string | null;
  readonly phone_display: string | null;
}): { readonly phone?: { readonly e164: string; readonly display: string } } {
  const display = row.phone_display?.trim();
  if (!display) return {};
  const e164 =
    row.phone_e164?.trim() || (display.startsWith('+') ? display.replace(/[^\d+]/g, '') : '');
  if (!/^\+\d{8,15}$/.test(e164)) return {};
  return { phone: { e164, display } };
}

/** Raw visit from canonical rows, before the tier gate. Empty → undefined. */
export function rawVisitFromRow(row: Row): PublicVisit | undefined {
  const address = {
    ...(row.street ? { street: row.street } : {}),
    ...cityStateFromJurisdiction(row.jurisdiction_label),
    ...(row.postal_code ? { postalCode: row.postal_code } : {}),
  };
  const hasAddress = Boolean(row.street || row.postal_code);
  const visit: PublicVisit = {
    ...(hasAddress ? { address } : {}),
    ...phoneFromRow(row),
    ...(row.website ? { website: row.website } : {}),
    ...(row.hours ? { hours: row.hours } : {}),
    ...(row.visitability &&
    ['open_to_public', 'exterior_only', 'private', 'demolished', 'unknown'].includes(
      row.visitability,
    )
      ? { visitability: row.visitability as PublicVisit['visitability'] }
      : {}),
    ...(row.source_ids && row.source_ids.length > 0 ? { sources: row.source_ids } : {}),
  };
  return Object.keys(visit).length > 0 ? visit : undefined;
}

async function main(): Promise<void> {
  const raw = process.env.DATABASE_URL ?? process.env.APP_DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is required');
  const { connectionString, ssl } = normalizePgConnectionString(raw);
  const pool = new pg.Pool({ connectionString, ...(ssl ? { ssl } : {}), max: 2 });

  const { rows } = await pool.query<Row>(
    `SELECT re.entity_id,
            re.projection->>'kind' AS kind,
            re.projection->>'livingStatus' AS living_status,
            re.projection->'location'->>'precision' AS precision,
            re.projection->>'jurisdictionLabel' AS jurisdiction_label,
            (v.entity_id IS NOT NULL) AS has_visit,
            v.phone_e164, v.phone_display, v.website, v.hours, v.visitability, v.source_ids,
            l.street, l.postal_code
       FROM bb_public.release_entities re
       JOIN bb_public.active_release r ON r.id = 'active' AND r.release_id = re.release_id
       LEFT JOIN bb_canonical.entity_visit v ON v.entity_id = re.entity_id
       LEFT JOIN LATERAL (
         SELECT street, postal_code
           FROM bb_canonical.entity_locations el
          WHERE el.entity_id = re.entity_id
            AND (el.street IS NOT NULL OR el.postal_code IS NOT NULL)
          ORDER BY el.updated_at DESC
          LIMIT 1
       ) l ON true
      WHERE v.entity_id IS NOT NULL OR l.street IS NOT NULL OR l.postal_code IS NOT NULL`,
  );

  const counts = {
    candidates: rows.length,
    published: 0,
    withStreet: 0,
    withPhone: 0,
    withWebsite: 0,
    gatedToNothing: 0,
  };
  const plan: { entityId: string; visit: PublicVisit }[] = [];
  for (const row of rows) {
    const gated = publicVisitForTier(
      rawVisitFromRow(row),
      row.precision ?? 'city',
      row.kind,
      row.living_status ?? undefined,
    );
    if (!gated) {
      counts.gatedToNothing += 1;
      continue;
    }
    counts.published += 1;
    if (gated.address?.street) counts.withStreet += 1;
    if (gated.phone) counts.withPhone += 1;
    if (gated.website) counts.withWebsite += 1;
    plan.push({ entityId: row.entity_id, visit: gated });
  }

  console.log(counts);
  console.log(
    'Samples:',
    JSON.stringify(plan.slice(0, 3), null, 1).split('\n').slice(0, 40).join('\n'),
  );

  if (DRY_RUN || !APPLY) {
    console.log(
      '\nDRY_RUN=1 (default): no database writes. Set DRY_RUN=0 SYNC_VISIT_APPLY=1 to apply.',
    );
    await pool.end();
    return;
  }

  let applied = 0;
  for (const item of plan) {
    await pool.query(
      `UPDATE bb_public.release_entities
          SET projection = jsonb_set(projection, '{visit}', $2::jsonb, true)
        WHERE entity_id = $1
          AND release_id = (SELECT release_id FROM bb_public.active_release WHERE id = 'active')`,
      [item.entityId, JSON.stringify(item.visit)],
    );
    applied += 1;
  }
  console.log(`Applied projection.visit on ${applied} entities.`);
  await pool.end();
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '');
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
