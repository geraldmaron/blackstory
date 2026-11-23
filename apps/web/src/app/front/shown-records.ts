/**
 * The home page's records: the one the opening leads with, and one per decade for the walk.
 *
 * Every record shown here is shown the way the record page shows it: its name, its own sourced
 * photograph as a plate (when it has one), and one claim in the claims block's language (the
 * statement, its source, its grade). The map and the plate always show the same record.
 *
 * Quiet records never come up: a sensitivity flag, a trauma content note, or a massacre or
 * plantation tone (`isQuietRecord`, the record page's own rule), on top of the walk's existing
 * refusal of violence-adjacent records (`eligibleStoryRecords`).
 */
import type { ExploreMapFeature } from '../../lib/map-experience/build-explore-map-source';
import { earliestDecadeFor } from '../../lib/map-experience/decade-transition';
import { eligibleStoryRecords } from '../../lib/story/pick-story-record';
import { placeLabelFor } from '../../lib/map-experience/place-label';
import type { RecordsFacet } from '../../lib/records/build-records-index';
import { hereLocality } from './locality';
import { buildEvidenceCards } from '../../lib/evidence';
import type { PublicEntityPrimaryImageView, PublicEntityView } from '../../data/public-seed';
import type { EvidenceItem } from '../../components/evidence/EvidenceList';
import { isRenderedImage } from '../../components/entity/rendered-image';
import {
  endsAsSentence,
  isQuietRecord,
  isSourceExcerpt,
  publisherOf,
  statementFor,
  toEvidenceClaimInputs,
  withoutSummaryEchoClaims,
} from '../entity/[id]/adapters';

/** A claim long enough to need a "read more" does not belong in a column beside the map. */
const MAX_STATEMENT_CHARS = 240;

const LEVEL_RANK = { high: 0, medium: 1, low: 2 } as const;

/** One record as the home page shows it. */
export type ShownRecord = {
  readonly entityId: string;
  readonly name: string;
  /** Where it is, without repeating the name (`hereLocality`), or nothing. */
  readonly locality: string | null;
  readonly href: string;
  readonly lngLat: readonly [number, number];
  readonly precision: string;
  readonly decade: number;
  readonly plate?: PublicEntityPrimaryImageView;
  /** A portrait: the plate holds the top of the frame, where the face is. */
  readonly person: boolean;
  /** The record's kind (place, person, school...), so a pick can vary what it shows. */
  readonly kind?: string;
  /** The one claim, already in the evidence list's shape (a string statement, a linked source). */
  readonly claim: EvidenceItem;
  /** The record's state (postal code), for the tour's spread across regions. */
  readonly statePostal?: string;
  /**
   * True only when the record is safe to put a camera on: not a person, or a person the archive
   * marks deceased; and carrying no sensitivity class. Absent means not safe (the tour's gate).
   */
  readonly cameraSafe?: boolean;
};

/**
 * The record's strongest short claim with a linked source, as the record page would print it.
 * Disputed and retracted claims stay on the record page, where their note sits beside them.
 */
