/** Converts public search-index records into entity-embedding input. */
import { US_STATES } from '@repo/domain';
import type { EntityKindDoc } from '../records/types.js';
import type { EntityEmbeddingInput } from './pipeline.js';

const STATE_BY_NAME = new Map(
  US_STATES.map((state) => [state.name.toLowerCase(), state.postalCode]),
);
const STATE_BY_POSTAL = new Map(US_STATES.map((state) => [state.postalCode, state.postalCode]));

const ENTITY_KINDS = new Set<string>([
  'person',
  'place',
  'school',
  'organization',
  'institution',
  'event',
  'law',
  'case',
  'publication',
  'artifact',
  'movement',
  'invention',
  'other',
]);

export type SearchIndexEmbeddingRecord = {
  readonly id?: string;
  readonly kind?: string;
  readonly displayName?: string;
  readonly summary?: string;
  readonly aliases?: readonly string[];
  readonly jurisdictionState?: string;
  readonly eraBuckets?: readonly string[];
};

/** Resolves a 2-letter US state/DC code from a jurisdiction label like "City, Pennsylvania". */
export function parseStateCodeFromJurisdiction(label: string | undefined): string | undefined {
  if (!label || !label.trim()) return undefined;
  const tail = label.split(',').pop()?.trim() ?? '';
  if (!tail) return undefined;
  if (/^d\.?c\.?$/i.test(tail) || /district of columbia/i.test(tail)) {
    return 'DC';
  }
  if (/^[A-Za-z]{2}$/.test(tail)) {
    return STATE_BY_POSTAL.get(tail.toUpperCase());
  }
  return STATE_BY_NAME.get(tail.toLowerCase());
}

function asEntityKind(kind: string | undefined): EntityKindDoc {
  if (kind && ENTITY_KINDS.has(kind)) return kind as EntityKindDoc;
  return 'other';
}

/**
 * Maps a publicSearchIndex-shaped record into an embedding input.
 * `docId` is the record identifier (preferred entity id).
 */
export function mapSearchIndexRecordToEmbeddingInput(
  docId: string,
  data: SearchIndexEmbeddingRecord,
): EntityEmbeddingInput | undefined {
  const displayName =
    typeof data.displayName === 'string' && data.displayName.trim()
      ? data.displayName.trim()
      : undefined;
  if (!displayName) return undefined;

  const entityId = typeof data.id === 'string' && data.id.trim() ? data.id.trim() : docId.trim();
  if (!entityId) return undefined;

  const aliases = Array.isArray(data.aliases)
    ? data.aliases.filter(
        (alias): alias is string => typeof alias === 'string' && alias.trim().length > 0,
      )
    : undefined;
  const summary =
    typeof data.summary === 'string' && data.summary.trim() ? data.summary.trim() : undefined;
  const state = parseStateCodeFromJurisdiction(
    typeof data.jurisdictionState === 'string' ? data.jurisdictionState : undefined,
  );
  const placeLabel =
    typeof data.jurisdictionState === 'string' && data.jurisdictionState.trim()
      ? data.jurisdictionState.trim()
      : undefined;

  return {
    entityId,
    entity: {
      kind: asEntityKind(data.kind),
      displayName,
      ...(summary !== undefined ? { summary } : {}),
      ...(aliases !== undefined && aliases.length > 0
        ? { aliases: aliases.map((value) => ({ value })) }
        : {}),
    },
    ...(state !== undefined || placeLabel !== undefined
      ? {
          location: {
            ...(state !== undefined ? { state } : {}),
            ...(placeLabel !== undefined ? { placeLabel } : {}),
          },
        }
      : {}),
  };
}
