/**
 * Point-in-time status resolution for decade views. Uses `statusAsOf` against
 * published `statusHistory` never present-day `entity.status` when rendering a decade slice.
 */
import { statusAsOf, type EntityStatusValue, type StatusHistoryEntry } from '@blap/domain/entity-status';
import type { PublicEntityView } from '../../data/public-seed';

/** Mid-decade representative year for status-as-of queries ("1950s" → "1955").  */
export function decadeRepresentativeYear(decade: string): string {
  const match = /^(\d{4})s$/.exec(decade);
  if (!match) return decade;
  const start = Number.parseInt(match[1]!, 10);
  return String(start + 5);
}

export type DecadeStatusResult =
  | { readonly kind: 'status'; readonly label: string; readonly asOf: string }
  | { readonly kind: 'event-window'; readonly label: string }
  | { readonly kind: 'undated'; readonly label: string };

function humanizeToken(value: string): string {
  return value
    .split('_')
    .map((word) => (word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

function formatEventWindow(entity: PublicEntityView): string {
  const window = entity.eventWindow;
  if (!window?.startAt) return 'Undated event';
  if (!window.endAt) return `Occurred ${window.startAt}`;
  return `${window.startAt} – ${window.endAt}`;
}

/**
 * Resolves the status label an entity should show in a decade view point-in-time from
 * `statusHistory`, event when-span for events, or an explicit undated gap label.
 */
export function resolveDecadeStatusLabel(
  entity: PublicEntityView,
  decade: string,
): DecadeStatusResult {
  if (entity.kind === 'event') {
    return { kind: 'event-window', label: formatEventWindow(entity) };
  }

  const history = entity.statusHistory as readonly StatusHistoryEntry<EntityStatusValue>[] | undefined;
  if (!history || history.length === 0) {
    return { kind: 'undated', label: 'Status not yet published for this record' };
  }

  const asOf = decadeRepresentativeYear(decade);
  const status = statusAsOf(history, asOf);
  if (!status) {
    return {
      kind: 'undated',
      label: `No published status designation as of the ${decade}`,
    };
  }

  return {
    kind: 'status',
    label: humanizeToken(status),
    asOf,
  };
}

/** All-time view uses present-day derived status for place-like kinds (open-ended record).  */
export function resolveAllTimeStatusLabel(entity: PublicEntityView): DecadeStatusResult {
  if (entity.kind === 'event') {
    return { kind: 'event-window', label: formatEventWindow(entity) };
  }
  if (entity.status) {
    return { kind: 'status', label: humanizeToken(entity.status), asOf: 'present release' };
  }
  return { kind: 'undated', label: 'Status not yet published for this record' };
}