export function claimFor(entity: PublicEntityView): EvidenceItem | null {
  const shown = withoutSummaryEchoClaims(entity.claims, entity.summary);
  const cards = buildEvidenceCards(toEvidenceClaimInputs(shown));
  const ranked = cards
    .map((card, index) => ({ card, claim: shown[index]! }))
    .filter(({ card }) => card.citation.href && !card.dispute?.hasDispute && !card.retraction)
    .map((entry) => ({
      ...entry,
      statement: statementFor(entry.card.predicate, entry.card.object),
    }))
    // A sentence that stands alone: a fragment ("on the National Register ...", "1976,
    // designated ...") reads as a glitch when it is the only claim on the screen.
    // A short labeled value ("Founded year: 1865") is whole. Anything longer has to open like a
    // sentence in its own words: a label in front ("Listing: on the National Register ...") does
    // not make a fragment whole.
    .filter(
      ({ card, statement }) =>
        (isLabeledValue(statement, card.object) || /^[\p{Lu}"“]/u.test(card.object.trim())) &&
        statement.length <= MAX_STATEMENT_CHARS &&
        standsAlone(statement),
    )
    // An excerpt cut off mid-sentence ("Known as a civil rights leader, Dr.") stays on the record
    // page, beside the rest of its source. Most excerpts only lack their final period; those pass.
    .filter(({ card }) => !isSourceExcerpt(card.predicate) || !isCutOff(card.object))
    // A sentence lifted from a source can be about anything in that source: Hawikuh's nomination
    // opens on Narvaez landing in Florida. Shown alone under the record's name it reads as a fact
    // about the record, so an excerpt has to name it. A record's own facts ("Founded year: 1865")
    // have the record as their subject and pass.
    .filter(
      ({ card, statement }) =>
        !isSourceExcerpt(card.predicate) || namesSubject(statement, entity.displayName),
    )
    // A whole sentence says more than a label ("Significant for: Black heritage"); one that names
    // the record says more than one about its neighborhood; then the grade.
    .sort(
      (a, b) =>
        Number(endsAsSentence(b.statement)) - Number(endsAsSentence(a.statement)) ||
        Number(namesSubject(b.statement, entity.displayName)) -
          Number(namesSubject(a.statement, entity.displayName)) ||
        LEVEL_RANK[a.card.confidenceLevel] - LEVEL_RANK[b.card.confidenceLevel],
    );
  const best = ranked[0];
  if (!best) return null;
  const publisher = publisherOf(best.claim);
  return {
    id: 'door-claim',
    statement: best.statement,
    source: {
      ...(publisher ? { publisher } : {}),
      title: best.card.citation.label || publisher,
      href: best.card.citation.href!,
    },
    level: best.card.confidenceLevel,
  };
}

/** Every record the home page may show, with its claim, plate and decade. */
export function shownRecords(
  features: readonly ExploreMapFeature[],
  entities: readonly PublicEntityView[],
): readonly ShownRecord[] {
  const byId = new Map(entities.map((entity) => [entity.id, entity] as const));
  const records: ShownRecord[] = [];
  for (const feature of eligibleStoryRecords(features)) {
    const entity = byId.get(feature.properties.entityId);
    if (!entity || isQuietRecord(entity)) continue;
    const decade = earliestDecadeFor(feature);
    if (decade === null) continue;
    const claim = claimFor(entity);
    if (!claim) continue;
    const [lng, lat] = feature.geometry.coordinates;
    const name = feature.properties.displayName;
    records.push({
      entityId: entity.id,
      name,
      locality: hereLocality(name, placeLabelFor(feature)),
      href: feature.properties.href || `/entity/${encodeURIComponent(entity.id)}`,
      lngLat: [lng!, lat!],
      precision: feature.properties.precision,
      decade,
      person: String(entity.kind) === 'person',
      kind: String(entity.kind),
      ...(feature.properties.statePostalCode
        ? { statePostal: feature.properties.statePostalCode }
        : {}),
      cameraSafe: isCameraSafe(entity),
      ...(entity.primaryImage && !isRenderedImage(entity.primaryImage)
        ? { plate: entity.primaryImage }
        : {}),
      claim,
    });
  }
  return records;
}

/**
 * The living-person gate for any surface that flies a camera to a record. A person record needs a
 * recorded death (`livingStatus: 'deceased'`; unknown is treated as living, as the redaction policy
 * does), and any sensitivity class (a living residence, a restricted site, a withheld place) keeps
 * the record off.
 */
export function isCameraSafe(entity: PublicEntityView): boolean {
  if (entity.sensitivityClass) return false;
  return String(entity.kind) !== 'person' || entity.livingStatus === 'deceased';
}

/**
 * Most claims are sentences lifted from a source. One that opens on the sentence before it ("It
 * was built in 1882.", "Ultimately this led to a law ...") says nothing as the only claim shown.
 * shortcut: reads the opening words only, so a dangling "his" mid-sentence still passes; a real
 * fix is a claim written to stand alone at ingest.
 */
export function standsAlone(statement: string): boolean {
  return !/^(?:(?:ultimately|however|thus|therefore|also|then|and|but),?\s|(?:this|these|those|it|its|he|she|they|his|her|their|such)\b)/i.test(
    statement.trim(),
  );
}

/** A labeled claim whose object is a name, a date or a few words. */
function isLabeledValue(statement: string, object: string): boolean {
  return statement !== object.trim() && object.trim().split(/\s+/).length <= 8;
}

/** Ends on a comma or on a title with no name after it: the sentence was cut, not finished. */
export function isCutOff(text: string): boolean {
  return /(?:[,;:]|\b(?:Dr|Mr|Mrs|Ms|Rev|St|Gen|Col|Capt|Lt|Sgt|Hon|Prof|No)\.)$/.test(text.trim());
}

/** Does the statement use a word of the record's own name (four letters or more)? */
export function namesSubject(statement: string, name: string): boolean {
  const text = statement.toLowerCase();
  return (name.toLowerCase().match(/\p{L}{4,}/gu) ?? []).some((word) => text.includes(word));
}

export type DecadeBar = { readonly year: number; readonly label: string; readonly count: number };

/**
 * The decade axis on a true time scale: every decade from the first documented to the last, in
 * order, so a century with no records takes a century's width. Empty decades count 0. Only real
 * decades ("1770s") are read from the register's Era facet.
 */
export function decadeBars(facets: readonly RecordsFacet[]): readonly DecadeBar[] {
  const counts = new Map<number, number>();
  for (const facet of facets) {
    const year = Number.parseInt(facet.id, 10);
    if (Number.isFinite(year)) counts.set(year, (counts.get(year) ?? 0) + facet.count);
  }
  if (counts.size === 0) return [];
  const first = Math.min(...counts.keys());
  const last = Math.max(...counts.keys());
  const bars: DecadeBar[] = [];
  for (let year = first; year <= last; year += 10) {
    bars.push({ year, label: `${year}s`, count: counts.get(year) ?? 0 });
  }
  return bars;
}
