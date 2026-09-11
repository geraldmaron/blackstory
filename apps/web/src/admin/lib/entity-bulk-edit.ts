/**
 * Bulk field edits across a selected set of canonical entities.
 *
 * Pure: parsing, validation, and the SQL each edit implies. The transaction lives in the server
 * action, inside `commitCanonicalWrite`.
 *
 * Two decisions worth stating, because they are what make this different from looping the
 * single-entity path:
 *
 * 1. **One statement, one transaction, one audit event.** The existing bulk-decision path commits
 *    once per entity, which is why it is capped at 50 — 4,000 transactions from a server action is
 *    not a thing that finishes. A set-based UPDATE costs the same whether it touches 5 rows or
 *    5,000, so the cap here is about how much an operator should be able to change with one click,
 *    not about what the database can do.
 *
 * 2. **The set is pinned to explicit ids, not re-derived from the filter.** The operator confirmed
 *    a specific count against a specific set. Re-running the filter at apply time would silently
 *    include rows that drifted into it since, which is exactly the surprise a confirm step exists
 *    to prevent.
 */
import { entityClassForKind, isEntityKind, LIVING_STATUSES } from './entity-vocabulary.js';
import type { EntityKind, LivingStatus } from './entity-vocabulary.js';

/**
 * The most rows one bulk edit may touch. Matches the select-all-matching cap in
 * `queryMatchingEntityIds`, so anything an operator can select, they can act on.
 */
export const MAX_BULK_ENTITIES = 10_000;

/** Above this, applying asks for explicit confirmation rather than acting on a single click. */
export const BULK_CONFIRM_THRESHOLD = 250;

export const BULK_FIELDS = ['kind', 'livingStatus', 'sensitivity'] as const;
export type BulkField = (typeof BULK_FIELDS)[number];

export type BulkEdit =
  | { readonly field: 'kind'; readonly kind: EntityKind; readonly entityClass: string | null }
  | { readonly field: 'livingStatus'; readonly livingStatus: LivingStatus }
  | { readonly field: 'sensitivity'; readonly classes: readonly string[] };

export type ParsedBulkEdit =
  { readonly ok: true; readonly edit: BulkEdit } | { readonly ok: false; readonly message: string };

export function parseBulkEdit(
  field: string,
  value: string,
  sensitivityClasses: readonly string[],
  selectedSensitivity: readonly string[] = [],
): ParsedBulkEdit {
  switch (field) {
    case 'kind': {
      if (!isEntityKind(value)) {
        return { ok: false, message: `"${value}" is not a kind this archive uses.` };
      }
      // Class is derived, never posted: the form cannot offer a kind/class pair that disagrees.
      return {
        ok: true,
        edit: { field: 'kind', kind: value, entityClass: entityClassForKind(value) },
      };
    }
    case 'livingStatus': {
      if (!(LIVING_STATUSES as readonly string[]).includes(value)) {
        return { ok: false, message: `"${value}" is not a living status this archive uses.` };
      }
      return { ok: true, edit: { field: 'livingStatus', livingStatus: value as LivingStatus } };
    }
    case 'sensitivity': {
      const allowed = new Set(sensitivityClasses);
      const chosen = [...new Set(selectedSensitivity.filter((entry) => allowed.has(entry)))];
      if (chosen.length !== new Set(selectedSensitivity).size) {
        return { ok: false, message: 'One of those sensitivity classes is not in the vocabulary.' };
      }
      return { ok: true, edit: { field: 'sensitivity', classes: chosen } };
    }
    default:
      return { ok: false, message: `"${field}" cannot be edited in bulk.` };
  }
}

export function normalizeBulkIds(ids: readonly string[]): readonly string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

export type BulkIdCheck =
  | { readonly ok: true; readonly ids: readonly string[] }
  | { readonly ok: false; readonly message: string };

export function checkBulkIds(ids: readonly string[]): BulkIdCheck {
  const normalized = normalizeBulkIds(ids);
  if (normalized.length === 0) {
    return { ok: false, message: 'Select at least one record.' };
  }
  if (normalized.length > MAX_BULK_ENTITIES) {
    return {
      ok: false,
      message: `A single bulk edit changes at most ${MAX_BULK_ENTITIES.toLocaleString()} records; ${normalized.length.toLocaleString()} were selected.`,
    };
  }
  return { ok: true, ids: normalized };
}

/**
 * The column expression an edit assigns. Absorbed rows are excluded in the WHERE: they are merge
 * tombstones pointing at a survivor, and editing one changes nothing anyone reads.
 */
export function bulkUpdateStatement(
  ids: readonly string[],
  edit: BulkEdit,
): { readonly sql: string; readonly params: readonly unknown[] } {
  const guard = `WHERE id = ANY($1::text[])
      AND (merge_state IS NULL OR merge_state->>'status' IS DISTINCT FROM 'absorbed')`;

  switch (edit.field) {
    case 'kind':
      return {
        sql: `UPDATE bb_canonical.entities
              SET kind = $2, entity_class = $3, updated_at = now()
              ${guard}
              RETURNING id`,
        params: [ids, edit.kind, edit.entityClass],
      };
    case 'livingStatus':
      return {
        sql: `UPDATE bb_canonical.entities
              SET living_status = $2, updated_at = now()
              ${guard}
              RETURNING id`,
        params: [ids, edit.livingStatus],
      };
    case 'sensitivity':
      return {
        sql: `UPDATE bb_canonical.entities
              SET sensitivity = $2::jsonb, updated_at = now()
              ${guard}
              RETURNING id`,
        params: [ids, JSON.stringify(edit.classes.map((entry) => ({ class: entry })))],
      };
  }
}

/**
 * Reads the values about to be overwritten, grouped by value rather than listed per row. A
 * thousand rows moving from `institution` to `organization` is one group holding a thousand ids,
 * not a thousand before/after pairs — which keeps the audit event a readable size while still
 * carrying everything an un-do would need.
 */
export function bulkBeforeStatement(
  ids: readonly string[],
  field: BulkField,
): { readonly sql: string; readonly params: readonly unknown[] } {
  const expression =
    field === 'kind'
      ? `kind || '|' || coalesce(entity_class, '')`
      : field === 'livingStatus'
        ? 'living_status'
        : 'sensitivity::text';
  return {
    sql: `SELECT ${expression} AS value, array_agg(id ORDER BY id) AS ids
          FROM bb_canonical.entities
          WHERE id = ANY($1::text[])
            AND (merge_state IS NULL OR merge_state->>'status' IS DISTINCT FROM 'absorbed')
          GROUP BY 1
          ORDER BY 1`,
    params: [ids],
  };
}

export function describeBulkEdit(edit: BulkEdit): string {
  switch (edit.field) {
    case 'kind':
      return `kind to ${edit.kind}${edit.entityClass ? ` (class ${edit.entityClass})` : ' (no class)'}`;
    case 'livingStatus':
      return `living status to ${edit.livingStatus.replace(/_/g, ' ')}`;
    case 'sensitivity':
      return edit.classes.length === 0
        ? 'sensitivity to none'
        : `sensitivity to ${edit.classes.join(', ')}`;
  }
}

/** The verb each field commits under. Kind gets its own so the log reads as what happened. */
export function bulkVerbFor(
  field: BulkField,
): 'entity.bulk_kind_reassign' | 'entity.bulk_field_edit' {
  return field === 'kind' ? 'entity.bulk_kind_reassign' : 'entity.bulk_field_edit';
}
