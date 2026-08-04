/**
 * Parsing, validation, and SQL for a single canonical field edit.
 *
 * Kept pure and separate from the server action so the rules that decide what an operator may
 * write are testable without a request or a database. The action layer only supplies identity,
 * the audit wrapper, and revalidation.
 *
 * Every builder here targets exactly one entity by id and touches only the column it names, so a
 * malformed edit cannot widen into a table-wide UPDATE. Values are always bound, never
 * interpolated.
 */
import { SENSITIVITY_CLASSES, type SensitivityClass } from '@repo/domain';
import {
  ENTITY_KINDS,
  LIVING_STATUSES,
  entityClassForKind,
  isEntityKind,
  type EntityKind,
  type LivingStatus,
} from './entity-vocabulary.js';

export const EDITABLE_FIELDS = [
  'displayName',
  'kind',
  'livingStatus',
  'aliases',
  'sensitivity',
  'identifierAdd',
  'identifierRemove',
] as const;

export type EditableField = (typeof EDITABLE_FIELDS)[number];

export type EntityFieldEdit =
  | { readonly field: 'displayName'; readonly value: string }
  | { readonly field: 'kind'; readonly value: EntityKind }
  | { readonly field: 'livingStatus'; readonly value: LivingStatus }
  | { readonly field: 'aliases'; readonly value: readonly string[] }
  | { readonly field: 'sensitivity'; readonly value: readonly SensitivityClass[] }
  | {
      readonly field: 'identifierAdd';
      readonly value: {
        readonly namespace: string;
        readonly value: string;
        readonly trusted: boolean;
      };
    }
  | { readonly field: 'identifierRemove'; readonly value: { readonly id: string } };

export type ParsedEntityEdit =
  | { readonly ok: true; readonly edit: EntityFieldEdit }
  | { readonly ok: false; readonly message: string };

/** Display names are single-line; a pasted newline would render as a broken row everywhere. */
const MAX_DISPLAY_NAME = 300;
const MAX_ALIASES = 50;
const MAX_ALIAS_LENGTH = 300;
const MAX_IDENTIFIER_LENGTH = 200;

export type EditFormValues = {
  readonly get: (name: string) => string | null;
  readonly getAll: (name: string) => readonly string[];
};

/** Reads a FormData-shaped source without depending on the DOM/undici FormData type. */
export function editValuesFromFormData(formData: {
  get(name: string): unknown;
  getAll(name: string): readonly unknown[];
}): EditFormValues {
  return {
    get: (name) => {
      const value = formData.get(name);
      return typeof value === 'string' ? value : null;
    },
    getAll: (name) =>
      formData.getAll(name).filter((value): value is string => typeof value === 'string'),
  };
}

function parseAliasesInput(raw: string): ParsedEntityEdit {
  // One alias per line: the only separator that can appear inside a real alias is a comma
  // ("Chicago, Illinois"), so splitting on commas would silently shred names.
  const aliases = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const deduped = [...new Set(aliases)];
  if (deduped.length > MAX_ALIASES) {
    return { ok: false, message: `An entity may carry at most ${MAX_ALIASES} aliases.` };
  }
  const tooLong = deduped.find((alias) => alias.length > MAX_ALIAS_LENGTH);
  if (tooLong) {
    return { ok: false, message: `Alias is longer than ${MAX_ALIAS_LENGTH} characters.` };
  }
  return { ok: true, edit: { field: 'aliases', value: deduped } };
}

