/**
 * First-paint surface rules: the featured place stays the page, and every linked room
 * is argued from that record. National catalogs are not the door. Internal ids,
 * rights-clearance captions, and "from their record" never print here.
 */
import type { PublicEntityView, RelatedNeighborView } from '../data/public-seed';
import type { StoryCitation } from '../lib/release/build-cites-edge';
import { isInternalRecordLabel } from './home-first-paint';

const SHOP_LOCATION = /pin|precision|schematic|affordance|rights-cleared|\brecord\b/i;

const PLACE_RELATIONS = new Set(['located_at', 'located_in', 'occurred_at', 'part_of']);

const LAW_KINDS = new Set(['law', 'case']);

export const DOOR_ROOM_IDS = ['stories', 'law', 'data', 'memorial'] as const;
export type DoorRoomId = (typeof DOOR_ROOM_IDS)[number];

export type DoorRoom = {
  readonly id: DoorRoomId;
  readonly label: string;
  readonly href: string;
};

export function containsInternalId(value: string | undefined): boolean {
  if (value === undefined) return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (isInternalRecordLabel(trimmed)) return true;
  return /\b(?:ent|disc|art|pkg|rec|src|claim)_[a-z0-9_]+/i.test(trimmed);
}

export function humanPlaceLine(entity: PublicEntityView): string | undefined {
  const location = entity.locationLabel.trim();
  const jurisdiction = entity.jurisdictionLabel.trim();
  if (
    location.length > 0 &&
    !containsInternalId(location) &&
    !SHOP_LOCATION.test(location)
  ) {
    return location;
  }
  if (
    jurisdiction.length > 0 &&
    !containsInternalId(jurisdiction) &&
    !SHOP_LOCATION.test(jurisdiction)
  ) {
    return jurisdiction;
  }
  return undefined;
}

function humanizeRelation(value: string): string {
  return value
    .split('_')
    .filter((word) => word.length > 0)
    .join(' ')
    .toLowerCase();
}

/**
 * Place line from this entity's location, or a human relation token.
 * Never "from their record". Empty when nothing honest can be said.
 */
export function firstPaintRelation(
  neighbor: RelatedNeighborView,
  entity: PublicEntityView,
): string | undefined {
  if (neighbor.viaEvent) {
    const via = neighbor.viaEvent.displayName.trim();
    if (via.length > 0 && !containsInternalId(via)) {
      return `both appear in ${via}`;
    }
  }
  if (PLACE_RELATIONS.has(neighbor.relationType)) {
    return humanPlaceLine(entity);
  }
  const phrase = humanizeRelation(neighbor.relationType);
  if (phrase.length === 0 || containsInternalId(phrase) || SHOP_LOCATION.test(phrase)) {
    return undefined;
  }
  return phrase;
}

function sanitizeTimelineBody(body: string): string {
  return body
    .replace(/\s*Basis:[^.]*\.?/gi, '')
    .replace(/\s*ongoing as of this release\.?/gi, '')
    .replace(/\b(?:ent|disc|art|pkg|rec|src|claim)_[a-z0-9_]+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function firstPaintTimeline(
  items: PublicEntityView['timeline'],
): PublicEntityView['timeline'] {
  return items.flatMap((item) => {
    const title = item.title.trim();
    if (title.length === 0 || containsInternalId(title)) return [];
    const body = sanitizeTimelineBody(item.body);
    if (containsInternalId(body)) return [];
    return [{ ...item, title, body }];
  });
}

function publishableNeighbors(
  neighbors: readonly RelatedNeighborView[] | undefined,
): readonly RelatedNeighborView[] {
  return (neighbors ?? []).filter(
    (neighbor) =>
      neighbor.displayName.trim().length > 0 && !containsInternalId(neighbor.displayName),
  );
}

export function firstPaintRecord(entity: PublicEntityView): PublicEntityView {
  const relatedNeighbors = publishableNeighbors(entity.relatedNeighbors);
  const continueLearning = publishableNeighbors(entity.continueLearning);
  return {
    ...entity,
    timeline: firstPaintTimeline(entity.timeline),
    ...(relatedNeighbors.length > 0 ? { relatedNeighbors } : { relatedNeighbors: [] }),
    ...(continueLearning.length > 0 ? { continueLearning } : { continueLearning: [] }),
  };
}

function neighborsOf(
  entity: PublicEntityView,
  kinds: ReadonlySet<string>,
): readonly RelatedNeighborView[] {
  return publishableNeighbors([
    ...(entity.relatedNeighbors ?? []),
    ...(entity.continueLearning ?? []),
  ]).filter((neighbor) => kinds.has(String(neighbor.kind)));
}

export function storiesRoomMaterial(
  entity: PublicEntityView,
  citing: readonly StoryCitation[],
): boolean {
  return (
    entity.historicalContext.trim().length > 0 ||
    Boolean(entity.extendedNarrative?.trim()) ||
    citing.some((story) => !containsInternalId(story.title))
  );
}

export function selectDoorRooms(
  entity: PublicEntityView,
  citing: readonly StoryCitation[] = [],
): readonly DoorRoom[] {
  const rooms: DoorRoom[] = [];
  if (storiesRoomMaterial(entity, citing)) {
    rooms.push({ id: 'stories', label: 'Stories', href: '#stories' });
  }
  if (neighborsOf(entity, LAW_KINDS).length > 0) {
    rooms.push({ id: 'law', label: 'Law', href: '#law' });
  }
  // Data stays unlinked until this record has place-specific series. National
  // packets (wealth gap, census edition) are not Greenwood's numbers.
  if (neighborsOf(entity, new Set(['person'])).length > 0) {
    rooms.push({ id: 'memorial', label: 'Memorial', href: '#memorial' });
  }
  return rooms;
}

export function publishableCitingStories(
  citing: readonly StoryCitation[],
): readonly StoryCitation[] {
  return citing.filter((story) => story.title.trim().length > 0 && !containsInternalId(story.title));
}
