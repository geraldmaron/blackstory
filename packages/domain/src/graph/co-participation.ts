/**
 * Co-participation inference: derive person↔person (and org) associations through shared
 * events. Same-event co-participation is the strongest deterministic tier for WS4 — the
 * event itself is the assertion; no separate review edge is required.
 */
export type EventParticipationRow = {
  readonly eventId: string;
  readonly participantId: string;
  readonly role: string;
  readonly statusAtEvent?: string | null;
};

export type CoParticipationLink = {
  readonly entityAId: string;
  readonly entityBId: string;
  readonly eventId: string;
  readonly rolesA: readonly string[];
  readonly rolesB: readonly string[];
};

export type CoParticipationNeighbor = {
  readonly neighborId: string;
  readonly eventId: string;
  readonly eventDisplayName: string;
  readonly neighborRole: string;
  readonly entityRole: string;
};

export type BuildCoParticipationLinksOptions = {
  /** When set, only emit links for these participant kinds (default: person + organization). */
  readonly participantKinds?: ReadonlyMap<string, string>;
};

const DEFAULT_PARTICIPANT_KINDS = new Set(['person', 'organization']);

function pairKey(entityA: string, entityB: string, eventId: string): string {
  const [left, right] = entityA < entityB ? [entityA, entityB] : [entityB, entityA];
  return `${left}|${right}|${eventId}`;
}

function isCoParticipationParticipant(
  participantId: string,
  kindsById: ReadonlyMap<string, string> | undefined,
): boolean {
  if (!kindsById) return true;
  const kind = kindsById.get(participantId);
  return kind !== undefined && DEFAULT_PARTICIPANT_KINDS.has(kind);
}

/**
 * Build unordered co-participation links from event participation rows.
 * Each link records both endpoints' roles at the shared event.
 */
export function buildCoParticipationLinks(
  participations: readonly EventParticipationRow[],
  options: BuildCoParticipationLinksOptions = {},
): readonly CoParticipationLink[] {
  const kindsById = options.participantKinds;
  const byEvent = new Map<string, Map<string, Set<string>>>();

  for (const row of participations) {
    if (!isCoParticipationParticipant(row.participantId, kindsById)) continue;
    let participants = byEvent.get(row.eventId);
    if (!participants) {
      participants = new Map();
      byEvent.set(row.eventId, participants);
    }
    let roles = participants.get(row.participantId);
    if (!roles) {
      roles = new Set();
      participants.set(row.participantId, roles);
    }
    roles.add(row.role);
  }

  const links = new Map<string, CoParticipationLink>();

  for (const [eventId, participants] of byEvent) {
    const ids = [...participants.keys()].sort();
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const entityAId = ids[i] as string;
        const entityBId = ids[j] as string;
        const key = pairKey(entityAId, entityBId, eventId);
        if (links.has(key)) continue;
        links.set(key, {
          entityAId,
          entityBId,
          eventId,
          rolesA: [...(participants.get(entityAId) ?? [])].sort(),
          rolesB: [...(participants.get(entityBId) ?? [])].sort(),
        });
      }
    }
  }

  return [...links.values()].sort(
    (a, b) =>
      a.eventId.localeCompare(b.eventId) ||
      a.entityAId.localeCompare(b.entityAId) ||
      a.entityBId.localeCompare(b.entityBId),
  );
}

/**
 * For one entity, list co-participants with the connecting event (for "through <event>" UI).
 */
export function coParticipationNeighborsForEntity(
  entityId: string,
  participations: readonly EventParticipationRow[],
  eventNamesById: ReadonlyMap<string, string>,
  options: BuildCoParticipationLinksOptions = {},
): readonly CoParticipationNeighbor[] {
  const links = buildCoParticipationLinks(participations, options);
  const neighbors: CoParticipationNeighbor[] = [];

  for (const link of links) {
    if (link.entityAId !== entityId && link.entityBId !== entityId) continue;
    const isA = link.entityAId === entityId;
    const neighborId = isA ? link.entityBId : link.entityAId;
    const entityRole = (isA ? link.rolesA : link.rolesB)[0] ?? 'participant';
    const neighborRole = (isA ? link.rolesB : link.rolesA)[0] ?? 'participant';
    const eventDisplayName = eventNamesById.get(link.eventId)?.trim() ?? link.eventId;
    neighbors.push({
      neighborId,
      eventId: link.eventId,
      eventDisplayName,
      entityRole,
      neighborRole,
    });
  }

  return neighbors.sort(
    (a, b) =>
      a.eventDisplayName.localeCompare(b.eventDisplayName) ||
      a.neighborId.localeCompare(b.neighborId),
  );
}

/** User-facing copy for a co-participation neighbor link. */
export function formatCoParticipationSummary(
  neighborDisplayName: string,
  eventDisplayName: string,
): string {
  const event = eventDisplayName.trim();
  const neighbor = neighborDisplayName.trim();
  if (event.length === 0) {
    return `Connected through a shared event with ${neighbor}.`;
  }
  return `Connected through ${event} with ${neighbor}.`;
}