export function parseEntityFieldEdit(values: EditFormValues): ParsedEntityEdit {
  const field = values.get('field');
  if (!field || !(EDITABLE_FIELDS as readonly string[]).includes(field)) {
    return { ok: false, message: `Unknown field: ${field ?? '(none)'}` };
  }

  switch (field as EditableField) {
    case 'displayName': {
      const value = (values.get('value') ?? '').trim().replace(/\s+/g, ' ');
      if (!value) return { ok: false, message: 'A display name is required.' };
      if (value.length > MAX_DISPLAY_NAME) {
        return {
          ok: false,
          message: `Display name is longer than ${MAX_DISPLAY_NAME} characters.`,
        };
      }
      return { ok: true, edit: { field: 'displayName', value } };
    }

    case 'kind': {
      const value = (values.get('value') ?? '').trim();
      if (!isEntityKind(value)) {
        return { ok: false, message: `Kind must be one of: ${ENTITY_KINDS.join(', ')}.` };
      }
      return { ok: true, edit: { field: 'kind', value } };
    }

    case 'livingStatus': {
      const value = (values.get('value') ?? '').trim();
      if (!(LIVING_STATUSES as readonly string[]).includes(value)) {
        return {
          ok: false,
          message: `Living status must be one of: ${LIVING_STATUSES.join(', ')}.`,
        };
      }
      return { ok: true, edit: { field: 'livingStatus', value: value as LivingStatus } };
    }

    case 'aliases':
      return parseAliasesInput(values.get('value') ?? '');

    case 'sensitivity': {
      const selected = [...new Set(values.getAll('sensitivity').map((value) => value.trim()))];
      const unknown = selected.find(
        (value) => !(SENSITIVITY_CLASSES as readonly string[]).includes(value),
      );
      if (unknown) {
        return { ok: false, message: `Unknown sensitivity class: ${unknown}` };
      }
      return {
        ok: true,
        edit: { field: 'sensitivity', value: selected as readonly SensitivityClass[] },
      };
    }

    case 'identifierAdd': {
      const namespace = (values.get('namespace') ?? '').trim();
      const value = (values.get('identifierValue') ?? '').trim();
      if (!namespace) return { ok: false, message: 'An identifier namespace is required.' };
      if (!value) return { ok: false, message: 'An identifier value is required.' };
      if (namespace.length > MAX_IDENTIFIER_LENGTH || value.length > MAX_IDENTIFIER_LENGTH) {
        return {
          ok: false,
          message: 'Identifier namespace and value must be under 200 characters.',
        };
      }
      const trusted = values.get('trusted') === 'on' || values.get('trusted') === '1';
      return { ok: true, edit: { field: 'identifierAdd', value: { namespace, value, trusted } } };
    }

    case 'identifierRemove': {
      const id = (values.get('identifierId') ?? '').trim();
      if (!id) return { ok: false, message: 'An identifier id is required.' };
      return { ok: true, edit: { field: 'identifierRemove', value: { id } } };
    }
  }
}

export type EditStatement = {
  readonly sql: string;
  readonly params: readonly unknown[];
  /**
   * When set, the statement must affect at least one row or the whole edit is rejected with this
   * message. Used where "zero rows" means a real conflict rather than a no-op.
   */
  readonly requireRowsElse?: string;
};

export type EditStatementOptions = {
  /** New primary key for an inserted row; `entity_identifiers.id` is a UUID, not a composite. */
  readonly newId: string;
};

const MISSING_ENTITY = 'That entity no longer exists — it may have been merged away.';

/**
 * The statements that apply an edit to one entity. Returns a list because a kind change is two
 * writes: `kind` and the `entity_class` it implies must move together or the row lands in the
 * wrong facet bucket permanently.
 */
export function buildEditStatements(
  entityId: string,
  edit: EntityFieldEdit,
  options: EditStatementOptions,
): readonly EditStatement[] {
  const touch = `updated_at = now()`;

  switch (edit.field) {
    case 'displayName':
      return [
        {
          sql: `UPDATE bb_canonical.entities SET display_name = $2, ${touch} WHERE id = $1`,
          params: [entityId, edit.value],
          requireRowsElse: MISSING_ENTITY,
        },
      ];

    case 'kind':
      return [
        {
          sql: `UPDATE bb_canonical.entities SET kind = $2, entity_class = $3, ${touch} WHERE id = $1`,
          params: [entityId, edit.value, entityClassForKind(edit.value)],
          requireRowsElse: MISSING_ENTITY,
        },
      ];

    case 'livingStatus':
      return [
        {
          sql: `UPDATE bb_canonical.entities SET living_status = $2, ${touch} WHERE id = $1`,
          params: [entityId, edit.value],
          requireRowsElse: MISSING_ENTITY,
        },
      ];

    case 'aliases':
      return [
        {
          sql: `UPDATE bb_canonical.entities SET aliases = $2::jsonb, ${touch} WHERE id = $1`,
          params: [entityId, JSON.stringify(edit.value)],
          requireRowsElse: MISSING_ENTITY,
        },
      ];

    case 'sensitivity':
      return [
        {
          sql: `UPDATE bb_canonical.entities SET sensitivity = $2::jsonb, ${touch} WHERE id = $1`,
          params: [entityId, JSON.stringify(edit.value.map((value) => ({ class: value })))],
          requireRowsElse: MISSING_ENTITY,
        },
      ];

    case 'identifierAdd':
      return [
        {
          // `UNIQUE (namespace, value)` is global, not per entity: an external identifier names
          // exactly one entity in the archive. So re-adding this entity's own identifier just
          // updates its trust flag, while one already claimed by a different entity updates zero
          // rows — and that must surface as a refusal, not a silent no-op that looks like success.
          sql: `INSERT INTO bb_canonical.entity_identifiers (id, entity_id, namespace, value, trusted)
                VALUES ($2, $1, $3, $4, $5)
                ON CONFLICT (namespace, value) DO UPDATE SET trusted = EXCLUDED.trusted
                WHERE bb_canonical.entity_identifiers.entity_id = $1
                RETURNING id`,
          params: [
            entityId,
            options.newId,
            edit.value.namespace,
            edit.value.value,
            edit.value.trusted,
          ],
          requireRowsElse: `${edit.value.namespace}:${edit.value.value} already belongs to a different entity. Identifiers are unique across the archive — merge the two records instead.`,
        },
        {
          sql: `UPDATE bb_canonical.entities SET ${touch} WHERE id = $1`,
          params: [entityId],
        },
      ];

    case 'identifierRemove':
      return [
        {
          // Scoped by entity_id as well as id: an id from another entity's form must not delete.
          sql: `DELETE FROM bb_canonical.entity_identifiers WHERE id = $2 AND entity_id = $1`,
          params: [entityId, edit.value.id],
          requireRowsElse: 'That identifier is no longer on this entity — reload and try again.',
        },
        {
          sql: `UPDATE bb_canonical.entities SET ${touch} WHERE id = $1`,
          params: [entityId],
        },
      ];
  }
}

/** Human label for the audit record and the page's confirmation line. */
export function describeEdit(edit: EntityFieldEdit): string {
  switch (edit.field) {
    case 'displayName':
      return 'display name';
    case 'kind':
      return 'kind';
    case 'livingStatus':
      return 'living status';
    case 'aliases':
      return 'aliases';
    case 'sensitivity':
      return 'sensitivity';
    case 'identifierAdd':
      return `identifier ${edit.value.namespace}`;
    case 'identifierRemove':
      return 'identifier';
  }
}

/** The `before` half of the audit record, read off the current detail. */
export function beforeValueFor(
  edit: EntityFieldEdit,
  current: {
    readonly displayName: string;
    readonly kind: string;
    readonly entityClass?: string;
    readonly livingStatus: string;
    readonly aliases: readonly string[];
    readonly sensitivity: readonly { readonly class: string }[];
    readonly identifiers: readonly {
      readonly id: string;
      readonly namespace: string;
      readonly value: string;
    }[];
  },
): unknown {
  switch (edit.field) {
    case 'displayName':
      return current.displayName;
    case 'kind':
      return { kind: current.kind, entityClass: current.entityClass ?? null };
    case 'livingStatus':
      return current.livingStatus;
    case 'aliases':
      return current.aliases;
    case 'sensitivity':
      return current.sensitivity.map((entry) => entry.class);
    case 'identifierAdd':
      return current.identifiers.map((identifier) => `${identifier.namespace}:${identifier.value}`);
    case 'identifierRemove': {
      const target = current.identifiers.find((identifier) => identifier.id === edit.value.id);
      return target ? `${target.namespace}:${target.value}` : null;
    }
  }
}

/** The `after` half, derived from the edit itself. */
export function afterValueFor(edit: EntityFieldEdit): unknown {
  switch (edit.field) {
    case 'kind':
      return { kind: edit.value, entityClass: entityClassForKind(edit.value) };
    case 'identifierAdd':
      return `${edit.value.namespace}:${edit.value.value}`;
    case 'identifierRemove':
      return null;
    default:
      return edit.value;
  }
}
